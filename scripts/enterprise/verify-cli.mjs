import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { parse } from 'smol-toml';
const require = createRequire(import.meta.url);
const policy = require('./policy.cjs');

export async function verifyCli(executable) {
  for (const existing of ['', '[mcp_servers.node_repl]\nurl="http://127.0.0.1:9/mcp"\n', '[mcp_servers.node_repl]\ncommand="node"\nargs=["--version"]\n']) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'teenet-cli-'));
    let child;
    try {
      fs.writeFileSync(path.join(home, 'config.toml'), existing);
      child = spawn(executable, policy.appServerArgs(['app-server'], parse(existing)), { env: { ...process.env, CODEX_HOME: home }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      await new Promise((resolve, reject) => {
        let output = '', errors = '';
        const timer = setTimeout(() => reject(new Error('CLI initialization timed out: ' + errors)), 15000);
        const finish = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
        child.on('error', finish);
        child.on('exit', code => finish(new Error('CLI exited before initialization (' + code + '): ' + errors)));
        child.stderr.on('data', chunk => { errors += chunk; });
        child.stdout.on('data', chunk => {
          output += chunk;
          let end;
          while ((end = output.indexOf('\n')) >= 0) {
            const line = output.slice(0, end); output = output.slice(end + 1);
            let response;
            try { response = JSON.parse(line); } catch { continue; }
            if (response.error) { finish(new Error(JSON.stringify(response.error))); return; }
            if (response.id === 1) {
              child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
              child.stdin.write(JSON.stringify({ id: 2, method: 'config/read', params: { includeLayers: false } }) + '\n');
            }
            if (response.id === 2) {
              try {
                const config = response.result.config;
                assert.notEqual(config.approval_policy, 'never', 'fresh CLI retains approval requirements');
                assert.notEqual(config.default_permissions, ':danger-full-access', 'fresh CLI does not default to full access');
                assert.notEqual(config.sandbox_mode, 'danger-full-access', 'fresh CLI retains its sandbox default');
                finish();
              } catch (error) { finish(error); }
            }
          }
        });
        child.stdin.on('error', finish);
        child.stdin.write(JSON.stringify({ id: 1, method: 'initialize', params: { clientInfo: { name: 'teenet_config_check', version: '1.0' }, capabilities: {} } }) + '\n');
      });
      assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), existing);
    } finally {
      if (child && child.exitCode === null) {
        const closed = new Promise(resolve => child.once('close', resolve));
        child.kill();
        await closed;
      }
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
  console.log('Bundled CLI initialized with absent, HTTP and stdio browser MCP configurations');
}
