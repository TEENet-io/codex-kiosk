import fs from 'node:fs';
import path from 'node:path';

// MSIX ZIP names encode scoped Node package directories. Repair these before
// extracting app.asar, otherwise its unpacked native dependencies appear absent.
export function prepareRuntime(app) {
  const modules = path.join(app, 'resources/cua_node/bin/node_modules');
  const removed = [];
  for (const scope of ['%40oai', '@oai']) {
    for (const name of ['cua', 'sky', 'browser-desktop']) {
      const target = path.join(modules, scope, name);
      if (!fs.existsSync(target)) continue;
      fs.rmSync(target, { recursive: true });
      removed.push(path.relative(app, target));
    }
  }
  let renamed = 0;
  function visit(dir, inModules = false) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      const inside = inModules || item.name === 'node_modules';
      if (item.isDirectory()) visit(file, inside);
      let name = item.name;
      if (inside && item.isDirectory()) name = name.replaceAll('%40', '@');
      if (inside && item.isFile() && name.startsWith('%24_StatsigGlobal.')) name = name.replace('%24', '$');
      if (name === item.name) continue;
      const target = path.join(dir, name);
      if (fs.existsSync(target)) throw new Error('Encoded runtime path collides with existing entry: ' + target);
      fs.renameSync(file, target);
      renamed++;
    }
  }
  visit(path.join(app, 'resources'));
  return { removed, renamed };
}

export function verifyRuntimePaths(root) {
  // Covers the default employee directory and the longer isolated CI install.
  const installRootBudget = 90;
  const files = [];
  function visit(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      const relative = path.relative(root, file);
      if (relative.length + installRootBudget + 1 > 259) throw new Error('Installer path exceeds Windows budget: ' + relative);
      if (relative.split(path.sep).includes('node_modules') && item.name.includes('%40')) throw new Error('Encoded scoped Node package remains: ' + relative);
      if (item.isDirectory()) visit(file);
      else files.push(relative);
    }
  }
  visit(root);
  for (const name of ['cua', 'sky', 'browser-desktop']) {
    if (fs.existsSync(path.join(root, '_internal/app/resources/cua_node/bin/node_modules/@oai', name))) throw new Error('Computer Use runtime remains: ' + name);
  }
  if (!fs.existsSync(path.join(root, '_internal/app/resources/cua_node/bin/node.exe'))) throw new Error('Shared Node runtime is missing');
  return files.length;
}
