'use strict';
// Only called for the owned Windows pet HWND after enabling its hit region.
// Owl retains WS_EX_LAYERED even when setIgnoreMouseEvents(false) is called;
// transparent DirectComposition windows then miss native mouse hit testing.
let api;
function restoreHitTesting(win) {
  if (!api) {
    const path = require('node:path');
    const koffi = require(path.join(process.resourcesPath, 'codex-pet-native/koffi'));
    const user32 = koffi.load('user32.dll');
    api = {
      get: user32.func('int32_t __stdcall GetWindowLongW(uintptr_t hwnd, int index)'),
      set: user32.func('int32_t __stdcall SetWindowLongW(uintptr_t hwnd, int index, int32_t value)'),
      refresh: user32.func('bool __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int width, int height, uint32_t flags)'),
    };
  }
  const buffer = win.getNativeWindowHandle();
  const hwnd = buffer.length === 8 ? buffer.readBigUInt64LE() : BigInt(buffer.readUInt32LE());
  const style = api.get(hwnd, -20);
  if (!(style & 0x80000)) return;
  api.set(hwnd, -20, style & ~0x80000);
  api.refresh(hwnd, 0n, 0, 0, 0, 0, 0x37); // frame changed; no move/resize/z-order/activation
}
module.exports = { restoreHitTesting };
