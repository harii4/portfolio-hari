import { FRAMES } from '../core/config.js';

/**
 * Draws the portrait frame sequence onto a 2D canvas.
 * No CSS transforms are involved in the rotation: each scroll position selects a real PNG-derived frame.
 */
export class PortraitCanvas {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.store = store;
    this.frame = 0;
    this.drawn = -1;
    this.dpr = 1;
  }

  resize(rect, dpr) {
    this.dpr = dpr;
    const { canvas } = this;
    canvas.style.width = `${rect.w}px`;
    canvas.style.height = `${rect.h}px`;
    canvas.style.left = `${rect.x}px`;
    canvas.style.top = `${rect.y}px`;
    // Never allocate more pixels than the source can fill meaningfully.
    const maxScale = Math.max(1, FRAMES.height / rect.h) * 1.6;
    const scale = Math.min(dpr, maxScale);
    canvas.width = Math.max(1, Math.round(rect.w * scale));
    canvas.height = Math.max(1, Math.round(rect.h * scale));
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.drawn = -1;
    this.render();
  }

  setFrame(f) {
    this.frame = f;
    this.render();
  }

  render() {
    const target = Math.round(this.frame);
    const bmp = this.store.get(target);
    if (!bmp) return;
    // Redraw if the frame changed, or if we fell back to a different bitmap while loading.
    const key = this.store.bitmaps[target] ? target : -2 - target;
    if (key === this.drawn) return;
    this.drawn = key;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  }
}
