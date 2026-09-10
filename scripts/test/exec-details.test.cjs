'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');
const original = require('./fixtures/exec-details-26.901.cjs').toString();
const version = '26.901.51231';

// Execute the actual upstream component. Simulate hooks/JSX only, retaining
// its state, memo cache, disclosure callback and output rendering decisions.
function mount(source, hideRawCommand) {
  const states = [], cache = Array(69).fill(Symbol.for('react.memo_cache_sentinel'));
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const ctx = {
    Nx: { c: () => cache },
    Px: { useState(init) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof init === 'function' ? init() : init;
      return [states[index], value => { states[index] = value; }];
    } },
    Oa: () => null, tr: {}, ix: () => 0,
    sh: () => ({ elementHeightPx: 80, elementRef: null }),
    ve() {}, Em() {}, Dx: () => 10, Ix: () => '10ms', ms: (...parts) => parts.join(' '),
    Z: { jsx, jsxs: jsx }, jm: 'reviews', mr: 'icon', Lg: 'warning', Rs: 'shell',
    Cx: 'summary', Za: 'body', Dm: 'review', yh: { Footer: 'footer' },
    es: value => value, f: { div: 'motion.div' }, xc: {}, ao: 'activity',
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const props = {
    item: { cmd: ['echo', 'hello'], cwd: 'C:/test', output: { aggregatedOutput: 'hello\n', exitCode: 0 } },
    summary: { type: 'unknown' }, hideRawCommand, isInProgress: false,
  };
  return {
    props,
    render() { cursor = 0; return ctx.rx(props).props; },
  };
}

test('upstream simplified command activity has no disclosure or output', () => {
  const view = mount(original, true).render();
  assert.equal(view.disclosure, undefined);
  assert.equal(view.body.props.children, null);
});

test('commands expand and collapse in both display modes without changing compact summaries', async () => {
  const { patchPinnedExecDetails } = await import('../enterprise/patch-bundle.mjs');
  const patched = patchPinnedExecDetails(original, version);
  parse(patched, { ecmaVersion: 'latest' });
  for (const compact of [true, false]) {
    const mounted = mount(patched, compact);
    let view = mounted.render();
    assert.equal(view.disclosure.expanded, false);
    assert.equal(view.body.props.children, null, 'output stays collapsed initially');
    assert.equal(view.summary.props.children.props.showRawCommand, !compact, 'summary mode is preserved');
    view.disclosure.onToggle();
    view = mounted.render();
    assert.equal(view.disclosure.expanded, true);
    const output = view.body.props.children.props.children[1].props;
    assert.equal(output.command, mounted.props.item.cmd);
    assert.equal(output.cwd, 'C:/test');
    assert.equal(output.output, 'hello\n');
    assert.equal(output.footer.props.exitCode, 0);
    assert.equal(view.body.props.style.pointerEvents, 'auto');
    mounted.props.item.output.aggregatedOutput = 'updated output\n';
    assert.equal(mounted.render().body.props.children.props.children[1].props.output, 'updated output\n');
    view.disclosure.onToggle();
    view = mounted.render();
    assert.equal(view.disclosure.expanded, false);
    assert.equal(view.body.props.children, null);
  }
});

test('exec details patch rejects drift, duplicate functions and unsupported versions', async () => {
  const { patchPinnedExecDetails, verifyPinnedExecDetails } = await import('../enterprise/patch-bundle.mjs');
  assert.throws(() => patchPinnedExecDetails(original, '26.810.52044'), /Unsupported/);
  assert.throws(() => patchPinnedExecDetails(original + original, version), /baseline drift/);
  assert.throws(() => patchPinnedExecDetails(original.replace('E=!p&&v', 'E=!p&&changed'), version), /baseline drift/);
  assert.throws(() => verifyPinnedExecDetails(original, version), /exec details/);
  const patched = patchPinnedExecDetails(original, version);
  assert.doesNotThrow(() => verifyPinnedExecDetails(patched, version));
  assert.throws(() => verifyPinnedExecDetails(patched.replace('E=v===', 'E=!p&&v==='), version), /exec details/);
  assert.throws(() => patchPinnedExecDetails(patched, version), /baseline drift/);
  const untouched = '/* unrelated content remains unchanged */';
  assert.ok(patchPinnedExecDetails(untouched + original + untouched, version).startsWith(untouched));
  assert.ok(patchPinnedExecDetails(untouched + original + untouched, version).endsWith(untouched));
});

test('stored exec fixture is byte-identical to the available pinned upstream bundle', t => {
  const file = path.join(__dirname, '../../build/upstream-26.901/asar/webview/assets/subagent-activity-chip-group-7235ecadfc3f.js');
  if (!fs.existsSync(file)) return t.skip('pinned MSIX not present on this runner');
  assert.ok(fs.readFileSync(file, 'utf8').includes(original));
});
