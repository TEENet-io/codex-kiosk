'use strict';
// Loaded before the original bootstrap. No employee settings are persisted here.
const policy = require('./policy.cjs');
process.env.CODEX_ELECTRON_ENABLE_WINDOWS_COMPUTER_USE = '0';
const cp = require('node:child_process');
const originalSpawn = cp.spawn;
cp.spawn = function (file, args, options) {
  if (typeof file === 'string' && /(?:^|[\\/])codex(?:\.exe)?$/i.test(file)) {
    args = policy.appServerArgs(args);
  }
  return originalSpawn.call(this, file, args, options);
};
const electron = require('electron');
if (electron.Menu) {
  const originalBuild = electron.Menu.buildFromTemplate;
  const filter = items => items.filter(item => policy.commandAllowed(item.id) && !/^(?:Settings[….]*|设置[….]*|Log Out|退出登录)$/i.test(item.label || '')).map(item => item.submenu && Array.isArray(item.submenu) ? { ...item, submenu: filter(item.submenu) } : item);
  electron.Menu.buildFromTemplate = function (items) { return originalBuild.call(this, filter(items)); };
}
