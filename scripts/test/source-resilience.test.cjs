const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const resolverUrl = pathToFileURL(
  path.join(repoRoot, "scripts", "resolve-store-bundle-url.mjs"),
).href;

const matchingHtml = (version = "26.900.1234.0") => `
  <table><tr>
    <td><a href="https://example.invalid/codex.msix">OpenAI.Codex_${version}_x64__2p2nqsd0c76g0.msix</a></td>
    <td>2099-01-01</td><td>abc123</td><td>700 MB</td>
  </tr></table>`;

test("store resolver retries empty direct responses before using the browser", async () => {
  const { resolveStoreBundle } = await import(resolverUrl);
  let directCalls = 0;
  let browserCalls = 0;
  const sleeps = [];

  const result = await resolveStoreBundle({
    packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    ring: "Retail",
    filePattern: /\.(msix|appx|msixbundle|appxbundle)$/i,
    timeoutMs: 100,
    directAttempts: 3,
    browserAttempts: 2,
    retryDelaysMs: [10, 20],
    postApi: async () => {
      directCalls += 1;
      return directCalls < 3 ? "<p>The server returned an empty list.</p>" : matchingHtml();
    },
    browserResolver: async () => {
      browserCalls += 1;
      return [];
    },
    sleep: async (delay) => sleeps.push(delay),
    logger: () => {},
  });

  assert.equal(directCalls, 3);
  assert.equal(browserCalls, 0);
  assert.deepEqual(sleeps, [10, 20]);
  assert.equal(result.version, "26.900.1234.0");
  assert.match(result.selected.fileName, /_x64_/);
});

test("store resolver retries the browser fallback after direct responses stay empty", async () => {
  const { resolveStoreBundle } = await import(resolverUrl);
  let directCalls = 0;
  let browserCalls = 0;

  const result = await resolveStoreBundle({
    packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
    ring: "Retail",
    filePattern: /\.(msix|appx|msixbundle|appxbundle)$/i,
    timeoutMs: 100,
    directAttempts: 2,
    browserAttempts: 2,
    retryDelaysMs: [0],
    postApi: async () => {
      directCalls += 1;
      return "<p>The server returned an empty list.</p>";
    },
    browserResolver: async () => {
      browserCalls += 1;
      return browserCalls === 1
        ? []
        : [{
            fileName: "OpenAI.Codex_26.901.42.0_x64__2p2nqsd0c76g0.msix",
            href: "https://example.invalid/codex.msix",
            sha1: "def456",
          }];
    },
    sleep: async () => {},
    logger: () => {},
  });

  assert.equal(directCalls, 2);
  assert.equal(browserCalls, 2);
  assert.equal(result.version, "26.901.42.0");
});

test("package sources support immutable archives and bounded download retries", () => {
  const sourceVersionScript = read("scripts/get-app-source-version.ps1");
  const buildScript = read("scripts/build-offline-package.ps1");
  const importScript = read("scripts/import-store-bundle-from-url.ps1");

  assert.match(sourceVersionScript, /'archive'\s*\{/);
  assert.match(sourceVersionScript, /releaseMarker = 'MSIX \{0\}' -f \$version/);
  assert.match(buildScript, /'archive'\s*\{/);
  assert.match(buildScript, /-ExpectedSha256 \$sha256/);
  assert.match(importScript, /function Invoke-DownloadWithRetry/);
  assert.match(importScript, /Downloaded package SHA256 mismatch/);
});

test("nightly workflow creates one issue per MSIX train and never invokes the full package build", () => {
  const buildWorkflow = read(".github/workflows/build-offline-package.yml");
  const canaryWorkflow = read(".github/workflows/check-upstream-codex.yml");

  assert.doesNotMatch(buildWorkflow, /^\s{2}schedule:/m);
  assert.match(buildWorkflow, /Test-PowerShellSyntax '\.\/scripts\/import-store-bundle-from-url\.ps1'/);
  assert.match(canaryWorkflow, /^\s{2}schedule:/m);
  assert.match(canaryWorkflow, /\[Codex compatibility\] MSIX train/);
  assert.match(canaryWorkflow, /cut -d '\.' -f 1-2/);
  assert.doesNotMatch(canaryWorkflow, /title=.*patcher.*patcher_short/);
  assert.match(canaryWorkflow, /patcher_revision/);
  assert.match(canaryWorkflow, /desktop-patches\/\*\.cjs/);
  assert.doesNotMatch(canaryWorkflow, /build-offline-package\.ps1/);
  assert.doesNotMatch(canaryWorkflow, /import-store-bundle-from-url\.ps1/);
});
