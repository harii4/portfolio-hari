import { lockScroll } from './scroll.js';

/**
 * One accessible image preview for the whole site (Works thumbnails and the testimonial screenshot).
 * A native <dialog>: focus is trapped, Escape closes, and focus goes back to whatever opened it.
 * Also: close button, backdrop click, ← → between images, and touch swipe.
 */
let dialog, img, caption, counter, prevBtn, nextBtn, closeBtn;
let group = [];
let index = 0;
let opener = null;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'preview';
  dialog.setAttribute('aria-label', 'Image preview');
  dialog.innerHTML = `
    <div class="preview__bar">
      <p class="preview__count" data-preview-count></p>
      <button type="button" class="preview__close" data-preview-close aria-label="Close preview"><span aria-hidden="true">Close ✕</span></button>
    </div>
    <figure class="preview__figure">
      <img class="preview__img" data-preview-img alt="" decoding="async" />
      <figcaption class="preview__caption" data-preview-caption></figcaption>
    </figure>
    <button type="button" class="preview__nav preview__nav--prev" data-preview-prev aria-label="Previous image"><span aria-hidden="true">←</span></button>
    <button type="button" class="preview__nav preview__nav--next" data-preview-next aria-label="Next image"><span aria-hidden="true">→</span></button>`;
  document.body.append(dialog);
  img = dialog.querySelector('[data-preview-img]');
  caption = dialog.querySelector('[data-preview-caption]');
  counter = dialog.querySelector('[data-preview-count]');
  prevBtn = dialog.querySelector('[data-preview-prev]');
  nextBtn = dialog.querySelector('[data-preview-next]');
  closeBtn = dialog.querySelector('[data-preview-close]');

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  /* a click outside the picture (on the dialog itself) closes */
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.classList.contains('preview__figure')) close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
  dialog.addEventListener('close', () => {
    lockScroll(false);
    document.documentElement.classList.remove('has-preview');
    const back = opener;
    opener = null;
    if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  });
  /* the page behind must not scroll while the preview is open */
  const stop = (e) => e.preventDefault();
  dialog.addEventListener('wheel', stop, { passive: false });
  dialog.addEventListener('touchmove', (e) => { if (e.touches.length > 1) return; stop(e); }, { passive: false });
  /* swipe */
  let startX = 0, startY = 0;
  dialog.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  dialog.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) close();
  }, { passive: true });
}

function show() {
  const item = group[index];
  img.removeAttribute('src');
  img.alt = item.alt || item.title || '';
  img.src = item.src;
  caption.textContent = item.title || item.caption || '';
  const many = group.length > 1;
  counter.textContent = many ? `${String(index + 1).padStart(2, '0')} / ${String(group.length).padStart(2, '0')}` : '';
  prevBtn.hidden = nextBtn.hidden = !many;
}

function step(d) {
  if (group.length < 2) return;
  index = (index + d + group.length) % group.length;
  show();
}

/** items: [{src, title?, alt?, caption?}], start: index to show first, from: element to return focus to. */
export function openPreview(items, start = 0, from = document.activeElement) {
  if (!dialog) build();
  group = items;
  index = Math.max(0, Math.min(items.length - 1, start));
  opener = from;
  show();
  document.documentElement.classList.add('has-preview');
  lockScroll(true);
  if (!dialog.open) dialog.showModal();
  closeBtn.focus({ preventScroll: true });
}

export function close() {
  if (dialog && dialog.open) dialog.close();
}
