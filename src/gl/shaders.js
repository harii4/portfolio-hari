/** Full-screen triangle, no buffers. vUv origin is bottom-left everywhere (all textures share it). */
export const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Separable gaussian. Used once per resize to build the "dome" height fields from the glyph mask. */
export const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uStep;     // one texel along the blur axis
uniform float uSigma;   // in texels
void main() {
  float acc = 0.0, sum = 0.0;
  int R = int(ceil(uSigma * 3.0));
  float inv = 1.0 / (2.0 * uSigma * uSigma);
  for (int i = -160; i <= 160; i++) {
    if (i < -R || i > R) continue;
    float w = exp(-float(i * i) * inv);
    acc += texture(uSrc, vUv + uStep * float(i)).r * w;
    sum += w;
  }
  o = vec4(acc / sum, 0.0, 0.0, 1.0);
}`;

/**
 * Liquid field. RG = displacement (css px), BA = velocity.
 * A damped spring per cell, coupled to its neighbours (so the disturbance spreads like a viscous
 * surface), kicked by the cursor's velocity and by a soft outward bulge.
 */
export const SIM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uCss;
uniform vec2 uMouse;     // css px, bottom-left origin
uniform vec2 uVel;       // css px per step
uniform float uSigma;    // css px
uniform float uSpring, uDamp, uLap, uDrag, uRadial, uHover, uMaxD;
void main() {
  vec4 s = texture(uState, vUv);
  vec2 d = s.xy;
  vec2 v = s.zw;

  vec2 l = texture(uState, vUv - vec2(uTexel.x, 0.0)).xy;
  vec2 r = texture(uState, vUv + vec2(uTexel.x, 0.0)).xy;
  vec2 u = texture(uState, vUv + vec2(0.0, uTexel.y)).xy;
  vec2 b = texture(uState, vUv - vec2(0.0, uTexel.y)).xy;
  vec2 lap = l + r + u + b - 4.0 * d;

  vec2 p = vUv * uCss;
  vec2 q = p - uMouse;
  float g = exp(-dot(q, q) / (2.0 * uSigma * uSigma));
  float speed = length(uVel);

  vec2 acc = -uSpring * d + uLap * lap;
  acc += uVel * g * uDrag;                                            // cursor drags the liquid along
  acc += (q / uSigma) * g * uRadial * min(speed * 0.35, 4.0);          // …and pushes it aside
  acc += (q / uSigma) * g * uHover;                                    // a resting cursor still bulges the surface

  v = (v + acc) * (1.0 - uDamp);
  d += v;
  float len = length(d);
  if (len > uMaxD) d *= uMaxD / len;                                   // surface tension: the liquid can only stretch so far
  o = vec4(d, v);
}`;

/**
 * Final pass: ink that melts into mercury wherever the field is disturbed.
 * 1. sample the glyph mask through the displacement field (the warp)
 * 2. near the disturbance, threshold a blurred copy instead (surface tension → gooey merging edges)
 * 3. derive a normal from the displaced height field and shade it with a procedural studio environment
 */
export const DISPLAY_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uMask, uDomeA, uDomeB, uSim;
uniform vec2 uCss;
uniform float uBump, uReveal, uBaseline, uBand, uW0, uW1;
uniform vec3 uInk;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float heightAt(vec2 p) {
  vec2 q = p - texture(uSim, p).xy / uCss;
  return mix(texture(uDomeA, q).r, texture(uDomeB, q).r, 0.5);
}

// Procedural studio: stacked bright/dark bands (light from above), one hard horizon and a soft-box.
vec3 studio(vec3 r) {
  float t = r.y * 0.5 + 0.5 + 0.12 * r.x;
  float bands = 0.5 + 0.5 * cos(t * 6.28318 * 1.25 + 0.55);
  float v = mix(bands, smoothstep(0.32, 0.68, bands), 0.78);   // hard-edged reflections, like real polished metal
  v *= 1.0 - 0.8 * exp(-pow((r.y - 0.12) / 0.07, 2.0));
  float box = (1.0 - smoothstep(0.18, 0.30, abs(r.x + 0.10))) * smoothstep(0.35, 0.5, r.y) * (1.0 - smoothstep(0.75, 0.9, r.y));
  v += 0.7 * box;
  return vec3(mix(0.06, 1.0, clamp(v, 0.0, 1.0)));
}

void main() {
  vec2 uv = vUv;
  vec2 dsp = texture(uSim, uv).xy;
  float w = smoothstep(uW0, uW1, length(dsp));
  vec2 q = uv - dsp / uCss;

  float vis = 1.0;
  if (uReveal < 0.999) {
    float p = clamp(uReveal * 1.7 - uv.x * 0.7, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - p, 4.0);
    q.y += (1.0 - e) * uBand * 1.3;
    vis = step(uBaseline, uv.y);
  }

  float m  = texture(uMask, q).r;
  float hA = texture(uDomeA, q).r;
  float hB = texture(uDomeB, q).r;

  float hs = mix(hA, hB, 0.16 * w);
  float aa = max(fwidth(hs), 0.002);
  float liquid = smoothstep(0.47 - aa, 0.47 + aa, hs);
  float sil = mix(m, liquid, w) * vis;

  if (sil < 0.002) { outColor = vec4(0.0); return; }

  vec3 col = uInk;
  if (w > 0.003) {                       // chrome is only evaluated where the liquid is disturbed
    vec2 e2 = vec2(2.0) / uCss;
    float hx = heightAt(uv + vec2(e2.x, 0.0)) - heightAt(uv - vec2(e2.x, 0.0));
    float hy = heightAt(uv + vec2(0.0, e2.y)) - heightAt(uv - vec2(0.0, e2.y));
    vec3 n = normalize(vec3(-hx * uBump, -hy * uBump, 1.0));

    vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
    R = normalize(R + vec3(0.0, 0.16 * (uv.y - 0.5), 0.0));

    float hm = mix(hA, hB, 0.5);
    float rim = 1.0 - smoothstep(0.50, 0.68, hm);   // darker toward the silhouette: the classic liquid-metal contour

    vec3 chrome = studio(R);
    vec3 L = normalize(vec3(-0.35, 0.6, 0.72));
    vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
    chrome += pow(max(dot(n, Hh), 0.0), 140.0) * 1.3;
    // thin bright lip just inside the dark contour, strongest on edges that face the light (up)
    float lip = smoothstep(0.52, 0.58, hm) * (1.0 - smoothstep(0.58, 0.70, hm));
    chrome += lip * (0.25 + 0.75 * clamp(n.y * 2.0 + 0.5, 0.0, 1.0)) * 0.9;
    chrome *= 1.0 - 0.80 * rim;
    chrome = pow(clamp(chrome, 0.0, 1.0), vec3(1.08));
    col = mix(uInk, chrome, w * 0.97);
  }
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  outColor = vec4(col * sil, sil);
}`;
