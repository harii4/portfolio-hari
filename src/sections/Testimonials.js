import { testimonial, proof } from '../data/testimonials.js';
import { sections } from '../data/navigation.js';
import { openPreview } from '../lib/Preview.js';
import { revealLines, revealRise } from '../lib/reveal.js';

export function testimonialsMarkup() {
  const s = testimonial.screenshot;
  const stats = proof
    .map((p, i) => `
      <li class="proof__item" data-rise="${i * 0.08}">
        <p class="proof__figure">${p.figure}</p>
        <p class="proof__label">${p.label}</p>
        <p class="proof__text">${p.text}</p>
        <p class="proof__partner">${p.partner}</p>
      </li>`)
    .join('');
  return `
  <section class="section section--light testimonials" id="${sections.testimonials}" aria-labelledby="testimonials-title">
    <div class="wrap">
      <p class="kicker" data-rise>Client feedback</p>
      <h2 class="display" id="testimonials-title"><span class="line"><span>WHAT CLIENTS</span></span><span class="line"><span>ARE SAYING.</span></span></h2>

      <div class="testimonials__grid">
        <figure class="quote" data-rise>
          <blockquote class="quote__text"><p>“${testimonial.quote}”</p></blockquote>
          <figcaption class="quote__by">
            <span class="quote__source">${testimonial.source}</span>
            <span class="quote__context">${testimonial.context}</span>
            <span class="quote__note">${testimonial.note}</span>
          </figcaption>
        </figure>

        <button type="button" class="shot" data-shot data-rise="0.1" aria-label="Enlarge the original message screenshot">
          <img src="${s.src}" width="${s.width}" height="${s.height}" alt="${s.alt}" loading="lazy" decoding="async" />
          <span class="shot__cap">Original message <span aria-hidden="true">↗</span></span>
        </button>
      </div>

      <ul class="proof" aria-label="Results">${stats}</ul>
    </div>
  </section>`;
}

export function initTestimonials() {
  const root = document.getElementById(sections.testimonials);
  revealLines(root.querySelector('.display'));
  revealRise(root);
  const shot = root.querySelector('[data-shot]');
  shot.addEventListener('click', () =>
    openPreview([{ src: testimonial.screenshot.src, alt: testimonial.screenshot.alt, title: testimonial.screenshot.caption }], 0, shot));
}
