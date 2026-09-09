#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { patchExtractedBundle } from './enterprise/patch-bundle.mjs';
import { verifyCli } from './enterprise/verify-cli.mjs';
import { prepareRuntime } from './enterprise/prepare-runtime.mjs';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const policy = require('./enterprise/policy.cjs');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(repo, 'config/enterprise-preview.json'), 'utf8'));
const { values } = parseArgs({ options: {
  'source-zip': { type: 'string' }, 'source-msix': { type: 'string' }, 'output': { type: 'string' },
  'skip-zip': { type: 'boolean', default: false }, 'installer': { type: 'boolean', default: false },
} });
export async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
const output = path.resolve(values.output || path.join(repo, 'dist', config.version));
const cache = path.join(repo, 'build/enterprise-source');
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(output, { recursive: true });
const zip = path.resolve(values['source-zip'] || path.join(cache, 'base-portable.zip'));
if (!fs.existsSync(zip)) {
  execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-fL', '--retry', '3', config.carrier.url, '-o', zip], { stdio: 'inherit' });
}
if (await hashFile(zip) !== config.carrier.sha256) throw new Error('Enterprise source SHA-256 mismatch');
console.log('Verified immutable base:', config.carrier.tag);
// Short paths also avoid Windows MAX_PATH failures when extracting the bundle.
const work = fs.mkdtempSync(path.join(process.platform === 'win32' ? os.tmpdir() : path.join(repo, 'build'), 'te-'));
if (process.platform === 'win32') execFileSync('tar.exe', ['-xf', zip, '-C', work], { stdio: 'inherit' });
else execFileSync('unzip', ['-q', zip, '-d', work], { stdio: 'inherit' });
const stage = path.join(work, config.carrier.root);
const app = path.join(stage, '_internal/app');
// The old package supplies only launchers, the skill seed and pinned office
// runtime plugins. Replace the entire desktop app to avoid stale native DLLs.
const msix = path.resolve(values['source-msix'] || path.join(cache, 'ChatGPT-' + config.base.msixVersion + '-x64.msix'));
if (!fs.existsSync(msix)) execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-fL', '--retry', '3', config.base.url, '-o', msix], { stdio: 'inherit' });
if (await hashFile(msix) !== config.base.sha256) throw new Error('Official MSIX SHA-256 mismatch; obtain the pinned version, do not silently update');
const official = path.join(work, 'official');
fs.mkdirSync(official);
if (process.platform === 'win32') execFileSync('tar.exe', ['-xf', msix, '-C', official], { stdio: 'inherit' });
else execFileSync('unzip', ['-q', msix, '-d', official], { stdio: 'inherit' });
const appx = fs.readFileSync(path.join(official, 'AppxManifest.xml'), 'utf8');
if (!appx.includes('Version="' + config.base.msixVersion + '"') || !appx.includes('Name="OpenAI.Codex"')) throw new Error('Unexpected official MSIX identity');
const oldMarketplace = path.join(app, 'resources/plugins/openai-bundled');
const newMarketplace = path.join(official, 'app/resources/plugins/openai-bundled');
const manifestRelative = '.agents/plugins/marketplace.json';
const oldPlugins = JSON.parse(fs.readFileSync(path.join(oldMarketplace, manifestRelative), 'utf8'));
const newPlugins = JSON.parse(fs.readFileSync(path.join(newMarketplace, manifestRelative), 'utf8'));
for (const name of ['documents', 'spreadsheets', 'presentations']) {
  fs.cpSync(path.join(oldMarketplace, 'plugins', name), path.join(newMarketplace, 'plugins', name), { recursive: true });
  newPlugins.plugins = newPlugins.plugins.filter(plugin => plugin.name !== name);
  newPlugins.plugins.push(oldPlugins.plugins.find(plugin => plugin.name === name));
}
fs.writeFileSync(path.join(newMarketplace, manifestRelative), JSON.stringify(newPlugins, null, 2) + '\n');
fs.rmSync(app, { recursive: true });
fs.renameSync(path.join(official, 'app'), app);
console.log('Prepared official runtime:', JSON.stringify(prepareRuntime(app)));
for (const relative of ['_internal/patches', '_internal/app/patches']) {
  fs.mkdirSync(path.join(stage, relative), { recursive: true });
  for (const name of ['init.cjs', 'plugin-service-compat.cjs']) fs.copyFileSync(path.join(repo, 'scripts/desktop-patches', name), path.join(stage, relative, name));
}
execFileSync(process.execPath, [path.join(repo, 'scripts/patch-app-asar.mjs'), '--enterprise', '--app-dir', app], { stdio: 'inherit' });
const buildInfoPath = path.join(stage, '_internal/build-info.json');
const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
Object.assign(buildInfo, { version: config.version, appVersion: config.base.appVersion, sourceVersion: config.base.msixVersion, releaseTag: null, appSource: config.base, sourceMetadata: { version: config.base.msixVersion, sourceSha256: config.base.sha256 } });
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2) + '\n');
if (process.platform === 'win32') await verifyCli(path.join(app, 'resources/codex.exe'));
const archive = path.join(app, 'resources/app.asar');
const unpacked = path.join(work, 'asar');
asar.extractAll(archive, unpacked);
const report = patchExtractedBundle(unpacked);
console.log('Enterprise semantic patches:', JSON.stringify(report));
await asar.createPackage(unpacked, archive);
// Both original search locations must use the same enforced runtime policy.
for (const relative of ['_internal/patches', '_internal/app/patches']) {
  const dir = path.join(stage, relative);
  const initPath = path.join(dir, 'init.cjs');
  let init = fs.readFileSync(initPath, 'utf8');
  const anchor = '\n  // ═══════════════════════════════════════════════════════════════════════\n  // Helpers';
  if (!init.includes(anchor)) throw new Error('Runtime feature bootstrap drift: ' + relative);
  init = init.replace(anchor, '\n  STATSIG_GATE_OVERRIDES = require("./policy.cjs").applyGatePolicy(STATSIG_GATE_OVERRIDES);\n  FORCED_DESKTOP_FEATURE_STATE = require("./policy.cjs").applyFeaturePolicy(FORCED_DESKTOP_FEATURE_STATE);\n' + anchor);
  fs.writeFileSync(initPath, init);
  fs.copyFileSync(path.join(repo, 'scripts/enterprise/policy.cjs'), path.join(dir, 'policy.cjs'));
}
const marketplaceRoot = path.join(app, 'resources/plugins/openai-bundled');
const marketplacePath = path.join(marketplaceRoot, '.agents/plugins/marketplace.json');
const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
marketplace.plugins = marketplace.plugins.filter(plugin => !policy.removedPlugins.includes(plugin.name));
fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + '\n');
for (const name of policy.removedPlugins) fs.rmSync(path.join(marketplaceRoot, 'plugins', name), { recursive: true, force: true });
// Employee package has no reconfiguration or browser installation utilities.
for (const relative of ['Setup Codex.cmd', '_internal/chrome-extension', '_internal/tools', '_internal/repair-chrome-host.ps1', '_internal/setup-codex-offline.ps1', '_internal/powershell-shim']) {
  fs.rmSync(path.join(stage, relative), { recursive: true, force: true });
}
for (const name of ['Codex.cmd', 'Codex.vbs']) {
  const file = path.join(stage, name);
  const source = fs.readFileSync(file, 'utf8').replaceAll('CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE=1', 'CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE=0').replaceAll('("CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE") = "1"', '("CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE") = "0"');
  fs.writeFileSync(file, source);
}
fs.copyFileSync(path.join(repo, 'scripts/setup-enterprise-preview.ps1'), path.join(stage, '_internal/setup-enterprise-preview.ps1'));
const cmdPath = path.join(stage, 'Codex.cmd');
fs.writeFileSync(cmdPath, fs.readFileSync(cmdPath, 'utf8').replace('start "" /D', 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_internal\\setup-enterprise-preview.ps1"\r\nif errorlevel 1 exit /b 1\r\nstart "" /D'));
const vbsPath = path.join(stage, 'Codex.vbs');
fs.writeFileSync(vbsPath, fs.readFileSync(vbsPath, 'utf8').replace('shell.CurrentDirectory = appRoot', 'If shell.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & fso.BuildPath(packageRoot, "_internal\\setup-enterprise-preview.ps1") & """", 0, True) <> 0 Then WScript.Quit 1\r\nshell.CurrentDirectory = appRoot'));
const blockList = `# TEENet 企业版功能清单\n\n版本：${config.version}\n基线：${config.base.tag}（MSIX ${config.base.msixVersion}）\n基线 SHA-256：${config.base.sha256}\n\n## 屏蔽\n\n- 完整设置、配置文件编辑、账户切换、连接与环境管理。\n- Worktree、Pull Requests、自动化、Heartbeat、Scratchpad、个性化、Chronicle。\n- Computer Use、浏览器控制、Chrome 扩展和本机桥接；移除专用控制运行时，保留普通 Node/办公运行时。\n- 员工安装/卸载插件、添加插件市场、导入导出配置。\n- Chat/Work 模式切换、快捷浮窗聊天及不留历史的临时聊天。\n- 个性化首启问卷、新模型推广弹窗、Windows 沙箱安装向导、Codex Micro USB 硬件探测。\n- 对应快捷键、命令菜单及被禁止的配置/插件 RPC。\n\n## 保留\n\n- 本地对话、项目、归档/恢复、语音、快捷键、外观、宠物悬浮层与宠物偏好。\n- 会话模型切换，默认模型沿用管理员下发配置。\n- 默认完整访问、普通文件与终端能力、Skill 创建。\n- 管理员预装插件与办公运行时，移除浏览器/Chrome/Computer Use、统一控制、自动化应用工具和写作个性化插件。\n\n## 管理与验收边界\n\n- 这是预览版本。完整设置替换为仅包含外观、语音、快捷键、归档和宠物的精简页面。\n- 沿用现有 CODEX_HOME，不覆盖个人 Provider、密钥或会话文件。\n- 默认模型、隐私策略和插件预装名单由现有管理系统配置，本包不内置员工密钥。\n- 对话采集沿用 ai-env-mgr；项目归属落库、后台回收和网关计费需另外联调，尚未在本包验收。\n- 完整访问和 Skill 创建保留，应用内限制不能代替终端操作系统权限管理。\n- Windows 实测结果见 smoke-result.json（若存在）；没有该结果时，不视为已完成 Windows 验收。\n`;
fs.writeFileSync(path.join(stage, 'block-list.md'), blockList);
fs.writeFileSync(path.join(stage, 'README.md'), '# TEENet AI 工作间预览\n\n解压后双击 Codex.vbs 启动。使用管理员已有的模型与凭据配置。功能清单见 block-list.md。\n\n本包仅供单机预览，请先完成验收，再通过管理系统安排员工部署。\n');
fs.writeFileSync(path.join(stage, 'teenet-version.txt'), config.version + '\n');
const manifest = { ...config, builtAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), asarSha256: await hashFile(archive), report, windowsSmoke: 'not-run', status: 'preview' };
fs.writeFileSync(path.join(stage, 'enterprise-build.json'), JSON.stringify(manifest, null, 2) + '\n');
execFileSync(process.execPath, [path.join(repo, 'scripts/verify-enterprise-preview.mjs'), stage], { stdio: 'inherit' });
const portable = path.join(output, 'TEENet-Codex-' + config.version);
if (fs.existsSync(portable)) throw new Error('Output exists; use a fresh --output path: ' + portable);
fs.cpSync(stage, portable, { recursive: true });
fs.writeFileSync(path.join(output, 'block-list.md'), blockList);
fs.writeFileSync(path.join(output, 'enterprise-build.json'), JSON.stringify(manifest, null, 2) + '\n');
const assets = [];
if (!values['skip-zip']) {
  const zipOutput = portable + '-portable.zip';
  if (process.platform === 'win32') execFileSync('7z', ['a', '-tzip', '-mx=1', zipOutput, path.basename(portable)], { cwd: output, stdio: 'inherit' });
  else execFileSync('zip', ['-q', '-r', '-5', zipOutput, path.basename(portable)], { cwd: output, stdio: 'inherit' });
  assets.push(zipOutput);
}
if (values.installer) {
  if (process.platform !== 'win32') throw new Error('Native installer requires Windows');
  const compiler = path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Inno Setup 6/ISCC.exe');
  const iss = fs.readFileSync(path.join(repo, 'installer/TEENetPreview.iss.tpl'), 'utf8')
    .replaceAll('__SOURCE_ROOT__', portable).replaceAll('__OUTPUT_ROOT__', output)
    .replaceAll('__APP_VERSION__', config.version).replaceAll('__VERSION_INFO_VERSION__', config.base.msixVersion)
    .replaceAll('__INSTALLER_ROOT__', path.join(repo, 'installer'));
  const issPath = path.join(work, 'enterprise.iss');
  fs.writeFileSync(issPath, '\ufeff' + iss);
  execFileSync(compiler, [issPath], { stdio: 'inherit' });
  assets.push(path.join(output, 'TEENet-Codex-' + config.version + '-setup.exe'));
}
const sums = [];
for (const asset of assets) sums.push((await hashFile(asset)) + ' *' + path.basename(asset));
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log('Preview ready:', portable);
console.log('Temporary build root:', work);
