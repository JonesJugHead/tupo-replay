const lucide = (body: string, stroke = 2) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  menu: lucide('<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>'),
  close: lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  calendar: lucide('<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>', 3.5),
  calendarDays: lucide(
    '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
    3.5,
  ),
  stats: '<svg viewBox="0 0 24 24" width="24" height="24"><g fill="currentColor" stroke="none"><rect x="2.5" y="13.5" width="5" height="7.5" rx="1.5"/><rect x="9.5" y="3" width="5" height="18" rx="1.5"/><rect x="16.5" y="7.5" width="5" height="13.5" rx="1.5"/></g></svg>',
  replay: lucide('<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>', 3.5),
  rules: lucide('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>', 3.5),
  tutorial: lucide('<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>', 3.5),
  about: lucide('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 3.5),
  feedback: lucide(
    '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/>',
    3.5,
  ),
  logo:
    '<svg viewBox="0 0 48 48"><rect x="2" y="2" width="20" height="20" rx="4" class="fill-tile-red"/><rect x="26" y="2" width="20" height="20" rx="4" class="fill-tile-blue"/><rect x="2" y="26" width="20" height="20" rx="4" class="fill-tile-green"/><rect x="26" y="26" width="20" height="20" rx="4" class="fill-tile-yellow"/><g font-family="system-ui, sans-serif" font-weight="900" font-size="13" text-anchor="middle" class="fill-ink dark:fill-slate-900"><text x="12" y="17">1</text><text x="36" y="17">2</text><text x="12" y="41">3</text><text x="36" y="41">4</text></g></svg>',
} as const;
