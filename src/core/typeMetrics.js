/**
 * Measures the word so that its *ink* (not its advance box) spans an exact width,
 * with kerning preserved and tracking applied manually (ctx.letterSpacing is not universal).
 */
export function measureTitle({ text, family, targetWidth, tracking }) {
  const ctx = document.createElement('canvas').getContext('2d');
  const S0 = 400;
  ctx.font = `400 ${S0}px ${family}`;
  const n = text.length;
  const track0 = tracking * S0;

  // x of each glyph origin, kerning included, via prefix widths
  const origins = [];
  for (let i = 0; i < n; i++) origins.push(ctx.measureText(text.slice(0, i)).width + i * track0);

  const whole = ctx.measureText(text);
  const inkLeft = -whole.actualBoundingBoxLeft;
  const inkRight = whole.actualBoundingBoxRight + (n - 1) * track0;
  const k = targetWidth / (inkRight - inkLeft);

  const cap = ctx.measureText('H');
  return {
    fontSize: S0 * k,
    capHeight: cap.actualBoundingBoxAscent * k,
    originX: -inkLeft * k,                 // add to the left edge of the ink box
    origins: origins.map((o) => o * k),
    letters: [...text],
  };
}
