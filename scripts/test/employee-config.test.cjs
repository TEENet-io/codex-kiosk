const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('smol-toml');

test('employee fixture preserves supplied root keys, gateway and literal Windows marketplace path', async () => {
  const { employeeConfigFixture } = await import('./fixtures/employee-config.mjs');
  const cfg = parse(employeeConfigFixture('C:/Users/weipeng/.codex'));
  assert.equal(cfg.model, 'deepseek-v3.2');
  assert.equal(cfg.model_provider, 'gateway');
  assert.equal(cfg.model_catalog_json, 'C:/Users/weipeng/.codex/models.json');
  assert.equal(cfg.web_search, 'live');
  assert.equal(cfg.stream_idle_timeout_ms, 7200000);
  assert.deepEqual(cfg.model_providers.gateway, { name: 'Gateway', base_url: 'https://litellm.teenet.app/v1', wire_api: 'responses', experimental_bearer_token: 'sk-xxxxxxxx' });
  assert.deepEqual(cfg.desktop, { followUpQueueMode: 'queue' });
  assert.deepEqual(cfg.marketplaces['openai-bundled'], { source_type: 'local', source: '\\\\?\\C:\\Users\\weipeng\\.codex\\.tmp\\bundled-marketplaces\\openai-bundled' });
  assert.deepEqual(cfg.plugins['visualize@openai-bundled'], { enabled: true });
});
