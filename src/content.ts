import { injectPageLinks } from './page-links.js';
import { Recorder } from './recorder.js';
import { extensionStore, listRecordings } from './recording-store.js';
import { mountReplays } from './replays.js';
import { mountShell } from './shell.js';
import { takeOverPage } from './takeover.js';
import { browserStore } from './tupo-storage.js';

const FALLBACK_SCAN_MS = 1000;

function record() {
  const recorder = new Recorder(browserStore(localStorage), extensionStore);
  let scanScheduled = false;
  const scheduleScan = () => {
    if (scanScheduled) return;
    scanScheduled = true;
    setTimeout(() => {
      scanScheduled = false;
      void recorder.scan();
    }, 0);
  };
  new MutationObserver(scheduleScan).observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  setInterval(scheduleScan, FALLBACK_SCAN_MS);
  addEventListener('pagehide', () => void recorder.scan());
  scheduleScan();
}

function exposeRecordingsForTests() {
  addEventListener('message', async (event) => {
    if (event.source !== window || event.data !== 'tupo-replay:dump') return;
    postMessage({ tupoReplayDump: JSON.stringify(await listRecordings()) }, location.origin);
  });
}

const params = new URLSearchParams(location.search);
if (__E2E__) exposeRecordingsForTests();
if (params.has('replay')) {
  const { body, styled } = takeOverPage();
  void mountReplays(mountShell(body, 'Replays'), styled, params.get('replay') || null);
} else {
  record();
  injectPageLinks();
}
