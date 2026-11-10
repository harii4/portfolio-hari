import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollToY, lockScroll } from '../lib/scroll.js';
import { navigation, sections } from '../data/navigation.js';
import { personalInfo } from '../data/personalInfo.js';

gsap.registerPlugin(ScrollTrigger);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function navMarkup() {
  const links = navigation.map((n) => `<a href="${n.href}">${n.label}</a>`).join('');
  const big = navigation.map((n, i) => `<a href="${n.href}"><span class="menu__index">0${i + 1}</span>${n.label}</a>`).join('');
  return `
  <header class="site-nav" data-site-nav aria-label="Site">
    <a class="site-nav__brand" href="#${sections.hero}" aria-label="${personalInfo.name}, back to top">${personalInfo.name}</a>
    <nav class="site-nav__links" aria-label="Primary">${links}</nav>
    <button type="button" class="site-nav__toggle" data-menu-toggle aria-expanded="false" aria-controls="site-menu"><span data-menu-label>Menu</span></button>
  </header>
  <div class="menu" id="site-menu" data-menu hidden>
    <nav class="menu__nav" aria-label="Mobile">${big}</nav>
    <p class="menu__foot">${personalInfo.availability}</p>
  </div>`;
}

/** Smooth, no-reload scrolling for every in-page anchor (the hero's own nav included). */
export function scrollToSection(hash) {
  const id = hash.replace('#', '');
  const target = id === sections.hero ? null : document.getElementById(id);
  if (id !== sections.hero && !target) return false;
  const y = target ? target.getBoundingClientRect().top + scrollY : 0;
  const distance = Math.abs(y - scrollY);
  scrollToY(y, { immediate: reduced(), duration: Math.min(2.6, Math.max(1, distance / 2400)) });
  if (target) {
    /* keyboard users land on the section */
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    setTimeout(() => target.focus({ preventScroll: true }), reduced() ? 0 : 900);
  }
  history.replaceState(null, '', `#${id}`);
  return true;
}

export function initNav(heroEl) {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const label = document.querySelector('[data-menu-label]');
  let open = false;
  const setMenu = (next) => {
    if (next === open) return;
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Close' : 'Menu';
    document.documentElement.classList.toggle('menu-open', open);
    lockScroll(open);
    if (open) {
      menu.hidden = false;
      gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: reduced() ? 0 : 0.45, ease: 'power2.out' });
      gsap.fromTo(menu.querySelectorAll('.menu__nav a'), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: reduced() ? 0 : 0.8, ease: 'expo.out', stagger: 0.06, delay: reduced() ? 0 : 0.08 });
      menu.querySelector('a').focus({ preventScroll: true });
    } else {
      gsap.to(menu, { opacity: 0, duration: reduced() ? 0 : 0.3, ease: 'power2.in', onComplete: () => { menu.hidden = true; } });
      toggle.focus({ preventScroll: true });
    }
  };
  const onToggle = () => setMenu(!open);
  const onKey = (e) => { if (e.key === 'Escape' && open) setMenu(false); };
  const onMenuClick = (e) => { if (e.target.closest('a')) setMenu(false); };
  /* a rotated phone / resized window leaves no stranded overlay */
  const wide = matchMedia('(min-width: 701px)');
  const onWide = (e) => { if (e.matches) setMenu(false); };
  const onAnchor = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    if (scrollToSection(hash)) e.preventDefault();
  };
  toggle.addEventListener('click', onToggle);
  document.addEventListener('keydown', onKey);
  menu.addEventListener('click', onMenuClick);
  wide.addEventListener('change', onWide);
  document.addEventListener('click', onAnchor);
  const triggers = [];

  const nav = document.querySelector('[data-site-nav]');
  /* the hero has its own nav; this one takes over once the hero has gone */
  const show = (on) => {
    nav.classList.toggle('is-on', on);
    nav.toggleAttribute('inert', !on);
  };
  show(false);
  triggers.push(ScrollTrigger.create({
    trigger: heroEl,
    start: 'bottom 60%',
    end: 'max',
    onEnter: () => show(true),
    onLeaveBack: () => show(false),
  }));
  /* over the full-bleed showcase video the blended nav is unreadable, and the section has its own CTA */
  const showcase = document.getElementById(sections.showcase);
  if (showcase) {
    triggers.push(ScrollTrigger.create({
      trigger: showcase,
      start: 'top 35%',
      end: 'max',
      onEnter: () => { nav.classList.add('is-away'); nav.toggleAttribute('inert', true); },
      onLeaveBack: () => { nav.classList.remove('is-away'); nav.toggleAttribute('inert', !nav.classList.contains('is-on')); },
    }));
  }

  return () => {
    triggers.forEach((t) => t.kill());
    toggle.removeEventListener('click', onToggle);
    document.removeEventListener('keydown', onKey);
    menu.removeEventListener('click', onMenuClick);
    wide.removeEventListener('change', onWide);
    document.removeEventListener('click', onAnchor);
    gsap.killTweensOf(menu);
  };
}
