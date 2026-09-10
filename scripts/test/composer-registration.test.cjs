'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const baseline = fs.readFileSync(path.join(__dirname, 'fixtures/composer-registration-26.901.cjs'), 'utf8');

// Run the actual pinned producer and registration hooks. Only React scheduling
// and unrelated host hooks are substituted. Store subscribers re-render the
// composer after its registered commands change, as an active editor does.
function mount(source, enabled = true, freshSelection = false) {
  const memo = new Map(), effects = [], ref = { current: undefined };
  let hook = 0, pending = [], dirty = false, writes = 0;
  const model = id => ({ model: id, displayName: id, description: id, defaultReasoningEffort: 'high', supportedReasoningEfforts: [{ reasoningEffort: 'high' }] });
  let models = [model('deepseek-v3.2'), model('devstral-2')], registry = [];
  const settings = { model: 'deepseek-v3.2', reasoningEffort: 'high' }, selected = [];
  const selection = { modelSettings: settings, selectComposerModelAndReasoningEffort: (...args) => selected.push(args.slice(0, 2)) };
  const tiers = { selectedServiceTier: null, availableOptions: [] };
  const store = { get: () => false, set: (_atom, update) => { const next = update(registry); if (next !== registry) { registry = next; writes++; dirty = true; } } };
  const compiler = key => ({ c: size => { if (!memo.has(key)) memo.set(key, Array(size).fill(Symbol.for('react.memo_cache_sentinel'))); return memo.get(key); } });
  const context = {
    gUr: compiler('model'), M5: { c(size) { return compiler('registration-' + size).c(size); } },
    Zas: {
      useRef(value) { if (ref.current === undefined) ref.current = value; return ref; },
      useLayoutEffect(callback, deps) { const i = hook++; if (!effects[i] || deps.some((value, j) => !Object.is(value, effects[i].deps[j]))) { pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: callback() }; }); } },
    },
    Db: () => store, zx: () => store, hK: {}, $as: {}, yi: {},
    me: () => intl, uH: () => editor, hO: () => ({ hostId: 'local', cwd: null }), lS: () => ({ requiresAuth: enabled, authMethod: 'apikey' }),
    rw: () => false, OIr: {}, bS: value => value, hg: {}, Ts: {}, Jt: {},
    xFr: () => freshSelection ? { ...selection, modelSettings: { ...settings }, selectComposerModelAndReasoningEffort: (...args) => selection.selectComposerModelAndReasoningEffort(...args) } : selection, ZIr: () => null, ZS: () => ({ data: { models }, status: 'success' }), iFe: () => true,
    $oe: () => null, Pd: () => null, cv: () => ({ serviceTierSettings: tiers }), dUr: () => null, hUr: () => false,
    ef: (list, id) => list?.find(item => item.model === id), Uf: value => value,
    A3() {}, tH() {}, qgr: {}, Iv: {},
    Has: list => list.sort((a, b) => a.title.localeCompare(b.title)),
    sr: id => id.includes('red'), Iee: id => !id.includes('red'), DT: value => value,
  };
  const intl = { formatMessage: value => value.defaultMessage }, editor = { view: {} };
  vm.createContext(context);
  vm.runInContext(source + '\nnO=Pas;', context);
  const settle = () => {
    for (let depth = 0; depth <= 50; depth++) {
      dirty = false; hook = 0; pending = [];
      context.pUr({});
      for (const effect of pending) effect();
      if (!dirty) return;
    }
    throw new Error('Maximum update depth exceeded');
  };
  return { settle, get writes() { return writes; }, get registry() { return registry; }, selected,
    refresh(ids) { models = ids.map(model); settle(); },
    replaceCallback(callback) { selection.selectComposerModelAndReasoningEffort = callback; settle(); },
    setEnabled(value) { enabled = value; settle(); },
    unmount() { for (const effect of effects) effect.cleanup?.(); },
  };
}

test('pinned baseline reproduces command registration feedback with enabled and disabled model commands', () => {
  for (const enabled of [true, false]) assert.throws(() => mount(baseline, enabled).settle(), /Maximum update depth/);
});

test('unchanged catalog settles; refreshed catalog and selection callbacks remain current', async () => {
  const { patchPinnedModelCommand } = await import('../enterprise/patch-bundle.mjs');
  for (const enabled of [true, false]) {
    const app = mount(patchPinnedModelCommand(baseline, '26.901.51231'), enabled);
    app.settle();
    assert.equal(app.writes, 1);
    app.settle();
    assert.equal(app.writes, 1, 'unchanged inputs do not register again');
    app.refresh(['deepseek-v3.2', 'kimi-k2.5']);
    assert.equal(app.writes, 2, 'catalog refresh is propagated once');
    if (enabled) {
      const items = app.registry[0].submenu.sections[0].items;
      assert.equal(items.map(item => item.id).join(','), 'deepseek-v3.2,kimi-k2.5');
      items[1].onSelect();
      assert.deepEqual(app.selected, [['kimi-k2.5', 'high']]);
    } else assert.equal(app.registry.length, 0);
    app.unmount();
    assert.equal(app.registry.length, 0);
  }
});

test('model command patch refuses a different version or changed pinned anchors', async () => {
  const { patchPinnedModelCommand } = await import('../enterprise/patch-bundle.mjs');
  assert.throws(() => patchPinnedModelCommand(baseline, '26.810.52044'), /Unsupported/);
  assert.throws(() => patchPinnedModelCommand(baseline.replace('gUr.c)(51)', 'gUr.c)(52)'), '26.901.51231'), /drift/);
});

test('b2 still loops when a disabled command receives freshly allocated selection dependencies', async () => {
  const { patchPinnedModelCommand } = await import('../enterprise/patch-bundle.mjs');
  assert.throws(() => mount(patchPinnedModelCommand(baseline, '26.901.51231'), false, true).settle(), /Maximum update depth/);
});

test('registration preserves an unchanged array but still publishes enabled command changes', async () => {
  const { patchPinnedModelCommand, patchPinnedCommandRegistration } = await import('../enterprise/patch-bundle.mjs');
  const source = patchPinnedCommandRegistration(patchPinnedModelCommand(baseline, '26.901.51231'), '26.901.51231');
  const disabled = mount(source, false, true);
  disabled.settle();
  disabled.settle();
  disabled.unmount();
  assert.equal(disabled.writes, 0, 'disabled registration and cleanup do not notify subscribers');
  const enabled = mount(source);
  enabled.settle();
  assert.equal(enabled.writes, 1);
  enabled.refresh(['deepseek-v3.2', 'kimi-k2.5']);
  assert.equal(enabled.writes, 2);
  enabled.registry[0].submenu.sections[0].items[1].onSelect();
  assert.deepEqual(enabled.selected, [['kimi-k2.5', 'high']]);
  const replacementCalls = [];
  enabled.replaceCallback((...args) => replacementCalls.push(args.slice(0, 2)));
  assert.equal(enabled.writes, 3, 'callback-only replacement is observable');
  enabled.registry[0].submenu.sections[0].items[1].onSelect();
  assert.deepEqual(replacementCalls, [['kimi-k2.5', 'high']]);
  enabled.setEnabled(false);
  assert.equal(enabled.registry.length, 0);
  assert.equal(enabled.writes, 4, 'disabling an active command removes it');
  enabled.setEnabled(true);
  assert.equal(enabled.writes, 5);
  enabled.unmount();
  assert.equal(enabled.writes, 6, 'unmount of an active command is observable');
});

test('registration patch refuses a different version or changed pinned anchors', async () => {
  const { patchPinnedCommandRegistration } = await import('../enterprise/patch-bundle.mjs');
  assert.throws(() => patchPinnedCommandRegistration(baseline, '26.810.52044'), /Unsupported/);
  assert.throws(() => patchPinnedCommandRegistration(baseline.replace('.filter(zas)', '.filter(other)'), '26.901.51231'), /drift/);
});
