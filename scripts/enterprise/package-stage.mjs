// Package a fully verified stage on Windows. The installer template and bundle
// verifier are the same as the normal source build.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { verifyCli } from './verify-cli.mjs';
if (process.platform !== 'win32') throw Error('Windows packaging required');
const stage = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
const config = JSON.parse(fs.readFileSync('config/enterprise-preview.json'));
const metadata = JSON.parse(fs.readFileSync(path.join(stage, 'enterprise-build.json')));
assert.equal(metadata.version, config.version);
assert.equal(metadata.base.sha256, config.base.sha256);
assert.ok(metadata.stageTransfer?.checkedFiles > 0 ||
  (metadata.version === '26.901.51231-b7' && metadata.sourcePackage?.version === '26.901.51231-b6' &&
    metadata.sourcePackage.sha256 === '2c2489ff744e3015347d4afb29ff1ab6aa534f978fa0e2d9e87839ca9e409713'), 'verified source provenance');
await verifyCli(path.join(stage, '_internal/app/resources/codex.exe'));
execFileSync(process.execPath, ['scripts/verify-enterprise-preview.mjs', stage], { stdio: 'inherit' });
fs.mkdirSync(output, { recursive: true });
const portable = path.join(output, 'codex-only-local-' + config.version);
if (fs.existsSync(portable)) throw Error('Package output exists');
fs.cpSync(stage, portable, { recursive: true });
for (const file of ['block-list.md', 'enterprise-build.json']) fs.copyFileSync(path.join(stage, file), path.join(output, file));
const zip = portable + '-portable.zip';
execFileSync('7z', ['a', '-tzip', '-mx=1', zip, path.basename(portable)], { cwd: output, stdio: 'inherit' });
const iss = fs.readFileSync('installer/CodexManaged.iss.tpl', 'utf8')
  .replaceAll('__SOURCE_ROOT__', portable).replaceAll('__OUTPUT_ROOT__', output)
  .replaceAll('__APP_VERSION__', config.version).replaceAll('__VERSION_INFO_VERSION__', config.base.msixVersion)
  .replaceAll('__INSTALLER_ROOT__', path.resolve('installer'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-stage-installer-'));
const issPath = path.join(tmp, 'installer.iss');
fs.writeFileSync(issPath, '\ufeff' + iss);
execFileSync(path.join(process.env['ProgramFiles(x86)'], 'Inno Setup 6/ISCC.exe'), [issPath], { stdio: 'inherit' });
const sums = [];
for (const file of [zip, portable + '-setup.exe']) {
  const h = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  sums.push(h.digest('hex') + ' *' + path.basename(file));
}
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
