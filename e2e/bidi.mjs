import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import WebSocket from 'ws';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchFirefox({ port = 9321, firefox = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe', theme, width = 1280, height = 1000 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'tupo-replay-e2e-'));
  writeFileSync(
    join(profile, 'user.js'),
    [
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
      'user_pref("browser.aboutwelcome.enabled", false);',
      'user_pref("browser.download.useDownloadDir", true);',
      `user_pref("browser.download.dir", ${JSON.stringify(join(profile, 'downloads'))});`,
      'user_pref("browser.download.folderList", 2);',
      theme ? `user_pref("layout.css.prefers-color-scheme.content-override", ${theme === 'light' ? 1 : 0});` : '',
    ].join('\n'),
  );
  const proc = spawn(firefox, ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port), '--width', String(width), '--height', String(height)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((res, rej) => {
    const timeout = setTimeout(() => rej(new Error('Firefox did not start')), 30000);
    const onData = (d) => {
      if (String(d).includes('WebDriver BiDi listening')) {
        clearTimeout(timeout);
        res();
      }
    };
    proc.stderr.on('data', onData);
    proc.stdout.on('data', onData);
  });
  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((r, j) => {
    ws.once('open', r);
    ws.once('error', j);
  });
  let id = 0;
  const pending = new Map();
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    if (m.id === undefined || !pending.has(m.id)) return;
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.type === 'error') p.reject(new Error(`${m.error}: ${m.message}`));
    else p.resolve(m.result);
  });
  const cmd = (method, params) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await cmd('session.new', { capabilities: {} });
  await cmd('webExtension.install', { extensionData: { type: 'path', path: resolve('dist') } });
  const ctx = (await cmd('browsingContext.getTree', {})).contexts[0].context;

  const evaluate = async (expression) => {
    const r = await cmd('script.evaluate', { expression, target: { context: ctx }, awaitPromise: true, serializationOptions: { maxObjectDepth: 0 } });
    if (r.type === 'exception') throw new Error(r.exceptionDetails.text);
    return r.result?.value;
  };
  const json = async (expression) => JSON.parse(await evaluate(`(async () => JSON.stringify(await (${expression})))()`));

  return {
    profile,
    cmd,
    evaluate,
    json,
    navigate: (url) => cmd('browsingContext.navigate', { context: ctx, url, wait: 'complete' }),
    screenshot: async (file) => writeFileSync(file, Buffer.from((await cmd('browsingContext.captureScreenshot', { context: ctx })).data, 'base64')),
    key: (value) =>
      cmd('input.performActions', {
        context: ctx,
        actions: [{ type: 'key', id: 'kb', actions: [{ type: 'keyDown', value }, { type: 'keyUp', value }] }],
      }),
    close: () => {
      proc.kill();
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1500);
    },
  };
}
