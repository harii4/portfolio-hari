/**
 * The one scroll controller for the whole site.
 *
 * Lenis smooths wheel/trackpad scrolling on top of the browser's own scroll (position: sticky, ScrollTrigger pins,
 * anchors and accessibility keep working). It is wired the way the Lenis docs recommend for GSAP:
 *   lenis.on('scroll', ScrollTrigger.update)   – ScrollTrigger reads the same position Lenis just set
 *   gsap.ticker.add(time => lenis.raf(...))    – ONE requestAnimationFrame loop for everything (GSAP's)
 *   gsap.ticker.lagSmoothing(0)
 *
 * Lenis exists only for mouse / trackpad devices. On phones and tablets (coarse primary pointer) there is NO Lenis at all:
 * the browser's own touch scrolling is the best scrolling there is (instant response, native momentum, native rubber-banding,
 * compositor-thread scroll), and adding a JS layer on top of it can only make it heavier. Everything scroll-linked is driven by
 * ScrollTrigger reading the native position directly. Nothing is created for prefers-reduced-motion either.
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis = null;
let tick = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** a touch-first device: the primary pointer is coarse and there is no hover */
export const isTouchFirst = () => matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export function initScroll() {
  if (lenis || reduced() || isTouchFirst()) return lenis;
  lenis = new Lenis({
    autoRaf: false,        // GSAP's ticker drives it, below
    smoothWheel: true,
    lerp: 0.12,            // a little snappier than the 0.1 default: smooth, but never behind your hand
    syncTouch: false,      // (touch devices never get here; kept for hybrid laptops)
    anchors: false,        // anchors are handled in layout/SiteNav.js so they can focus the target section
  });
  lenis.on('scroll', ScrollTrigger.update);
  tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export const getLenis = () => lenis;

/** Scroll to a pixel position. Smooth through Lenis; an instant jump for reduced motion. */
export function scrollToY(y, { duration, immediate = false, easing = easeInOutCubic, onComplete } = {}) {
  if (!lenis || immediate) {
    /* no Lenis (touch devices): the browser's own smooth scrolling; instant for reduced motion */
    scrollTo({ top: y, behavior: immediate || reduced() ? 'auto' : 'smooth' });
    onComplete && onComplete();
    return;
  }
  lenis.scrollTo(y, { duration, easing, onComplete });
}

/** Pause / resume smoothing (used while a modal is open). */
export function lockScroll(locked) {
  if (lenis) { if (locked) lenis.stop(); else lenis.start(); }
  /* the native lock: the loader and modals (Lenis only covers wheel/trackpad) */
  document.documentElement.classList.toggle('scroll-locked', locked);
}

export function destroyScroll() {
  if (tick) gsap.ticker.remove(tick);
  tick = null;
  if (lenis) lenis.destroy();
  lenis = null;
}
