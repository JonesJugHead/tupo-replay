type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;
export type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}

const parser = new DOMParser();

export function svg(markup: string, className?: string): SVGSVGElement {
  const source = markup.includes('xmlns=') ? markup : markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const parsed = parser.parseFromString(source, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
  const node = document.importNode(parsed, true);
  if (className) node.setAttribute('class', className);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
