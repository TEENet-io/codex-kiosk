const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachTrace, safeFrame } = require('../diagnostics/startup-trace.cjs');

test('trace captures the pUr throw location and resumes without reading private data', async () => {
  const contents = new EventEmitter();
  contents.id = 1;
  contents.debugger = new EventEmitter();
  const commands = [];
  let detached = false;
  contents.debugger.attach = () => {};
  contents.debugger.detach = () => { detached = true; };
  contents.debugger.sendCommand = async (method, params) => commands.push([method, params]);
  const report = [];
  const stop = attachTrace(contents, value => report.push(value));
  await new Promise(resolve => setImmediate(resolve));
  contents.debugger.emit('message', null, 'Debugger.scriptParsed', { scriptId: '17', url: 'app://-/assets/app-primary.js?token=private' });
  contents.debugger.emit('message', null, 'Debugger.paused', {
    reason: 'exception', data: { description: 'secret exception' },
    callFrames: [{ functionName: 'pUr', location: { scriptId: '17', lineNumber: 4145, columnNumber: 2249 }, scopeChain: ['private token'] }],
  });
  const event = report.find(value => value.event === 'exception');
  assert.deepEqual(event.frames, [{ function: 'pUr', file: 'app-primary.js', line: 4146, column: 2250 }]);
  assert.equal(event.focused, true);
  assert.equal(commands.at(-1)[0], 'Debugger.resume');
  assert.ok(!JSON.stringify(report).includes('private'));
  assert.ok(!JSON.stringify(report).includes('secret'));
  stop();
  assert.equal(detached, true);
});

test('trace strips directory and query parameters from frame URLs', () => {
  assert.equal(safeFrame({ url: 'file:///C:/Users/private/app.js?key=secret' }).file, 'app.js');
  assert.equal(safeFrame({ url: 'https://example.com/secret' }).file, '<runtime>');
});

test('known React update loop is captured once then debugger detaches before Retry', async () => {
  const contents = new EventEmitter();
  contents.id = 1;
  contents.debugger = new EventEmitter();
  let detached = 0;
  const commands = [], report = [];
  contents.debugger.attach = () => {};
  contents.debugger.detach = () => detached++;
  contents.debugger.sendCommand = async method => commands.push(method);
  attachTrace(contents, value => report.push(value));
  await new Promise(resolve => setImmediate(resolve));
  const params = {
    reason: 'exception',
    get data() { throw new Error('exception payload must not be read'); },
    callFrames: [{ functionName: 'ste', url: 'app://-/assets/app-initial-f87238153a19.js', location: { lineNumber: 10, columnNumber: 27593 } }],
  };
  contents.debugger.emit('message', null, 'Debugger.paused', params);
  assert.equal(commands.at(-1), 'Debugger.resume');
  assert.equal(detached, 1);
  assert.deepEqual(report.map(value => value.event), ['trace-ready', 'exception', 'trace-stopped']);
  contents.debugger.emit('message', null, 'Debugger.paused', params);
  contents.emit('destroyed');
  assert.equal(detached, 1);
  assert.equal(report.length, 3);
});
