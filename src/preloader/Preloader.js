import { gsap } from 'gsap';
import { TYPE } from '../core/config.js';
import { computeLayout } from '../core/layout.js';
import { measureTitle } from '../core/typeMetrics.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * The first-visit preloader.
 *
 * One idea, so it reads as part of the hero rather than a separate screen: the loader is the hero's own word.
 * PORTFOLIO is drawn in white on black at EXACTLY the position, size and kerning of the hero's WebGL word (same layout and
 * metrics code), rising from its baseline with the hero's own stagger. When the essentials are ready, the black panel lifts
 * away and the hero's black word rises underneath at the very same coordinates: one continuous move, white-on-black becoming
 * black-on-white across a rising horizon.
 *
 * Nothing here pretends to measure progress: no percentage, no bar. The entrance is a fixed, short piece of choreography;
 * the exit waits for what is genuinely needed (see main.js) and is never held longer than that.
 *
 * The markup and first-paint CSS live in index.html, so the very first frame the browser paints is already the loader.
 */
export class Preloader {
  constructor() {
    this.root = document.getElementById('preloader');
    this.canvas = this.root.querySelector('[data-preloader-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.labels = [...this.root.querySelectorAll('[data-preloader-label]')];
    this.rise = { v: reduced() ? 1 : 0 };
    this.done = false;
    this.entered = null;
    this.onResize = () => { if (!this.done) { this.measure(); this.draw(); } };
  }

  /** Waits for the display font, measures, and plays the entrance. Resolves when the entrance has finished. */
  start() {
    const ready = Promise.race([
      document.fonts.load(`400 120px ${TYPE.family}`).then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 2500)),   // a missing font must never trap the visitor on a black screen
    ]).catch(() => {});

    this.entered = ready.then(() => new Promise((resolve) => {
      if (this.done) return resolve();
      this.measure();
      this.draw();
      window.addEventListener('resize', this.onResize);
      if (reduced()) {
        gsap.to(this.labels, { opacity: 1, duration: 0.3 });
        return resolve();
      }
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(this.labels, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, 0)
        /* the same linear sweep + per-letter ease the hero uses for its own word */
        .to(this.rise, { v: 1, duration: 1.25, ease: 'none', onUpdate: () => this.draw() }, 0.1);
    }));
    return this.entered;
  }

  measure() {
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.dpr = dpr;
    this.layout = computeLayout(W, H);
    this.metrics = measureTitle({
      text: TYPE.text,
      family: TYPE.family,
      targetWidth: this.layout.type.width,
      tracking: TYPE.tracking,
    });
  }

  draw() {
    const { ctx, canvas, layout, metrics: m } = this;
    if (!layout) return;
    const W = canvas.width / this.dpr;
    const H = canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `400 ${m.fontSize}px ${TYPE.family}`;

    const left = layout.type.cx - layout.type.width / 2 + m.originX;
    const baseline = layout.type.cy + m.capHeight / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, baseline + 1);     // letters rise out of a line at the baseline, like the hero's
    ctx.clip();
    m.letters.forEach((ch, i) => {
      const x = left + m.origins[i];
      /* the hero shader's stagger and ease, mirrored: p = clamp(v·1.7 − x·0.7), e = 1 − (1 − p)⁴ */
      const p = clamp01(this.rise.v * 1.7 - (x / W) * 0.7);
      const e = 1 - (1 - p) ** 4;
      ctx.fillText(ch, x, baseline + (1 - e) * m.capHeight * 1.3);
    });
    ctx.restore();
  }

  /**
   * Lifts the panel. `onReveal` fires while the edge is sweeping past the word, so the hero's own entrance starts inside the
   * transition instead of after it. Resolves when the preloader is gone.
   */
  exit(onReveal) {
    if (this.done) return Promise.resolve();
    this.done = true;
    window.removeEventListener('resize', this.onResize);
    this.root.style.pointerEvents = 'none';
    this.root.setAttribute('aria-busy', 'false');

    return new Promise((resolve) => {
      const finish = () => {
        this.root.hidden = true;
        this.root.remove();
        resolve();
      };
      if (reduced()) {
        onReveal && onReveal();
        gsap.to(this.root, { opacity: 0, duration: 0.45, ease: 'power1.out', onComplete: finish });
        return;
      }
      const tl = gsap.timeline({ onComplete: finish });
      tl.to(this.labels, { opacity: 0, y: -10, duration: 0.45, ease: 'power2.in', stagger: 0.04 }, 0)
        .fromTo(this.root, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, 0.05)
        .add(() => onReveal && onReveal(), 0.5);
    });
  }
}
