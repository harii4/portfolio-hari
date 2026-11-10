/** Section order is the visitor journey: Hero → Works → Testimonials → About → Contact → Final showcase. */
export const sections = {
  hero: 'top',
  works: 'work',
  testimonials: 'testimonials',
  about: 'about',
  contact: 'contact',
  showcase: 'showcase',
};

export const navigation = [
  { label: 'Work', href: `#${sections.works}` },
  { label: 'Testimonials', href: `#${sections.testimonials}` },
  { label: 'About', href: `#${sections.about}` },
  { label: 'Contact', href: `#${sections.contact}` },
];
