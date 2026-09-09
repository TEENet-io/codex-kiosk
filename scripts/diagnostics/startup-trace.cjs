'use strict';

// Temporary, local-only exception tracing. No RPC bodies, credentials, source
// text, scope variables or exception messages are written to the report.
const fs = require('node:fs');
const path = require('node:path');

function safeFrame(frame) {
  const url = frame.url || '';
  return {
    function: String(frame.functionName || '<anonymous>').slice(0, 120),
    file: /^app:\/\/|^file:\/\//.test(url) ? path.posix.basename(url.split(/[?#]/)[0]) : '<runtime>',
    line: (frame.location?.lineNumber ?? -1) + 1,
    column: (frame.location?.columnNumber ?? -1) + 1,
  };
}

function attachTrace(contents, write, durationMs = 120000, onReady = () => {}) {
  const connection = contents.debugger;
  let exceptions = 0;
  let stopped = false;
  let timer;
  const scripts = new Map();
  const send = (method, params) => connection.sendCommand(method, params);
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    // Detaching resumes a paused renderer even if a protocol call failed.
    try { connection.detach(); } catch {}
    write({ event: 'trace-stopped', window: contents.id, exceptions });
  }
  connection.on('message', (_event, method, params) => {
    if (stopped) return;
    if (method === 'Debugger.scriptParsed') scripts.set(params.scriptId, params.url);
    if (method !== 'Debugger.paused') return;
    const frames = (params.callFrames || []).map(frame => safeFrame({ ...frame, url: frame.url || scripts.get(frame.location?.scriptId) || '' }));
    const focused = frames.some(frame => frame.function === 'pUr');
    exceptions++;
    // Resume before doing synchronous report I/O. Never inspect paused scopes.
    send('Debugger.resume').catch(stop);
    write({ event: 'exception', window: contents.id, reason: params.reason, focused, frames: frames.slice(0, focused ? 30 : 12) });
    // The pinned 26.901 trace already identifies this as React #185. Once
    // captured, detach so Retry cannot repeatedly pause while React constructs
    // its diagnostic component stack. No exception payload needs to be read.
    const updateLoop = frames.some(frame => frame.file === 'app-initial-f87238153a19.js' && frame.function === 'ste' && frame.line === 11 && frame.column === 27594);
    if (updateLoop || exceptions >= 64) stop();
  });
  try { connection.attach('1.3'); }
  catch { write({ event: 'attach-failed', window: contents.id }); return stop; }
  send('Debugger.enable')
    .then(() => send('Debugger.setPauseOnExceptions', { state: 'all' }))
    .then(() => { write({ event: 'trace-ready', window: contents.id }); onReady(); })
    .catch(stop);
  timer = setTimeout(stop, durationMs);
  timer.unref?.();
  contents.once('destroyed', stop);
  return stop;
}

module.exports = { attachTrace, safeFrame };
if (process.versions.electron && process.env.CODEX_STARTUP_TRACE_FILE) {
  const { app } = require('electron');
  const output = process.env.CODEX_STARTUP_TRACE_FILE;
  const write = data => {
    try { fs.appendFileSync(output, JSON.stringify({ time: new Date().toISOString(), ...data }) + '\n'); } catch {}
  };
  write({ event: 'trace-loaded', electron: process.versions.electron });
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'window') return;
    // Pause-on-exception during module initialization changes the behavior of
    // this Owl runtime's CSP/eval feature probes. Let startup finish first,
    // then capture the user's Retry on the already-loaded application.
    contents.once('did-finish-load', () => {
      const pending = setTimeout(() => {
        if (contents.isDestroyed()) return;
        attachTrace(contents, write, 120000, () => {
          if (process.env.CODEX_STARTUP_TRACE_SELFTEST === '1') {
            contents.executeJavaScript('(function codexStartupTraceProbe(){try{throw new Error("")}catch{}})()').catch(() => {});
          }
        });
      }, 10000);
      pending.unref?.();
      contents.once('destroyed', () => clearTimeout(pending));
    });
  });
}
