const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/check-upstream-codex.yml'), 'utf8');
const step = workflow.split('      - name: Report unseen upstream version once\n')[1];
const script = step.split('        run: |\n')[1].split('\n      - name:')[0]
  .split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');

// Execute the workflow's real Bash and jq. Mock only GitHub's API boundary,
// including its --jq option, so invalid query escaping fails before the fix.
const githubStub = `
gh() {
  case "$1 $2" in
    'release list')
      if [[ "$RELEASE_FAILURE" == 1 ]]; then return 23; fi
      if [[ " $* " == *' --jq '* ]]; then
        jq -r "\${@: -1}" <<< "$RELEASE_FIXTURE"
      else
        printf '%s\\n' "$RELEASE_FIXTURE"
      fi
      ;;
    'issue list')
      if [[ "\${@: -1}" == *'resolver unavailable'* ]]; then
        jq -r "\${@: -1}" <<< "$OUTAGE_FIXTURE"
      else
        jq -r "\${@: -1}" <<< "$ISSUE_FIXTURE"
      fi
      ;;
    'issue create'|'issue close') printf 'WRITE %s\\n' "$*" ;;
    *) printf 'Unexpected GitHub call: %s\\n' "$*" >&2; return 99 ;;
  esac
}
`;

function run({ releases = [], issues = [], outages = [], releaseFailure = false } = {}) {
  return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', githubStub + script], {
    encoding: 'utf8',
    env: { ...process.env, RELEASE_FIXTURE: JSON.stringify(releases), ISSUE_FIXTURE: JSON.stringify(issues),
      OUTAGE_FIXTURE: JSON.stringify(outages), RELEASE_FAILURE: releaseFailure ? '1' : '0',
      UPSTREAM_VERSION: '26.903.8094.0', UPSTREAM_FILE_NAME: 'Codex.msix', UPSTREAM_SHA1: 'fixture',
      PATCHER_REVISION: 'fixture', GITHUB_REPOSITORY: 'example/codex', GITHUB_SERVER_URL: 'https://github.com', GITHUB_RUN_ID: '1' },
  });
}

test('upstream canary reporting executes valid Bash/jq and preserves deduplication', { skip: process.platform === 'win32' }, () => {
  const title = '[Codex compatibility] MSIX train 26.903';
  for (const releases of [
    [{ name: 'Codex (MSIX 26.903.1.0)' }],
    [{ name: 'Codex (MSIX 26.903.8094.0)' }],
    Array.from({ length: 1000 }, (_, i) => ({ name: 'Codex (MSIX 26.903.' + i + '.0)' })),
  ]) {
    const result = run({ releases });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '', 'existing train must not create another issue');
  }
  for (const releases of [[], [{ name: 'Codex (MSIX 26.9030.1.0)' }], [{ name: 'Codex (MSIX 26x903.1.0)' }]]) {
    const result = run({ releases });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /WRITE issue create .*MSIX train 26\.903/);
  }
  const duplicate = run({ issues: [{ number: 42, title }] });
  assert.equal(duplicate.status, 0, duplicate.stderr);
  assert.equal(duplicate.stdout, '', 'open or closed compatibility issues remain deduplicated');
  const recovered = run({ releases: [{ name: 'Codex (MSIX 26.903.1.0)' }], issues: [{ number: 42, title }],
    outages: [{ number: 43, title: '[Codex source canary] resolver unavailable' }] });
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.match(recovered.stdout, /WRITE issue close 43 /);
  assert.match(recovered.stdout, /WRITE issue close 42 /);
  assert.doesNotMatch(recovered.stdout, /issue create/);
  const unavailable = run({ releaseFailure: true });
  assert.notEqual(unavailable.status, 0, 'GitHub failures must not look like an empty release list');
  assert.equal(unavailable.stdout, '', 'failed release reads must not create issues');
});
