import fs from 'node:fs';
import path from 'node:path';
import { flipFuses, getCurrentFuseWire, FuseVersion, FuseV1Options, FuseState } from '@electron/fuses';

// Codex 26.901's Owl launcher moved Electron into chrome.dll. The launcher
// itself has no fuse wire; its absence must never imply integrity is disabled.
function runtimeBinary(appDir) {
  const manifest = path.join(appDir, 'owl-shell-runtime.json');
  if (fs.existsSync(manifest)) {
    const runtime = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (runtime.schemaVersion !== 1 || runtime.platform !== 'win32' || runtime.arch !== 'x64') {
      throw new Error('Unsupported Owl runtime layout: ' + manifest);
    }
    return path.join(appDir, 'chrome.dll');
  }
  return path.join(appDir, 'ChatGPT.exe');
}

export async function verifyAsarIntegrityDisabled(appDir) {
  const binary = runtimeBinary(appDir);
  const wire = await getCurrentFuseWire(binary);
  if (wire.version !== FuseVersion.V1 || wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation] !== FuseState.DISABLE) {
    throw new Error('ASAR integrity validation is enabled or unsupported in ' + binary);
  }
  return binary;
}

export async function disableAsarIntegrity(appDir) {
  const binary = runtimeBinary(appDir);
  await flipFuses(binary, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
  });
  return verifyAsarIntegrityDisabled(appDir);
}
