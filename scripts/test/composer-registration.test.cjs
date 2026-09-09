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
function mount(source, enabled = true) {
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
    xFr: () => selection, ZIr: () => null, ZS: () => ({ data: { models }, status: 'success' }), iFe: () => true,
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
