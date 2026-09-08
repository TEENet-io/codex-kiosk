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
  if (pkg.version !== '26.810.52044') throw new Error('Unsupported enterprise baseline: ' + pkg.version);
  const reports = {};
  const files = [
    '.vite/build/main-C8eoOzMw.js', '.vite/build/src-DhHWkTcG.js',
    'webview/assets/app-initial-TxV8Ik1J.js',
  ];
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
    if (rel === '.vite/build/main-C8eoOzMw.js') {
      source = 'const _teenetPolicy=require("../../teenet/policy.cjs");\n' + source;
      source = replaceExact(source, 'k=(e,t)=>{let r=n.Ut({commandId:e});', 'k=(e,t)=>{const hidden=_teenetPolicy.blockedMenuItem(e);if(hidden)return hidden;let r=n.Ut({commandId:e});', 'native menu references to removed commands');
      source = replaceExact(source, 'function Tr(){return xr}', 'function Tr(){return _teenetPolicy.applyFeaturePolicy(xr)}', 'desktop feature reader');
      source = replaceExact(source, 'function Or(e){', 'function Or(e){e=_teenetPolicy.applyFeaturePolicy(e);', 'desktop feature updates');
      // The old browser reconciliation deletes MCP settings when capabilities
      // are off. Enterprise disables its runtime through CLI overrides instead
      // and leaves the administrator's config file untouched.
      const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
      let reconcile;
      walk(ast, node => { if (node.type === 'FunctionDeclaration' && node.id?.name === 'ys' && node.async) reconcile = node; });
      if (!reconcile || !source.slice(reconcile.start, reconcile.end).includes('config/batchWrite')) throw new Error('Browser config reconciliation drift');
      source = source.slice(0, reconcile.body.start + 1) + 'return;/*teenet:no-browser-config-mutation*/' + source.slice(reconcile.body.start + 1);
      source = replaceExact(source, 'async handleMessage(e,t){if(_I(t))', `async handleMessage(e,t){
        if(_teenetPolicy.messageDenial(t))return;
        if(t.type==='show-settings'||t.type==='open-keyboard-shortcuts'){
          const w=require('electron').BrowserWindow.fromWebContents(e);
          if(w){const u=new URL(w.getURL());u.searchParams.set('initialRoute',t.type==='open-keyboard-shortcuts'?'/settings/keyboard-shortcuts':'/settings/appearance');await w.loadURL(u.toString());}return;
        }
        if(_I(t))`, 'desktop message handler');
      source = replaceExact(source, 'case`mcp-request`:{', `case\`mcp-request\`:{
        const denied=_teenetPolicy.requestDenial(t.request);
        if(denied){this.sendAppServerResponseToView(e,t.hostId,t.request.method,{id:t.request.id,error:{code:-32001,message:denied}},t.request.trace,t.priority);break;}
      `, 'renderer RPC boundary');
    }
    if (rel === 'webview/assets/app-initial-TxV8Ik1J.js') {
      source = 'import "./teenet-policy.js";\n' + source;
      source = replaceExact(source, 'e.Fragment=n,e.jsx=r,e.jsxs=r', 'e.Fragment=n,e.jsx=globalThis.TEENetPolicy.createJsxGuard(r),e.jsxs=e.jsx', 'React JSX boundary');
      source = replaceExact(source, 'ims=`general-settings`', 'ims=`appearance`', 'default preferences route');
      source = replaceExact(source, '{slug:n}=e,r=tdl[n],i;', '{slug:n}=e,r=globalThis.TEENetPolicy.routeAllowed("/settings/"+n)?tdl[n]:()=>null,i;', 'settings child route guard');
    }
    parse(source, { ecmaVersion: 'latest', sourceType: rel.startsWith('webview/') ? 'module' : 'script', allowReturnOutsideFunction: true });
    fs.writeFileSync(file, marker + '\n' + source);
    reports[rel] = result.report;
  }
  if (!Object.entries(reports).some(([name, r]) => name.startsWith('webview/') && r.commandArrays > 0)) throw new Error('Renderer command registry not found');
  if (!Object.entries(reports).some(([name, r]) => name.startsWith('.vite/') && r.commandArrays > 0)) throw new Error('Native command registry not found');
  const settings = path.join(root, 'webview/assets/settings-page-B4j1j14I.js');
  let source = fs.readFileSync(settings, 'utf8');
  source = replaceExact(source, 'export{Dn as SettingsPage};', fs.readFileSync(path.join(here, 'preferences.js.txt'), 'utf8') + '\nexport{TEENetPreferences as SettingsPage};', 'preferences component export');
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
