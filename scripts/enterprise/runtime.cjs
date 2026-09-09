'use strict';
// Loaded before the original bootstrap. No employee settings are persisted here.
const policy = require('./policy.cjs');
process.env.CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE = '0';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parse } = require('./toml');
const originalSpawn = cp.spawn;
cp.spawn = function (file, args, options) {
  if (typeof file === 'string' && /(?:^|[\\/])codex(?:\.exe)?$/i.test(file) && Array.isArray(args) && args.includes('app-server')) {
    const env = options?.env || process.env;
    const home = env.CODEX_HOME || path.join(env.USERPROFILE || os.homedir(), '.codex');
    const configPath = path.join(home, 'config.toml');
    const config = fs.existsSync(configPath) ? parse(fs.readFileSync(configPath, 'utf8')) : {};
    const permissionProfiles = fs.existsSync(path.resolve(path.dirname(file), '..', 'owl-shell-runtime.json'));
    args = policy.appServerArgs(args, config, { permissionProfiles });
  }
  return originalSpawn.call(this, file, args, options);
};
const electron = require('electron');
if (electron.Menu) {
  const originalBuild = electron.Menu.buildFromTemplate;
  const filter = items => items.filter(item => policy.commandAllowed(item.id) && !/^(?:Settings[….]*|设置[….]*|Log Out|退出登录)$/i.test(item.label || '')).map(item => item.submenu && Array.isArray(item.submenu) ? { ...item, submenu: filter(item.submenu) } : item);
  electron.Menu.buildFromTemplate = function (items) { return originalBuild.call(this, filter(items)); };
}
