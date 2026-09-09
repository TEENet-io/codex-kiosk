import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
const require = createRequire(import.meta.url);
const policy = require('./policy.cjs');
const here = path.dirname(fileURLToPath(import.meta.url));
export const marker = '/*teenet:enterprise-preview-v1*/';

function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, visit, node));
    else if (value && typeof value === 'object') walk(value, visit, node);
  }
}
function literal(node) {
  if (node?.type === 'Literal') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}
function key(node) { return node?.type === 'Identifier' ? node.name : literal(node); }
function field(node, name) {
  return node?.type === 'ObjectExpression' ? node.properties.find(p => p.type === 'Property' && key(p.key) === name)?.value : null;
}
function applyEdits(source, edits) {
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const selected = [];
  for (const edit of edits) {
    const prev = selected.at(-1);
    if (prev && edit.start < prev.end) {
      if (edit.end <= prev.end) continue;
      throw new Error('Overlapping enterprise patches');
    }
    selected.push(edit);
  }
  for (const edit of selected.reverse()) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}
function replaceExact(source, needle, replacement, label, count = 1) {
  if (source.split(needle).length - 1 !== count) throw new Error('Enterprise baseline drift: ' + label);
  return source.split(needle).join(replacement);
}

export function patchPinnedStartupControls(source, kind, version = '26.810.52044') {
  if (kind === 'native') {
    return replaceExact(source, 'async getState(){let e=await this.getService();e.start();', 'async getState(){return this.deviceState;/*teenet:no-micro-hardware*/let e=await this.getService();e.start();', 'optional USB controller discovery');
  }
  if (version === '26.901.51231') {
    // The legacy composer remains active while permission-selection rollout
    // is off. It otherwise ignores the CLI profile default for new chats.
    source = replaceExact(source, 'function zno({isProjectless:e,requirements:t}){return e&&Ubt(`granular`,t)?`granular`:`auto`}', 'function zno({isProjectless:e,requirements:t}){return Ubt(`full-access`,t)?`full-access`:e&&Ubt(`granular`,t)?`granular`:`auto`/*teenet:default-full-access*/}', 'legacy composer full-access default');
    return replaceExact(source, 'dIi=Xy(Q,(e,{get:t})=>{if(e==null||e!==`local`)', 'dIi=Xy(Q,(e,{get:t})=>{return uIi;/*teenet:full-access-no-setup*/if(e==null||e!==`local`)', 'Windows sandbox setup requirement');
  }
  source = replaceExact(source, 'function cNc(e){let t=(0,lNc.c)(26)', 'function cNc(e){return null;/*teenet:no-model-promotion*/let t=(0,lNc.c)(26)', 'model promotion modal');
  // The enterprise app-server always uses the requested full-access default;
  // it does not need the workspace-write Windows sandbox installation wizard.
  return replaceExact(source, 'nUs=ja(Q,(e,{get:t})=>{if(e==null||e!==`local`)', 'nUs=ja(Q,(e,{get:t})=>{return tUs;/*teenet:full-access-no-setup*/if(e==null||e!==`local`)', 'Windows sandbox setup requirement');
}

export function patchPinnedModelCommand(source, version) {
  if (version !== '26.901.51231') throw new Error('Unsupported composer baseline: ' + version);
  // pUr passes the projected catalog to Pas/Las/Ras as a layout-effect
  // dependency. A fresh projection on every render causes registration to
  // notify the active editor, which renders and registers again (React #185).
  // Reserve three compiler memo slots without changing the existing slots.
  source = replaceExact(source, 'function pUr(e){let t=(0,gUr.c)(51)', 'function pUr(e){let t=(0,gUr.c)(54)/*codex:stable-model-command*/', 'model command memo capacity');
  return replaceExact(source, 'P=JIr(M,p?N:null),{serviceTierSettings:F}=cv(n)', 'P;{let e=p?N:null;t[51]!==M||t[52]!==e?(P=JIr(M,e),t[51]=M,t[52]=e,t[53]=P):P=t[53]}let{serviceTierSettings:F}=cv(n)', 'model command catalog dependency');
}

export function patchSemanticControls(source, sourceType = 'module') {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true });
  const edits = [];
  const report = { commandArrays: 0, commandsRemoved: 0, capabilitiesDisabled: 0, nativeHandlersBlocked: 0, formattedLabels: 0 };
  walk(ast, (node, parent) => {
    if (sourceType === 'module' && node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && key(node.callee.property) === 'formatMessage' && policy.hiddenMessageId(literal(field(node.arguments[0], 'id')))) {
      edits.push({ start: node.start, end: node.end, text: 'globalThis.TEENetPolicy.markHiddenText(' + source.slice(node.start, node.end) + ')' });
      report.formattedLabels++;
    }
    if (sourceType === 'script' && node.type === 'Property' && parent?.type === 'ObjectExpression' && policy.blockedNativeHandlers.includes(key(node.key)) && ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.value.type)) {
      edits.push({ start: node.value.start, end: node.value.end, text: 'async()=>{throw new Error(' + JSON.stringify(policy.reason) + ')}' });
      report.nativeHandlersBlocked++;
    }
    if (node.type === 'ArrayExpression') {
      const commands = node.elements.map(e => literal(field(e, 'id')));
      if (commands.includes('settings') && commands.includes('keyboardShortcuts')) {
        const allowed = node.elements.filter(e => policy.commandAllowed(literal(field(e, 'id'))));
        report.commandArrays++;
        report.commandsRemoved += node.elements.length - allowed.length;
        edits.push({ start: node.start, end: node.end, text: '[' + allowed.map(e => source.slice(e.start, e.end)).join(',') + ']' });
      }
    }
    if (node.type === 'Property' && parent?.type === 'ObjectExpression' && policy.disabledFeatures.includes(key(node.key))) {
      const text = source.slice(node.value.start, node.value.end);
      if (['true', 'false', '!0', '!1'].includes(text)) {
        edits.push({ start: node.value.start, end: node.value.end, text: 'false' });
        report.capabilitiesDisabled++;
      }
    }
  });
  return { source: applyEdits(source, edits), report };
}

export function patchExtractedBundle(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const current = pkg.version === '26.901.51231';
  if (!current && pkg.version !== '26.810.52044') throw new Error('Unsupported enterprise baseline: ' + pkg.version);
  const reports = {};
  const mainFile = current ? '.vite/build/main-DpnWwRdP.js' : '.vite/build/main-C8eoOzMw.js';
  const rendererFile = current ? 'webview/assets/app-initial-f87238153a19.js' : 'webview/assets/app-initial-TxV8Ik1J.js';
  const settingsFile = current ? 'webview/assets/settings-page-ed0dbe72a147.js' : 'webview/assets/settings-page-B4j1j14I.js';
  const files = [mainFile, current ? '.vite/build/src-VqXTPopo.js' : '.vite/build/src-DhHWkTcG.js', rendererFile, ...(current ? ['webview/assets/app-primary-428a0a65766f.js'] : [])];
  // Discover shared command registries by structure, not guessed minified names.
  for (const dir of ['.vite/build', 'webview/assets']) {
    for (const name of fs.readdirSync(path.join(root, dir))) {
      if (!name.endsWith('.js')) continue;
      const rel = dir + '/' + name;
      if (files.includes(rel)) continue;
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      if ((source.includes('id:`settings`') && source.includes('id:`keyboardShortcuts`')) || (rel.startsWith('webview/') && source.includes('.formatMessage') && [...source.matchAll(/id:`([^`]+)`/g)].some(match => policy.hiddenMessageId(match[1])))) files.push(rel);
    }
  }
  for (const rel of files) {
    const file = path.join(root, rel);
    let source = fs.readFileSync(file, 'utf8');
    if (source.includes(marker)) throw new Error('Enterprise patch expects a fresh fixed baseline: ' + rel);
    const result = patchSemanticControls(source, rel.startsWith('webview/') ? 'module' : 'script');
    source = result.source;
    if (rel.startsWith('.vite/') && source.includes('sendInternalRequest(e,t){')) {
      source = replaceExact(source, 'sendInternalRequest(e,t){', `sendInternalRequest(e,t){
        const denied=require('../../teenet/native-policy.cjs').internalRequestDenial(e);
        if(denied)return Promise.resolve({id:e.id,error:{code:-32001,message:denied}});
      `, 'native RPC boundary ' + rel);
    }
    if (rel === mainFile) {
      source = patchPinnedStartupControls(source, 'native');
      source = 'const _teenetPolicy=require("../../teenet/policy.cjs");\n' + source;
      source = replaceExact(source, current ? 'A=(e,t)=>{let r=n.Ht({commandId:e});' : 'k=(e,t)=>{let r=n.Ut({commandId:e});', current ? 'A=(e,t)=>{const hidden=_teenetPolicy.blockedMenuItem(e);if(hidden)return hidden;let r=n.Ht({commandId:e});' : 'k=(e,t)=>{const hidden=_teenetPolicy.blockedMenuItem(e);if(hidden)return hidden;let r=n.Ut({commandId:e});', 'native menu references to removed commands');
      source = replaceExact(source, current ? 'function U(){return br}' : 'function Tr(){return xr}', current ? 'function U(){return _teenetPolicy.applyFeaturePolicy(br)}' : 'function Tr(){return _teenetPolicy.applyFeaturePolicy(xr)}', 'desktop feature reader');
      source = replaceExact(source, current ? 'function Dr(e){' : 'function Or(e){', current ? 'function Dr(e){e=_teenetPolicy.applyFeaturePolicy(e);' : 'function Or(e){e=_teenetPolicy.applyFeaturePolicy(e);', 'desktop feature updates');
      source = replaceExact(source, current ? 'async function So(e){let t=(await Co(e)).browserExtensions' : 'async function Hl(e){let t=(await Ul(e)).browserExtensions', current ? 'async function So(e){return [];/*teenet:no-browser-extension-sync*/let t=(await Co(e)).browserExtensions' : 'async function Hl(e){return [];/*teenet:no-browser-extension-sync*/let t=(await Ul(e)).browserExtensions', 'browser extension synchronization');
      // The old browser reconciliation deletes MCP settings when capabilities
      // are off. Enterprise disables its runtime through CLI overrides instead
      // and leaves the administrator's config file untouched.
      const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
      let reconcile;
      walk(ast, node => { if (node.type === 'FunctionDeclaration' && node.id?.name === (current ? 'Ys' : 'ys') && node.async) reconcile = node; });
      if (!reconcile || !source.slice(reconcile.start, reconcile.end).includes('config/batchWrite')) throw new Error('Browser config reconciliation drift');
      source = source.slice(0, reconcile.body.start + 1) + 'return;/*teenet:no-browser-config-mutation*/' + source.slice(reconcile.body.start + 1);
      source = replaceExact(source, current ? 'async handleMessage(e,t){if(xR(t))' : 'async handleMessage(e,t){if(_I(t))', `async handleMessage(e,t){
        if(_teenetPolicy.messageDenial(t))return;
        if(t.type==='show-settings'||t.type==='open-keyboard-shortcuts'){
          const w=require('electron').BrowserWindow.fromWebContents(e);
          if(w){const u=new URL(w.getURL());u.searchParams.set('initialRoute',t.type==='open-keyboard-shortcuts'?'/settings/keyboard-shortcuts':'/settings/appearance');await w.loadURL(u.toString());}return;
        }
        if(${current ? 'xR' : '_I'}(t))`, 'desktop message handler');
      source = replaceExact(source, 'case`mcp-request`:{', `case\`mcp-request\`:{
        const denied=_teenetPolicy.requestDenial(t.request);
        if(denied){this.sendAppServerResponseToView(e,t.hostId,t.request.method,{id:t.request.id,error:{code:-32001,message:denied}},t.request.trace,t.priority);break;}
      `, 'renderer RPC boundary');
    }
    if (rel === rendererFile) {
      source = patchPinnedStartupControls(source, 'renderer', pkg.version);
      source = 'import "./teenet-policy.js";\n' + source;
      source = replaceExact(source, 'workspaceRootsIsLoading:u}){return e.isLoading?', 'workspaceRootsIsLoading:u}){return globalThis.TEENetPolicy.onboardingTarget(e);/*teenet:managed-onboarding*/return e.isLoading?', 'managed onboarding decision');
      source = replaceExact(source, 'e.Fragment=n,e.jsx=r,e.jsxs=r', 'e.Fragment=n,e.jsx=globalThis.TEENetPolicy.createJsxGuard(r),e.jsxs=e.jsx', 'React JSX boundary');
      source = replaceExact(source, current ? 'bSo=`general-settings`' : 'ims=`general-settings`', current ? 'bSo=`appearance`' : 'ims=`appearance`', 'default preferences route');
      source = replaceExact(source, current ? '{slug:n}=e,r=Wwo[n],i;' : '{slug:n}=e,r=tdl[n],i;', '{slug:n}=e,r=globalThis.TEENetPolicy.routeAllowed("/settings/"+n)?' + (current ? 'Wwo' : 'tdl') + '[n]:()=>null,i;', 'settings child route guard');
    }
    if (current && rel === 'webview/assets/app-primary-428a0a65766f.js') {
      source = patchPinnedModelCommand(source, pkg.version);
      source = replaceExact(source, 'function Wnn(e){', 'function Wnn(e){return null;/*teenet:no-model-promotion*/', 'model promotion modal');
      source = replaceExact(source, 'function vnn(e){', 'function vnn(e){return null;/*teenet:no-fast-promotion*/', 'fast mode promotion modal');
    }
    parse(source, { ecmaVersion: 'latest', sourceType: rel.startsWith('webview/') ? 'module' : 'script', allowReturnOutsideFunction: true });
    fs.writeFileSync(file, marker + '\n' + source);
    reports[rel] = result.report;
  }
  if (!Object.entries(reports).some(([name, r]) => name.startsWith('webview/') && r.commandArrays > 0)) throw new Error('Renderer command registry not found');
  if (!Object.entries(reports).some(([name, r]) => name.startsWith('.vite/') && r.commandArrays > 0)) throw new Error('Native command registry not found');
  const settings = path.join(root, settingsFile);
  let source = fs.readFileSync(settings, 'utf8');
  let preferences = fs.readFileSync(path.join(here, 'preferences.js.txt'), 'utf8');
  if (current) preferences = preferences.replace('const location = f();', 'const location = A();').replace('const navigate = me();', 'const navigate = ee();').replace('$.jsx(ft, {})', '$.jsx(oe, {})');
  source = replaceExact(source, current ? 'export{Wn as SettingsPage};' : 'export{Dn as SettingsPage};', preferences + '\nexport{TEENetPreferences as SettingsPage};', 'preferences component export');
  parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  fs.writeFileSync(settings, marker + '\n' + source);
  fs.copyFileSync(path.join(here, 'policy.cjs'), path.join(root, 'webview/assets/teenet-policy.js'));
  const entry = path.join(root, pkg.main);
  source = fs.readFileSync(entry, 'utf8');
  fs.writeFileSync(entry, marker + '\nrequire("../../teenet/runtime.cjs");\n' + source);
  fs.mkdirSync(path.join(root, 'teenet'), { recursive: true });
  const tomlPackage = path.resolve(here, '../../node_modules/smol-toml');
  fs.cpSync(tomlPackage, path.join(root, 'teenet/toml'), { recursive: true });
  for (const name of ['policy.cjs', 'runtime.cjs', 'native-policy.cjs']) fs.copyFileSync(path.join(here, name), path.join(root, 'teenet', name));
  return reports;
}
