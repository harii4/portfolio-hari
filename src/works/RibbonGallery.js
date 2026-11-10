/* The rearing ribbon — integrated into the portfolio.
   This is the supplied ribbon, ported from a loose script into a self-contained module. Everything that makes it the
   ribbon is unchanged: the constants, the shaders (see ribbonShaders.js), the S-curve, the bank / door / tilt, the
   scroll-following inertia and speed surge, the dent under the pointer and the loader bars that become cards.

   What changed, and only this:
   1. The generated demo cards (ROOMS, THINGS, seeded, card, paint) are gone. Cards are the thumbnails in
      src/data/thumbnails.js, and each card's ratio comes from the image's own naturalWidth / naturalHeight.
   2. The square-texture pipeline. The original drew every card into a 1024 × 1024 square, which is fine for a
      generated card and wrong for a real picture. Here each picture keeps its aspect ratio: it is drawn into the smallest
      power-of-two texture that holds it (so mipmaps still work on WebGL1), the padding is filled by replicating the picture's
      edge pixels (so the mipmap chain can never bleed a foreign colour in), and the fragment shader samples only the
      picture's share of the texture through `uvScale`.
   3. Per-card height (a `featured` card is larger), and a deliberate "open" action next to the original click-to-centre.
   4. The floor / perspective grid is gone (white theme), the loader bars are ink, and phones get a card sized to the screen.
   5. Lifecycle: it renders only while on screen, loads images when the section approaches, and cleans up after itself. */

import { gsap } from 'gsap';
import { RIBBON_VERTEX, RIBBON_FRAGMENT } from './ribbonShaders.js';
import { scrollToY, getLenis, isTouchFirst } from '../lib/scroll.js';

/* ---- values to change (unchanged from the supplied ribbon) ---- */
export const RIBBON = {
  FOLLOW: 0.1,            /* how much of the way to the scroll the ribbon covers every sixtieth of a second */
  RUSH: 140,              /* how many pixels behind the scroll the ribbon must be to count as full speed */
  FIELD: 53.4,            /* the camera's field of view, in degrees */
  DEPTH: 0.2,             /* how deep the S goes, as a share of half the page's width */
  SURGE: 1.1,             /* how much deeper it gets at full speed */
  SPAN: 1.15,             /* how much of the S fits across the page */
  SHIFT: -0.2,            /* slides the S along: negative brings the near bulge in from the left */
  BANK: -0.16,            /* how far the ribbon leans into its own slope, radians at the steepest point */
  DOOR: -0.12,            /* the whole ribbon turned like a door: left edge nearer, right edge further */
  TILT: 0.03,             /* the ribbon runs slightly uphill to the right */
  REAR: { up: 0.1, near: 0.2 },   /* at full speed the left side lifts and comes nearer, in half page widths */
  WRING: 1.8,             /* at full speed the two ends twist opposite ways, in radians */
  DENT: 0.1,              /* how far a card bows back under the pointer, as a share of its height */
  HOVER: 0.5,             /* seconds for the dent to come and go */
  SHADE: 0.5,             /* how dark the far end of the S gets */
  GLOSS: 0.35,            /* how bright the sheen on the cards is */
  CARD: { height: 0.46, gap: 10, round: 20 },   /* the cards: height as a share of the page's, then pixels */
  INTRO: { load: 1.4, flight: 1.5, stagger: 0.05, sides: 1.25 },   /* seconds of the entrance */
  BAR: { width: 48, height: 5, gap: 8 },        /* the three loader bars, in pixels */
};
const {
  FOLLOW, RUSH, FIELD, DEPTH, SURGE, SPAN, SHIFT, BANK, DOOR, TILT, REAR, WRING, DENT, HOVER, SHADE, GLOSS, CARD, INTRO, BAR,
} = RIBBON;

const FIRST = 1;   /* the card in the middle of the page when the scroll is at the top */
const FEATURED_SCALE = 1.16;
const INK = [0.067, 0.067, 0.067];   /* the loader bars: the site's ink on a white page */
const pot = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));
const mix = (a, b, k) => a + (b - a) * k;

export function createRibbon({ hall, stage, canvas, list, hint, items, onActive, onOpen, onLayout, onLoadProgress }) {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowMemory = (navigator.deviceMemory && navigator.deviceMemory <= 4) || Math.min(innerWidth, innerHeight) < 600;
  /* the largest picture we upload: a 16:9 thumbnail ends up 1820 × 1024 (2048 × 1024 texture) on desktop, half that on small devices */
  const TEXTURE = lowMemory ? { w: 1024, h: 512 } : { w: 2048, h: 1024 };

  const cleanup = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanup.push(() => target.removeEventListener(type, fn, opts)); };
  let destroyed = false;

  const TOUCH = isTouchFirst();
  /* the cards' edges are anti-aliased in the shader, so MSAA on a phone GPU buys almost nothing and costs a lot */
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: !TOUCH });

  /* ---------------------------------------------------------------- the state of every card, moved by GSAP */
  const cards = items.map((item, i) => ({
    i,
    item,
    ratio: item.ratio || (item.width && item.height ? item.width / item.height : 16 / 9),   /* provisional until the image loads */
    scale: item.scale || (item.featured ? FEATURED_SCALE : 1),
    x: 0, w: 0, h: 0, hover: 0, fly: 1, side: 0, alpha: 1, boot: -1,
    texture: null, uv: [1, 1], image: null,
  }));
  const load = { p: 0, bars: 0 };
  let travel = 0;      /* how far the ribbon can go, in pixels */
  let aim = 0;         /* where the scroll says it should be */
  let at = 0;          /* where it is */
  let height = 0;
  let ribbon, mesh, count = 0, density = 1;
  let buffer;
  const textures = [];
  let phase = 'loading';     /* loading → waiting (loaded, not yet on screen) → playing */
  let visible = false;
  let ticking = false;
  let last = 0;
  let active = -1;
  let flatMode = false;
  let intro;
  let lastHall = 0;

  /* ---------------------------------------------------------------- layout: the cards in a row */
  function layout() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    /* the original height, but never a card wider than ~86% of the screen (phones, portrait tablets): same proportions, fits */
    height = Math.min(H * CARD.height, (W * 0.86) / (16 / 9));
    let x = 0;
    cards.forEach((c) => {
      c.h = height * c.scale;
      c.w = c.h * c.ratio;
      c.x = x;
      x += c.w + CARD.gap;
    });
    const middle = (c) => c.x + c.w / 2;
    const start = middle(cards[Math.min(FIRST, cards.length - 1)]);
    travel = middle(cards[Math.max(0, cards.length - 2)]) - start;
    cards.forEach((c) => { c.x -= start; });
    const total = H + Math.max(0, travel);
    if (Math.abs(total - lastHall) > 0.5) {
      hall.style.height = `${total}px`;
      lastHall = total;
      onLayout && onLayout();
    }
  }
  const scrolled = () => Math.min(travel, Math.max(0, -hall.getBoundingClientRect().top));
  const centreOf = (c) => c.x + c.w / 2;

  /* ---------------------------------------------------------------- WebGL setup */
  function build(vertex, fragment) {
    const program = gl.createProgram();
    const shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(program, s);
      return s;
    });
    gl.bindAttribLocation(program, 0, 'corner');
    gl.linkProgram(program);
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, at: uniforms, shaders };
  }

  function setupGL() {
    ribbon = build(RIBBON_VERTEX, RIBBON_FRAGMENT);
    /* a sheet of 32 by 8 squares: it only bends along its length */
    const across = 32;
    const down = 8;
    const points = [];
    for (let j = 0; j <= down; j++) for (let i = 0; i <= across; i++) points.push(i / across, j / down);
    const order = [];
    for (let j = 0; j < down; j++) {
      for (let i = 0; i < across; i++) {
        const a = j * (across + 1) + i;
        order.push(a, a + 1, a + across + 1, a + 1, a + across + 2, a + across + 1);
      }
    }
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    mesh = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(order), gl.STATIC_DRAW);
    count = order.length;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  function size() {
    density = Math.min(devicePixelRatio, stage.clientWidth < 700 ? 1.5 : 2);
    const w = Math.round(canvas.clientWidth * density);
    const h = Math.round(canvas.clientHeight * density);
    /* a mobile URL bar sliding in and out fires resize: only touch the canvas when its size really changed */
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    layout();
    if (flatMode) moveFlat();
  }

  /* ---------------------------------------------------------------- pictures → textures (aspect-correct) */
  function texturize(card, img) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const natural = nw / nh;
    /* never cropped, unless the data asks for a different ratio: then cover-crop around `focus` */
    let sx = 0, sy = 0, sw = nw, sh = nh;
    const want = card.item.ratio;
    if (want && Math.abs(want / natural - 1) > 0.01) {
      if (natural > want) { sw = nh * want; } else { sh = nw / want; }
    }
    const zoom = Math.max(1, card.item.zoom || 1);
    sw /= zoom; sh /= zoom;
    const fx = card.item.focus ? card.item.focus.x : 0.5;
    const fy = card.item.focus ? card.item.focus.y : 0.5;
    sx = (nw - sw) * fx;
    sy = (nh - sh) * fy;
    card.ratio = sw / sh;

    /* the picture's size in the texture, then the smallest power-of-two texture that holds it */
    const k = Math.min(TEXTURE.w / sw, TEXTURE.h / sh, 1);
    const w = Math.max(1, Math.round(sw * k));
    const h = Math.max(1, Math.round(sh * k));
    const tw = pot(w);
    const th = pot(h);
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    /* UNPACK_FLIP_Y is on, so the canvas' bottom is v = 0: the picture goes at the bottom */
    const y0 = th - h;
    g.drawImage(img, sx, sy, sw, sh, 0, y0, w, h);
    /* padding = the picture's own edge pixels stretched outward, so filtering and mipmaps never pull in another colour */
    if (tw > w) g.drawImage(c, w - 1, y0, 1, h, w, y0, tw - w, h);
    if (th > h) g.drawImage(c, 0, y0, tw, 1, 0, 0, tw, y0);

    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    /* where the browser can, a card seen at a slant is filtered along the slant */
    const sharp = gl.getExtension('EXT_texture_filter_anisotropic');
    if (sharp) gl.texParameterf(gl.TEXTURE_2D, sharp.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    card.texture = t;
    card.uv = [w / tw, h / th];
    textures.push(t);
    c.width = c.height = 1;   /* release the scratch canvas */
  }

  function loadImage(card) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => { console.warn('[ribbon] could not load', card.item.src); resolve(null); };
      img.src = card.item.src;
    });
  }

  let loading = null;
  function loadAll() {
    if (loading) return loading;
    let done = 0;
    loading = Promise.all(cards.map(async (card) => {
      const img = await loadImage(card);
      card.image = img;
      done++;
      onLoadProgress && onLoadProgress(done / cards.length);
      return img;
    })).then(() => {
      if (destroyed) return;
      if (flatMode) return;
      cards.forEach((card) => { if (card.image) texturize(card, card.image); });
      /* a picture that could not load is dropped, so the ribbon never shows a blank card */
      const usable = cards.filter((c) => c.texture);
      if (usable.length !== cards.length) {
        cards.length = 0;
        usable.forEach((c, i) => { c.i = i; cards.push(c); });
      }
      layout();       /* the ratios are now the real ones */
      at = aim = scrolled();
      phase = 'waiting';
      maybePlay();
    });
    return loading;
  }

  /* ---------------------------------------------------------------- the entrance: the loader's bars are the cards */
  function enter() {
    if (REDUCED) {
      gsap.set(stage.querySelectorAll('.bar, .foot'), { opacity: 1 });
      return;
    }
    /* the three cards nearest the middle start as bars; the others wait off to the sides */
    const near = [...cards].sort((a, b) => Math.abs(centreOf(a) - at) - Math.abs(centreOf(b) - at));
    const three = near.slice(0, 3).sort((a, b) => a.x - b.x);
    const rest = near.slice(3);
    three.forEach((c, k) => { c.boot = k; c.fly = 0; });
    rest.forEach((c) => { c.alpha = 0; c.side = Math.sign(centreOf(c) - at || 1) * stage.clientWidth * 0.5; });
    intro = gsap.timeline();
    intro.to(load, { bars: 1, duration: 0.4, ease: 'power1.out' })
      /* the pictures have really arrived by now; the bars still fill, because the bars are the entrance */
      .to(load, { p: 1, duration: INTRO.load, ease: 'power1.inOut' }, 0.1)
      .addLabel('go')
      .to(three, { fly: 1, duration: INTRO.flight, ease: 'expo.inOut', stagger: INTRO.stagger }, 'go')
      .to(rest, { side: 0, duration: INTRO.sides, ease: 'expo.out', stagger: 0.05 }, 'go+=1.15')
      .to(rest, { alpha: 1, duration: INTRO.sides * 0.5, ease: 'power1.out', stagger: 0.05 }, 'go+=1.15')
      .to(stage.querySelectorAll('.bar, .foot'), { opacity: 1, duration: 0.6, ease: 'power1.out', stagger: 0.06 }, 'go+=0.75');
  }

  function maybePlay() {
    if (destroyed || flatMode || phase !== 'waiting' || !visible) return;
    phase = 'playing';
    enter();
  }

  /* ---------------------------------------------------------------- the pointer: the card under it bows back */
  let over = -1;
  function find(e) {
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = r.height / 2 - (e.clientY - r.top);
    const hit = cards.find((c) => x > c.x - at && x < c.x - at + c.w && Math.abs(y) <= c.h / 2);
    return hit ? hit.i : -1;
  }
  function point(i) {
    if (i === over) return;
    over = i;
    stage.classList.toggle('is-over-card', i >= 0);
    if (REDUCED) return;
    cards.forEach((c) => gsap.to(c, { hover: c.i === i ? 1 : 0, duration: HOVER, ease: 'expo.out', overwrite: 'auto' }));
  }

  /* centre a card: the original click action. Returns false when the card sits past the ends of the scroll */
  function goTo(i, { instant = false } = {}) {
    const c = cards[i];
    if (!c) return false;
    const want = centreOf(c);
    const y = scrollY + hall.getBoundingClientRect().top + Math.min(travel, Math.max(0, want));
    scrollToY(y, { immediate: REDUCED || instant, duration: 1.1 });
    return want >= -2 && want <= travel + 2;
  }

  /* a click: a card off to the side comes to the middle first (the original behaviour); a click on the card that is
     already there (or on one the scroll cannot bring to the middle) opens it. The "View" button does the same, always. */
  let lastScroll = 0;
  function click(e) {
    const touch = e.pointerType ? e.pointerType !== 'mouse' : matchMedia('(hover: none)').matches;
    /* a finger that lands on a scrolling page only stops it: that tap must never open anything */
    if (touch && performance.now() - lastScroll < 220) return;
    const i = find(e);
    if (i < 0) return;
    const c = cards[i];
    const off = Math.abs(centreOf(c) - at);
    const reachable = centreOf(c) >= -2 && centreOf(c) <= travel + 2;
    if (off < c.w * 0.28 || !reachable) onOpen && onOpen(i);
    else if (!touch) goTo(i);      /* touch: the page scrolls under the finger, taps on the peeking neighbours do nothing */
  }

  function keydown(e) {
    if (e.target !== stage) return;
    const step = (d) => {
      e.preventDefault();
      const next = Math.min(cards.length - 2, Math.max(FIRST, (active < 0 ? FIRST : active) + d));
      goTo(next);
    };
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen && onOpen(active < 0 ? FIRST : active); }
  }

  /* ---------------------------------------------------------------- drawing */
  /* the ribbon's depth at a point across the page: the same S as the shader, to draw the far cards first */
  function deep(x, half, curve) {
    const q = (x / half) * SPAN + SHIFT;
    return -(curve ? Math.sin(Math.PI * q) : 1 - q * q) * Math.exp(-q * q);
  }

  function frame(now) {
    if (destroyed) return;
    if (!visible || flatMode) { stopLoop(); return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (phase !== 'playing') return;

    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const half = W / 2;
    const eye = H / 2 / Math.tan((FIELD * Math.PI) / 360);
    const curve = W < 650 ? 0 : 1;

    /* the ribbon follows the scroll; how far behind it is says how fast it is going */
    aim = scrolled();
    /* the original inertia, eased a little when Lenis (desktop) or the browser's momentum (touch) is already smoothing the scroll,
       so the ribbon follows without stacking a third layer of lag on top; the speed surge still comes from this gap */
    const follow = getLenis() ? 0.16 : TOUCH ? 0.18 : FOLLOW;
    at = REDUCED ? aim : at + (aim - at) * (1 - Math.pow(1 - follow, dt * 60));
    const rush = REDUCED ? 0 : Math.tanh(Math.abs(aim - at) / RUSH);
    const speed = rush * rush;
    const strength = REDUCED ? 0 : 1;

    /* which card is in the middle, for the counter */
    let nearest = 0;
    let best = Infinity;
    for (const c of cards) {
      const d = Math.abs(centreOf(c) - at);
      if (d < best) { best = d; nearest = c.i; }
    }
    if (nearest !== active) { active = nearest; onActive && onActive(active); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    /* the canvas is see-through: the page's own colour is the background */
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(ribbon.program);
    gl.uniform2f(ribbon.at.page, half, H / 2);
    gl.uniform1f(ribbon.at.eye, eye);
    gl.uniform1f(ribbon.at.depth, half * (curve ? DEPTH : DEPTH * 0.9) * (1 + SURGE * speed));
    gl.uniform1f(ribbon.at.span, curve ? SPAN : 1);
    gl.uniform1f(ribbon.at.shift, curve ? SHIFT : 0);
    gl.uniform1f(ribbon.at.curve, curve);
    gl.uniform1f(ribbon.at.bank, BANK);
    gl.uniform1f(ribbon.at.door, curve ? DOOR : 0);
    gl.uniform1f(ribbon.at.tilt, TILT);
    gl.uniform2f(ribbon.at.rear, REAR.up, REAR.near);
    gl.uniform1f(ribbon.at.wring, WRING);
    gl.uniform1f(ribbon.at.speed, speed);
    gl.uniform1f(ribbon.at.dent, DENT);
    gl.uniform1f(ribbon.at.shade, SHADE);
    gl.uniform1f(ribbon.at.gloss, GLOSS);
    gl.uniform1f(ribbon.at.density, density);
    gl.uniform1i(ribbon.at.picture, 0);
    gl.activeTexture(gl.TEXTURE0);

    /* far cards first, so the soft edge of a near one blends over them */
    const seen = cards.filter((c) => c.x - at + c.side < half * 1.7 && c.x - at + c.side + c.w > -half * 1.7);
    seen.sort((a, b) => deep(a.x - at + a.w / 2, half, curve) - deep(b.x - at + b.w / 2, half, curve));
    seen.forEach((c) => {
      const x = c.x - at + c.side;
      /* still a loader bar: a small white rectangle in the middle of the page, filled from the left */
      const bar = c.boot < 0 ? null : [(c.boot - 1) * (BAR.width + BAR.gap) - BAR.width / 2, -BAR.height / 2, BAR.width, BAR.height];
      const k = c.fly;
      const box = bar ? [mix(bar[0], x, k), mix(bar[1], -c.h / 2, k), mix(bar[2], c.w, k), mix(bar[3], c.h, k)] : [x, -c.h / 2, c.w, c.h];
      gl.bindTexture(gl.TEXTURE_2D, c.texture);
      gl.uniform2f(ribbon.at.uvScale, c.uv[0], c.uv[1]);
      gl.uniform4f(ribbon.at.box, box[0], box[1], box[2], box[3]);
      gl.uniform1f(ribbon.at.on, k * strength);
      gl.uniform1f(ribbon.at.hover, c.hover);
      gl.uniform1f(ribbon.at.corners, Math.min(mix(BAR.height / 2, CARD.round, k), box[3] / 2));
      gl.uniform3f(ribbon.at.ink, INK[0], INK[1], INK[2]);
      gl.uniform1f(ribbon.at.wash, bar ? 1 - Math.min(1, k * 1.08) : 0);
      gl.uniform1f(ribbon.at.fill, bar && k === 0 ? Math.min(1, Math.max(0, load.p * 3 - c.boot)) : 1);
      gl.uniform1f(ribbon.at.alpha, bar && k === 0 ? load.bars : c.alpha);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    });
  }

  /* one animation-frame loop for the whole site: the ribbon rides GSAP's ticker, which also drives Lenis and the hero */
  const tickFn = (time) => frame(time * 1000);
  function startLoop() {
    if (ticking || destroyed || flatMode) return;
    ticking = true;
    last = 0;
    gsap.ticker.add(tickFn);
  }
  function stopLoop() {
    if (!ticking) return;
    ticking = false;
    gsap.ticker.remove(tickFn);
  }

  /* ---------------------------------------------------------------- no WebGL: the thumbnails in a flat row the scroll moves */
  function flat() {
    if (flatMode) return;
    flatMode = true;
    stopLoop();
    stage.classList.add('is-flat');
    gsap.set(stage.querySelectorAll('.bar, .foot'), { opacity: 1 });
    list.replaceChildren();
    cards.forEach((c) => {
      const li = document.createElement('li');
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'lazy';
      img.alt = c.item.alt || c.item.title || '';
      img.width = c.item.width || 1920;
      img.height = c.item.height || 1080;
      img.src = c.item.src;
      img.addEventListener('load', () => {
        if (!c.item.ratio) c.ratio = img.naturalWidth / img.naturalHeight;
        layout();
        moveFlat();
      });
      li.append(img);
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'rooms__open';
      open.setAttribute('aria-label', `Open ${c.item.title || 'thumbnail'}`);
      open.addEventListener('click', () => onOpen && onOpen(c.i));
      li.append(open);
      li.dataset.index = c.i;
      c.flatEl = li;
      list.append(li);
    });
    on(window, 'scroll', moveFlat, { passive: true });
    layout();
    moveFlat();
  }
  function moveFlat() {
    if (!flatMode) return;
    cards.forEach((c) => { if (c.flatEl) { c.flatEl.style.width = `${c.w}px`; c.flatEl.style.marginRight = `${CARD.gap}px`; } });
    const a = scrolled();
    list.style.transform = `translate3d(${stage.clientWidth / 2 + cards[0].x - a}px, -50%, 0)`;
    let nearest = 0, best = Infinity;
    cards.forEach((c) => { const d = Math.abs(centreOf(c) - a); if (d < best) { best = d; nearest = c.i; } });
    if (nearest !== active) { active = nearest; onActive && onActive(active); }
  }

  /* ---------------------------------------------------------------- start */
  let observer;
  if (gl) {
    try {
      setupGL();
      on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); flat(); });
    } catch (err) {
      console.warn('[ribbon] WebGL setup failed, using the flat gallery', err);
    }
  }
  const usable = !!(gl && ribbon);
  size();
  on(window, 'resize', () => { size(); });
  on(window, 'scroll', () => { lastScroll = performance.now(); }, { passive: true });
  if (usable) {
    on(stage, 'pointermove', (e) => { if (e.pointerType === 'mouse') point(find(e)); });
    on(stage, 'pointerleave', () => point(-1));
    on(canvas, 'click', click);
    on(stage, 'keydown', keydown);
  }
  if (matchMedia('(hover: none)').matches && hint) hint.textContent = 'Swipe up';

  /* images are fetched when the section is a screen away; the entrance plays when it is actually in view */
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { near.disconnect(); if (usable) loadAll(); }
  }, { rootMargin: '120% 0px 120% 0px' });
  near.observe(hall);
  cleanup.push(() => near.disconnect());

  observer = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) { maybePlay(); startLoop(); }
  }, { rootMargin: '10% 0px 10% 0px' });
  observer.observe(stage);
  cleanup.push(() => observer.disconnect());

  if (!usable) {
    /* no WebGL at all: the flat gallery straight away (images are lazy) */
    flat();
  }

  /* ---------------------------------------------------------------- the controller */
  function destroy() {
    destroyed = true;
    stopLoop();
    intro && intro.kill();
    gsap.killTweensOf(cards);
    gsap.killTweensOf(load);
    cleanup.forEach((fn) => fn());
    if (gl && !gl.isContextLost()) {
      textures.forEach((t) => gl.deleteTexture(t));
      buffer && gl.deleteBuffer(buffer);
      mesh && gl.deleteBuffer(mesh);
      ribbon && gl.deleteProgram(ribbon.program);
      const lose = gl.getExtension('WEBGL_lose_context');
      lose && lose.loseContext();
    }
  }

  return {
    destroy,
    goTo,
    get count() { return cards.length; },
    get active() { return active; },
    get isFlat() { return flatMode; },
    items: () => cards.map((c) => c.item),
  };
}
