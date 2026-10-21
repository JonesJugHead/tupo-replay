const STYLE_TIMEOUT_MS = 3000;

export function tupoPrefersDark(): boolean {
  let theme = 'system';
  try {
    theme = JSON.parse(localStorage.getItem('tupo:settings') || '{}')?.theme || 'system';
  } catch {
    theme = 'system';
  }
  return theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

function blockTupoScripts() {
  window.stop();
  document.addEventListener('beforescriptexecute', (event) => event.preventDefault(), true);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement) {
          node.type = 'javascript/blocked';
          node.remove();
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

async function loadTupoStyles(head: HTMLHeadElement) {
  try {
    const response = await fetch(`${location.origin}/`, { credentials: 'omit' });
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const loads: Promise<unknown>[] = [];
    for (const link of page.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="icon"]')) {
      const href = new URL(link.getAttribute('href') ?? '', `${location.origin}/`);
      if (href.origin !== location.origin) continue;
      const el = document.createElement('link');
      el.rel = link.rel;
      el.href = href.href;
      if (el.rel === 'stylesheet') loads.push(new Promise((resolve) => ((el.onload = resolve), (el.onerror = resolve))));
      head.appendChild(el);
    }
    await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, STYLE_TIMEOUT_MS))]);
  } catch {
    return;
  }
}

export function takeOverPage(): { body: HTMLElement; styled: Promise<void> } {
  blockTupoScripts();
  const html = document.createElement('html');
  html.lang = 'en';
  html.className = 'tupo-replay';
  if (tupoPrefersDark()) html.classList.add('dark');
  const head = document.createElement('head');
  const charset = document.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  head.append(charset, viewport, document.createElement('title'));
  const body = document.createElement('body');
  html.append(head, body);
  if (document.documentElement) document.replaceChild(html, document.documentElement);
  else document.appendChild(html);
  const styled = loadTupoStyles(head).finally(() => html.classList.add('tr-styled'));
  return { body, styled };
}
