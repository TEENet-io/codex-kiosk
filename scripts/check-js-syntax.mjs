/**
 * check-js-syntax.mjs
 *
 * Parses JavaScript files and reports only the diagnosis.
 *
 * `node --check` already does the parsing, but it echoes the offending source
 * line first, and the files this repo patches are minified -- one line can be
 * the entire 187,000-character file. That matters because of who reads the
 * output: PowerShell carries a native process's stderr as objects and cuts any
 * single line off at 64 KB, so on such a file the caret and the SyntaxError
 * itself are discarded and the build reports a wall of JavaScript with no
 * diagnosis attached. `2>&1`, `2> file`, and Start-Process -RedirectStandardError
 * were all measured to truncate identically; the limit is not in the redirection
 * chosen but in PowerShell's handling of the stream.
 *
 * So the filtering happens here, in Node, where the full output is available.
 * Callers get a few short lines that name the file, the position, and the
 * error.
 *
 * Usage:
 *   node scripts/check-js-syntax.mjs <file> [<file> ...]
 *
 * Exit codes:
 *   0  every file parses
 *   1  at least one file does not parse (diagnosis on stderr)
 *   2  bad usage
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Longer than any diagnosis Node emits, far shorter than a minified line.
const MAX_DIAGNOSTIC_LINE = 400;

/**
 * Parses one file.
 *
 * @returns {{ok: true} | {ok: false, detail: string}}
 */
export function checkJavaScriptSyntax(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, detail: `File not found: ${filePath}` };
  }

  const source = fs.readFileSync(filePath, 'utf8');

  // Never let Node pick the goal symbol from the file extension.
  //
  // `node --check some.js` decides between script and module itself, and on
  // these bundles it decides wrong and reports success: an app-initial asset
  // corrupted by a bad patch -- an actual "Unexpected identifier" a parser
  // finds immediately -- exited 0 when checked by path, and exited 1 the
  // moment the same bytes were checked as a module. Every webview asset here
  // is an ES module named .js, so checking by path silently checks nothing.
  //
  // The goal symbol is therefore always explicit. ESM syntax settles it when
  // present; otherwise both are tried, since a plain script is valid too.
  // Static import/export only. `import(...)` is deliberately excluded: dynamic
  // import is legal in CommonJS too, so it says nothing about the goal symbol.
  // Anchoring to line starts would miss these bundles, where a static import
  // sits mid-line 820 chars in.
  const looksLikeModule =
    /(?:^|[;}\s])import\s*(?:[{*"']|[A-Za-z_$])/.test(source) ||
    /(?:^|[;}\s])export\s*(?:[{*]|default\b|(?:const|let|var|function|class|async)\b)/.test(source);
  const kinds = filePath.endsWith('.cjs')
    ? ['commonjs']
    : looksLikeModule
      ? ['module']
      : ['module', 'commonjs'];

  let lastDetail = '';
  for (const kind of kinds) {
    const attempt = runCheck(source, kind);
    if (attempt.ok) {
      return { ok: true };
    }
    lastDetail = attempt.detail;
  }

  return {
    ok: false,
    detail: `${filePath}\n${lastDetail}`,
  };
}

function runCheck(source, kind) {
  // Collect stderr through a file, not a pipe.
  //
  // Node writes to a piped stderr asynchronously and exits without flushing the
  // tail: checking a file whose offending line is 187,000 characters produced
  // 146,000 bytes down a pipe, stopping mid-source with the SyntaxError never
  // written at all. The same check redirected to a file yields every byte.
  const capturePath = path.join(
    os.tmpdir(),
    `codex-offline-syntax-${crypto.randomBytes(8).toString('hex')}.log`,
  );
  const capture = fs.openSync(capturePath, 'w');
  let result;
  try {
    result = spawnSync(
      process.execPath,
      [`--input-type=${kind}`, '--check'],
      { input: source, stdio: ['pipe', capture, capture] },
    );
  } finally {
    fs.closeSync(capture);
  }

  if (result.error) {
    fs.rmSync(capturePath, { force: true });
    return { ok: false, detail: `Could not run node --check: ${result.error.message}` };
  }
  if (result.status === 0) {
    fs.rmSync(capturePath, { force: true });
    return { ok: true };
  }

  const captured = fs.readFileSync(capturePath, 'utf8');
  fs.rmSync(capturePath, { force: true });

  const detail = captured
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim().length > 0 && line.length < MAX_DIAGNOSTIC_LINE)
    .join('\n');

  return {
    ok: false,
    detail:
      detail.length > 0
        ? `checked as ${kind}:\n${detail}`
        : `node --check exited ${result.status} as ${kind} without a message short enough to show.`,
  };
}

/** Throws with the diagnosis if the file does not parse. */
export function assertJavaScriptSyntax(filePath, context) {
  const result = checkJavaScriptSyntax(filePath);
  if (result.ok) {
    return;
  }
  throw new Error(
    `${context} is not valid JavaScript (${filePath}):\n${result.detail}`,
  );
}

// CLI entry: only when run directly, so importing this stays side-effect free.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: node scripts/check-js-syntax.mjs <file> [<file> ...]');
    process.exit(2);
  }

  let failed = false;
  for (const file of files) {
    const result = checkJavaScriptSyntax(file);
    if (!result.ok) {
      failed = true;
      console.error(result.detail);
    }
  }
  process.exit(failed ? 1 : 0);
}
