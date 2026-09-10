const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { sync } = require('../enterprise/pet-pointer.cjs');

test('Windows pet independently enters and leaves hit regions without renderer hover events', () => {
  const win = new EventEmitter();
  let visible = true, cursor = { x: 110, y: 60 }, tick, cancelled = false, refreshes = 0, restored = 0;
  const calls = [];
  Object.assign(win, { isDestroyed: () => false, isVisible: () => visible, getContentBounds: () => ({ x: 100, y: 50 }), setIgnoreMouseEvents: (...args) => calls.push(args) });
  const manager = { window: win, pointerInteractive: false, inputShape: [{ left: 300, top: 500, width: 100, height: 120 }], refreshCursorAtCurrentMousePosition: () => refreshes++ };
  sync(manager, { getCursorScreenPoint: () => cursor }, fn => { tick = fn; return {}; }, () => { cancelled = true; }, () => interactive => { if (interactive) restored++; });
  assert.deepEqual(calls.at(-1), [true, { forward: true }]);
  cursor = { x: 450, y: 600 }; tick();
  assert.deepEqual(calls.at(-1), [false, { forward: false }], 'pet receives mouse without a preceding renderer pointer-enter');
  assert.equal(refreshes, 1);
  assert.equal(restored, 1, 'interactive transition restores native hit testing');
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
  const original = 'class Pet{applyPointerInteractivityPolicy(){let e=this.window;return e}prepare(){e!=null&&!e.isDestroyed()&&e.setOpacity(lm)}restorePresentationAccessories(){}fadePresentation(e,t,n,r){this.cancelPresentationFade(e,!1);}cancel(){t&&e!=null&&!e.isDestroyed()&&e.setOpacity(1)}shouldPresentWindow(){}}';
  const patched = patchPinnedPetInput(original, '26.901.51231');
  assert.match(patched, /process.platform===`win32`&&!this.supportsInputShape/);
  assert.match(patched, /pet-pointer.cjs/);
  assert.match(patched, /codex:pet-no-layered-fade/);
  const instantiate = platform => new Function('process', 'return (' + patched + ')')({ platform });
  for (const platform of ['win32', 'darwin']) {
    const Pet = instantiate(platform);
    const pet = new Pet();
    let cancelled = 0, completed = 0;
    pet.cancelPresentationFade = () => cancelled++;
    pet.fadePresentation({}, 0, 1, () => completed++);
    assert.equal(cancelled, 1);
    assert.equal(completed, platform === 'win32' ? 1 : 0, 'Windows fade still completes visibility callbacks');
  }
  assert.throws(() => patchPinnedPetInput(patched, '26.901.51231'), /baseline drift/);
  assert.throws(() => patchPinnedPetInput(original, 'future'), /Unsupported/);
});

test('failed native companion keeps the desktop clickable', () => {
  const win = new EventEmitter(), calls = [];
  Object.assign(win, { isDestroyed: () => false, isVisible: () => true, getContentBounds: () => ({ x: 0, y: 0 }), setIgnoreMouseEvents: (...args) => calls.push(args) });
  const manager = { window: win, inputShape: [{ left: 0, top: 0, width: 20, height: 20 }], refreshCursorAtCurrentMousePosition: () => { throw Error('Failed companion must not synthesize pet hover'); } };
  sync(manager, { getCursorScreenPoint: () => ({ x: 10, y: 10 }) }, () => ({}), () => {}, () => () => false);
  assert.deepEqual(calls.at(-1), [true, { forward: true }]);
});
