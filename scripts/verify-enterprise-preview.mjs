#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
import { verifyRuntimePaths } from './enterprise/prepare-runtime.mjs';
import { verifyAsarIntegrityDisabled } from './desktop-runtime-fuses.mjs';
import { execDetailsBundle, verifyPinnedExecDetails } from './enterprise/patch-bundle.mjs';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const policy = require('./enterprise/policy.cjs');
const root = path.resolve(process.argv[2] || '');
const archive = path.join(root, '_internal/app/resources/app.asar');
await verifyAsarIntegrityDisabled(path.join(root, '_internal/app'));
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
assert.ok(read('teenet/toml/package.json').includes('"name": "smol-toml"'));
const current = metadata.base.appVersion === '26.901.51231';
const main = read(current ? '.vite/build/main-DpnWwRdP.js' : '.vite/build/main-C8eoOzMw.js');
assert.ok(main.includes('_teenetPolicy.requestDenial(t.request)'));
assert.ok(main.includes('_teenetPolicy.messageDenial(t)'));
assert.ok(main.includes('return _teenetPolicy.applyFeaturePolicy(' + (current ? 'br' : 'xr') + ')'));
assert.ok(main.includes('_teenetPolicy.blockedMenuItem(e)'));
assert.ok(main.includes('teenet:no-micro-hardware'));
assert.ok(main.includes('teenet:no-browser-config-mutation'));
assert.ok(main.includes('teenet:no-browser-extension-sync'));
const renderer = read(current ? 'webview/assets/app-initial-f87238153a19.js' : 'webview/assets/app-initial-TxV8Ik1J.js');
assert.ok(renderer.includes('globalThis.TEENetPolicy.createJsxGuard(r)'));
assert.ok(renderer.includes('globalThis.TEENetPolicy.onboardingTarget(e)'));
assert.ok((current ? read('webview/assets/app-primary-428a0a65766f.js') : renderer).includes('teenet:no-model-promotion'));
assert.ok(!renderer.includes('teenet:full-access-no-setup'), 'Windows sandbox setup is preserved');
if (current) {
  verifyPinnedExecDetails(read(execDetailsBundle), metadata.base.appVersion);
  for (const marker of ['stable-command-registration', 'stable-command-cleanup']) assert.ok(renderer.includes('/*codex:' + marker + '*/'), marker);
  for (const marker of ['no-pet-restore', 'no-pet-prewarm', 'no-pet-window']) assert.ok(!main.includes('/*codex:' + marker + '*/'), 'removed pet isolation: ' + marker);
  assert.equal(policy.applyFeaturePolicy({ avatarOverlay: true }).avatarOverlay, true);
  verifyRuntimePaths(root);
  assert.ok(!renderer.includes('teenet:default-full-access'), 'workspace permission selection remains upstream');
  assert.ok(main.includes('codex:pet-native-hit-regions'), 'Windows pet native mouse fallback is installed');
  assert.ok(main.includes('codex:pet-no-layered-fade'), 'Windows pet does not enter layered opacity state');
  assert.ok(fs.existsSync(path.join(root, '_internal/app/resources/codex-pet-native/koffi/build/koffi/win32_x64/koffi.node')), 'Windows pet native helper is bundled');
  const primary = read('webview/assets/app-primary-428a0a65766f.js');
  assert.ok(primary.includes('/*codex:stable-model-command*/'), 'model command catalog dependency is stable');
  const surfaces = renderer + primary;
  for (const name of ['codex-only-startup', 'codex-only-selector', 'codex-only-transition', 'local-tasks-only-composer', 'cloud-task-schema-disabled', 'cloud-task-runtime-blocked', 'cloud-task-list-disabled', 'cloud-task-detail-disabled', 'offline-query-network-mode', 'offline-mutation-network-mode', 'model-id-display-name-fallback', 'archived-threads-cache-fallback']) {
    assert.ok(surfaces.includes('/*codex-offline:' + name + '*/'), 'retained offline contract: ' + name);
  }
  assert.ok(read('.vite/build/src-VqXTPopo.js').includes('internalRequestDenial(e)'));
}
const settingsFile = current ? 'webview/assets/settings-page-ed0dbe72a147.js' : 'webview/assets/settings-page-B4j1j14I.js';
const preferences = read(settingsFile);
assert.ok(preferences.includes('export{TEENetPreferences as SettingsPage}'));
assert.ok(preferences.includes("className: 'no-drag rounded-lg"), 'preference buttons receive native clicks inside the titlebar region');
assert.ok(!preferences.includes('export{' + (current ? 'Wn' : 'Dn') + ' as SettingsPage}'));
const registries = Object.entries(metadata.report).filter(([, report]) => report.commandArrays > 0);
assert.ok(registries.some(([file]) => file.startsWith('.vite/')));
assert.ok(registries.some(([file]) => file.startsWith('webview/')));
for (const [file] of registries) {
  const source = read(file);
  assert.ok(!source.includes('id:`settings`,titleIntlId:'), 'settings command survived in ' + file);
  assert.ok(!source.includes('id:`openBrowserTab`,titleIntlId:'), 'browser command survived in ' + file);
  assert.ok(source.includes('id:`keyboardShortcuts`,titleIntlId:'), 'keyboard help removed in ' + file);
}
for (const file of [...Object.keys(metadata.report), settingsFile, 'webview/assets/teenet-policy.js']) {
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
assert.ok(fs.existsSync(path.join(root, '_internal/setup-codex-managed.ps1')));
console.log('Enterprise package verification passed:', metadata.version);
