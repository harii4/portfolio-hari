/**
 * Every tunable in one place. Art direction lives here, not scattered through the modules.
 */
const BASE = import.meta.env.BASE_URL;

export const FRAMES = {
  count: 190,
  width: 646,          // cropped frame size produced by tools/process_frames.py
  height: 640,
  url: (i) => `${BASE}frames/f${String(i).padStart(3, '0')}.webp`,
};

export const TYPE = {
  text: 'PORTFOLIO',
  family: 'Anton',
  widthRatio: 0.945,   // share of viewport width the word occupies
  tracking: -0.006,    // em; Anton is already tight, this just closes optical gaps
  ink: [0.07, 0.07, 0.075],
};

export const COMPOSITION = {
  portraitHeight: 0.945,    // portrait height as share of viewport height (bottom-anchored, chest bleeds off)
  frontAlignShift: 0.017,   // nudges the canvas so the FINAL (front-facing) frame is exactly centred
  typeCenter: 0.47,         // vertical centre of the word, measured down the portrait (0 = frame top, 1 = bottom)
};

export const SCROLL = {
  lengthPerViewport: 2.4,   // pinned scroll distance, in viewport heights
  mobileLengthPerViewport: 1.9,   // phones: a shorter pin (touch scrolling covers distance fast)
  scrub: 0.55,              // (unused now: the frame follows the scroll directly; Lenis or the browser does the smoothing)
};

export const MERCURY = {
  simCell: 3,           // css px per simulation cell
  sigma: 0.36,          // cursor influence radius, as a multiple of cap height × this → see MercuryType
  spring: 0.0085,       // pull back to rest (lower = lingers longer)
  damping: 0.075,       // velocity loss per step (higher = more viscous)
  coupling: 0.19,       // how strongly neighbouring cells drag each other (organic spread)
  drag: 0.026,          // how much the cursor's velocity is imparted to the liquid
  radial: 0.20,
  hover: 0.16,          // steady bulge while the cursor merely rests over the type
  maxStretch: 0.55,     // furthest a point can travel, as a share of cap height         // outward push from the cursor (the "finger in mercury" bulge)
  bump: 7.5,            // normal strength used for reflections
  weightStart: 2.0,     // displacement (px) where ink begins turning to metal
  weightEnd: 20.0,      // displacement (px) where it is fully metal
  sleepAfterMs: 4500,
};
