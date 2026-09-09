// Employee report 2026-09-09: reproduce catalog metadata without credentials or
// the employee's instruction templates. No model requests are made by smoke.
export function gatewayCatalogFixture(template) {
  const rows = [
    ['deepseek-v3.2', 'DeepSeek V3.2', 'high', ['low', 'high']],
    ['devstral-2', 'Devstral 2 (123B)', 'low', ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']],
    ['glm-5', '智谱 GLM-5', 'high', ['low', 'high']],
    ['gpt-oss-120b', 'GPT-OSS 120B', 'high', ['low', 'medium', 'high']],
    ['grok-4.6', 'Grok 4.6', 'high', ['low', 'high']],
    ['kimi-k2.5', 'Kimi K2.5', 'high', ['low', 'high']],
    ['minimax-m2.5', 'MiniMax M2.5', 'high', ['low', 'high']],
    ['qwen3-coder-480b', 'Qwen3 Coder 480B', 'low', ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']],
  ];
  return { client_version: '0.148.0', etag: null, models: rows.map(([slug, display_name, level, efforts], i) => ({
    ...template, slug, display_name, description: 'Gateway catalog reproduction fixture',
    priority: i + 1, visibility: 'list', supported_in_api: true,
    default_reasoning_level: level,
    supported_reasoning_levels: efforts.map(effort => ({ effort, description: effort })),
    additional_speed_tiers: ['fast'],
    service_tiers: [{ id: 'priority', name: 'Fast', description: '1.5x speed, increased usage' }],
    context_window: slug === 'grok-4.6' ? 256000 : 128000,
    max_context_window: slug === 'grok-4.6' ? 256000 : 128000,
    effective_context_window_percent: 95, input_modalities: ['text'],
    availability_nux: null, upgrade: null, tool_mode: null, multi_agent_version: null,
    use_responses_lite: false, model_messages: { instructions_template: 'Catalog reproduction fixture.' },
  })) };
}
