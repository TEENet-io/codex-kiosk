#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');

if (process.platform !== 'win32') throw new Error('Enterprise desktop smoke requires Windows');
let root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] || path.join(root, '..', 'smoke'));
fs.mkdirSync(output, { recursive: true });
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'teenet-smoke-'));
const home = path.join(isolated, 'codex');
fs.mkdirSync(home, { recursive: true });
const catalog = path.join(root, '_internal/models-api.json').replaceAll('\\', '/');
const config = `model = "gpt-5.6"\nmodel_provider = "preview"\nmodel_catalog_json = ${JSON.stringify(catalog)}\n[model_providers.preview]\nname = "TEENet Preview"\nbase_url = "http://127.0.0.1:9/v1"\nwire_api = "responses"\nexperimental_bearer_token = "preview-not-a-real-key"\n`;
fs.writeFileSync(path.join(home, 'config.toml'), config);
fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify({ OPENAI_API_KEY: 'preview-not-a-real-key', auth_mode: 'apikey' }));
const installer = root + '-setup.exe';
let installed = false;
if (fs.existsSync(installer)) {
  const destination = path.join(isolated, 'installed');
  const installation = spawnSync(installer, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOICONS', '/DIR=' + destination, '/LOG=' + path.join(output, 'installer.log')], {
    env: { ...process.env, CODEX_HOME: home }, timeout: 180000, windowsHide: true,
  });
  assert.equal(installation.status, 0, installation.error?.message || 'preview installer exit code');
  assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), config, 'installer preserves managed configuration');
  assert.ok(fs.existsSync(path.join(home, 'skills/.system/skill-creator/SKILL.md')), 'installer seeds skill creator');
  root = destination;
  installed = true;
}
// Validate the unchanged production executable first. Electron intentionally
// disables DevTools in production windows; UI instrumentation belongs only in
// the throwaway installed copy, never in the distributed installer or ZIP.
const bootstrapRoot = path.join(output, 'production-bootstrap');
execFileSync(process.execPath, [path.resolve('scripts/offline-direct-launch-smoke.mjs'), '--portable-root', root, '--work-root', bootstrapRoot, '--timeout-ms', '15000'], { stdio: 'inherit' });
const bootstrap = JSON.parse(fs.readFileSync(path.join(bootstrapRoot, 'result.json'), 'utf8'));
assert.equal(bootstrap.pass, true, 'unchanged production executable startup');
assert.ok(!/Uncaught Exception|JavaScript error occurred in the main process/.test(fs.readFileSync(path.join(bootstrapRoot, 'codex-stderr.log'), 'utf8')), 'production main process exceptions');
if (!installed) {
  const copy = path.join(isolated, 'instrumented-portable');
  fs.cpSync(root, copy, { recursive: true });
  root = copy;
}
const archive = path.join(root, '_internal/app/resources/app.asar');
const instrumentation = path.join(isolated, 'instrumentation');
asar.extractAll(archive, instrumentation);
const mainPath = path.join(instrumentation, '.vite/build/main-C8eoOzMw.js');
const productionMain = fs.readFileSync(mainPath, 'utf8');
const devtoolsAnchor = 'devTools:this.options.allowDevtools';
assert.equal(productionMain.split(devtoolsAnchor).length - 1, 2, 'pinned window instrumentation anchors');
fs.writeFileSync(mainPath, productionMain.replaceAll(devtoolsAnchor, 'devTools:true'));
await asar.createPackage(instrumentation, archive);
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const log = fs.openSync(path.join(output, 'desktop.log'), 'w');
const child = spawn(path.join(root, '_internal/app/ChatGPT.exe'), ['--remote-debugging-port=' + port, '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + path.join(isolated, 'electron'), '--disable-gpu', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'], {
  cwd: path.join(root, '_internal/app'), windowsHide: false,
  env: { ...process.env, CODEX_HOME: home, CODEX_ELECTRON_USER_DATA_PATH: path.join(isolated, 'electron'), CODEX_OFFLINE_PATCH_DEBUG: '1', CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE: '0', HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', NO_PROXY: 'localhost,127.0.0.1', ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', log, log],
});
let spawnError;
child.on('error', error => { spawnError = error; });
const result = { pass: false, version: JSON.parse(fs.readFileSync(path.join(root, 'enterprise-build.json'))).version, instrumentation: 'DevTools enabled only in temporary installed copy; distributed artifacts unchanged', screenshots: [], checks: ['unchanged production executable startup', ...(installed ? ['silent installer completed and preserved managed configuration'] : [])] };
let browser;
async function deadline(promise, label, timeout = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' did not respond within ' + timeout + 'ms')), timeout); })]);
  } finally { clearTimeout(timer); }
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode != null) throw new Error('Desktop exited: ' + child.exitCode);
    try { const response = await fetch('http://127.0.0.1:' + port + '/json/version'); if (response.ok) { ready = true; break; } } catch {}
    await delay(1000);
  }
  assert.ok(ready, 'desktop debugging endpoint');
  let target;
  for (let attempt = 0; attempt < 45; attempt++) {
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    target = targets.find(item => item.type === 'page' && item.url.startsWith('app://-/') && !/avatar|pip|composition/.test(item.url));
    if (target) break;
    await delay(1000);
  }
  assert.ok(target, 'main application page');
  result.pageUrl = target.url;
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(), handlers = new Map();
  let nextId = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id != null) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
    } else handlers.get(message.method)?.(message.params);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) request.reject(new Error('Window debugging connection closed'));
    pending.clear();
  });
  await deadline(new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }), 'Connect to primary window debugger');
  browser = { close: async () => { socket.close(); } };
  const cdp = {
    on: (name, handler) => handlers.set(name, handler),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    }),
  };
  const send = (method, params) => deadline(cdp.send(method, params), method);
  const errors = [];
  cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  await send('Runtime.enable');
  await send('Runtime.runIfWaitingForDebugger');
  await send('Page.bringToFront');
  const evaluate = async (fn, arg) => {
    const response = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + JSON.stringify(arg ?? null) + ')', returnByValue: true, awaitPromise: true, timeout: 10000 });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async fn => {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await evaluate(fn)) return;
      await delay(1000);
    }
    throw new Error('Page condition timed out: ' + fn.toString());
  };
  await waitFor(() => document.body && document.readyState !== 'loading');
  await delay(8000);
  const capture = async name => {
    // Headless Windows runners can expose an interactive DOM without a
    // compositor surface. Preserve that distinction in the validation report.
    fs.writeFileSync(path.join(output, name.replace('.png', '.txt')), await evaluate(() => document.body.innerText));
    let timer;
    try {
      const screenshot = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Compositor capture timed out')), 5000); }),
      ]);
      fs.writeFileSync(path.join(output, name), Buffer.from(screenshot.data, 'base64'));
      result.screenshots.push(name);
    } catch (error) {
      (result.screenshotErrors ||= []).push({ name, error: error.message });
    } finally { clearTimeout(timer); }
  };
  await capture('01-home.png');
  const navigate = async route => {
    await evaluate(async route => {
      const app = await import('/assets/app-initial-TxV8Ik1J.js');
      app.BTt.dispatchHostMessage({ type: 'navigate-to-route', path: route });
    }, route);
  };
  await navigate('/settings/appearance');
  await waitFor(() => document.querySelector('[data-teenet-preferences]'));
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('nav[aria-label="个人偏好"] button')].map(button => button.textContent)), ['外观', '语音', '快捷键', '归档对话']);
  result.checks.push('limited preferences navigation');
  await capture('02-appearance.png');
  await navigate('/settings/connections');
  await delay(1500);
  assert.equal(await evaluate(() => [...document.querySelectorAll('nav[aria-label="个人偏好"] button')].find(button => button.textContent === '外观')?.getAttribute('aria-current')), 'page');
  result.checks.push('restricted settings route redirected');
  const clickPreference = name => evaluate(name => {
    const button = [...document.querySelectorAll('nav[aria-label="个人偏好"] button')].find(button => button.textContent === name);
    if (!button) throw new Error('Missing preference button: ' + name);
    button.click();
  }, name);
  await clickPreference('快捷键');
  await delay(2000);
  await capture('03-keyboard.png');
  await clickPreference('归档对话');
  await delay(2000);
  await capture('04-archive.png');
  assert.deepEqual(errors, [], 'renderer exceptions');
  assert.ok(!/Uncaught Exception|JavaScript error occurred in the main process/.test(fs.readFileSync(path.join(output, 'desktop.log'), 'utf8')), 'no main process exceptions');
  assert.ok(!fs.readFileSync(path.join(output, 'desktop.log'), 'utf8').includes('plugin_marketplace_add_failed'), 'native bundled marketplace initialized');
  result.checks.push('no renderer exceptions during preference navigation');
  const after = fs.readFileSync(path.join(home, 'config.toml'), 'utf8');
  assert.ok(after.includes('model_provider = "preview"'), 'provider preserved');
  assert.ok(!after.includes('[mcp_servers.node_repl]'), 'no browser MCP persisted');
  result.checks.push('administrator provider preserved');
  result.visualCapture = result.screenshotErrors?.length ? 'unavailable-on-runner' : 'passed';
  result.pass = true;
} catch (error) {
  result.error = error.stack || String(error);
  result.desktopLogTail = fs.readFileSync(path.join(output, 'desktop.log'), 'utf8').slice(-12000);
  process.exitCode = 1;
} finally {
  if (browser) await deadline(browser.close(), 'Close debugger connection', 5000).catch(() => {});
  if (child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  fs.closeSync(log);
  fs.writeFileSync(path.join(output, 'smoke-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
