import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { personalInfo } from '../data/personalInfo.js';
import { sections } from '../data/navigation.js';
import { revealLines, revealRise } from '../lib/reveal.js';

const portrait = `${import.meta.env.BASE_URL}images/about/hari-krishna-portrait.webp`;

export function aboutMarkup() {
  const p = personalInfo;
  const rows = [
    ['Tools & craft', p.tools],
    ['Niches', p.niches],
  ]
    .map(([k, v]) => `<div class="facts__row" data-rise><dt>${k}</dt><dd>${v.join('<span aria-hidden="true"> / </span>')}</dd></div>`)
    .join('');
  const [first, ...rest] = p.name.split(' ');
  return `
  <section class="section section--dark about" id="${sections.about}" aria-labelledby="about-title">
    <div class="wrap about__grid">
      <figure class="about__photo" data-photo>
        <img src="${portrait}" width="1119" height="1405" alt="Portrait of ${p.name}" loading="lazy" decoding="async" />
      </figure>

      <div class="about__copy">
        <p class="kicker" data-rise>About</p>
        <h2 class="display about__name" id="about-title"><span class="line"><span>${first.toUpperCase()}</span></span><span class="line"><span>${rest.join(' ').toUpperCase()}</span></span></h2>
        <p class="about__role" data-rise>${p.role} — ${p.specialty}</p>
        <p class="about__bio" data-rise>${p.bio}</p>
        <dl class="facts">${rows}</dl>
        <a class="textlink" href="#${sections.contact}" data-rise>Work with me <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </section>`;
}

export function initAbout() {
  const root = document.getElementById(sections.about);
  revealLines(root.querySelector('.display'));
  revealRise(root);
  const photo = root.querySelector('[data-photo]');
  const img = photo.querySelector('img');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(photo, { clipPath: 'inset(12% 0% 0% 0%)', opacity: 0.0 });
    ScrollTrigger.create({
      trigger: photo, start: 'top 85%', once: true,
      onEnter: () => gsap.to(photo, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 1.3, ease: 'expo.out' }),
    });
    /* a slow drift inside the frame: the picture is oversized by 4% so it never shows an edge */
    gsap.set(img, { scale: 1.04 });
    gsap.fromTo(img, { yPercent: -1.5 }, {
      yPercent: 1.5, ease: 'none',
      scrollTrigger: { trigger: photo, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
  }
}
