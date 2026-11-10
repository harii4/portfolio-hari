/**
 * The Rearing Ribbon shaders, kept as supplied. The ONLY change is in RIBBON_FRAGMENT:
 *   - a `uvScale` uniform, so a card whose picture sits inside a larger power-of-two texture samples only the
 *     picture (see RibbonGallery.texturize) instead of the whole padded square. `vUv` itself is untouched, because the
 *     corners, the loader-bar fill and the rounded outline all need the card's own 0–1 space.
 *   - an `ink` uniform: the loader bars were white on black; on the white page they are ink.
 *   The perspective grid / floor of the original has been removed on purpose (white theme).
 */
export const RIBBON_VERTEX = `
  attribute vec2 corner;
  uniform vec2 page;       /* half the page, in pixels */
  uniform float eye;       /* the camera's distance from the page */
  uniform vec4 box;        /* the card where it would lie flat: left, bottom, width, height, in pixels from the middle */
  uniform float on;        /* 0 while the card is still a loader bar, 1 on the ribbon */
  uniform float hover;
  uniform float depth;
  uniform float span;
  uniform float shift;
  uniform float curve;     /* 1 the S, 0 a bowl (narrow screens have no room for an S) */
  uniform float bank;
  uniform float door;
  uniform float tilt;
  uniform vec2 rear;
  uniform float wring;
  uniform float speed;
  uniform float dent;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDeep;
  const float PI = 3.141592653589793;

  void main() {
    vUv = corner;
    vec3 p = vec3(box.xy + corner * box.zw, 0.);

    /* the dent under the pointer: a dome that is zero along every edge, so the outline never moves */
    vec2 c = corner * 2. - 1.;
    float dome = (1. - c.x * c.x) * (1. - c.y * c.y);
    float bow = hover * dent * box.w;
    p.z -= bow * dome;

    /* where this point is across the page, and the surface's height and slope there: the bell brings both back
       to flat off the page by itself, so a card coming in takes the curve gradually */
    float s = p.x / page.x;
    float q = s * span + shift;
    float bell = exp(-q * q);
    float shape = mix(1. - q * q, sin(PI * q), curve) * bell;
    float slope = mix(-2. * q * (2. - q * q), PI * cos(PI * q) - 2. * q * sin(PI * q), curve) * bell;

    /* the roll about the ribbon's centre line: the bank, read off the slope, plus the wring at speed */
    float roll = (bank * slope / PI * curve + wring * speed * smoothstep(0.3, 0.9, abs(s)) * sign(s)) * on;
    float cr = cos(roll);
    float sr = sin(roll);
    p.yz = vec2(p.y * cr - p.z * sr, p.y * sr + p.z * cr);

    /* depth: the S, and the door (a smooth ramp, flat past the edges) */
    float e = clamp(s, -1., 1.);
    p.z += (-depth * shape + door * page.x * e * (1.5 - 0.5 * e * e)) * on;
    p.y += tilt * p.x * on;

    /* at speed the left side rears: up, and towards the camera */
    float lift = (1. - smoothstep(-1., 0.3, s)) * speed * on;
    p.y += rear.x * page.x * lift;
    p.z += rear.y * page.x * lift;

    /* the normal comes from the same formulas, not from the mesh: the sheen needs it exact */
    float dzdx = (-depth * slope * span / page.x + door * 1.5 * (1. - e * e)) * on + 4. * bow * c.x * (1. - c.y * c.y) / box.z;
    float dzdy = 4. * bow * c.y * (1. - c.x * c.x) / box.w;
    vec3 n = normalize(vec3(-dzdx, -dzdy, 1.));
    vNormal = vec3(n.x, n.y * cr - n.z * sr, n.y * sr + n.z * cr);
    vDeep = (clamp((1. + shape) * 0.5, 0., 1.) * on + bow * dome / (2. * depth + 0.0001));

    float w = eye - p.z;
    gl_Position = vec4(p.x * eye / page.x, p.y * eye / page.y, -p.z / (page.x * 2.) * w, w);
  }`;

export const RIBBON_FRAGMENT = `
  precision highp float;
  uniform sampler2D picture;
  uniform vec2 uvScale;    /* the share of the texture the picture fills (the rest is edge-replicated padding) */
  uniform vec4 box;
  uniform float on;
  uniform float corners;
  uniform vec3 ink;        /* the colour of a loader bar */
  uniform float wash;      /* 1 the loader bar, 0 the picture */
  uniform float fill;      /* how much of a loader bar is filled */
  uniform float alpha;
  uniform float shade;
  uniform float gloss;
  uniform float density;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDeep;
  void main() {
    if (vUv.x > fill) discard;
    vec2 p = (vUv - 0.5) * box.zw;
    vec2 d = abs(p) - (box.zw * 0.5 - corners);
    float outside = length(max(d, 0.)) + min(max(d.x, d.y), 0.) - corners;
    float inside = 1. - smoothstep(-0.7, 0.7, outside * density);
    if (inside < 0.01) discard;
    vec3 colour = mix(texture2D(picture, vUv * uvScale).rgb, ink, wash);
    /* darker towards the far end of the S, a light from up on the left, and a tight sheen */
    vec3 n = normalize(vNormal);
    vec3 light = normalize(vec3(-0.4, 0.5, 1.));
    colour *= 1. - shade * clamp(vDeep, 0., 1.) * (1. - wash);
    colour *= 1. - 0.12 * on * (1. - (dot(n, light) * 0.5 + 0.5));
    colour += pow(max(dot(n, normalize(light + vec3(0., 0., 1.))), 0.), 48.) * gloss * on;
    gl_FragColor = vec4(colour, 1.) * inside * alpha;
  }`;
