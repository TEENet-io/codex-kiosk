'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');
const source = fs.readFileSync(path.join(__dirname, '../patch-app-asar.mjs'), 'utf8');
const functions = new Map();

test('hidden sidebar actions preserve the new native context-menu child element contract', () => {
  const policy = require('../enterprise/policy.cjs');
  const jsx = policy.createJsxGuard((type, props, key) => ({ type, props, key }));
  const label = jsx('FormattedMessage', { id: 'sidebarElectron.inboxRouteNavLink' });
  const action = jsx('SidebarItem', { label, onClick() { throw new Error('blocked action ran'); } });
  // 26.901 e8i reads and clones its child without a nullable-child fallback.
  const contextMenu = child => ({ ...child, props: { ...child.props, onClick: child.props.onClick } });
  const trigger = contextMenu(action);
  assert.equal(typeof trigger.type, 'function');
  assert.equal(trigger.type(trigger.props), null, 'no rendered DOM or focusable action');
  assert.equal(trigger.props.onClick, undefined, 'blocked handler never reaches the wrapper');
  const voice = jsx('button', { children: 'Voice', onClick() {} });
  assert.equal(jsx('nav', { children: [action, voice] }).props.children[1], voice, 'adjacent normal action survives');
});
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') functions.set(node.id.name, source.slice(node.start, node.end));
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') walk(value);
  }
}
walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
function helper(name, bindings = {}, extra = '') {
  return Function(...Object.keys(bindings), extra + '\n' + functions.get(name) + '\nreturn ' + name)(...Object.values(bindings));
}

test('enterprise static gate rewrites disable controls while retaining voice gates', () => {
  const patch = helper('patchDirectStatsigGateCalls', {}, functions.get('escapeRegExp'));
  const output = patch('const a=gate(`1506311413`),b=!gate(`1506311413`),c=gate(`voice`);', ['1506311413', 'voice'], '/*test*/', { '1506311413': false });
  const result = Function(output.content + 'return {a,b,c}')();
  assert.deepEqual(result, { a: false, b: true, c: true });
});

test('26.901 custom model label uses the real model ID with the new formatter options', () => {
  const patch = helper('patchModelDisplayNameFallback', { MODEL_DISPLAY_NAME_FALLBACK_PATCH_MARKER: '/*model*/' });
  const fixture = 'function label(e){let t=[],{model:n,displayName:r}=e,u;if(r!=null){let e=false,n;n=Uf(r,{stripGptPrefix:e}),u=n}else if(n){let e;t[3]===Symbol.for(`react.memo_cache_sentinel`)?(e=jsx(X,{id:`composer.mode.local.model.custom`,defaultMessage:`Custom`,description:`Custom model from config`}),t[3]=e):e=t[3],u=e}else u=n;return u}';
  const result = patch(fixture);
  assert.equal(result.patched, true);
  const label = Function('Uf', result.content + ';return label')(value => value);
  assert.equal(label({ model: 'company-model' }), 'company-model');
  assert.equal(label({ model: 'company-model', displayName: 'Approved model' }), 'Approved model');
});

test('26.901 archived pagination preserves partial results and propagates active-thread failures', async () => {
  const fixture = 'async function l9t(e,{modelProviders:t,archived:n=!1,sourceKinds:r=ALt}){let i=[],a=async o=>{let s={limit:100,cursor:o,sortKey:e.recentConversationsSortKey,modelProviders:t,sourceKinds:r,archived:n,useStateDbOnly:e.useStateDbOnly},c=await e.sendRequest(`thread/list`,s,{priority:`background`,source:`thread_list`});i.push(...c.data),c.nextCursor&&await a(c.nextCursor)};return await a(null),i}';
  const patch = helper('patchArchivedThreadsPartialList', {
    ARCHIVED_THREADS_PARTIAL_LIST_PATCH_MARKER: '/*partial*/',
    ARCHIVED_THREADS_CACHE_FALLBACK_PATCH_MARKER: '/*cache*/',
  }, functions.get('archivedThreadsReturnExpression'));
  const result = patch(fixture);
  assert.equal(result.patched, true);
  const list = Function('ALt', result.content + ';return l9t')([]);
  const requests = [];
  const client = { recentConversationsSortKey: 'updated_at', useStateDbOnly: false, sendRequest: async (method, params, options) => {
    requests.push({ method, params, options });
    if (params.cursor) throw new Error('second page failed');
    return { data: [{ id: 'saved-thread' }], nextCursor: 'page-2' };
  } };
  try {
    assert.deepEqual(await list(client, { archived: true, modelProviders: null }), [{ id: 'saved-thread' }]);
    assert.equal(requests[0].params.useStateDbOnly, true);
    assert.equal(requests[0].options.priority, 'background');
    await assert.rejects(list(client, { archived: false, modelProviders: null }), /second page failed/);
    assert.equal(requests[2].params.useStateDbOnly, false);
  } finally { delete globalThis.__codexOfflineArchivedThreadsCache; }
});

test('new upstream control and personalization plugins cannot run or be installed', () => {
  const policy = require('../enterprise/policy.cjs');
  for (const name of ['unified-computer-use', 'codex-app-tools', 'user-writing']) {
    assert.ok(policy.removedPlugins.includes(name));
    assert.ok(policy.appServerArgs(['app-server']).includes('plugins."' + name + '@openai-bundled".enabled=false'));
    assert.ok(policy.internalRequestDenial({ method: 'plugin/install', params: { pluginName: name, marketplacePath: 'C:/trusted' } }, ['C:/trusted']));
  }
  assert.equal(policy.applyFeaturePolicy({ browserExtensions: true }).browserExtensions, false);
});

test('26.901 cloud execution cannot bypass the local-only thread target schema', () => {
  const constants = source.slice(source.indexOf('const CODEX_ONLY_STARTUP_PATCH_MARKER'), source.indexOf('function patchCodexOnlyLocalTasks'));
  const patch = helper('patchCodexOnlyLocalTasks', { contractPatchMarker: value => value }, constants);
  const fixture = 'function run(o,r){try{r?.throwIfAborted();let t=o.data.target;if(t.type===`chatgptWorkCloud`){throw Error(`cloud executed`)}return `local`}catch(e){throw e}}';
  const result = patch(fixture);
  assert.ok(result.markers.has('/*codex-offline:cloud-task-runtime-blocked*/'));
  const run = Function('dE', result.content + ';return run')(message => ({ error: message }));
  assert.match(run({ data: { target: { type: 'chatgptWorkCloud' } } }).error, /disabled/);
  assert.equal(run({ data: { target: { type: 'project' } } }), 'local');
});

test('MSIX runtime preparation removes deep control dependencies and preserves shared Node modules', async () => {
  const os = require('node:os');
  const { prepareRuntime, verifyRuntimePaths } = await import('../enterprise/prepare-runtime.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teenet-msix-'));
  const app = path.join(root, '_internal/app');
  const write = (relative, value) => { const file = path.join(app, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  try {
    write('resources/cua_node/bin/node.exe', 'shared runtime');
    write('resources/cua_node/bin/node_modules/%40oai/sky/dist/cache/' + 'nested/'.repeat(30) + 'tslib.js', 'control only');
    write('resources/cua_node/bin/node_modules/sharp/index.js', 'office dependency');
    write('resources/app.asar.unpacked/node_modules/%40worklouder/device/node_modules/%40serialport/bindings/bindings.node', 'original native module');
    write('resources/cua_node/bin/node_modules/%40statsig/client/%24_StatsigGlobal.js', 'statsig global');
    assert.throws(() => verifyRuntimePaths(root), /path|Encoded/);
    const report = prepareRuntime(app);
    assert.equal(report.removed.length, 1);
    assert.equal(fs.readFileSync(path.join(app, 'resources/app.asar.unpacked/node_modules/@worklouder/device/node_modules/@serialport/bindings/bindings.node'), 'utf8'), 'original native module');
    assert.equal(fs.readFileSync(path.join(app, 'resources/cua_node/bin/node_modules/sharp/index.js'), 'utf8'), 'office dependency');
    assert.ok(fs.existsSync(path.join(app, 'resources/cua_node/bin/node_modules/@statsig/client/$_StatsigGlobal.js')));
    assert.doesNotThrow(() => verifyRuntimePaths(root));
    assert.deepEqual(prepareRuntime(app), { removed: [], renamed: 0 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
