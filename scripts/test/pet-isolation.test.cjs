const test = require('node:test');
const assert = require('node:assert/strict');

// Pinned method shapes from the 26.901 avatar manager. Every path is allowed
// to observe null, so disabling creation must neither throw nor mutate state.
const fixture = 'class Pet{async restoreOpenState(e){this.globalState.get(`electron-avatar-overlay-open`)===!0&&await this.open(e)}async prewarm(e){if(this.window!=null||this.openingWindowPromise!=null||this.isAppQuitting)return;let t=this.windowVisibilitySequence,n=await this.ensureWindow(t);n==null||t!==this.windowVisibilitySequence||this.positionWindow(n,e)}async ensureWindow(e){if(this.isAppQuitting)return null;let t=this.closingWindow;return this.createWindow()}}';

test('pet restoration and prewarming do not access persistent state or create a window', async () => {
  const { patchPinnedPetIsolation } = await import('../enterprise/patch-bundle.mjs');
  const patched = patchPinnedPetIsolation(fixture, '26.901.51231');
  const pet = Function(patched + ';return new Pet')();
  const forbidden = () => { throw Error('pet startup side effect'); };
  Object.assign(pet, { globalState: { get: forbidden, set: forbidden }, open: forbidden, createWindow: forbidden, positionWindow: forbidden });
  assert.equal(await pet.restoreOpenState({}), undefined);
  assert.equal(await pet.prewarm({}), undefined);
  assert.equal(await pet.ensureWindow(1), null);
  assert.throws(() => patchPinnedPetIsolation(fixture, '26.810.52044'), /Unsupported/);
  assert.throws(() => patchPinnedPetIsolation(fixture.replace('async prewarm(e)', 'async changed(e)'), '26.901.51231'), /baseline drift/);
});
