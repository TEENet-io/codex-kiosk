import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export async function probePetInput(target, pid, output) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const report = { errors: [] };
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') report.errors.push(msg.params);
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => reject(Error('Pet CDP timeout: ' + method)), 15000);
    pending.set(n, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    socket.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async fn => {
    const r = await send('Runtime.evaluate', { expression: '(' + fn.toString() + ')()', returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const snapshot = () => evaluate(() => ({ width: innerWidth, height: innerHeight, text: document.body.innerText,
    events: window.__petInputEvents,
    hit: (() => { const r = document.querySelector('[data-avatar-overlay-hit-region="mascot"]')?.getBoundingClientRect(); return r ? document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).map(e => ({ html:e.outerHTML.slice(0,500), appRegion:getComputedStyle(e).webkitAppRegion, pointerEvents:getComputedStyle(e).pointerEvents })) : []; })(),
    regions: [...document.querySelectorAll('[data-avatar-overlay-hit-region]')].map(e => ({ name: e.dataset.avatarOverlayHitRegion, rect: e.getBoundingClientRect().toJSON(), style: { pointerEvents: getComputedStyle(e).pointerEvents, visibility: getComputedStyle(e).visibility } })),
    buttons: [...document.querySelectorAll('button')].map(e => ({ text: e.textContent, label: e.getAttribute('aria-label'), rect: e.getBoundingClientRect().toJSON() })) }));
  try {
    await send('Runtime.enable');
    await evaluate(() => { window.__petInputEvents = []; for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, e => window.__petInputEvents.push({ type, x: e.clientX, y: e.clientY, target: e.target.outerHTML.slice(0, 350) }), true); });
    await delay(2000);
    report.before = await snapshot();
    const native = (x, y, extra = []) => JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-File', path.resolve('scripts/test/click-window-client.ps1'), '-TargetProcessId', String(pid), '-ClientX', String(Math.round(x)), '-ClientY', String(Math.round(y)), '-ClientWidth', String(report.before.width), '-ClientHeight', String(report.before.height), '-NoActivate', ...extra], { encoding: 'utf8', timeout: 20000 }));
    const mascot = report.before.regions.find(r => r.name === 'mascot')?.rect;
    if (!mascot) throw Error('Pet mascot hit region absent');
    const nativeFlags = process.env.CODEX_TEST_CLEAR_LAYERED === '1' ? ['-ClearLayered'] : [];
    report.click = native(mascot.x + mascot.width / 2, mascot.y + mascot.height / 2, [...nativeFlags, '-ScreenshotPath', path.join(output, '09-pet-desktop.png')]);
    await delay(1000);
    report.afterClick = await snapshot();
    const dragRegion = report.afterClick.regions.find(r => r.name === 'mascot')?.rect || mascot;
    report.drag = native(dragRegion.x + dragRegion.width / 2, dragRegion.y + dragRegion.height / 2, [...nativeFlags, '-DragX', '-100', '-DragY', '-80']);
    await delay(1000);
    report.afterDrag = await snapshot();
    if (process.env.CODEX_TEST_PET_VARIANTS === '1') {
      await evaluate(() => { const s = document.createElement('style'); s.textContent = '* { -webkit-app-region: no-drag !important; }'; s.id = 'pet-input-diagnostic-style'; document.head.append(s); });
      await delay(500);
      report.noDragClick = native(mascot.x + mascot.width / 2, mascot.y + mascot.height / 2);
      report.afterNoDrag = await snapshot();
      await evaluate(() => document.getElementById('pet-input-diagnostic-style').remove());
      fs.writeFileSync(process.env.CODEX_PET_TRACE_FILE + '.control', JSON.stringify({ focusable: true }));
      await delay(700);
      report.focusableClick = native(mascot.x + mascot.width / 2, mascot.y + mascot.height / 2);
      report.afterFocusable = await snapshot();
      report.focusableDrag = native(mascot.x + mascot.width / 2, mascot.y + mascot.height / 2, ['-DragX', '-100', '-DragY', '-80']);
      report.afterFocusableDrag = await snapshot();
    }
    report.background = native(10, 10, ['-ProbeBackground']);
    const screenshot = await send('Page.captureScreenshot');
    fs.writeFileSync(path.join(output, '08-pet-input.png'), Buffer.from(screenshot.data, 'base64'));
  } catch (e) { report.error = String(e.stack || e); }
  finally { socket.close(); fs.writeFileSync(path.join(output, 'pet-input.json'), JSON.stringify(report, null, 2)); }
  return report;
}
