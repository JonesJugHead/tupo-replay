import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchFirefox, sleep } from './bidi.mjs';

const SHOTS = resolve(process.env.SHOTS_DIR ?? 'e2e/screenshots');
const COLOR_KEYS = ['b', 'g', 'y', 'r', 'p'];
const PAUSE_MS = 5000;
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

function solve(n, givens) {
  const shapes = Array(n * n).fill(null);
  const colors = Array(n * n).fill(null);
  for (const g of givens) {
    shapes[g.cell] = g.shape;
    colors[g.cell] = g.color;
  }
  const fits = (cell, shape, color) => {
    const row = Math.floor(cell / n);
    const col = cell % n;
    for (let other = 0; other < n * n; other++) {
      if (other === cell) continue;
      const sameLine = Math.floor(other / n) === row || other % n === col;
      if (sameLine && (shapes[other] === shape || colors[other] === color)) return false;
      if (shapes[other] === shape && colors[other] === color) return false;
    }
    return true;
  };
  const fill = (cell) => {
    if (cell === n * n) return true;
    const fixedShape = shapes[cell];
    const fixedColor = colors[cell];
    for (let shape = 0; shape < n; shape++) {
      if (fixedShape !== null && fixedShape !== shape) continue;
      for (let color = 0; color < n; color++) {
        if (fixedColor !== null && fixedColor !== color) continue;
        shapes[cell] = shape;
        colors[cell] = color;
        if (fits(cell, shape, color) && fill(cell + 1)) return true;
      }
    }
    shapes[cell] = fixedShape;
    colors[cell] = fixedColor;
    return false;
  };
  if (!fill(0)) throw new Error('No solution');
  return { shapes, colors };
}

mkdirSync(SHOTS, { recursive: true });
const THEME = process.env.THEME === 'light' ? 'light' : 'dark';
const STORE = resolve('store');
const ff = await launchFirefox({ theme: THEME, width: 1280, height: 885 });
try {
  await ff.navigate('https://playtupo.com/');
  await sleep(4000);
  await ff.evaluate(`[...document.querySelectorAll('button, a')].find((x) => /^(Play|Resume|Start)/i.test(x.textContent.trim()))?.click()`);
  await sleep(2500);

  const puzzle = await ff.json(`(() => {
    const key = Object.keys(localStorage).find((k) => /^tupo:puzzle:\\d{4}-\\d{2}-\\d{2}$/.test(k));
    return JSON.parse(localStorage.getItem(key));
  })()`);
  const n = puzzle.n;
  const solution = solve(n, puzzle.givens);
  const given = (cell, attr) => puzzle.givens.some((g) => g.cell === cell && g[attr] !== null);
  console.log(`Puzzle ${puzzle.date} ${puzzle.level} ${n}x${n}`);

  const selectCell = async (cell) => {
    await ff.evaluate(`(() => {
      const tile = document.querySelectorAll('[role="gridcell"]')[${cell}];
      if (tile.getAttribute('aria-selected') === 'true') return;
      tile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', isPrimary: true }));
      tile.click();
      tile.focus();
    })()`);
    await sleep(60);
  };
  const play = async (cell, attr, value) => {
    await selectCell(cell);
    await ff.key(attr === 'shape' ? String(value + 1) : COLOR_KEYS[value]);
    await sleep(350);
  };

  const todo = [];
  for (let cell = 0; cell < n * n; cell++) {
    if (!given(cell, 'shape')) todo.push([cell, 'shape', solution.shapes[cell]]);
    if (!given(cell, 'color')) todo.push([cell, 'color', solution.colors[cell]]);
  }
  const [firstCell, firstAttr, firstValue] = todo[0];
  const wrongValue = (firstValue + 1) % n;
  await play(firstCell, firstAttr, wrongValue);
  await sleep(1200);
  await play(firstCell, firstAttr, firstValue);
  for (const move of todo.slice(1, 4)) await play(...move);

  await ff.evaluate(`window.dispatchEvent(new Event('blur'))`);
  await sleep(300);
  const pausedLabel = await ff.evaluate(`document.querySelector('[aria-label="Resume"]') ? 'paused' : 'running'`);
  check(pausedLabel === 'paused', `Tupo pauses its timer when the window loses focus (${pausedLabel})`);
  await sleep(PAUSE_MS);
  await ff.evaluate(`document.querySelector('[aria-label="Resume"]')?.click()`);
  await sleep(300);

  for (const move of todo.slice(4)) await play(...move);
  await sleep(2500);
  await ff.screenshot(join(SHOTS, 'tupo-won.png'));
  const solvedButton = await ff.evaluate(`!!document.querySelector('dialog button[data-tupo-replay]')`);
  check(solvedButton, 'a Replay GIF button is added to the Solved dialog');

  await ff.evaluate(`document.querySelector('[aria-label="Open menu"]').click()`);
  await sleep(1200);
  await ff.screenshot(join(SHOTS, 'tupo-menu.png'));
  const linked = await ff.evaluate(`(() => { const a = document.querySelector('section[data-tupo-replay] a'); a?.click(); return !!a; })()`);
  check(linked, 'a My replays link is added to the Tupo menu');
  await sleep(3000);
  const page = await ff.evaluate(`location.href + ' | ' + document.title`);
  check(page === 'https://playtupo.com/?replay | Replays · Tupo', `the link opens the replays page in the same tab (${page})`);
  const tabs = (await ff.cmd('browsingContext.getTree', {})).contexts.length;
  check(tabs === 1, `no extra tab is opened (${tabs})`);
  const tupoBooted = await ff.evaluate(`!!document.querySelector('[role="grid"]') || [...document.scripts].some((s) => s.src.includes('_app'))`);
  check(!tupoBooted, 'Tupo does not run on the replays page');
  const recordings = JSON.parse(
    await ff.evaluate(`new Promise((resolve) => {
      addEventListener('message', (e) => e.data?.tupoReplayDump && resolve(e.data.tupoReplayDump));
      postMessage('tupo-replay:dump', location.origin);
    })`),
  );
  check(recordings.length === 1, `one recording stored (${recordings.length})`);
  const rec = recordings[0];
  const changes = rec.steps.flatMap((s) => s.changes);
  check(rec.status === 'won', `recording finished as won (${rec.status})`);
  check(!rec.partial, 'recording starts from the givens');
  check(rec.level === puzzle.level, `level kept (${rec.level})`);
  check(rec.steps.length >= todo.length + 1, `every move recorded, mistake included (${rec.steps.length} steps for ${todo.length + 1} key presses)`);
  const mistake = changes.find((c) => c.cell === firstCell && (firstAttr === 'shape' ? c.shape : c.color) === wrongValue);
  check(!!mistake, 'the wrong value is in the replay');
  const finalBoard = rec.steps.reduce(
    (b, s) => {
      for (const c of s.changes) {
        b.shapes[c.cell] = c.shape;
        b.colors[c.cell] = c.color;
      }
      return b;
    },
    { shapes: rec.initial.shapes.slice(), colors: rec.initial.colors.slice() },
  );
  check(JSON.stringify(finalBoard) === JSON.stringify(solution), 'replay ends on the solved board');
  const pauseStep = rec.steps.findIndex((s, i) => i > 0 && s.wallMs - rec.steps[i - 1].wallMs >= PAUSE_MS);
  const gameGap = pauseStep > 0 ? rec.steps[pauseStep].elapsedMs - rec.steps[pauseStep - 1].elapsedMs : null;
  check(pauseStep > 0 && gameGap < PAUSE_MS - 1500, `the focus pause is not counted in game time (game gap ${gameGap} ms over a ${PAUSE_MS} ms pause)`);

  const clickButton = (text) => ff.evaluate(`[...document.querySelectorAll('.tr-page button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  const saveCanvas = async (file) =>
    writeFileSync(join(SHOTS, file), Buffer.from((await ff.evaluate(`document.querySelector('.tr-canvas').toDataURL('image/png')`)).split(',')[1], 'base64'));
  await ff.evaluate(`(() => { const s = document.querySelector('.tr-scrub'); s.value = String(Math.floor(s.max / 2)); s.dispatchEvent(new Event('input')); })()`);
  await clickButton('Light');
  await sleep(300);
  await saveCanvas('frame-light.png');
  await clickButton('Dark');
  await sleep(300);
  await saveCanvas('frame-dark.png');
  await clickButton(THEME === 'light' ? 'Light' : 'Dark');
  await ff.evaluate(`(() => { const s = document.querySelector('.tr-scrub'); s.value = String(Math.floor(s.max * 0.7)); s.dispatchEvent(new Event('input')); })()`);
  await sleep(300);
  mkdirSync(STORE, { recursive: true });
  await ff.screenshot(join(STORE, `screenshot-${THEME}.png`));
  const listed = await ff.evaluate(`document.querySelectorAll('.tr-game').length`);
  check(listed === 1, `the replays page lists the game (${listed})`);
  await clickButton('Export GIF');
  let status = '';
  for (let i = 0; i < 60 && !/Saved|failed/.test(status); i++) {
    await sleep(500);
    status = await ff.evaluate(`document.querySelector('.tr-actions [role="status"]').textContent`);
  }
  check(status.startsWith('Saved'), `GIF exported (${status})`);
  await sleep(1500);
  const downloads = join(ff.profile, 'downloads');
  const gif = existsSync(downloads) ? readdirSync(downloads).find((f) => f.endsWith('.gif')) : undefined;
  check(!!gif, `GIF written to disk (${gif})`);
  if (gif) {
    const bytes = readFileSync(join(downloads, gif));
    check(bytes.subarray(0, 6).toString('ascii') === 'GIF89a', `valid GIF header (${bytes.length} bytes)`);
    copyFileSync(join(downloads, gif), join(SHOTS, gif));
  }
} finally {
  ff.close();
}
console.log(failures ? `${failures} failure(s)` : 'All checks passed');
process.exit(failures ? 1 : 0);
