import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FRAMES, SCROLL, TYPE } from '../core/config.js';
import { computeLayout } from '../core/layout.js';
import { measureTitle } from '../core/typeMetrics.js';
import { FrameStore } from '../core/frameLoader.js';
import { PortraitCanvas } from './PortraitCanvas.js';
import { MercuryType } from '../gl/MercuryType.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Orchestrates the hero: preload → build layers → intro → pinned scroll scrub.
 * Layers never talk to each other directly; they all consume the same layout.
 */
export class Hero {
  constructor() {
    this.el = document.getElementById('hero');
    this.track = document.getElementById('hero-track');   // the CSS-sticky pin track around the hero
    this.title = document.getElementById('title');
    this.cue = document.getElementById('cue');
    this.scrub = { frame: 0 };
    this.lastSize = '';
  }

  /**
   * @param {{ deferIntro?: boolean }} opts  deferIntro: build everything, but wait for playIntro() (the preloader calls it
   *        as its panel lifts). The hero stays hidden and its intro runs exactly once.
   */
  async init({ deferIntro = false } = {}) {
    // Lighter memory tier on small / low-memory devices: every 2nd frame still scrubs smoothly.
    const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || window.innerWidth < 700;
    this.store = new FrameStore({
      count: FRAMES.count,
      url: FRAMES.url,
      stride: lowEnd ? 2 : 1,
    });
    const firstFrame = this.store.start();

    await Promise.all([firstFrame, this.loadFont()]);

    this.portrait = new PortraitCanvas(document.getElementById('portrait-canvas'), this.store);
    this.type = MercuryType.create(document.getElementById('type-canvas'), {
      interactive: !reducedMotion(),
      onLost: () => this.useFallback(),
    });
    if (!this.type) this.useFallback();

    this.layout();
    this.bindInput();
    this.bindScroll();
    this.bindResize();

    /* the one GSAP ticker drives the mercury (and Lenis, see lib/scroll.js): no extra animation-frame loop */
    this.tickFn = (_, delta) => this.type && this.type.tick(delta);
    gsap.ticker.add(this.tickFn);

    /* no WebGL work for a hero that is off screen: the liquid sim must not run while the visitor is in Works */
    this.io = new IntersectionObserver(([entry]) => this.type && this.type.setPaused(!entry.isIntersecting));
    this.io.observe(this.el);

    this.store.done.then(() => this.portrait.render());
    if (!deferIntro) this.playIntro();
  }

  async loadFont() {
    try {
      await Promise.all([document.fonts.load(`400 200px ${TYPE.family}`), document.fonts.ready]);
    } catch { /* system fallback is acceptable */ }
  }

  /* ───────────────────────── layout ───────────────────────── */

  layout() {
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    const key = `${W}x${H}x${window.devicePixelRatio}`;
    if (key === this.lastSize) return;
    this.lastSize = key;

    this.l = computeLayout(W, H);
    /* phones render at most 1.5× : indistinguishable on a small screen, far lighter for the GPU */
    const dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    this.portrait.resize(this.l.portrait, dpr);
    if (this.type && !this.fallback) this.type.resize(this.l, dpr);
    if (this.fallback) this.layoutFallback();
  }

  useFallback() {
    this.fallback = true;
    this.el.dataset.gl = 'off';
    document.getElementById('type-canvas').style.display = 'none';
    if (this.l) this.layoutFallback();
    if (this.title) gsap.set(this.title, { autoAlpha: 1 });
  }

  layoutFallback() {
    const m = measureTitle({ text: TYPE.text, family: TYPE.family, targetWidth: this.l.type.width, tracking: TYPE.tracking });
    Object.assign(this.title.style, {
      fontSize: `${m.fontSize}px`,
      letterSpacing: `${TYPE.tracking}em`,
      left: `${this.l.type.cx - this.l.type.width / 2 + m.originX}px`,
      top: `${this.l.type.cy - m.capHeight / 2 - m.fontSize * 0.04}px`,
    });
  }

  /* ───────────────────────── input ───────────────────────── */

  bindInput() {
    /* a finger is for scrolling: touch never stirs the liquid (it would only burn GPU while the page scrolls) */
    this.onMove = (e) => { if (e.pointerType !== 'touch') this.type && this.type.pointerMove(e.clientX, e.clientY); };
    this.onLeave = () => this.type && this.type.pointerLeave();
    window.addEventListener('pointermove', this.onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('blur', this.onLeave);
  }

  /* ───────────────────────── intro: one orchestrated moment ───────────────────────── */

  /** Idempotent: the intro plays once, whoever asks first. */
  playIntro() {
    if (this.introPlayed) return;
    this.introPlayed = true;
    this.el.dataset.state = 'ready';
    this.intro();
  }

  intro() {
    const portraitEl = this.portrait.canvas;
    if (reducedMotion()) {
      gsap.set(portraitEl, { opacity: 1 });
      this.type && this.type.setReveal(1);
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const r = { v: 0 };
    tl.to(portraitEl, { opacity: 1, duration: 1.1, ease: 'power2.out' }, 0.05)
      .fromTo(portraitEl, { yPercent: 2.5 }, { yPercent: 0, duration: 1.6 }, 0.05)
      .to(r, { v: 1, duration: 1.5, ease: 'none', onUpdate: () => this.type && this.type.setReveal(r.v) }, 0.25);
    if (this.fallback) tl.fromTo(this.title, { yPercent: 12, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2 }, 0.25);
  }

  /* ───────────────────────── scroll: sticky track + frame scrub ───────────────────────── */

  bindScroll() {
    ScrollTrigger.config({ ignoreMobileResize: true });
    const last = this.store.count - 1;

    /* the pinned distance lives in CSS (--hero-run, in viewport heights); only the phone/desktop choice is made here */
    this.runQuery = matchMedia('(max-width: 699px)');
    this.applyRun = () => this.track.style.setProperty('--hero-run', String(this.runQuery.matches ? SCROLL.mobileLengthPerViewport : SCROLL.lengthPerViewport));
    this.applyRun();
    this.runQuery.addEventListener('change', this.applyRun);

    /* No pin(): position: sticky keeps the hero on screen natively. ScrollTrigger just reports how far through the track we are,
       and the frame follows that exactly (scrub: true): Lenis (desktop) or the browser (touch) already did the smoothing. */
    this.scrollTween = gsap.to(this.scrub, {
      frame: last,
      ease: 'none',
      onUpdate: () => {
        this.portrait.setFrame(this.scrub.frame);
      },
      scrollTrigger: {
        trigger: this.track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          // the cue has done its job once the head starts turning
          this.cue.style.opacity = Math.max(0, 1 - self.progress * 14).toFixed(3);
        },
      },
    });
  }

  /* ───────────────────────── resize ───────────────────────── */

  bindResize() {
    let raf = 0;
    this.ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        this.layout();
        ScrollTrigger.refresh();
      });
    });
    this.ro.observe(this.el);
  }

  /* ───────────────────────── teardown ───────────────────────── */

  destroy() {
    this.tickFn && gsap.ticker.remove(this.tickFn);
    this.io && this.io.disconnect();
    this.ro && this.ro.disconnect();
    window.removeEventListener('pointermove', this.onMove);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('blur', this.onLeave);
    this.runQuery && this.runQuery.removeEventListener('change', this.applyRun);
    if (this.scrollTween) {
      this.scrollTween.scrollTrigger && this.scrollTween.scrollTrigger.kill();
      this.scrollTween.kill();
    }
    this.type && this.type.destroy && this.type.destroy();
  }
}
