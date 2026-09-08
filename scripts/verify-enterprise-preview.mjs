#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const policy = require('./enterprise/policy.cjs');
const root = path.resolve(process.argv[2] || '');
const archive = path.join(root, '_internal/app/resources/app.asar');
const read = name => asar.extractFile(archive, path.normalize(name)).toString('utf8');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'enterprise-build.json'), 'utf8'));
const digest = crypto.createHash('sha256');
for await (const chunk of fs.createReadStream(archive)) digest.update(chunk);
assert.equal(digest.digest('hex'), metadata.asarSha256, 'asar hash');
assert.equal(JSON.parse(read('package.json')).version, metadata.base.appVersion, 'upstream app version');
const canonicalPolicy = fs.readFileSync(new URL('./enterprise/policy.cjs', import.meta.url), 'utf8');
for (const name of ['teenet/policy.cjs', 'webview/assets/teenet-policy.js']) assert.equal(read(name), canonicalPolicy, 'policy copy ' + name);
for (const dir of ['_internal/patches', '_internal/app/patches']) {
  assert.equal(fs.readFileSync(path.join(root, dir, 'policy.cjs'), 'utf8'), canonicalPolicy);
  const init = fs.readFileSync(path.join(root, dir, 'init.cjs'), 'utf8');
  assert.ok(init.includes('applyGatePolicy(STATSIG_GATE_OVERRIDES)'));
  assert.ok(init.includes('applyFeaturePolicy(FORCED_DESKTOP_FEATURE_STATE)'));
}
assert.ok(read('.vite/build/early-bootstrap.js').includes('require("../../teenet/runtime.cjs")'));
const main = read('.vite/build/main-C8eoOzMw.js');
assert.ok(main.includes('_teenetPolicy.requestDenial(t.request)'));
assert.ok(main.includes('_teenetPolicy.messageDenial(t)'));
assert.ok(main.includes('return _teenetPolicy.applyFeaturePolicy(xr)'));
const renderer = read('webview/assets/app-initial-TxV8Ik1J.js');
assert.ok(renderer.includes('globalThis.TEENetPolicy.createJsxGuard(r)'));
const preferences = read('webview/assets/settings-page-B4j1j14I.js');
assert.ok(preferences.includes('export{TEENetPreferences as SettingsPage}'));
assert.ok(!preferences.includes('export{Dn as SettingsPage}'));
const registries = Object.entries(metadata.report).filter(([, report]) => report.commandArrays > 0);
assert.ok(registries.some(([file]) => file.startsWith('.vite/')));
assert.ok(registries.some(([file]) => file.startsWith('webview/')));
for (const [file] of registries) {
  const source = read(file);
  assert.ok(!source.includes('id:`settings`,titleIntlId:'), 'settings command survived in ' + file);
  assert.ok(!source.includes('id:`openBrowserTab`,titleIntlId:'), 'browser command survived in ' + file);
  assert.ok(source.includes('id:`keyboardShortcuts`,titleIntlId:'), 'keyboard help removed in ' + file);
}
for (const file of [...Object.keys(metadata.report), 'webview/assets/settings-page-B4j1j14I.js', 'webview/assets/teenet-policy.js']) {
  parse(read(file), { ecmaVersion: 'latest', sourceType: file.startsWith('webview/') ? 'module' : 'script', allowReturnOutsideFunction: true });
}
const pluginsRoot = path.join(root, '_internal/app/resources/plugins/openai-bundled');
const marketplace = JSON.parse(fs.readFileSync(path.join(pluginsRoot, '.agents/plugins/marketplace.json'), 'utf8'));
for (const name of policy.removedPlugins) {
  assert.equal(fs.existsSync(path.join(pluginsRoot, 'plugins', name)), false, 'forbidden plugin directory ' + name);
  assert.equal(marketplace.plugins.some(p => p.name === name), false, 'forbidden marketplace entry ' + name);
}
for (const name of ['documents', 'spreadsheets', 'presentations']) assert.ok(fs.existsSync(path.join(pluginsRoot, 'plugins', name)), 'office plugin ' + name);
for (const name of ['Setup Codex.cmd', '_internal/chrome-extension', '_internal/tools', '_internal/setup-codex-offline.ps1']) assert.equal(fs.existsSync(path.join(root, name)), false, name);
for (const name of ['Codex.cmd', 'Codex.vbs']) assert.ok(!/COMPUTER_USE[^\r\n]*[= ]"?1/.test(fs.readFileSync(path.join(root, name), 'utf8')), name);
assert.ok(fs.statSync(path.join(root, 'block-list.md')).size > 100);
assert.ok(fs.existsSync(path.join(root, '_internal/seed/codex-home/skills/.system/skill-creator/SKILL.md')));
assert.ok(fs.existsSync(path.join(root, '_internal/setup-enterprise-preview.ps1')));
console.log('Enterprise package verification passed:', metadata.version);
