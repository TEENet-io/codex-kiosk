'use strict';
const koffi = require('./koffi');
const readline = require('node:readline');
const pid = Number(process.argv[2]), hwnd = BigInt(process.argv[3]);
if (!Number.isInteger(pid) || pid <= 0 || hwnd <= 0n) process.exit(2);
const user32 = koffi.load('user32.dll');
const get = user32.func('int32_t __stdcall GetWindowLongW(uintptr_t hwnd, int index)');
const set = user32.func('int32_t __stdcall SetWindowLongW(uintptr_t hwnd, int index, int32_t value)');
const owner = user32.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hwnd, _Out_ uint32_t *pid)');
const refresh = user32.func('int __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int width, int height, uint32_t flags)');
const lines = readline.createInterface({ input: process.stdin });
lines.on('line', line => {
  const message = JSON.parse(line);
  if (typeof message.interactive !== 'boolean') process.exit(2);
  const actual = [0];
  owner(hwnd, actual);
  if (actual[0] !== pid) process.exit(0);
  const style = get(hwnd, -20);
  const next = message.interactive ? style & ~0x80020 : style | 0x80020;
  if (next !== style) {
    set(hwnd, -20, next);
    refresh(hwnd, 0n, 0, 0, 0, 0, 0x37);
  }
  process.stdout.write('ok\n');
});
lines.on('close', () => process.exit(0));
