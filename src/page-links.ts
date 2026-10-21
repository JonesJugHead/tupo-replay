import { goToReplays, MARKER, replayMenuSection } from './shell.js';

function addMenuSection() {
  const nav = document.querySelector('dialog.menu-drawer nav[aria-label="Menu"]');
  if (!nav || nav.querySelector(`[${MARKER}]`)) return;
  const anchor = nav.querySelector(':scope > section');
  const section = replayMenuSection(4);
  if (anchor?.nextSibling) nav.insertBefore(section, anchor.nextSibling);
  else nav.append(section);
}

function addSolvedButton() {
  const copyButton = [...document.querySelectorAll('dialog button')].find((b) => b.textContent?.trim() === 'Copy text');
  if (!copyButton?.parentElement || copyButton.parentElement.querySelector(`[${MARKER}]`)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = copyButton.className;
  button.setAttribute(MARKER, '');
  button.style.marginLeft = '0.5rem';
  button.textContent = 'Replay GIF';
  button.addEventListener('click', goToReplays);
  copyButton.after(button);
}

export function injectPageLinks() {
  let scheduled = false;
  const apply = () => {
    scheduled = false;
    addMenuSection();
    addSolvedButton();
  };
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }).observe(document, { childList: true, subtree: true });
}
