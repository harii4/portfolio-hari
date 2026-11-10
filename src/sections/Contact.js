import { personalInfo, links } from '../data/personalInfo.js';
import { sections } from '../data/navigation.js';
import { revealLines, revealRise } from '../lib/reveal.js';

export function contactMarkup() {
  const c = personalInfo.contact;
  const rows = [
    { label: 'WhatsApp', value: c.phoneDisplay, href: links.whatsapp(), external: true, primary: true },
    { label: 'Email', value: c.email, href: links.mailto() },
    { label: 'Phone', value: c.phoneDisplay, href: links.tel() },
    ...personalInfo.socials.map((s) => ({ label: s.label, value: s.handle || s.url.replace(/^https?:\/\/(www\.)?/, ''), href: s.url, external: true })),
  ]
    .map((r, i) => `
      <li data-rise="${i * 0.07}">
        <a class="contact__row${r.primary ? ' is-primary' : ''}" href="${r.href}"${r.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
          <span class="contact__label">${r.label}</span>
          <span class="contact__value">${r.value}</span>
          <span class="contact__arrow" aria-hidden="true">↗</span>
        </a>
      </li>`)
    .join('');
  return `
  <section class="section section--light contact" id="${sections.contact}" aria-labelledby="contact-title">
    <div class="wrap contact__grid">
      <div class="contact__intro">
        <p class="kicker" data-rise>${personalInfo.availability}</p>
        <h2 class="display contact__title" id="contact-title">
          <span class="line"><span>LET’S</span></span>
          <span class="line"><span>CREATE</span></span>
          <span class="line"><span class="ghost">SOMETHING.</span></span>
        </h2>
      </div>
      <ul class="contact__list">${rows}</ul>
    </div>
  </section>`;
}

export function initContact() {
  const root = document.getElementById(sections.contact);
  revealLines(root.querySelector('.display'), { stagger: 0.1 });
  revealRise(root);
}
