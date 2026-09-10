'use strict';
// Keep native FFI outside Owl's custom Electron runtime. The companion accepts
// only the owned pet HWND and its interactivity, and exits with that window.
const { spawn } = require('node:child_process');
const path = require('node:path');
function connect(win) {
  const resources = process.resourcesPath;
  const buffer = win.getNativeWindowHandle();
  const hwnd = (buffer.length === 8 ? buffer.readBigUInt64LE() : BigInt(buffer.readUInt32LE())).toString();
  const child = spawn(path.join(resources, 'cua_node/bin/node.exe'), [path.join(resources, 'codex-pet-native/bridge.cjs'), String(process.pid), hwnd], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stopped = false;
  const fail = () => { if (stopped) return; stopped = true; if (!win.isDestroyed()) win.setIgnoreMouseEvents(true, { forward: true }); };
  child.on('error', fail);
  child.on('exit', fail);
  child.stdin.on('error', fail);
  child.stderr.on('data', data => console.warn('[pet-native-input]', data.toString().trim()));
  child.stdout.resume();
  win.once('closed', () => { stopped = true; child.stdin.end(); child.kill(); });
  return interactive => { if (!stopped) child.stdin.write(JSON.stringify({ interactive }) + '\n'); };
}
module.exports = { connect };
