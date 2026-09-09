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
const diagnosticAuth = process.argv[4];
if (diagnosticAuth) assert.ok(['control', 'apikey', 'bearer-only', 'stale-chatgpt'].includes(diagnosticAuth));
const customCatalog = diagnosticAuth && diagnosticAuth !== 'control';
const diagnosticScenario = process.argv[5] || 'empty-en';
assert.ok(['empty-en', 'empty-zh', 'project-en', 'project-zh', 'pet-en', 'pet-zh'].includes(diagnosticScenario));
const diagnosticLocale = diagnosticScenario.endsWith('-zh') ? 'zh-CN' : 'en-US';

if (process.platform !== 'win32') throw new Error('Enterprise desktop smoke requires Windows');
let root = path.resolve(process.argv[2]);
const current = JSON.parse(fs.readFileSync(path.join(root, 'enterprise-build.json'), 'utf8')).base.appVersion === '26.901.51231';
const output = path.resolve(process.argv[3] || path.join(root, '..', 'smoke'));
fs.mkdirSync(output, { recursive: true });
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'teenet-smoke-'));
const home = path.join(isolated, 'codex');
fs.mkdirSync(home, { recursive: true });
if (diagnosticAuth && diagnosticScenario.startsWith('pet-')) {
  fs.writeFileSync(path.join(home, '.codex-global-state.json'), JSON.stringify({
    'electron-avatar-overlay-open': true,
  }));
}
if (diagnosticAuth && diagnosticScenario.startsWith('project-')) {
  const project = path.join(isolated, 'employee-project');
  fs.mkdirSync(project);
  execFileSync('git', ['init', project], { stdio: 'ignore' });
  fs.writeFileSync(path.join(home, '.codex-global-state.json'), JSON.stringify({
    'electron-saved-workspace-roots': [project],
    'active-workspace-roots': [project],
    'electron-workspace-root-labels': { [project]: 'Employee project fixture' },
  }));
}
let catalog = path.join(root, '_internal/models-api.json').replaceAll('\\', '/');
if (customCatalog) {
  const { gatewayCatalogFixture } = await import('./test/fixtures/gateway-catalog.mjs');
  const template = JSON.parse(fs.readFileSync(catalog, 'utf8')).models[0];
  catalog = path.join(home, 'models.json').replaceAll('\\', '/');
  fs.writeFileSync(catalog, JSON.stringify(gatewayCatalogFixture(template)));
}
const config = `model = "${customCatalog ? 'deepseek-v3.2' : 'gpt-5.6'}"\nmodel_provider = "preview"\nmodel_catalog_json = ${JSON.stringify(catalog)}\n[model_providers.preview]\nname = "Gateway fixture"\nbase_url = "http://127.0.0.1:9/v1"\nwire_api = "responses"\nexperimental_bearer_token = "preview-not-a-real-key"\n`
  + (diagnosticAuth ? `\n[desktop]\nlocaleOverride = ${JSON.stringify(diagnosticLocale)}\n` : '');
fs.writeFileSync(path.join(home, 'config.toml'), config);
if (diagnosticAuth !== 'bearer-only') {
  const jwt = claims => Buffer.from('{}').toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.fixture';
  const auth = diagnosticAuth === 'stale-chatgpt'
    ? { auth_mode: 'chatgpt', OPENAI_API_KEY: null, last_refresh: '2020-01-01T00:00:00Z', tokens: { id_token: jwt({ email: 'fixture@example.invalid', 'https://api.openai.com/auth': { chatgpt_account_id: 'fixture', chatgpt_plan_type: 'plus' } }), access_token: jwt({ exp: 1 }), refresh_token: 'fixture-not-a-real-token', account_id: 'fixture' } }
    : { OPENAI_API_KEY: 'preview-not-a-real-key', auth_mode: 'apikey' };
  fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify(auth));
}
const installer = root + '-setup.exe';
let installed = false;
if (fs.existsSync(installer)) {
  const destination = path.join(isolated, 'installed');
  if (!diagnosticAuth) {
    fs.mkdirSync(path.join(destination, '_internal/app/resources'), { recursive: true });
    fs.writeFileSync(path.join(destination, '_internal/app/resources/old-runtime-sentinel.txt'), 'old program file');
    fs.mkdirSync(path.join(home, 'skills/employee-existing'), { recursive: true });
    fs.writeFileSync(path.join(home, 'skills/employee-existing/SKILL.md'), '# Existing employee skill\n');
  }
  const installation = spawnSync(installer, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOICONS', '/DIR=' + destination, '/LOG=' + path.join(output, 'installer.log')], {
    env: { ...process.env, CODEX_HOME: home }, timeout: 180000, windowsHide: true,
  });
  assert.equal(installation.status, 0, installation.error?.message || 'preview installer exit code');
  assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), config, 'installer preserves managed configuration');
  assert.ok(fs.existsSync(path.join(home, 'skills/.system/skill-creator/SKILL.md')), 'installer seeds skill creator');
  if (!diagnosticAuth) {
    assert.equal(fs.existsSync(path.join(destination, '_internal/app/resources/old-runtime-sentinel.txt')), false, 'upgrade replaces obsolete program files');
    assert.equal(fs.readFileSync(path.join(home, 'skills/employee-existing/SKILL.md'), 'utf8'), '# Existing employee skill\n', 'upgrade preserves employee skills');
  }
  root = destination;
  installed = true;
}
// Validate the unchanged production executable first. Electron intentionally
// disables DevTools in production windows; UI instrumentation belongs only in
// the throwaway installed copy, never in the distributed installer or ZIP.
if (diagnosticAuth && process.env.CODEX_TEST_STARTUP_TRACE === '1') {
  const traceModule = path.resolve('scripts/diagnostics/startup-trace.cjs');
  fs.appendFileSync(path.join(root, '_internal/app/patches/init.cjs'), '\n;if(process.env.CODEX_STARTUP_TRACE_FILE){require(' + JSON.stringify(traceModule) + ');}\n');
  process.env.CODEX_STARTUP_TRACE_FILE = path.join(output, 'startup-trace.jsonl');
  process.env.CODEX_STARTUP_TRACE_SELFTEST = '1';
}
const bootstrapRoot = path.join(output, 'production-bootstrap');
execFileSync(process.execPath, [path.resolve('scripts/offline-direct-launch-smoke.mjs'), '--portable-root', root, '--work-root', bootstrapRoot, '--timeout-ms', process.env.CODEX_TEST_STARTUP_TRACE === '1' ? '25000' : '15000'], { stdio: 'inherit' });
const bootstrap = JSON.parse(fs.readFileSync(path.join(bootstrapRoot, 'result.json'), 'utf8'));
assert.equal(bootstrap.pass, true, 'unchanged production executable startup');
if (process.env.CODEX_TEST_STARTUP_TRACE === '1') {
  const trace = fs.readFileSync(process.env.CODEX_STARTUP_TRACE_FILE, 'utf8');
  assert.ok(trace.includes('trace-ready'), 'native exception tracer attaches with production DevTools disabled');
  assert.ok(trace.includes('codexStartupTraceProbe'), 'native exception tracer captures caught exceptions and resumes');
}
assert.ok(!/Uncaught Exception|JavaScript error occurred in the main process/.test(fs.readFileSync(path.join(bootstrapRoot, 'codex-stderr.log'), 'utf8')), 'production main process exceptions');
if (!installed) {
  const copy = path.join(isolated, 'instrumented-portable');
  fs.cpSync(root, copy, { recursive: true });
  root = copy;
}
const archive = path.join(root, '_internal/app/resources/app.asar');
const instrumentation = path.join(isolated, 'instrumentation');
asar.extractAll(archive, instrumentation);
const mainPath = path.join(instrumentation, current ? '.vite/build/main-DpnWwRdP.js' : '.vite/build/main-C8eoOzMw.js');
const productionMain = fs.readFileSync(mainPath, 'utf8');
const devtoolsAnchor = 'devTools:this.options.allowDevtools';
assert.equal(productionMain.split(devtoolsAnchor).length - 1, 2, 'pinned window instrumentation anchors');
let diagnosticMain = productionMain.replaceAll(devtoolsAnchor, 'devTools:true');
if (diagnosticAuth && current) {
  const localeAnchor = '"locale-info":async()=>({ideLocale:l.app.getLocale(),systemLocale:l.app.getSystemLocale()})';
  assert.equal(diagnosticMain.split(localeAnchor).length - 1, 1, 'pinned locale diagnostic anchor');
  diagnosticMain = diagnosticMain.replace(localeAnchor, '"locale-info":async()=>({ideLocale:' + JSON.stringify(diagnosticLocale) + ',systemLocale:' + JSON.stringify(diagnosticLocale) + '})');
}
fs.writeFileSync(mainPath, diagnosticMain);
if (diagnosticAuth && current) {
  const rendererPath = path.join(instrumentation, 'webview/assets/app-initial-f87238153a19.js');
  const renderer = fs.readFileSync(rendererPath, 'utf8');
  const anchor = 'componentDidCatch(e,{componentStack:t}){';
  assert.equal(renderer.split(anchor).length - 1, 1, 'pinned error boundary diagnostic anchor');
  fs.writeFileSync(rendererPath, renderer.replace(anchor, anchor + 'console.error("Codex diagnostic boundary",e,e?.stack,t);'));
  if (process.env.CODEX_TEST_MODEL_COMMAND_FIX === '1') {
    const { patchPinnedModelCommand } = await import('./enterprise/patch-bundle.mjs');
    const primaryPath = path.join(instrumentation, 'webview/assets/app-primary-428a0a65766f.js');
    fs.writeFileSync(primaryPath, patchPinnedModelCommand(fs.readFileSync(primaryPath, 'utf8'), '26.901.51231'));
  }
}
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
  const consoleErrors = [];
  result.rendererErrors = errors;
  result.consoleErrors = consoleErrors;
  cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Runtime.consoleAPICalled', event => {
    if (event.type === 'error') consoleErrors.push(event.args.map(arg => arg.description || String(arg.value)).join(' '));
  });
  await send('Runtime.enable');
  if (diagnosticAuth) {
    result.diagnosticAuth = diagnosticAuth;
    result.diagnosticScenario = diagnosticScenario;
    result.diagnosticLocale = diagnosticLocale;
  }
  await send('Runtime.runIfWaitingForDebugger');
  await send('Page.bringToFront');
  const evaluate = async (fn, arg) => {
    const response = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + JSON.stringify(arg ?? null) + ')', returnByValue: true, awaitPromise: true, timeout: 10000 });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (fn, attempts = 30) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await evaluate(fn)) return;
      await delay(1000);
    }
    result.lastPageText = await evaluate(() => document.body?.innerText || '');
    throw new Error('Page condition timed out: ' + fn.toString());
  };
  await waitFor(() => document.body && document.readyState !== 'loading');
  // document.readyState only covers the HTML shell. Owl may still be loading
  // the renderer and initializing its app-server on a cold Windows runner.
  await waitFor(() => /New chat|新建对话|新聊天|新对话|hit a snag|Something went wrong/.test(document.body.innerText), 60);
  await waitFor(() => /Full access|完整访问|完全访问|hit a snag|Something went wrong/.test(document.body.innerText), 30);
  if (diagnosticAuth) await delay(15000);
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
  const homeText = await evaluate(() => document.body.innerText);
  if (diagnosticAuth) {
    result.documentLanguage = await evaluate(() => document.documentElement.lang);
    if (diagnosticScenario.endsWith('-zh')) assert.ok(/新建对话|新聊天|新对话|完整访问|完全访问/.test(homeText), 'Chinese diagnostic locale applied');
    if (diagnosticScenario.startsWith('project-')) assert.ok(/projectCount=1/.test(fs.readFileSync(path.join(output, 'desktop.log'), 'utf8')), 'existing workspace migrated into app-server project');
  }
  assert.ok(!/ChatGPT hit a snag|Something went wrong\. Try again|Update ChatGPT/.test(homeText), 'home rendered without an application error boundary');
  assert.ok(/Full access|完整访问|完全访问/.test(homeText), 'new chat uses full access by default');
  assert.ok(!/^Scheduled$/m.test(homeText), 'scheduled navigation removed');
  assert.ok(!homeText.includes('Finish Windows setup'), 'full-access chat does not require environment setup');
  assert.ok(!homeText.includes('Introducing GPT-'), 'model promotion removed');
  result.checks.push('employee home without scheduled navigation, environment setup or model promotion');
  if (current) {
    await evaluate(() => {
      const editor = document.querySelector('[contenteditable="true"][role="textbox"], .ProseMirror[contenteditable="true"]');
      if (!editor) throw new Error('Composer editor not found');
      editor.focus();
    });
    await send('Input.insertText', { text: '/model' });
    await delay(5000);
    await capture('01-model-command.png');
    assert.ok(!await evaluate(() => /Something went wrong|hit a snag/.test(document.body.innerText)), 'focused composer slash command does not trigger update loop');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    result.checks.push('focused composer slash command without recursive updates');
  }
  const navigate = async route => {
    await evaluate(async ({ route, current }) => {
      const app = await import(current ? '/assets/app-initial-f87238153a19.js' : '/assets/app-initial-TxV8Ik1J.js');
      app[current ? 'Kun' : 'BTt'].dispatchHostMessage({ type: 'navigate-to-route', path: route });
    }, { route, current });
  };
  await navigate('/settings/appearance');
  await waitFor(() => !!document.querySelector('[data-teenet-preferences]'));
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('nav[aria-label="个人偏好"] button')].map(button => button.textContent)), ['外观', '语音', '快捷键', '归档对话', '宠物']);
  assert.ok(!await evaluate(() => document.body.innerText.includes('默认权限：完整访问 · 模型与连接由管理员统一配置')), 'managed configuration hint removed');
  result.checks.push('limited preferences navigation without managed configuration hint');
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
  const keyboardText = await evaluate(() => document.body.innerText);
  assert.ok(!/Switch to Work|Switch to Chat|Toggle activity view|New Temporary Chat|切换到 Work/.test(keyboardText), 'advanced command aliases absent from keyboard settings');
  assert.ok(/Show or hide pet|Show pet|显示或隐藏(?:虚拟)?宠物|显示宠物/.test(keyboardText), 'pet shortcut restored');
  await clickPreference('归档对话');
  await delay(2000);
  await capture('04-archive.png');
  await clickPreference('语音');
  await delay(2000);
  await capture('05-voice.png');
  assert.equal(await evaluate(() => [...document.querySelectorAll('nav[aria-label="个人偏好"] button')].find(button => button.textContent === '语音')?.getAttribute('aria-current')), 'page');
  result.checks.push('voice preferences retained');
  await clickPreference('宠物');
  if (diagnosticScenario.startsWith('pet-')) {
    await waitFor(() => [...document.querySelectorAll('button')].some(button => /^(Tuck Away Pet|Hide Mini|收起宠物|隐藏宠物|隐藏 Mini)$/.test(button.textContent.trim())));
    result.checks.push('pet restored as open at startup');
    await evaluate(() => [...document.querySelectorAll('button')].find(button => /^(Tuck Away Pet|Hide Mini|收起宠物|隐藏宠物|隐藏 Mini)$/.test(button.textContent.trim())).click());
  }
  await waitFor(() => [...document.querySelectorAll('button')].some(button => /^(Wake Pet|Show Mini|唤醒(?:虚拟)?宠物|显示宠物|显示 Mini)$/.test(button.textContent.trim())));
  await capture('07-pets.png');
  await evaluate(() => [...document.querySelectorAll('button')].find(button => /^(Wake Pet|Show Mini|唤醒(?:虚拟)?宠物|显示宠物|显示 Mini)$/.test(button.textContent.trim())).click());
  await waitFor(() => [...document.querySelectorAll('button')].some(button => /^(Tuck Away Pet|Hide Mini|收起宠物|隐藏宠物|隐藏 Mini)$/.test(button.textContent.trim())));
  let petTarget;
  for (let attempt = 0; attempt < 20; attempt++) {
    const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    petTarget = targets.find(item => item.type === 'page' && /avatar/.test(item.url));
    if (petTarget) break;
    await delay(1000);
  }
  assert.ok(petTarget, 'pet overlay window opened from preferences');
  result.petPageUrl = petTarget.url;
  await evaluate(() => [...document.querySelectorAll('button')].find(button => /^(Tuck Away Pet|Hide Mini|收起宠物|隐藏宠物|隐藏 Mini)$/.test(button.textContent.trim())).click());
  await waitFor(() => [...document.querySelectorAll('button')].some(button => /^(Wake Pet|Show Mini|唤醒(?:虚拟)?宠物|显示宠物|显示 Mini)$/.test(button.textContent.trim())));
  result.checks.push('pet preferences, keyboard shortcut and overlay show/hide restored');
  await navigate('/plugins');
  await delay(3000);
  await capture('06-plugins.png');
  assert.ok(!await evaluate(() => [...document.querySelectorAll('button')].some(button => /^(?:Add marketplace|添加市场|添加插件市场)$/.test(button.textContent.trim()))), 'employee marketplace installation unavailable');
  result.checks.push('controlled plugins route without marketplace installation');
  assert.deepEqual(errors, [], 'renderer exceptions');
  assert.ok(!/Uncaught Exception|JavaScript error occurred in the main process/.test(fs.readFileSync(path.join(output, 'desktop.log'), 'utf8')), 'no main process exceptions');
  assert.ok(!fs.readFileSync(path.join(output, 'desktop.log'), 'utf8').includes('plugin_marketplace_add_failed'), 'native bundled marketplace initialized');
  assert.ok(!fs.readFileSync(path.join(output, 'desktop.log'), 'utf8').includes('bundled_plugins_marketplace_install_failed'), 'approved bundled plugins installed');
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
