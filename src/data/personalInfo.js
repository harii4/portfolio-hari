/**
 * Single source of truth for personal details.
 * Everything here was taken from the supplied Gemini Argon portfolio (hari-krishna-argon-portfolio/index.html).
 * Nothing is invented: if a detail does not exist in the source it is left empty (see `socials`).
 */
export const personalInfo = {
  name: 'Hari Krishna',
  role: 'Thumbnail designer & visual creative',
  specialty: 'Photoshop specialist',
  availability: 'Available for freelance & agency retainers',

  bio:
    "I'm a visual designer specializing in creating bold, engaging thumbnails that turn ideas into visual stories. " +
    'With a focus on composition, color, and visual hierarchy, I craft designs that capture attention and communicate with impact. ' +
    'I bring concepts to life through creativity and precision, using Photoshop as my primary creative tool.',

  tools: ['Adobe Photoshop', 'Visual Hierarchy', 'Color & Lighting', 'High-CTR Composition', 'Visual Storytelling'],
  niches: ['Podcast & Founders', 'Documentary', 'AI & Tech', 'Health & Lifestyle'],

  contact: {
    email: 'hariieditz4@gmail.com',
    emailSubject: 'Thumbnail Design Inquiry — Portfolio',
    phoneDisplay: '+91 6379475514',
    phoneTel: '+916379475514',
    whatsappNumber: '916379475514',
    whatsappMessage: 'Hi Hari, I saw your portfolio and want to start working with you on thumbnails!',
  },

  /**
   * Social profiles: the supplied Gemini project contains no social links, so none are shown.
   * Add entries here ({ label: 'Instagram', url: 'https://…' }) and the Contact section renders them automatically.
   */
  socials: [],
};

export const links = {
  mailto: () => {
    const { email, emailSubject } = personalInfo.contact;
    return `mailto:${email}?subject=${encodeURIComponent(emailSubject)}`;
  },
  tel: () => `tel:${personalInfo.contact.phoneTel}`,
  whatsapp: () => {
    const { whatsappNumber, whatsappMessage } = personalInfo.contact;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  },
};
