import { writeFileSync } from 'node:fs';
import { launchFirefox, sleep } from './bidi.mjs';

const out = process.argv[2];
const ff = await launchFirefox();
try {
  await ff.navigate('https://playtupo.com/');
  await sleep(4000);
  console.log(await ff.evaluate(`[...document.querySelectorAll('button, a')].map((x) => x.textContent.trim()).filter(Boolean).join(' | ')`));
  console.log(await ff.evaluate(`(() => { const b = [...document.querySelectorAll('button, a')].find((x) => /^(Play|Resume|Start)/i.test(x.textContent.trim())); b?.click(); return b?.textContent ?? 'none'; })()`));
  await sleep(3000);
  writeFileSync(`${out}/game.html`, await ff.evaluate('document.documentElement.outerHTML'));
  await ff.screenshot(`${out}/game.png`);
  console.log(await ff.evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).slice(0, 400)])), null, 1)`));
} finally {
  ff.close();
}
