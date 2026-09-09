// User-supplied 2026-09-09 configuration. Only the secret and machine-specific
// home path are substituted. Keep root keys before every TOML table.
export function employeeConfigFixture(home) {
  const windowsHome = home.replaceAll('/', '\\');
  return `model = "deepseek-v3.2"
model_provider = "gateway"
model_catalog_json = ${JSON.stringify(home.replaceAll('\\', '/') + '/models.json')}
web_search = "live"
stream_idle_timeout_ms = 7200000

[model_providers.gateway]
name = "Gateway"
base_url = "https://litellm.teenet.app/v1"
wire_api = "responses"
experimental_bearer_token = "sk-xxxxxxxx"

[desktop]
followUpQueueMode = "queue"

[marketplaces.openai-bundled]
source_type = "local"
source = '\\\\?\\${windowsHome}\\.tmp\\bundled-marketplaces\\openai-bundled'

[plugins."visualize@openai-bundled"]
enabled = true
`;
}
