# Hari Krishna — portfolio

Hero → Works → Testimonials → About → Contact → Final showcase.
Vanilla JS + Vite, GSAP + ScrollTrigger, Lenis, WebGL. No framework, no environment variables, no backend.

## Run
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
npm run preview      # serve the production build locally
```
Needs Node 18+. Open it through a server (not file://).

## Deploy
`dist/` is a static site (relative asset paths, so it works at a domain root or in a sub-folder).
- **Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, output directory `dist`.
- **Any static host:** upload the contents of `dist/`. The host must support HTTP range requests for the video (all common hosts do).
- No environment variables are used.

## Where things live
```
src/data/personalInfo.js   name, bio, email, phone, WhatsApp, socials   ← edit contact details here
src/data/thumbnails.js     the Works gallery                              ← add/replace thumbnails here
src/data/testimonials.js   the testimonial + proof points
src/data/navigation.js     section ids and nav links
src/works/                 RibbonGallery.js (the Rearing Ribbon engine), ribbonShaders.js, WorksSection.js
src/sections/              Testimonials, About, Contact, FinalShowcase
src/layout/SiteNav.js      sticky nav + smooth anchor scrolling
src/lib/Preview.js         the accessible image preview (<dialog>)
src/lib/scroll.js          Lenis + GSAP ticker integration (the single scroll controller)
src/preloader/Preloader.js the first-visit loader (markup + first-paint CSS are in index.html)
src/hero/ src/gl/ src/core/  the locked Hero — unchanged
public/images, public/videos  optimised assets
tools/process_frames.py    how the hero's portrait frames were produced
```

## Adding a thumbnail
1. Put the image in `public/images/thumbnails/` (WebP/JPG/PNG, any size, 1920 px wide is plenty).
2. Add one line to `src/data/thumbnails.js`: `t('file-name-without-extension', 'Title')`.
That is all. The card's shape comes from the image's own width ÷ height (16:9 is only the fallback), so a different
aspect ratio simply makes a different-shaped card. Options per entry: `featured: true` (larger card), `ratio` + `focus` + `zoom`
(deliberately crop to another ratio), `alt`. Pictures are never stretched or cropped unless you ask.

## How the ribbon was adapted
`src/works/RibbonGallery.js` is the supplied Rearing Ribbon JavaScript ported into a module. Constants, shaders, S-curve, bank/door/tilt, scroll inertia, speed surge,
pointer dent, loader-bars-become-cards entrance and floor are unchanged. Changed: the generated demo cards were replaced by real images;
the square 1024² texture was replaced by an aspect-correct one (picture in the smallest power-of-two texture, edge-replicated padding, `uvScale` in the
fragment shader so only the picture is sampled; mipmaps and anisotropic filtering kept); per-card height; open-preview action; WebGL cleanup; render-only-when-visible;
flat fallback when WebGL is missing. Click a side card → it centres; click the centred card, press Enter, or use "View thumbnail" → preview.
Keyboard: ← → move, Enter opens, Esc closes the preview.

## Scrolling model
- **One controller.** `src/lib/scroll.js` follows the official Lenis/GSAP recipe (`lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`,
  `lagSmoothing(0)`, `autoRaf: false`). The hero's liquid type, the ribbon and Lenis all run on GSAP's one ticker.
- **Mouse / trackpad devices:** Lenis (lerp 0.12: smooth, never behind your hand).
- **Touch devices (phones, tablets): no Lenis at all.** The browser's own scrolling is instant, has native momentum and runs on the compositor thread; ScrollTrigger just reads
  the native position. Anchor jumps use the browser's smooth scrolling there. Reduced-motion users also get no Lenis.
- **The hero pin is CSS.** The hero is `position: sticky` inside `#hero-track` (height = viewport × `--hero-run`, set from `SCROLL` in `src/core/config.js`), exactly like the Works stage.
  It used to be a ScrollTrigger pin (`position: fixed` toggled from JS), which jitters under native touch scrolling and snapped early on fast upward scrolls (`anticipatePin`).
  ScrollTrigger now only reports progress (`scrub: true`), so the portrait frame equals the scroll position exactly (measured error < 0.05 frames, both directions).
- The hero's WebGL pauses while off screen and ignores touch; the ribbon renders only while visible, at ≤ 1.5× pixel ratio and without MSAA on touch devices.
- On touch devices a tap on the ribbon opens only the centred card, never a peeking neighbour, and a tap that merely stops a scrolling page does nothing.

## Preloader
`index.html` contains the loader markup and its first-paint CSS, so the very first frame the browser paints is the loader (no hero flash, no blank). The loader is the hero's own word:
PORTFOLIO is drawn white-on-black on a canvas at exactly the hero word's position/size/kerning (same `computeLayout` + `measureTitle`), rising with the hero's own stagger.
When the essentials are ready, the black panel lifts and the hero's black word rises beneath it at the same coordinates, starting mid-transition.
- **Essentials only:** the display font, the first portrait frame and the hero's renderers. Everything else (189 more frames, Works images, the video) loads in the background.
- **No fake progress:** no percentage, no bar. The entrance is a fixed ~1.3 s; the exit waits for the essentials and is capped (10 s) so it can never trap a visitor.
- **Once per page load.** `hero.init({ deferIntro: true })` + `hero.playIntro()` (idempotent) mean the hero intro plays exactly once, as the panel lifts.
- **Reduced motion:** the word is shown and the panel simply fades. **No JS:** the loader is hidden by `<noscript>`.
- To restyle: `src/preloader/Preloader.js` (entrance/exit timeline), the markup + inline CSS in `index.html`, and the label rules in `src/styles/sections.css`.

## Test it like a visitor
`npm run dev` serves unminified code with HMR and is noticeably heavier on a phone. Judge smoothness on `npm run build && npm run preview -- --host` (or your deployed site).

## Notes
- Reduced-motion users get a static ribbon, no scroll reveals and a still showcase poster. Data-saver users also get the poster instead of the video.
- Phones load a lighter showcase video and 1024-px textures.
- Hero, Works and the showcase are the heavy parts; everything pauses when off screen.
- Phones: WebGL renders at ≤1.5× pixel ratio, the hero pin is shorter, Works shows one card sized to the screen with its name beneath, navigation becomes Menu, and the showcase video is a full-width band.
