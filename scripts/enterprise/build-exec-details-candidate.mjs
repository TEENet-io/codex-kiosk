// Rebuild the installer from the immutable, Windows-validated b6 package.
// Only the pinned renderer fix and version/provenance metadata change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { execDetailsBundle, patchPinnedExecDetails, verifyPinnedExecDetails } from './patch-bundle.mjs';
const require = createRequire(import.meta.url), asar = require('@electron/asar');
if (process.platform !== 'win32') throw Error('Windows candidate packaging required');
const zip = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
const config = JSON.parse(fs.readFileSync('config/enterprise-preview.json'));
assert.equal(config.version, '26.901.51231-b7');
const hash = async file => {
  const h = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest('hex');
};
const baseHash = '2c2489ff744e3015347d4afb29ff1ab6aa534f978fa0e2d9e87839ca9e409713';
assert.equal(await hash(zip), baseHash, 'immutable b6 portable');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-b7-'));
execFileSync('tar.exe', ['-xf', zip, '-C', work], { stdio: 'inherit' });
const stage = path.join(work, 'codex-only-local-26.901.51231-b6');
const archive = path.join(stage, '_internal/app/resources/app.asar');
const metaPath = path.join(stage, 'enterprise-build.json');
const metadata = JSON.parse(fs.readFileSync(metaPath));
assert.equal(metadata.version, '26.901.51231-b6');
assert.equal(metadata.base.appVersion, config.base.appVersion);
assert.equal(await hash(archive), metadata.asarSha256, 'base ASAR');
const unpacked = path.join(work, 'asar');
asar.extractAll(archive, unpacked);
const file = path.join(unpacked, execDetailsBundle);
const original = fs.readFileSync(file, 'utf8');
const patched = patchPinnedExecDetails(original, config.base.appVersion);
verifyPinnedExecDetails(patched, config.base.appVersion);
fs.writeFileSync(file, patched);
await asar.createPackage(unpacked, archive);
metadata.sourcePackage = { version: metadata.version, sha256: baseHash, asarSha256: metadata.asarSha256, stageTransfer: metadata.stageTransfer };
delete metadata.stageTransfer;
Object.assign(metadata, { version: config.version, builtAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), asarSha256: await hash(archive), windowsSmoke: 'not-run', status: 'built-unvalidated' });
metadata.report[execDetailsBundle] ??= { commandArrays: 0 };
metadata.report[execDetailsBundle].commandDetailsExpandable = true;
fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n');
const infoPath = path.join(stage, '_internal/build-info.json');
const info = JSON.parse(fs.readFileSync(infoPath));
info.version = config.version;
info.releaseTag = null;
fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n');
fs.writeFileSync(path.join(stage, 'codex-version.txt'), config.version + '\n');
for (const name of ['block-list.md', 'README.md']) {
  const target = path.join(stage, name);
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replaceAll('26.901.51231-b6', config.version));
}
execFileSync(process.execPath, ['scripts/verify-enterprise-preview.mjs', stage], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/enterprise/package-stage.mjs', stage, output], { stdio: 'inherit' });
console.log('Candidate installer built from verified b6:', config.version);
