const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('enterprise setup seeds skills once and preserves administrator and employee files on reinstall', { skip: process.platform !== 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teenet-setup-'));
  try {
    const home = path.join(root, 'home');
    const source = path.join(root, 'seed/codex-home/skills/.system/skill-creator');
    const destination = path.join(home, 'skills/.system/skill-creator/SKILL.md');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'bundled creator');
    const preserved = { 'config.toml': 'model_provider = "managed"\n', 'auth.json': '{"fixture":"preserve-me"}', 'sessions/history.jsonl': '{"project":"employee-project"}\n' };
    for (const [name, value] of Object.entries(preserved)) {
      fs.mkdirSync(path.dirname(path.join(home, name)), { recursive: true });
      fs.writeFileSync(path.join(home, name), value);
    }
    const script = path.join(root, 'setup-enterprise-preview.ps1');
    fs.copyFileSync(path.join(__dirname, '../setup-enterprise-preview.ps1'), script);
    const setup = () => execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { env: { ...process.env, CODEX_HOME: home } });
    setup();
    assert.equal(fs.readFileSync(destination, 'utf8'), 'bundled creator');
    fs.writeFileSync(destination, 'employee customizations');
    setup();
    assert.equal(fs.readFileSync(destination, 'utf8'), 'employee customizations');
    for (const [name, value] of Object.entries(preserved)) assert.equal(fs.readFileSync(path.join(home, name), 'utf8'), value);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
