// Loaded only in the disposable Windows smoke installation.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const out = process.env.CODEX_PET_TRACE_FILE;
const write = value => fs.appendFileSync(out, JSON.stringify({ time: Date.now(), ...value }) + '\n');
for (const name of ['setInputShape', 'setIgnoreMouseEvents', 'setOpacity']) {
  const original = BrowserWindow.prototype[name];
  if (!original) continue;
  BrowserWindow.prototype[name] = function (...args) {
    const result = original.apply(this, args);
    write({ event: name, id: this.id, args, result, ...(name === 'setOpacity' ? { stack: new Error().stack } : {}) });
    return result;
  };
}
app.on('browser-window-created', (_, win) => {
  win.webContents.on('did-finish-load', () => write({ event: 'window', id: win.id, url: win.webContents.getURL(), bounds: win.getBounds(), inputShapeSupported: BrowserWindow.isInputShapeSupported() }));
});
if (process.env.CODEX_TEST_PET_VARIANTS === '1') {
  let last;
  setInterval(() => {
    const file = out + '.control';
    if (!fs.existsSync(file)) return;
    const next = fs.readFileSync(file, 'utf8');
    if (next === last) return;
    last = next;
    const command = JSON.parse(next);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.webContents.getURL().includes('avatar')) continue;
      if (command.focusable != null) win.setFocusable(command.focusable);
      write({ event: 'variant', command, id: win.id });
    }
  }, 100).unref();
}
