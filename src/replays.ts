import { cls, h } from './dom.js';
import { encodeGif } from './gif.js';
import { moveCount, RECORDING_PREFIX, type Recording } from './model.js';
import { deleteRecording, listRecordings } from './recording-store.js';
import { drawFrame, FRAME_WIDTH, frameHeight, loadRenderFonts, recordingTitle, type Theme } from './render.js';
import { buildFrames, DEFAULT_OPTIONS, formatClock, totalDuration, type Frame, type TimelineOptions, type TimingMode } from './timeline.js';

interface ViewSettings extends TimelineOptions {
  theme: Theme;
}

const SETTINGS_KEY = 'settings';
const SPEEDS = [1, 2, 5, 10, 30];
const BUTTON = 'btn btn-md tr-btn';

function describe(recording: Recording) {
  const lastClock = recording.finalElapsedMs ?? recording.steps.at(-1)?.elapsedMs ?? recording.initialElapsedMs;
  const moves = moveCount(recording);
  return `${moves} move${moves === 1 ? '' : 's'} · ${formatClock(lastClock)}`;
}

function choiceGroup<T extends string | number>(label: string, options: [T, string][], onPick: (value: T) => void) {
  const buttons = options.map(([value, text]) => h('button', { type: 'button', class: cls(BUTTON, 'tr-choice'), onclick: (() => onPick(value)) as EventListener }, text));
  const group = h('div', { class: 'tr-control', role: 'group', 'aria-label': label }, h('span', { class: 'tr-label' }, label), h('div', { class: 'tr-row' }, ...buttons));
  const sync = (current: T) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === current)));
  return { group, sync };
}

export async function mountReplays(container: HTMLElement, styled: Promise<void>, initialId: string | null) {
  let settings: ViewSettings = { ...DEFAULT_OPTIONS, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' };
  let recordings: Recording[] = [];
  let selected: Recording | null = null;
  let frames: Frame[] = [];
  let current = 0;
  let playing = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let exporting = false;

  const canvas = h('canvas', { class: 'tr-canvas', 'aria-label': 'Replay preview' });
  canvas.width = FRAME_WIDTH;
  canvas.height = frameHeight();
  const ctx = canvas.getContext('2d')!;

  const gamesList = h('ul', { class: 'tr-games' });
  const emptyNote = h(
    'div',
    { class: 'panel tr-empty' },
    h('p', {}, 'No game recorded yet.'),
    h('p', { class: 'tr-small' }, 'Play a puzzle: every move is recorded, mistakes included, then come back here to export it as a GIF.'),
    h('a', { class: BUTTON, href: '/' }, 'Play today’s puzzle'),
  );
  const playButton = h('button', { type: 'button', class: BUTTON, onclick: (() => setPlaying(!playing)) as EventListener }, 'Pause');
  const restartButton = h('button', {
    type: 'button',
    class: BUTTON,
    onclick: (() => {
      show(0);
      setPlaying(true);
    }) as EventListener,
  }, 'Restart');
  const scrub = h('input', { type: 'range', min: 0, value: 0, step: 1, class: 'tr-scrub', 'aria-label': 'Move' });
  const position = h('span', { class: 'tr-small tr-position' });
  const smoothValue = h('strong');
  const smoothInput = h('input', { type: 'range', min: 100, max: 2000, step: 100, class: 'tr-range', 'aria-label': 'Pause length' });
  const smoothControl = h('label', { class: 'tr-control' }, h('span', { class: 'tr-label' }, 'Every pause lasts ', smoothValue), smoothInput);
  const mode = choiceGroup<TimingMode>('Timing', [['smooth', 'Smooth pauses'], ['real', 'Real time']], (value) => updateSettings({ mode: value }));
  const speed = choiceGroup<number>('Speed', SPEEDS.map((s) => [s, `${s}×`]), (value) => updateSettings({ speed: value }));
  const theme = choiceGroup<Theme>('Theme', [['light', 'Light'], ['dark', 'Dark']], (value) => updateSettings({ theme: value }));
  const summary = h('p', { class: 'tr-small' });
  const exportButton = h('button', { type: 'button', class: cls(BUTTON, 'tr-primary'), onclick: (() => void exportSelected()) as EventListener }, 'Export GIF');
  const deleteButton = h('button', { type: 'button', class: cls(BUTTON, 'tr-danger'), onclick: (() => void deleteSelected()) as EventListener }, 'Delete');
  const exportStatus = h('span', { class: 'tr-small', role: 'status' });

  const viewer = h(
    'section',
    { class: 'tr-viewer' },
    h('div', { class: 'tr-stage' }, canvas),
    h('div', { class: 'tr-row tr-transport' }, playButton, restartButton, scrub, position),
    h('div', { class: 'tr-options' }, mode.group, smoothControl, speed.group, theme.group),
    summary,
    h('div', { class: 'tr-row tr-actions' }, exportButton, deleteButton, exportStatus),
  );
  const games = h('aside', { class: 'tr-sidebar' }, h('h2', { class: 'tr-label' }, 'Games'), gamesList, emptyNote);
  container.append(h('div', { class: 'tr-page' }, games, viewer));

  function badge(text: string) {
    return h('span', { class: 'tr-badge' }, text);
  }

  function renderList() {
    gamesList.replaceChildren(
      ...recordings.map((recording) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'panel tr-game',
              'aria-current': String(recording.id === selected?.id),
              onclick: (() => select(recording.id)) as EventListener,
            },
            h(
              'strong',
              { class: 'font-display' },
              recordingTitle(recording),
              badge(recording.status === 'won' ? 'Solved' : 'In progress'),
              recording.partial ? badge('Partial') : null,
            ),
            h('small', {}, describe(recording)),
          ),
        ),
      ),
    );
    emptyNote.hidden = recordings.length > 0;
    gamesList.hidden = recordings.length === 0;
    viewer.hidden = !selected;
  }

  function stop() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function show(index: number) {
    if (!selected || frames.length === 0) return;
    current = Math.max(0, Math.min(index, frames.length - 1));
    drawFrame(ctx, selected, frames[current], frames.length, settings.theme);
    scrub.value = String(current);
    position.textContent = `${current} / ${frames.length - 1}`;
  }

  function schedule() {
    stop();
    if (!playing || frames.length === 0) return;
    timer = setTimeout(() => {
      show(current + 1 >= frames.length ? 0 : current + 1);
      schedule();
    }, frames[current].durationMs);
  }

  function setPlaying(value: boolean) {
    playing = value;
    playButton.textContent = playing ? 'Pause' : 'Play';
    schedule();
  }

  function rebuild(keepPosition = true) {
    if (!selected) return;
    frames = buildFrames(selected, settings);
    scrub.max = String(Math.max(0, frames.length - 1));
    show(keepPosition ? current : 0);
    const gifLength = totalDuration(frames);
    summary.textContent = `${describe(selected)} · GIF lasts ${formatClock(gifLength)}${gifLength < 60_000 ? ` (${(gifLength / 1000).toFixed(1)} s)` : ''}`;
    schedule();
  }

  function syncControls() {
    mode.sync(settings.mode);
    speed.sync(settings.speed);
    theme.sync(settings.theme);
    smoothInput.value = String(settings.smoothGapMs);
    smoothValue.textContent = `${(settings.smoothGapMs / 1000).toFixed(1)} s`;
    smoothControl.hidden = settings.mode !== 'smooth';
    speed.group.hidden = settings.mode !== 'real';
  }

  function updateSettings(patch: Partial<ViewSettings>) {
    settings = { ...settings, ...patch };
    syncControls();
    void browser.storage.local.set({ [SETTINGS_KEY]: settings });
    rebuild();
  }

  function select(id: string) {
    const next = recordings.find((r) => r.id === id) ?? null;
    const changed = next?.id !== selected?.id;
    selected = next;
    renderList();
    if (changed) current = 0;
    rebuild(!changed);
  }

  async function refresh(preferredId: string | null = null) {
    recordings = await listRecordings();
    const wanted = preferredId ?? selected?.id;
    selected = recordings.find((r) => r.id === wanted) ?? recordings[0] ?? null;
    renderList();
    if (selected) rebuild();
    else stop();
  }

  function fileName(recording: Recording) {
    const parts = ['tupo', recording.date, recording.level, settings.mode === 'smooth' ? 'smooth' : `x${settings.speed}`].filter(Boolean);
    return `${parts.join('-').replace(/[^a-z0-9.-]+/gi, '_')}.gif`;
  }

  async function exportSelected() {
    if (!selected || exporting) return;
    exporting = true;
    exportButton.disabled = true;
    const recording = selected;
    try {
      const blob = await encodeGif(recording, buildFrames(recording, settings), settings.theme, (done, total) => {
        exportStatus.textContent = `Encoding ${done}/${total}…`;
      });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: fileName(recording), hidden: true });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      exportStatus.textContent = `Saved ${fileName(recording)} (${(blob.size / 1024).toFixed(0)} KB)`;
    } catch (error) {
      exportStatus.textContent = `Export failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      exporting = false;
      exportButton.disabled = false;
    }
  }

  async function deleteSelected() {
    if (!selected || !confirm(`Delete the replay "${recordingTitle(selected)}"?`)) return;
    await deleteRecording(selected);
    selected = null;
    await refresh();
  }

  scrub.addEventListener('input', () => {
    setPlaying(false);
    show(Number(scrub.value));
  });
  smoothInput.addEventListener('input', () => updateSettings({ smoothGapMs: Number(smoothInput.value) }));
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some((key) => key.startsWith(RECORDING_PREFIX))) void refresh();
  });

  const stored = (await browser.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  if (stored && typeof stored === 'object') settings = { ...settings, ...(stored as Partial<ViewSettings>) };
  syncControls();
  await styled;
  await loadRenderFonts();
  await refresh(initialId);
}
