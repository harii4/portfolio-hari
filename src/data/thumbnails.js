/**
 * THE one place to add, remove or reorder thumbnails. Drop the file in public/images/thumbnails/ and add a line.
 *
 *   src       path of the image (required)
 *   title     shown in the gallery counter and in the preview (optional)
 *   alt       accessible description (defaults to the title)
 *   width/height  the file's pixel size, used ONLY to lay the ribbon out before the image has loaded.
 *             The real ratio always comes from naturalWidth / naturalHeight once it loads (fallback 16:9).
 *   ratio     optional: force a different card ratio. The image is then cover-cropped to it (otherwise it is never cropped)
 *   focus     optional {x, y} (0–1) where a forced-ratio crop is centred. Default {x: .5, y: .5}
 *   zoom      optional (>1) punch-in, used together with `focus`
 *   featured  optional: render this card larger (scale 1.16). Or give an explicit `scale`.
 */
const base = `${import.meta.env.BASE_URL}images/thumbnails/`;
const t = (file, title, extra = {}) => ({ src: `${base}${file}.webp`, title, width: 1920, height: 1080, ...extra });

export const thumbnails = [
  t('heal-all-diseases', 'Heal all your diseases'),
  t('i-dominate', 'I don’t compete, I dominate'),
  t('man-who-beat-tata', 'The man who beat Tata'),
  t('opus-vs-gpt', 'Opus 4.6 vs GPT 5.3 — is the paid version worth it'),
  t('most-failed', 'Most failed'),
  t('maths-god', 'Maths God'),
  t('marico-son', 'I didn’t choose my son for Marico'),
  t('debt-vs-equity', 'Debt vs equity financing'),
  t('queen-of-chickens', 'Queen of Hearts to Queen of Chickens'),
  t('youre-addicted', 'You’re addicted'),
  t('why-playboys-get-most-girls', 'Why playboys get most girls'),
  t('bhagavad-gita', '“Bhagavad Gita changed my life”'),
];
