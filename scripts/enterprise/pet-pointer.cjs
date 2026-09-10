'use strict';
// The Windows Owl runtime reports no input-shape support. Its forwarded
// mouse moves do not reliably wake the renderer's pointer handlers. Use the
// same renderer-supplied regions with native cursor coordinates instead.
const trackers = new WeakMap();
function sync(manager, screen, schedule = setInterval, cancel = clearInterval, restore = win => {
  if (process.platform === 'win32') require('./win32-pet-input.cjs').restoreHitTesting(win);
}) {
  const win = manager.window;
  if (!win || win.isDestroyed()) return;
  let tracker = trackers.get(win);
  if (!tracker) {
    tracker = { mode: null };
    tracker.tick = () => {
      if (win.isDestroyed()) return;
      let interactive = false;
      const visible = win.isVisible();
      if (visible) {
        const cursor = screen.getCursorScreenPoint();
        const bounds = win.getContentBounds();
        const regions = manager.inputShape ?? (manager.layout?.mascot ? [manager.layout.mascot] : []);
        interactive = !!manager.dragState || !!manager.nativeWindowDragActive || regions.some(rect =>
          cursor.x >= bounds.x + rect.left && cursor.x < bounds.x + rect.left + rect.width &&
          cursor.y >= bounds.y + rect.top && cursor.y < bounds.y + rect.top + rect.height);
      }
      const mode = interactive ? 'disabled' : visible ? 'forwarding' : 'without-forwarding';
      manager.mousePassthroughMode = mode;
      if (tracker.mode === mode) return;
      tracker.mode = mode;
      win.setIgnoreMouseEvents(!interactive, { forward: visible && !interactive });
      if (interactive) {
        restore(win);
        manager.refreshCursorAtCurrentMousePosition(win);
      }
    };
    trackers.set(win, tracker);
    const timer = schedule(tracker.tick, 32);
    timer.unref?.();
    win.once('closed', () => { cancel(timer); trackers.delete(win); });
  }
  tracker.tick();
}
module.exports = { sync };
