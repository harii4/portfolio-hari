/**
 * Progressive frame preloader.
 *  - frame 0 first (instant first paint)
 *  - then a coarse pass (every 8th) so scrubbing works almost immediately
 *  - then progressively finer passes
 * `get(i)` always returns the nearest frame that has loaded, so a fast scroll during loading
 * never shows a blank portrait.
 */
export class FrameStore {
  constructor({ count, url, stride = 1, concurrency = 8, onProgress }) {
    this.count = count;
    this.url = url;
    this.stride = stride;
    this.concurrency = concurrency;
    this.onProgress = onProgress || (() => {});
    this.bitmaps = new Array(count).fill(null);
    this.loaded = 0;
    this.total = 0;
    this.queue = this.buildQueue();
    this.total = this.queue.length;
  }

  buildQueue() {
    const want = [];
    for (let i = 0; i < this.count; i += this.stride) want.push(i);
    if (want[want.length - 1] !== this.count - 1) want.push(this.count - 1);
    const rank = (i) => (i === 0 ? -1 : i === this.count - 1 ? 0 : i % 8 === 0 ? 1 : i % 4 === 0 ? 2 : i % 2 === 0 ? 3 : 4);
    return want.sort((a, b) => rank(a) - rank(b) || a - b);
  }

  async decode(i) {
    const res = await fetch(this.url(i));
    if (!res.ok) throw new Error(`frame ${i}: ${res.status}`);
    const blob = await res.blob();
    if ('createImageBitmap' in window) {
      return createImageBitmap(blob, { premultiplyAlpha: 'premultiply' });
    }
    // Fallback for very old engines
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return img;
  }

  /** Resolves when frame 0 is ready. `done` resolves when everything has loaded. */
  start() {
    let cursor = 0;
    let resolveFirst;
    const first = new Promise((r) => (resolveFirst = r));

    const worker = async () => {
      while (cursor < this.queue.length) {
        const i = this.queue[cursor++];
        try {
          this.bitmaps[i] = await this.decode(i);
        } catch (e) {
          console.warn(e);
        }
        this.loaded++;
        this.onProgress(this.loaded / this.total);
        if (i === 0) resolveFirst();
      }
    };

    // Frame 0 alone first, so it is not competing for bandwidth.
    const boot = worker().then(() => {});
    this.done = (async () => {
      await first;
      await Promise.all(Array.from({ length: this.concurrency }, worker));
      await boot;
    })();
    return first;
  }

  /** Nearest loaded frame to the requested (possibly fractional) index. */
  get(index) {
    const t = Math.max(0, Math.min(this.count - 1, Math.round(index)));
    if (this.bitmaps[t]) return this.bitmaps[t];
    for (let d = 1; d < this.count; d++) {
      const a = this.bitmaps[t - d];
      if (a) return a;
      const b = this.bitmaps[t + d];
      if (b) return b;
    }
    return null;
  }
}
