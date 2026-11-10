import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const EASE = 'expo.out';

/** Slide-up line masks for headings written as <span class="line"><span>…</span></span>. */
export function revealLines(root, { start = 'top 82%', stagger = 0.09, duration = 1.15 } = {}) {
  if (reduced()) return;
  const inner = root.querySelectorAll('.line > span');
  if (!inner.length) return;
  gsap.set(inner, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: root, start, once: true,
    onEnter: () => gsap.to(inner, { yPercent: 0, duration, ease: EASE, stagger }),
  });
}

/** Fade + rise for any element marked [data-rise], staggered per parent group. */
export function revealRise(root, { start = 'top 88%' } = {}) {
  if (reduced()) return;
  const els = [...root.querySelectorAll('[data-rise]')];
  els.forEach((el) => {
    gsap.set(el, { opacity: 0, y: 28 });
    ScrollTrigger.create({
      trigger: el, start, once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: EASE, delay: Number(el.dataset.rise) || 0 }),
    });
  });
}
