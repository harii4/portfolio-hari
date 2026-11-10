/**
 * Testimonial content, taken verbatim from the supplied Gemini Argon portfolio.
 * The only direct client quote in that project is the #win-of-the-day message below (see the screenshot).
 * The author's name/designation is not visible in the screenshot (it shows "You"), so none is invented.
 */
const img = `${import.meta.env.BASE_URL}images/testimonials/`;

export const testimonial = {
  quote: 'Hari (who is not here) - for designing all the thumbnail that have consistently given 7-8-9% CTRs',
  source: 'GrowthOS team',
  context: '#win-of-the-day · Uncovered with Suketu Shah',
  note: 'Posted when the channel passed its 3K subscriber mark.',
  screenshot: {
    src: `${img}growthos-win-of-the-day.webp`,
    width: 1024,
    height: 702,
    alt: 'Screenshot of the GrowthOS #win-of-the-day message crediting Hari for thumbnails that consistently gave 7-8-9% CTRs',
    caption: 'GrowthOS #win-of-the-day — Uncovered with Suketu Shah',
  },
};

/** Agency proof points, as written in the Gemini project. */
export const proof = [
  {
    figure: '7–9%',
    label: 'Consistent CTR',
    text: 'Complete thumbnail system for Uncovered with Suketu Shah, helping a small team pass the 3K+ subscriber milestone with billionaire industrialists as guests.',
    partner: 'GrowthOS',
  },
  {
    figure: '+5,000',
    label: 'New subscribers',
    text: 'Overhauled the visual packaging for a second agency, stabilising view consistency across uploads at a reliable 5–7% click-through rate.',
    partner: 'Channel growth retainer',
  },
  {
    figure: '5–7%',
    label: 'Average CTR',
    text: 'Maintained across the second agency’s uploads, alongside the subscriber growth.',
    partner: 'Channel growth retainer',
  },
];
