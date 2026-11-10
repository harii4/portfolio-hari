import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { personalInfo } from '../data/personalInfo.js';
import { sections } from '../data/navigation.js';

const v = `${import.meta.env.BASE_URL}videos/final-showcase/`;

export function showcaseMarkup() {
  return `
  <section class="showcase" id="${sections.showcase}" aria-label="Final showcase">
    <div class="showcase__media" aria-hidden="true">
      <img class="showcase__poster" src="${v}poster.webp" alt="" width="1280" height="720" loading="lazy" decoding="async" />
      <video class="showcase__video" data-video muted loop playsinline preload="none" poster="${v}poster.webp" tabindex="-1"></video>
    </div>
    <div class="showcase__shade" aria-hidden="true"></div>
    <div class="showcase__content">
      <a class="cta" href="#${sections.contact}" data-cta>START A PROJECT <span class="cta__arrow" aria-hidden="true">→</span></a>
    </div>
    <p class="showcase__legal">© ${new Date().getFullYear()} ${personalInfo.name}. All rights reserved.</p>
  </section>`;
}

/** Efficient video: nothing is downloaded until the section is near; it plays only while visible; phones get a lighter file. */
export function initShowcase() {
  const root = document.getElementById(sections.showcase);
  const video = root.querySelector('[data-video]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reduced || saveData) { root.classList.add('is-still'); return () => {}; }   /* poster only */

  const small = matchMedia('(max-width: 800px)').matches;
  let attached = false;
  const attach = () => {
    if (attached) return;
    attached = true;
    /* MP4 (H.264) where the browser has it, WebM (VP9) otherwise */
    const h264 = video.canPlayType('video/mp4; codecs="avc1.640028"') !== '';
    const name = `${small ? 'showcase-mobile' : 'showcase-720'}.${h264 ? 'mp4' : 'webm'}`;
    video.src = `${v}${name}`;
    video.load();
  };
  const play = () => {
    const p = video.play();
    if (p && p.catch) p.catch(() => root.classList.add('is-still'));
  };
  video.addEventListener('playing', () => root.classList.add('is-playing'));
  video.addEventListener('error', () => root.classList.add('is-still'));

  const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { attach(); near.disconnect(); } }, { rootMargin: '150% 0px' });
  near.observe(root);
  const seen = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { attach(); play(); } else video.pause(); });
  }, { threshold: 0.15 });
  seen.observe(root);
  const onHidden = () => { if (document.hidden) video.pause(); };
  document.addEventListener('visibilitychange', onHidden);

  return () => {
    near.disconnect();
    seen.disconnect();
    document.removeEventListener('visibilitychange', onHidden);
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}
