#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

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
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const log = fs.openSync(path.join(output, 'desktop.log'), 'w');
const child = spawn(path.join(root, '_internal/app/ChatGPT.exe'), ['--remote-debugging-port=' + port, '--remote-debugging-address=127.0.0.1'], {
  cwd: path.join(root, '_internal/app'), windowsHide: false,
  env: { ...process.env, CODEX_HOME: home, CODEX_ELECTRON_USER_DATA_PATH: path.join(isolated, 'electron'), CODEX_OFFLINE_PATCH_DEBUG: '1', CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE: '0', HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', NO_PROXY: 'localhost,127.0.0.1', ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', log, log],
});
let spawnError;
child.on('error', error => { spawnError = error; });
const result = { pass: false, version: JSON.parse(fs.readFileSync(path.join(root, 'enterprise-build.json'))).version, screenshots: [], checks: installed ? ['silent installer completed and preserved managed configuration'] : [] };
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode != null) throw new Error('Desktop exited: ' + child.exitCode);
    try { const response = await fetch('http://127.0.0.1:' + port + '/json/version'); if (response.ok) { ready = true; break; } } catch {}
    await delay(1000);
  }
  assert.ok(ready, 'desktop debugging endpoint');
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
  const context = browser.contexts()[0];
  let page;
  for (let attempt = 0; attempt < 45; attempt++) {
    page = context.pages().find(p => p.url().startsWith('codex:'));
    if (page) break;
    await delay(1000);
  }
  assert.ok(page, 'main application page');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  await delay(8000);
  await page.screenshot({ path: path.join(output, '01-home.png') });
  result.screenshots.push('01-home.png');
  const navigate = async route => {
    await page.evaluate(async route => {
      const app = await import('/assets/app-initial-TxV8Ik1J.js');
      app.BTt.dispatchHostMessage({ type: 'navigate-to-route', path: route });
    }, route);
  };
  await navigate('/settings/appearance');
  await page.locator('[data-teenet-preferences]').waitFor({ timeout: 30000 });
  const nav = page.getByRole('navigation', { name: '个人偏好' });
  assert.deepEqual(await nav.getByRole('button').allTextContents(), ['外观', '语音', '快捷键', '归档对话']);
  result.checks.push('limited preferences navigation');
  await page.screenshot({ path: path.join(output, '02-appearance.png') });
  result.screenshots.push('02-appearance.png');
  await navigate('/settings/connections');
  await delay(1500);
  assert.equal(await nav.getByRole('button', { name: '外观', exact: true }).getAttribute('aria-current'), 'page');
  result.checks.push('restricted settings route redirected');
  await nav.getByRole('button', { name: '快捷键', exact: true }).click();
  await delay(2000);
  await page.screenshot({ path: path.join(output, '03-keyboard.png') });
  result.screenshots.push('03-keyboard.png');
  await nav.getByRole('button', { name: '归档对话', exact: true }).click();
  await delay(2000);
  await page.screenshot({ path: path.join(output, '04-archive.png') });
  result.screenshots.push('04-archive.png');
  assert.deepEqual(errors, [], 'renderer exceptions');
  result.checks.push('no renderer exceptions during preference navigation');
  const after = fs.readFileSync(path.join(home, 'config.toml'), 'utf8');
  assert.ok(after.includes('model_provider = "preview"'), 'provider preserved');
  assert.ok(!after.includes('[mcp_servers.node_repl]'), 'no browser MCP persisted');
  result.checks.push('administrator provider preserved');
  result.pass = true;
} catch (error) {
  result.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  fs.closeSync(log);
  fs.writeFileSync(path.join(output, 'smoke-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
