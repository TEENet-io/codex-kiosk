const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../enterprise/policy.cjs');

test('employee requests cannot install plugins or change managed configuration', () => {
  for (const method of ['plugin/install', 'plugin/uninstall', 'account/login/start', 'account/logout', 'mcpServer/oauth/login', 'remoteControl/enable']) {
    assert.ok(policy.requestDenial({ method, params: {} }), method);
  }
  assert.ok(policy.requestDenial({ method: 'config/batchWrite', params: { edits: [{ keyPath: 'model_provider', value: 'other' }] } }));
  assert.ok(policy.requestDenial({ method: 'config/batchWrite', params: { edits: [{ keyPath: 'model', value: 'm' }, { keyPath: 'mcp_servers.chrome', value: {} }] } }));
});

test('chat, project, archive, model selection and installed plugins remain usable', () => {
  for (const method of ['thread/start', 'thread/resume', 'turn/start', 'thread/list', 'thread/archive', 'thread/unarchive', 'model/list', 'plugin/installed', 'plugin/read', 'skills/list']) {
    assert.equal(policy.requestDenial({ method, params: {} }), null, method);
  }
  assert.equal(policy.requestDenial({ method: 'config/value/write', params: { keyPath: 'model', value: 'test-model' } }), null);
  assert.equal(policy.requestDenial({ method: 'config/batchWrite', params: { edits: [{ keyPath: 'model', value: 'test-model' }] } }), null);
});

test('restricted settings cannot be reached through encoded or nested routes', () => {
  for (const route of ['/settings/mcp-settings', '/settings/%63onnections', '/settings/appearance/../connections', '/settings/appearance/extra', '/remote-connections', '/automations']) {
    assert.equal(policy.routeAllowed(route), false, route);
  }
  for (const route of ['/', '/local/abc', '/settings/appearance', '/settings/voice', '/settings/keyboard-shortcuts', '/settings/data-controls']) {
    assert.equal(policy.routeAllowed(route), true, route);
  }
});

test('voice and model shortcuts remain while advanced commands are removed', () => {
  for (const id of ['settings', 'logOut', 'openBrowserTab', 'toggleWorktreeMode', 'git.createPullRequest', 'manageTasks']) assert.equal(policy.commandAllowed(id), false, id);
  for (const id of ['globalDictationHold', 'globalDictationToggle', 'keyboardShortcuts', 'composer.openModelPicker', 'openSkills', 'openFolder', 'theme']) assert.equal(policy.commandAllowed(id), true, id);
});

test('browser control and configuration entry messages are denied, normal file use remains', () => {
  for (const type of ['open-config-toml', 'open-extension-settings', 'pending-worktree-create', 'open-browser-tab']) assert.ok(policy.messageDenial({ type }), type);
  for (const type of ['fetch', 'open-file', 'open-keyboard-shortcuts']) assert.equal(policy.messageDenial({ type }), null, type);
});

test('removing a blocked menu item preserves adjacent chat and voice actions', () => {
  const jsx = policy.createJsxGuard((type, props, key) => ({ type, props, key }));
  const blockedLabel = jsx('FormattedMessage', { id: 'plugins.detail.install' });
  const voiceLabel = jsx('FormattedMessage', { id: 'codex.command.composer.startDictation' });
  const blocked = jsx('MenuItem', { onSelect() {}, children: blockedLabel });
  const voice = jsx('MenuItem', { onSelect() {}, children: voiceLabel });
  assert.equal(blocked.type(blocked.props), null);
  assert.deepEqual(blocked.props, {}, 'removed action retains no label or handler');
  assert.ok(voice);
  assert.deepEqual(jsx('div', { children: [blocked, voice] }).props.children, [blocked, voice]);
});

test('native menus can reference removed commands without resolving their deleted registry entries', () => {
  const hidden = policy.blockedMenuItem('settings');
  assert.deepEqual(hidden, { id: 'settings', label: 'settings', visible: false, enabled: false });
  assert.equal(policy.commandAllowed(hidden.id), false);
  assert.equal(policy.blockedMenuItem('keyboardShortcuts'), null);
});

test('a restricted preference removes its entire field while retaining ordinary voice fields', () => {
  const jsx = policy.createJsxGuard((type, props) => ({ type, props }));
  const label = jsx('FormattedMessage', { id: 'settings.general.realtimeVoiceScreenContext.label' });
  const control = jsx('Switch', { checked: true, onChange() {} });
  const removed = jsx('SettingsRow', { label, control });
  assert.equal(removed.type(removed.props), null);
  assert.deepEqual(removed.props, {}, 'removed field cannot render its control');
  assert.ok(jsx('SettingsRow', { label: 'Voice', control }));
});

test('feature policy overrides stale user values without changing voice or artifacts', () => {
  const original = { computerUse: true, browserPane: true, artifactsPane: true, dictation: true };
  const result = policy.applyFeaturePolicy(original);
  assert.equal(result.computerUse, false);
  assert.equal(result.browserPane, false);
  assert.equal(result.artifactsPane, true);
  assert.equal(result.dictation, true);
  assert.equal(original.computerUse, true);
});

test('app-server constraints preserve existing provider and model arguments', () => {
  const original = ['-c', 'model_provider="gateway"', 'app-server'];
  const result = policy.appServerArgs(original);
  assert.ok(result.includes('model_provider="gateway"'));
  assert.ok(!result.some(value => value.startsWith('mcp_servers.node_repl')));
  const existing = policy.appServerArgs(original, { mcp_servers: { node_repl: { url: 'http://localhost/mcp' } } });
  assert.ok(existing.includes('mcp_servers.node_repl.enabled=false'));
  assert.ok(result.includes('sandbox_mode="danger-full-access"'));
  assert.equal(result.at(-1), 'app-server');
  assert.deepEqual(policy.appServerArgs(['--version']), ['--version']);
});

test('only native bootstrap can install approved plugins from the exact bundled marketplace', () => {
  const trusted = ['C:/Users/Employee/.codex/.tmp/bundled-marketplaces/openai-bundled'];
  const request = { method: 'plugin/install', params: { pluginName: 'documents', marketplacePath: trusted[0] } };
  assert.ok(policy.requestDenial(request));
  assert.equal(policy.internalRequestDenial(request, trusted), null);
  assert.equal(policy.internalRequestDenial({ ...request, params: { ...request.params, marketplacePath: trusted[0] + '/.agents/plugins/marketplace.json' } }, trusted), null);
  assert.ok(policy.internalRequestDenial({ ...request, params: { ...request.params, pluginName: 'chrome' } }, trusted));
  assert.ok(policy.internalRequestDenial({ ...request, params: { ...request.params, marketplacePath: 'C:/Downloads/evil/openai-bundled' } }, trusted));
});

test('provisioned employees skip personalization onboarding without bypassing authentication', () => {
  assert.equal(policy.onboardingTarget({ isLoading: true }), null);
  assert.equal(policy.onboardingTarget({ requiresAuth: true, authMethod: null }), 'login');
  assert.equal(policy.onboardingTarget({ requiresAuth: true, authMethod: 'chatgpt', hasChatGptToken: false }), 'login');
  assert.equal(policy.onboardingTarget({ requiresAuth: true, authMethod: 'apikey' }), 'app');
});

test('employee home omits scheduled navigation and optional first-run integrations', async () => {
  assert.equal(policy.hiddenMessageId('sidebarElectron.inboxRouteNavLink'), true);
  const { patchPinnedStartupControls } = await import('../enterprise/patch-bundle.mjs');
  const renderer = 'function cNc(e){let t=(0,lNc.c)(26);return t}let tUs={isRequired:false,requirement:null};const ja=(q,fn)=>fn,Q={};let nUs=ja(Q,(e,{get:t})=>{if(e==null||e!==`local`)return tUs;throw Error("sandbox setup")});';
  const result = Function(patchPinnedStartupControls(renderer, 'renderer') + ';return [cNc({}),nUs("local",{})]')();
  assert.deepEqual(result, [null, { isRequired: false, requirement: null }]);
  const native = 'class Device{deviceState={status:"not-detected"};async getState(){let e=await this.getService();e.start();return e.getState()}}';
  const device = Function(patchPinnedStartupControls(native, 'native') + ';return new Device')();
  assert.deepEqual(await device.getState(), { status: 'not-detected' });
});

test('semantic patching removes both command entries and shortcuts but preserves unrelated data', async () => {
  const { patchSemanticControls } = await import('../enterprise/patch-bundle.mjs');
  const source = 'const commands=[{id:`settings`,titleIntlId:`settings`,keys:[`Ctrl+,`]},{id:`keyboardShortcuts`,titleIntlId:`keys`},{id:`globalDictationHold`,titleIntlId:`voice`},{id:`openBrowserTab`,titleIntlId:`browser`}];const capabilities={computerUse:!0,artifactsPane:!0};';
  const result = patchSemanticControls(source);
  const data = Function(result.source + ';return {commands,capabilities}')();
  assert.deepEqual(data.commands.map(c => c.id), ['keyboardShortcuts', 'globalDictationHold']);
  assert.equal(data.capabilities.computerUse, false);
  assert.equal(data.capabilities.artifactsPane, true);
  assert.equal(result.report.commandsRemoved, 2);
});

test('native bundled marketplace trust handles Windows short and long aliases of the same path', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const path = require('node:path');
  const context = { exports: {}, process: { env: { CODEX_HOME: 'C:/Users/RUNNER~1/codex' }, resourcesPath: 'C:/app/resources' }, require(name) {
    if (name === './policy.cjs') return policy;
    if (name === 'node:fs') return { realpathSync: { native: value => value.replace('RUNNER~1', 'runneradmin') } };
    if (name === 'node:path') return path.posix;
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../enterprise/native-policy.cjs'), 'utf8'), context);
  assert.equal(context.exports.internalRequestDenial({ method: 'marketplace/add', params: { source: 'C:/Users/runneradmin/codex/.tmp/bundled-marketplaces/openai-bundled' } }), null);
  assert.ok(context.exports.internalRequestDenial({ method: 'marketplace/add', params: { source: 'C:/Downloads/untrusted' } }));
});


test('pets remain available through preferences, native messages and profile menu', () => {
  assert.equal(policy.routeAllowed('/settings/pets'), true);
  for (const id of ['openPetOverlay', 'tuckAwayPetOverlay', 'openAvatarOverlay']) assert.equal(policy.commandAllowed(id), true, id);
  for (const type of ['avatar-overlay-open', 'avatar-overlay-close', 'avatar-overlay-set-avatar']) assert.equal(policy.messageDenial({ type }), null, type);
  assert.equal(policy.applyGatePolicy({ '2679188970': true })['2679188970'], true);
  assert.equal(policy.applyFeaturePolicy({ avatarOverlay: true }).avatarOverlay, true);
  const toggle = () => {};
  const jsx = policy.createJsxGuard((type, props) => ({ type, props }));
  const menu = jsx('ProfileMenu', { onOpenSettings() {}, onLogOut() {}, onTogglePet: toggle });
  assert.equal(menu.props.onTogglePet, toggle);
  assert.equal(menu.props.onLogOut, undefined, 'account management stays blocked');
  assert.equal(policy.routeAllowed('/settings/personalization'), false);
  assert.ok(policy.messageDenial({ type: 'computer-use-start' }));
});
