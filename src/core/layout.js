import { FRAMES, COMPOSITION, TYPE } from './config.js';

/**
 * Single source of truth for composition. Both the portrait canvas and the type canvas
 * read from this, so the two layers always behave as one artwork.
 */
export function computeLayout(W, H) {
  const aspect = FRAMES.width / FRAMES.height;

  // Never let the portrait be wider than the screen allows. On tall/narrow screens the
  // shoulders are allowed to run slightly past the edges rather than shrinking the head.
  const widthCap = W < 700 ? W * 1.3 : W * 1.02;
  const h = Math.min(H * COMPOSITION.portraitHeight, widthCap / aspect);
  const w = h * aspect;

  const portrait = {
    w, h,
    x: (W - w) / 2 + w * COMPOSITION.frontAlignShift,
    y: H - h, // bottom-anchored: chest bleeds off the viewport edge
  };

  const type = {
    width: W * TYPE.widthRatio,
    cx: W / 2,
    cy: portrait.y + h * COMPOSITION.typeCenter,
  };

  return { W, H, portrait, type };
}
