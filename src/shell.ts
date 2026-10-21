import { cls, h, svg } from './dom.js';
import { ICONS } from './icons.js';

export const REPLAY_PATH = '/?replay';
export const MARKER = 'data-tupo-replay';

const HEADER = 'site-header shrink-0 panel rounded-none border-0 border-b-[3px] shadow-none sm:border-b-4';
const HEADER_ROW = `mx-auto flex w-full items-center gap-3 pt-[max(0.25rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))]
  pb-2 pl-[max(0.5rem,env(safe-area-inset-left))] 2xs:pr-[max(1rem,env(safe-area-inset-right))] 2xs:pl-[max(1rem,env(safe-area-inset-left))]
  [@media(min-height:32rem)]:pt-[max(0.75rem,env(safe-area-inset-top))] [@media(min-height:32rem)]:pb-3.5
  [@media(min-height:48rem)]:pt-[max(1rem,env(safe-area-inset-top))] [@media(min-height:48rem)]:pb-4.25`;
const MENU_BTN = 'btn flex h-10 w-auto shrink-0 items-center justify-center gap-2 btn-md max-[22.5rem]:size-9 max-[22.5rem]:px-0';
const DRAWER = 'menu-drawer fixed inset-y-0 m-0 h-dvh max-h-none w-[min(22rem,calc(100%-2rem))] max-w-none border-0 border-edge bg-page p-0 text-ink';
const MENU_H3 = 'text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400';
const MENU_LINK = `group mt-1 flex w-full items-center gap-2.5 self-start rounded font-display text-lg leading-[1.1] font-black
  outline-offset-2 duration-150 first-of-type:mt-0 hover:underline hover:decoration-2 hover:underline-offset-4 2xs:text-xl`;
const MENU_ICON = `size-5 shrink-0 fill-sky-200 transition-colors duration-150 group-hover:fill-sky-300 group-focus:fill-sky-300
  dark:fill-none! dark:stroke-sky-300 dark:group-hover:stroke-sky-200 dark:group-focus:stroke-sky-200`;

export function goToReplays(event?: Event) {
  event?.preventDefault();
  event?.stopPropagation();
  location.assign(REPLAY_PATH);
}

function menuLink(href: string, icon: string, label: string, stagger: number, onclick?: EventListener) {
  const link = h('a', { class: cls(MENU_LINK), href, onclick }, svg(icon, cls(MENU_ICON)), ` ${label}`);
  link.style.setProperty('--stagger', String(stagger));
  return link;
}

function menuSection(title: string, stagger: number, ...links: HTMLElement[]) {
  const heading = h('h3', { class: MENU_H3 }, title);
  heading.style.setProperty('--stagger', String(stagger));
  return h('section', { class: 'flex flex-col gap-3' }, heading, ...links);
}

export function replayMenuSection(stagger: number): HTMLElement {
  const section = menuSection('Replay', stagger, menuLink(REPLAY_PATH, ICONS.replay, 'My replays', stagger + 1, goToReplays));
  section.setAttribute(MARKER, '');
  return section;
}

function buildDrawer(): HTMLDialogElement {
  const drawer = h(
    'dialog',
    { class: cls(DRAWER), 'aria-label': 'Menu' },
    h(
      'div',
      { class: 'flex min-h-full flex-col gap-12 p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]' },
      h(
        'div',
        { class: 'flex items-center justify-between gap-4' },
        h(
          'h2',
          { class: 'flex font-display text-2xl font-bold' },
          h('a', { class: 'flex h-12 w-auto items-center gap-2 rounded', href: '/' }, svg(ICONS.logo, 'h-full w-auto'), h('span', { class: 'tr-drawer-title' }, 'Tupo')),
        ),
        h(
          'button',
          { type: 'button', class: 'btn flex size-10 items-center justify-center', 'aria-label': 'Close menu', onclick: (() => drawer.close()) as EventListener },
          svg(ICONS.close, 'lucide lucide-x lucide-icon h-4 w-4 stroke-4'),
        ),
      ),
      h(
        'nav',
        { class: 'flex flex-col gap-10', 'aria-label': 'Menu' },
        menuSection('Play', 0, menuLink('/', ICONS.calendar, 'Today’s puzzle', 1), menuLink('/week', ICONS.calendarDays, 'This week’s puzzles', 2), menuLink('/stats', ICONS.stats, 'Your stats', 3)),
        replayMenuSection(4),
        menuSection('Learn', 6, menuLink('/rules', ICONS.rules, 'How to play', 7), menuLink('/tutorial', ICONS.tutorial, 'Interactive tutorial', 8), menuLink('/about', ICONS.about, 'About Tupo', 9)),
        menuSection('Contact', 10, menuLink('/feedback', ICONS.feedback, 'Send feedback', 11)),
      ),
    ),
  );
  drawer.style.left = '0px';
  drawer.style.right = 'auto';
  drawer.style.borderLeftWidth = '0px';
  drawer.style.borderRightWidth = 'var(--border-fluid)';
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) drawer.close();
  });
  return drawer;
}

export function mountShell(body: HTMLElement, title: string): HTMLElement {
  document.title = `${title} · Tupo`;
  const drawer = buildDrawer();
  const header = h(
    'header',
    { class: HEADER },
    h(
      'div',
      { class: cls(HEADER_ROW) },
      h(
        'button',
        { type: 'button', class: MENU_BTN, 'aria-label': 'Open menu', 'aria-haspopup': 'dialog', onclick: (() => drawer.showModal()) as EventListener },
        svg(ICONS.menu, 'lucide lucide-menu lucide-icon size-4 stroke-4'),
        ' ',
        h('span', { class: 'max-[22.5rem]:sr-only' }, 'Menu'),
      ),
      h('h1', { class: 'tr-header-title font-display font-black' }, title),
    ),
  );
  const content = h('main', { class: 'flex flex-1 flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]' });
  body.replaceChildren(h('div', { class: 'grid min-h-dvh grid-cols-1 grid-rows-[auto_1fr]' }, header, content), drawer);
  return content;
}
