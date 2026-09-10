const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { sync } = require('../enterprise/pet-pointer.cjs');

test('Windows pet independently enters and leaves hit regions without renderer hover events', () => {
  const win = new EventEmitter();
  let visible = true, cursor = { x: 110, y: 60 }, tick, cancelled = false, refreshes = 0;
  const calls = [];
  Object.assign(win, { isDestroyed: () => false, isVisible: () => visible, getContentBounds: () => ({ x: 100, y: 50 }), setIgnoreMouseEvents: (...args) => calls.push(args) });
  const manager = { window: win, pointerInteractive: false, inputShape: [{ left: 300, top: 500, width: 100, height: 120 }], refreshCursorAtCurrentMousePosition: () => refreshes++ };
  sync(manager, { getCursorScreenPoint: () => cursor }, fn => { tick = fn; return {}; }, () => { cancelled = true; });
  assert.deepEqual(calls.at(-1), [true, { forward: true }]);
  cursor = { x: 450, y: 600 }; tick();
  assert.deepEqual(calls.at(-1), [false, { forward: false }], 'pet receives mouse without a preceding renderer pointer-enter');
  assert.equal(refreshes, 1);
  manager.dragState = {}; cursor = { x: 50, y: 20 }; tick();
  assert.equal(calls.length, 2, 'drag remains interactive outside mascot');
  manager.dragState = null; manager.pointerInteractive = true; tick();
  assert.deepEqual(calls.at(-1), [true, { forward: true }], 'stale renderer hover cannot block the desktop');
  visible = false; tick();
  assert.deepEqual(calls.at(-1), [true, { forward: false }]);
  visible = true; cursor = { x: 450, y: 600 }; manager.inputShape = []; tick();
  assert.deepEqual(calls.at(-1), [true, { forward: true }], 'empty region list stays click-through');
  win.emit('closed'); assert.equal(cancelled, true);
});

test('pet native patch is exact and scoped to unsupported Windows input shapes', async () => {
  const { patchPinnedPetInput } = await import('../enterprise/patch-bundle.mjs');
  const original = 'class Pet{applyPointerInteractivityPolicy(){let e=this.window;return e}}';
  const patched = patchPinnedPetInput(original, '26.901.51231');
  assert.match(patched, /process.platform===`win32`&&!this.supportsInputShape/);
  assert.match(patched, /pet-pointer.cjs/);
  assert.throws(() => patchPinnedPetInput(patched, '26.901.51231'), /baseline drift/);
  assert.throws(() => patchPinnedPetInput(original, 'future'), /Unsupported/);
});
