import { createContext, createProgram, createTarget, destroyTarget, bindTex } from './glUtils.js';
import { VERT, BLUR_FRAG, SIM_FRAG, DISPLAY_FRAG } from './shaders.js';
import { TYPE, MERCURY } from '../core/config.js';
import { measureTitle } from '../core/typeMetrics.js';

const STEP_MS = 1000 / 60;

/**
 * The oversized word, rendered in WebGL2.
 *
 *   glyph mask ──blur──▶ dome heights ──┐
 *   cursor ──▶ spring/viscosity field ──┴──▶ display shader (ink → mercury)
 *
 * It sleeps (no GPU work) a few seconds after the cursor stops, once the liquid has settled.
 */
export class MercuryType {
  /** Returns null when WebGL2 + float render targets are unavailable → caller uses the DOM fallback. */
  static create(canvas, { interactive = true, onLost } = {}) {
    const gl = createContext(canvas);
    if (!gl) return null;
    try {
      return new MercuryType(canvas, gl, { interactive, onLost });
    } catch (err) {
      console.warn('[MercuryType] disabled:', err);
      return null;
    }
  }

  constructor(canvas, gl, { interactive, onLost }) {
    this.canvas = canvas;
    this.gl = gl;
    this.interactive = interactive;
    this.reveal = 0;
    this.paused = false;
    this.needsRender = true;
    this.awakeUntil = 0;
    this.acc = 0;

    this.mouse = { x: -1e4, y: -1e4, px: 0, py: 0, vx: 0, vy: 0, has: false };

    this.blur = createProgram(gl, VERT, BLUR_FRAG);
    this.simProg = createProgram(gl, VERT, SIM_FRAG);
    this.display = createProgram(gl, VERT, DISPLAY_FRAG);
    this.vao = gl.createVertexArray();
    this.maskTex = gl.createTexture();
    this.t = {};

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      onLost && onLost();
    });
  }

  /* ───────────────────────────── layout ───────────────────────────── */

  resize(layout, dpr) {
    const { gl, canvas } = this;
    dpr = Math.min(dpr, 2);
    this.layout = layout;
    this.dpr = dpr;
    const W = Math.round(layout.W * dpr);
    const H = Math.round(layout.H * dpr);
    canvas.width = W;
    canvas.height = H;

    const m = measureTitle({
      text: TYPE.text,
      family: TYPE.family,
      targetWidth: layout.type.width,
      tracking: TYPE.tracking,
    });
    this.metrics = m;

    this.drawMask(W, H, m, layout);
    this.buildFields(W, H, m);
    this.needsRender = true;
  }

  drawMask(W, H, m, layout) {
    const { gl } = this;
    const c = (this.maskCanvas ||= document.createElement('canvas'));
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `400 ${m.fontSize}px ${TYPE.family}`;

    const left = layout.type.cx - layout.type.width / 2 + m.originX;
    const baseline = layout.type.cy + m.capHeight / 2;
    m.letters.forEach((ch, i) => ctx.fillText(ch, left + m.origins[i], baseline));
    this.baselineCss = baseline;

    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  buildFields(W, H, m) {
    const { gl } = this;
    const t = this.t;
    Object.values(t).forEach((x) => destroyTarget(gl, x));

    const halfW = Math.ceil(W / 2), halfH = Math.ceil(H / 2);
    t.tmpA = createTarget(gl, W, H);
    t.domeA = createTarget(gl, W, H);
    t.tmpB = createTarget(gl, halfW, halfH);
    t.domeB = createTarget(gl, halfW, halfH);

    const fsDev = m.fontSize * this.dpr;
    this.blurPass(this.maskTex, t.tmpA, [1 / W, 0], fsDev * 0.024);
    this.blurPass(t.tmpA.tex, t.domeA, [0, 1 / H], fsDev * 0.024);
    this.blurPass(this.maskTex, t.tmpB, [1 / halfW, 0], (fsDev * 0.075) / 2);
    this.blurPass(t.tmpB.tex, t.domeB, [0, 1 / halfH], (fsDev * 0.075) / 2);
    // temporaries are no longer needed
    destroyTarget(gl, t.tmpA); destroyTarget(gl, t.tmpB);
    delete t.tmpA; delete t.tmpB;

    const cell = MERCURY.simCell;
    const sw = Math.ceil(this.layout.W / cell), sh = Math.ceil(this.layout.H / cell);
    t.simA = createTarget(gl, sw, sh);
    t.simB = createTarget(gl, sw, sh);
    this.simRead = t.simA;
    this.simWrite = t.simB;
    this.simSize = [sw, sh];

    // influence radius scales with the type so the interaction feels the same at any viewport
    this.sigma = m.capHeight * MERCURY.sigma;
  }

  blurPass(srcTex, dst, step, sigma) {
    const { gl, blur } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(blur.program);
    bindTex(gl, 0, srcTex, blur.u.uSrc);
    gl.uniform2f(blur.u.uStep, step[0], step[1]);
    gl.uniform1f(blur.u.uSigma, Math.max(sigma, 0.5));
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ───────────────────────────── input ───────────────────────────── */

  /** The hero is off screen: no simulation, no draws, and the pointer must not wake it. */
  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) { this.awakeUntil = 0; this.acc = 0; } else this.needsRender = true;
  }

  pointerMove(clientX, clientY) {
    if (!this.interactive || this.lost || this.paused) return;
    const r = this.canvas.getBoundingClientRect();
    const x = clientX - r.left;
    const y = r.height - (clientY - r.top); // bottom-left origin to match the shaders
    const mo = this.mouse;
    if (!mo.has) { mo.px = x; mo.py = y; mo.has = true; }
    mo.x = x; mo.y = y;
    this.awakeUntil = performance.now() + MERCURY.sleepAfterMs;
  }

  pointerLeave() {
    const mo = this.mouse;
    mo.has = false; mo.x = mo.y = mo.px = mo.py = -1e4;
    mo.vx = mo.vy = 0;
  }

  setReveal(v) {
    this.reveal = v;
    this.needsRender = true;
  }

  /* ───────────────────────────── frame ───────────────────────────── */

  tick(deltaMs) {
    if (this.lost || this.paused || !this.layout) return;
    const now = performance.now();
    const awake = this.interactive && now < this.awakeUntil;

    if (awake) {
      this.acc = Math.min(this.acc + deltaMs, STEP_MS * 3);
      const steps = Math.floor(this.acc / STEP_MS);
      this.acc -= steps * STEP_MS;
      if (steps > 0) { this.advance(steps); this.draw(); }
      else if (this.needsRender) this.draw();
    } else if (this.needsRender) {
      this.draw();
    }
  }

  /** Advance the liquid by n fixed steps. Cursor velocity is smoothed so a jump reads as a flick, not a teleport. */
  advance(n) {
    const mo = this.mouse;
    const rawX = mo.has ? (mo.x - mo.px) / n : 0;
    const rawY = mo.has ? (mo.y - mo.py) / n : 0;
    mo.px = mo.x; mo.py = mo.y;
    for (let i = 0; i < n; i++) {
      mo.vx += (rawX - mo.vx) * 0.35;
      mo.vy += (rawY - mo.vy) * 0.35;
      this.stepSim();
    }
  }

  stepSim() {
    const { gl, simProg: p, mouse: mo } = this;
    const [sw, sh] = this.simSize;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.simWrite.fbo);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(p.program);
    bindTex(gl, 0, this.simRead.tex, p.u.uState);
    gl.uniform2f(p.u.uTexel, 1 / sw, 1 / sh);
    gl.uniform2f(p.u.uCss, this.layout.W, this.layout.H);
    gl.uniform2f(p.u.uMouse, mo.x, mo.y);
    const mag = Math.hypot(mo.vx, mo.vy);
    const k = mag > 60 ? 60 / mag : 1;
    gl.uniform2f(p.u.uVel, mo.vx * k, mo.vy * k);
    gl.uniform1f(p.u.uSigma, this.sigma);
    gl.uniform1f(p.u.uSpring, MERCURY.spring);
    gl.uniform1f(p.u.uDamp, MERCURY.damping);
    gl.uniform1f(p.u.uLap, MERCURY.coupling);
    gl.uniform1f(p.u.uDrag, MERCURY.drag);
    gl.uniform1f(p.u.uRadial, MERCURY.radial);
    gl.uniform1f(p.u.uHover, MERCURY.hover);
    gl.uniform1f(p.u.uMaxD, this.metrics.capHeight * MERCURY.maxStretch);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.simRead, this.simWrite] = [this.simWrite, this.simRead];
  }

  draw() {
    const { gl, display: p, layout, canvas, t } = this;
    this.needsRender = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p.program);
    bindTex(gl, 0, this.maskTex, p.u.uMask);
    bindTex(gl, 1, t.domeA.tex, p.u.uDomeA);
    bindTex(gl, 2, t.domeB.tex, p.u.uDomeB);
    bindTex(gl, 3, this.simRead.tex, p.u.uSim);
    gl.uniform2f(p.u.uCss, layout.W, layout.H);
    gl.uniform1f(p.u.uBump, MERCURY.bump);
    gl.uniform1f(p.u.uReveal, this.reveal);
    gl.uniform1f(p.u.uBaseline, 1 - this.baselineCss / layout.H);
    gl.uniform1f(p.u.uBand, this.metrics.capHeight / layout.H);
    gl.uniform1f(p.u.uW0, MERCURY.weightStart);
    gl.uniform1f(p.u.uW1, MERCURY.weightEnd);
    gl.uniform3f(p.u.uInk, ...TYPE.ink);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    const { gl } = this;
    this.paused = true;
    const lose = gl.getExtension('WEBGL_lose_context');
    lose && lose.loseContext();
  }
}
