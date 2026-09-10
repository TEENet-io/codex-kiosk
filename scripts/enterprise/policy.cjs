/* Shared by the desktop process, renderer, builder and enterprise verifier. */
(function (root, factory) {
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  else Object.defineProperty(root, 'TEENetPolicy', { value: policy });
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const disabledGates = Object.freeze({
    '2106641128': 'experimental settings', '3693343337': 'model settings',
    '3026692602': 'workspace dependencies', '410262010': 'browser agent',
    '410065390': 'Chrome mentions', '4250630194': 'in-app browser',
    '2177625257': 'browser import',
    '1506311413': 'Computer Use', '2171042036': 'desktop control',
    '3903563814': 'browser sites', '3326157269': 'external config import',
    '2900529421': 'external config', '2711149772': 'external config',
    '816842483': 'external config', '3075919032': 'automations',
    '3789238711': 'pull requests', '2302560359': 'scratchpad',
    '1488233300': 'heartbeat automations', '2425897452': 'ambient suggestions',
    '2553306736': 'PR badges', '505458': 'worktree',
    '1907601843': 'environment onboarding', '2574306096': 'chronicle',
    '1444479692': 'personality', '717035860': 'sidebar customization',
  });
  const disabledFeatures = Object.freeze([
    'browserAgent', 'browserAgentAvailable', 'browserPane', 'inAppBrowserUse',
    'inAppBrowserUseAllowed', 'externalBrowserUse', 'externalBrowserUseAllowed',
    'computerUse', 'computerUseNodeRepl', 'computerUseAutoInstall', 'browserUseTinysky',
    'browserExtensions', 'browserSettingsCloudSync', 'inAppBrowserUseHistory', 'cuaPIP',
    'codexAppTools', 'userWriting',
    'ambientSuggestions',
  ]);
  const removedPlugins = Object.freeze(['browser', 'chrome', 'computer-use', 'unified-computer-use', 'codex-app-tools', 'user-writing']);
  const approvedBundledPlugins = Object.freeze(['documents', 'spreadsheets', 'presentations', 'latex', 'deep-research', 'visualize', 'sites']);
  const blockedNativeHandlers = Object.freeze([
    'save-codex-managed-remote-ssh-connections', 'set-remote-connection-auto-connect',
    'install-remote-codex', 'start-remote-chatgpt-login-port-forward',
    'set-local-remote-control-enabled', 'set-remote-control-connections-enabled',
    'set-remote-wsl-connections-enabled', 'authorize-remote-control-connections',
    'local-environment-config-save', 'external-agent-import-import',
    'download-internal-plugins', 'worktree-create-managed', 'worktree-delete',
  ]);
  const preferences = Object.freeze([
    ['appearance', '外观'], ['voice', '语音'],
    ['keyboard-shortcuts', '快捷键'], ['data-controls', '归档对话'], ['pets', '宠物'],
  ]);
  const blockedCommands = new Set([
    'settings', 'codexMicroSettings', 'mcpSettings', 'personalitySettings',
    'importExternalAgent', 'logOut',
    'manageTasks', 'openControlWindow', 'toggleDebugModal', 'openBrowserTab',
    'toggleBrowserPanel', 'focusBrowserAddressBar', 'navigateBrowserBack',
    'navigateBrowserForward', 'openReviewTab', 'toggleReviewTab', 'toggleReviewPanel',
    'toggleWorktreeMode', 'composer.toggleWorktreeMode', 'composer.toggleWorkRunLocation',
    'composer.captureAppshot', 'switchToChat', 'switchToWork',
    'switchToMode1', 'switchToMode2', 'togglePriorityFilter',
    'temporaryChat', 'quickChat', 'focusQuickChat',
  ]);
  function commandAllowed(id) {
    return typeof id !== 'string' || (!blockedCommands.has(id) && !/^(?:git\.|environmentAction\d+$)/.test(id));
  }
  function blockedMenuItem(id) {
    return commandAllowed(id) ? null : { id, label: id, visible: false, enabled: false };
  }
  function onboardingTarget(auth) {
    if (auth.isLoading) return null;
    if ((!auth.authMethod && auth.requiresAuth) || (auth.authMethod === 'chatgpt' && auth.hasChatGptToken === false)) return 'login';
    return 'app';
  }
  function routeAllowed(input) {
    if (typeof input !== 'string') return false;
    let route;
    try { route = decodeURIComponent(new URL(input, 'https://employee.invalid').pathname); }
    catch { return false; }
    if (route === '/settings') return false;
    if (route.startsWith('/settings/')) return preferences.some(([slug]) => route === '/settings/' + slug);
    return !/^\/(?:automations|remote|remote-connections|codex-mobile|pull-requests|scratchpad|chronicle|computer-use|browser-use|import|profile|account)(?:\/|$)/.test(route);
  }
  const writableConfigKeys = new Set(['model', 'model_reasoning_effort', 'model_reasoning_summary', 'service_tier']);
  const reason = '此操作由管理员统一管理。';
  function requestDenial(request) {
    const method = request?.method;
    if (typeof method !== 'string') return null;
    if (/^plugin\/(?:(?:install|uninstall)$|share\/(?:save|delete|updateTargets)$)/.test(method) ||
        /^marketplace\/(?:add|remove|update|install)/.test(method) ||
        /^account\/(?:login\/|logout$)/.test(method) ||
        /^remoteControl\/(?:enable|pairing\/start|client\/revoke)/.test(method) ||
        /^(?:externalAgentConfig\/import|mcpServer\/oauth\/login)/.test(method)) return reason;
    if (method === 'config/value/write' && !writableConfigKeys.has(request.params?.keyPath)) return reason;
    if (method === 'config/batchWrite') {
      const edits = request.params?.edits;
      if (!Array.isArray(edits) || edits.some(edit => !writableConfigKeys.has(edit?.keyPath))) return reason;
    }
    return null;
  }
  function messageDenial(message) {
    const type = message?.type;
    if (typeof type !== 'string') return null;
    if (['open-config-toml', 'open-extension-settings', 'open-browser-tab', 'open-browser-in-main-window', 'reload-bundled-plugins', 'settings-delete-targeted'].includes(type)) return reason;
    if (/^(?:pending-worktree-|browser-sidebar-|browser-use-|computer-use-|computer-history\/)/.test(type)) return reason;
    if (type === 'navigate-to-route' && !routeAllowed(message.path)) return reason;
    return null;
  }
  function internalRequestDenial(request, trustedMarketplacePaths = []) {
    // Native startup maintains its own runtime config; employee config writes
    // are checked separately at the renderer RPC boundary.
    if (request?.method?.startsWith('config/')) return null;
    // Startup reconciliation retires bundled capabilities removed by this
    // package. Employee RPCs still go through requestDenial and stay blocked.
    if (request?.method === 'plugin/uninstall' && removedPlugins.some(name => request.params?.pluginId === name + '@openai-bundled')) return null;
    const normalize = value => typeof value === 'string' ? value.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase() : null;
    const trusted = candidate => typeof candidate === 'string' && !candidate.split(/[\\/]/).includes('..') && trustedMarketplacePaths.some(p => normalize(p) === normalize(candidate) || normalize(p) + '/.agents/plugins/marketplace.json' === normalize(candidate));
    if (request?.method === 'marketplace/add' && trusted(request.params?.source)) return null;
    if (request?.method === 'plugin/install' && approvedBundledPlugins.includes(request.params?.pluginName) && trusted(request.params?.marketplacePath)) return null;
    return requestDenial(request);
  }
  function applyFeaturePolicy(value) {
    if (!value || typeof value !== 'object') return value;
    const result = { ...value };
    for (const name of disabledFeatures) result[name] = false;
    result.control = false;
    return result;
  }
  function applyGatePolicy(value) {
    const result = applyFeaturePolicy(value || {});
    for (const id of Object.keys(disabledGates)) result[id] = false;
    return result;
  }
  function appServerArgs(args, config = {}) {
    if (!Array.isArray(args) || !args.includes('app-server')) return args;
    const overrides = [
      ...(config.mcp_servers?.node_repl ? ['mcp_servers.node_repl.enabled=false'] : []),
      ...removedPlugins.map(name => 'plugins."' + name + '@openai-bundled".enabled=false'),
    ];
    const index = args.indexOf('app-server');
    return [...args.slice(0, index), ...overrides.flatMap(value => ['-c', value]), ...args.slice(index)];
  }
  function hiddenMessageId(id) {
    if (typeof id !== 'string') return false;
    return /^(?:codex\.profileDropdown\.(?:openConfigToml|logOut|profile|workspaceSettings|switchTo|signIn|apiKeyAuth|amazonBedrockAuth|copilotAuth|getPlus|invite)|sidebarElectron\.(?:connectionsNavLink|pullRequestsRouteNavLink|inboxRouteNavLink|priorityThreads\.showScheduled|addAutomation|editAutomation|createStableWorktree|addRemoteProjectCoachmark|debugNavLink)|plugins\.detail\.(?:install$|uninstall$|mcp\.settings|hooks\.settings)|skills\.appsPage\.(?:addMarketplace|marketplace\.)|settings\.general\.appearance\.chromeTheme\.(?:import|export)|settings\.general\.realtimeVoiceScreenContext|composer\.toggleWorktreeMode|threadHeader\.forkIntoWorktree|composer\.forkSlashCommand\.option\.worktree)/.test(id);
  }
  const hiddenTexts = new Set();
  function markHiddenText(value) {
    if (typeof value === 'string' && value.trim()) hiddenTexts.add(value);
    return value;
  }
  // React compiler caches labels separately from buttons. Propagate a marker
  // through fragments and remove the interactive ancestor, not just its label.
  function createJsxGuard(jsx) {
    const hidden = new WeakSet();
    // Native context menus and Slot wrappers read/clone their child element.
    // Preserve that contract without rendering DOM or retaining action props.
    function HiddenControl() { return null; }
    const removed = key => jsx(HiddenControl, {}, key);
    function marked(value, depth = 0) {
      if (!value || depth > 3) return false;
      if (typeof value === 'string') return hiddenTexts.has(value);
      if (Array.isArray(value)) return value.some(x => marked(x, depth + 1));
      return typeof value === 'object' && hidden.has(value);
    }
    return function guarded(type, props, key) {
      if (typeof props?.onCreateLocalProject === 'function' && 'showRemoteProjectItem' in props) {
        props = { ...props, showRemoteProjectItem: false, showRemoteProjectCoachmark: false, onSelectRemote: undefined, onCreateChatGptProject: undefined };
      }
      if (props && 'onOpenSettings' in props && 'onLogOut' in props) props = { ...props, onOpenProfile: undefined, onOpenWorkspaceSettings: undefined, onLogOut: undefined, onCopyUserId: undefined, identityItems: null };
      if (typeof props?.path === 'string' && props.element && props.path !== '/settings' && !routeAllowed(props.path.startsWith('/') ? props.path : '/' + props.path)) {
        return jsx(type, { ...props, element: jsx('div', { role: 'status', className: 'p-6', children: reason }) }, key);
      }
      if (props?.id === 'codex.profileDropdown.settingsPage' || props?.id === 'codex.profileFooter.settingsFallback' || props?.id === 'codex.header.settingsTooltip') {
        return jsx('span', { children: '外观与快捷键' }, key);
      }
      const ownHidden = hiddenMessageId(props?.id);
      const descendantHidden = marked(props?.children) || marked(props?.title) || marked(props?.label) || marked(props?.tooltipContent) || marked(props?.['aria-label']);
      // Settings fields render their controls in a separate prop, outside the
      // label subtree. Remove the field before that control can be rendered.
      if (props && 'control' in props && marked(props.label)) return removed(key);
      const actionable = props && (typeof props.onClick === 'function' || typeof props.onSelect === 'function' || props.href != null || props.to != null || type === 'button' || type === 'a' || props.role === 'menuitem');
      if (descendantHidden && actionable) return removed(key);
      if (typeof props?.to === 'string' && !routeAllowed(props.to) && props.to !== '/settings') return removed(key);
      const element = jsx(type, props, key);
      if (element && typeof element === 'object' && (ownHidden || descendantHidden)) hidden.add(element);
      return element;
    };
  }
  return Object.freeze({ disabledGates, disabledFeatures, removedPlugins, approvedBundledPlugins, blockedNativeHandlers, preferences, reason, commandAllowed, blockedMenuItem, onboardingTarget, routeAllowed, requestDenial, internalRequestDenial, messageDenial, applyFeaturePolicy, applyGatePolicy, appServerArgs, hiddenMessageId, markHiddenText, createJsxGuard });
});
