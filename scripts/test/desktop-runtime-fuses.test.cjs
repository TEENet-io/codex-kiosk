'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Owl stores Electron fuses in chrome.dll; repacked ASAR launches require that fuse disabled', async () => {
  const { disableAsarIntegrity, verifyAsarIntegrityDisabled } = await import('../desktop-runtime-fuses.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-fuses-'));
  try {
    fs.writeFileSync(path.join(root, 'ChatGPT.exe'), 'thin Owl launcher');
    fs.writeFileSync(path.join(root, 'owl-shell-runtime.json'), JSON.stringify({ schemaVersion: 1, platform: 'win32', arch: 'x64' }));
    const dll = path.join(root, 'chrome.dll');
    const original = Buffer.concat([Buffer.from('MZ dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from([1, 9]), Buffer.from('010011001 trailing data')]);
    fs.writeFileSync(dll, original);
    await assert.rejects(verifyAsarIntegrityDisabled(root), /integrity.*enabled/i);
    assert.equal(path.basename(await disableAsarIntegrity(root)), 'chrome.dll');
    await verifyAsarIntegrityDisabled(root);
    const patched = fs.readFileSync(dll);
    assert.deepEqual([...patched.keys()].filter(i => patched[i] !== original[i]), [original.indexOf('010011001') + 4]);
    await disableAsarIntegrity(root);
    assert.deepEqual(fs.readFileSync(dll), patched, 'idempotent');
    assert.equal(fs.readFileSync(path.join(root, 'ChatGPT.exe'), 'utf8'), 'thin Owl launcher');
    fs.writeFileSync(dll, 'unknown runtime');
    await assert.rejects(disableAsarIntegrity(root), /sentinel/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('classic Electron uses the EXE fuse; unknown layouts fail the build', async () => {
  const { disableAsarIntegrity, verifyAsarIntegrityDisabled } = await import('../desktop-runtime-fuses.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-fuses-'));
  try {
    const exe = path.join(root, 'ChatGPT.exe');
    fs.writeFileSync(exe, Buffer.concat([Buffer.from('MZ dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from([1, 9]), Buffer.from('010011001')]));
    assert.equal(path.basename(await disableAsarIntegrity(root)), 'ChatGPT.exe');
    await verifyAsarIntegrityDisabled(root);
    fs.writeFileSync(exe, 'unknown runtime');
    await assert.rejects(disableAsarIntegrity(root), /sentinel/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
