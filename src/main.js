import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/inter-tight';
import './styles/main.css';
import './styles/sections.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Hero } from './hero/Hero.js';
import { Preloader } from './preloader/Preloader.js';
import { initScroll, destroyScroll, lockScroll } from './lib/scroll.js';
import { navMarkup, initNav } from './layout/SiteNav.js';
import { worksMarkup, initWorks } from './works/WorksSection.js';
import { testimonialsMarkup, initTestimonials } from './sections/Testimonials.js';
import { aboutMarkup, initAbout } from './sections/About.js';
import { contactMarkup, initContact } from './sections/Contact.js';
import { showcaseMarkup, initShowcase } from './sections/FinalShowcase.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* The page, in the visitor's order: Hero → Works → Testimonials → About → Contact → Final showcase.
   Markup is static and cheap; everything that animates is started later, in boot(). */
document.body.insertAdjacentHTML('afterbegin', navMarkup());
document.getElementById('site').innerHTML = [worksMarkup(), testimonialsMarkup(), aboutMarkup(), contactMarkup(), showcaseMarkup()].join('');

/* One scroll controller (Lenis on mouse devices, the browser's own scrolling on touch), created before any ScrollTrigger.
   The preloader owns the scroll until it has lifted. */
initScroll();
lockScroll(true);

const preloader = new Preloader();
preloader.start();

const hero = new Hero();
if (/[?&](debug|expose)/.test(location.search)) window.__hero = hero;   /* test hook: ?expose leaves the real scroll behaviour on */

const disposers = [];
function bootSections() {
  disposers.push(initNav(hero.track));
  disposers.push(initWorks());
  disposers.push(initTestimonials());
  disposers.push(initAbout());
  disposers.push(initContact());
  disposers.push(initShowcase());
  /* every trigger above is created after the hero's, so positions are right; refresh once fonts have settled */
  document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  /* Essentials only: the display font, the first portrait frame and the hero's renderers (all inside hero.init()).
     Everything else (the other 189 frames, Works images, the showcase video) loads quietly in the background.
     The cap means a failure can never trap a visitor behind the loader. */
  await Promise.race([
    hero.init({ deferIntro: true }).catch((err) => console.error('[hero] failed to start', err)),
    wait(10000),
  ]);
  bootSections();

  await preloader.entered;                                   // the entrance has had its moment
  await preloader.exit(() => {                               // the panel lifts; the hero's own entrance starts inside that move
    try { hero.playIntro(); } catch (err) { console.error('[hero] intro failed', err); }
  });
  document.documentElement.classList.remove('is-loading');
  lockScroll(false);
}
boot();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposers.forEach((d) => typeof d === 'function' && d());
    hero.destroy();
    ScrollTrigger.killAll();
    destroyScroll();
  });
}
