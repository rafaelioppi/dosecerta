/**
 * icons.js
 * Biblioteca de ícones SVG inline (stroke, estilo consistente, herdam currentColor).
 * Mantidos em JS para serem reutilizados por qualquer componente sem requisições extras.
 */

window.ICONS = {
  logo: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.12"/>
    <path d="M16 6c4 4.2 7 7.9 7 11.2A7 7 0 1 1 9 17.2C9 13.9 12 10.2 16 6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M12.5 19.5c0 1.9 1.6 3.5 3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  menu: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  close: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  sun: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="2"/>
    <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  moon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  target: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
  </svg>`,

  bolt: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  book: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  shield: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  calculator: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M8 7h8M8 12h1M12 12h1M16 12h1M8 16h1M12 16h1M16 16h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  pill: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3.5" y="9.5" width="17" height="7" rx="3.5" transform="rotate(-40 12 13)" stroke="currentColor" stroke-width="2"/>
    <path d="M11 11l2 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  flow: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="4" y="3" width="7" height="5" rx="1.2" stroke="currentColor" stroke-width="2"/>
    <rect x="13" y="9.5" width="7" height="5" rx="1.2" stroke="currentColor" stroke-width="2"/>
    <rect x="4" y="16" width="7" height="5" rx="1.2" stroke="currentColor" stroke-width="2"/>
    <path d="M7.5 8v5.5a2 2 0 0 0 2 2h3M13 12h-3.5" stroke="currentColor" stroke-width="2"/>
  </svg>`,

  clipboard: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <rect x="5.5" y="6" width="13" height="15" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M9 12h6M9 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  alert: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
  </svg>`,

  refresh: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8M4 12a8 8 0 0 0 13.7 5.7L20 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20 4v4h-4M4 20v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  mail: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  phone: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3.5 6.2 2 2 0 0 1 5.5 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,

  pin: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" stroke-width="2"/>
  </svg>`,

  linkedin: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/>
    <path d="M7.5 10v6.5M7.5 7.6v.1M11.5 16.5V13c0-1.4 1-2.4 2.3-2.4S16 11.6 16 13v3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  instagram: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor"/>
  </svg>`,

  arrow: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};
