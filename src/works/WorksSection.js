import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { thumbnails } from '../data/thumbnails.js';
import { sections } from '../data/navigation.js';
import { createRibbon } from './RibbonGallery.js';
import { openPreview } from '../lib/Preview.js';

const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function worksMarkup() {
  const rooms = thumbnails
    .map((t, i) => `<li data-work><h3>${esc(t.title || `Thumbnail ${i + 1}`)}</h3></li>`)
    .join('');
  return `
  <section class="works hall" id="${sections.works}" data-hall aria-labelledby="works-title">
    <div class="stage" data-stage tabindex="0" aria-label="Selected thumbnail work. Use the left and right arrow keys to move, Enter to open.">
      <canvas class="stage__canvas" data-canvas aria-hidden="true"></canvas>
      <header class="bar">
        <h2 class="bar__title" id="works-title">SELECTED WORKS</h2>
        <span class="bar__meta">${thumbnails.length} THUMBNAILS</span>
      </header>
      <ul class="rooms" data-rooms aria-label="Thumbnail titles">${rooms}</ul>
      <p class="works__caption" data-caption aria-hidden="true"></p>
      <footer class="foot">
        <span class="foot__now"><span data-count>01 / ${String(thumbnails.length).padStart(2, '0')}</span><span class="foot__title" data-title></span></span>
        <button type="button" class="foot__view" data-view>VIEW THUMBNAIL <span aria-hidden="true">↗</span></button>
        <span class="foot__hint" data-hint>SCROLL TO EXPLORE</span>
      </footer>
    </div>
  </section>`;
}

/** Wires the ribbon to the markup above. Returns a destroy function. */
export function initWorks() {
  const hall = document.querySelector('[data-hall]');
  const stage = hall.querySelector('[data-stage]');
  const canvas = hall.querySelector('[data-canvas]');
  const list = hall.querySelector('[data-rooms]');
  const hint = hall.querySelector('[data-hint]');
  const count = hall.querySelector('[data-count]');
  const title = hall.querySelector('[data-title]');
  const caption = hall.querySelector('[data-caption]');
  const view = hall.querySelector('[data-view]');
  const total = String(thumbnails.length).padStart(2, '0');

  let ribbon;
  const open = (i, from) => {
    const items = ribbon ? ribbon.items() : thumbnails;
    openPreview(items.map((t) => ({ src: t.src, title: t.title, alt: t.alt })), i, from || stage);
  };

  let refreshTimer = 0;
  ribbon = createRibbon({
    hall, stage, canvas, list, hint,
    items: thumbnails,
    onActive: (i) => {
      count.textContent = `${String(i + 1).padStart(2, '0')} / ${total}`;
      title.textContent = thumbnails[i]?.title || '';
      caption.textContent = thumbnails[i]?.title || '';
    },
    onOpen: (i) => open(i, stage),
    /* the hall's height is the scroll distance: tell ScrollTrigger when it changes, once, not on every frame */
    onLayout: () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120); },
  });

  view.addEventListener('click', () => open(Math.max(0, ribbon.active), view));
  return () => { clearTimeout(refreshTimer); ribbon.destroy(); };
}
