// Loaded only in the disposable Windows smoke installation.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const out = process.env.CODEX_PET_TRACE_FILE;
const write = value => fs.appendFileSync(out, JSON.stringify({ time: Date.now(), ...value }) + '\n');
for (const name of ['setInputShape', 'setIgnoreMouseEvents']) {
  const original = BrowserWindow.prototype[name];
  if (!original) continue;
  BrowserWindow.prototype[name] = function (...args) {
    const result = original.apply(this, args);
    write({ event: name, id: this.id, args, result });
    return result;
  };
}
app.on('browser-window-created', (_, win) => {
  win.webContents.on('did-finish-load', () => write({ event: 'window', id: win.id, url: win.webContents.getURL(), bounds: win.getBounds(), inputShapeSupported: BrowserWindow.isInputShapeSupported() }));
});
