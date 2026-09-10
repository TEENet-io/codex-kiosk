// Transfer a source-built stage using the previous package only as a content
// cache. Every resulting file (including unpacked ASAR members) is verified.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const archivePath = '_internal/app/resources/app.asar';
async function hash(file) {
  const h = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
async function inventory(root) {
  const files = {};
  async function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files[path.relative(root, file).replaceAll('\\', '/')] = await hash(file);
      else throw Error('Unsupported stage entry: ' + file);
    }
  }
  await visit(root);
  return files;
}
function copy(root, dest, file) {
  if (file.split('/').some(p => !p || p === '..') || path.isAbsolute(file)) throw Error('Unsafe stage member');
  fs.mkdirSync(path.dirname(path.join(dest, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(dest, file));
}
async function verify(root, expected) {
  const actual = await inventory(root);
  const mismatches = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].filter(k => actual[k] !== expected[k]);
  if (mismatches.length) throw Error('Stage content mismatch: ' + mismatches.slice(0, 20).join(', '));
}
const [mode, rootArg, payloadArg, outputArg] = process.argv.slice(2);
const root = path.resolve(rootArg), payload = path.resolve(payloadArg);
const unpacked = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-stage-asar-'));
asar.extractAll(path.join(root, archivePath), unpacked);
if (mode === 'prepare') {
  fs.mkdirSync(payload, { recursive: true });
  const files = await inventory(root);
  delete files[archivePath];
  const asarFiles = await inventory(unpacked);
  const changed = ['.vite/build/main-DpnWwRdP.js', 'webview/assets/app-initial-f87238153a19.js', 'webview/assets/teenet-policy.js', ...Object.keys(asarFiles).filter(p => p.startsWith('teenet/'))];
  for (const file of changed) copy(unpacked, path.join(payload, 'asar'), file);
  const regular = ['enterprise-build.json', '_internal/build-info.json', 'codex-version.txt', 'block-list.md', 'README.md', '_internal/patches/policy.cjs', '_internal/app/patches/policy.cjs', ...Object.keys(files).filter(p => p.startsWith('_internal/app/resources/codex-pet-native/'))];
  for (const file of regular) copy(root, path.join(payload, 'regular'), file);
  fs.writeFileSync(path.join(payload, 'stage-files.json'), JSON.stringify({ files, asarFiles }));
  console.log('Prepared verified stage transfer:', Object.keys(files).length, 'files;', Object.keys(asarFiles).length, 'ASAR members');
} else if (mode === 'materialize') {
  const output = path.resolve(outputArg);
  if (fs.existsSync(output)) throw Error('Stage output already exists');
  const expected = JSON.parse(fs.readFileSync(path.join(payload, 'stage-files.json')));
  for (const file of Object.keys(await inventory(path.join(payload, 'asar')))) copy(path.join(payload, 'asar'), unpacked, file);
  await verify(unpacked, expected.asarFiles);
  fs.cpSync(root, output, { recursive: true });
  for (const file of Object.keys(await inventory(path.join(payload, 'regular')))) copy(path.join(payload, 'regular'), output, file);
  const actual = await inventory(output);
  delete actual[archivePath];
  if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(expected.files).sort())) {
    throw Error('Native stage content mismatch: ' + [...new Set([...Object.keys(actual), ...Object.keys(expected.files)])].filter(k => actual[k] !== expected.files[k]).slice(0, 20).join(', '));
  }
  await asar.createPackage(unpacked, path.join(output, archivePath));
  const metadataPath = path.join(output, 'enterprise-build.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath));
  metadata.asarSha256 = await hash(path.join(output, archivePath));
  metadata.stageTransfer = { manifestSha256: await hash(path.join(payload, 'stage-files.json')), checkedFiles: Object.keys(expected.files).length, checkedAsarMembers: Object.keys(expected.asarFiles).length };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  execFileSync(process.execPath, ['scripts/verify-enterprise-preview.mjs', output], { stdio: 'inherit' });
} else throw Error('Expected prepare or materialize');
fs.rmSync(unpacked, { recursive: true });
