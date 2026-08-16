/**
 * get-app-asar-version.mjs
 *
 * Prints the version the application reports about itself -- the one shown in
 * its About panel -- by reading package.json out of app.asar.
 *
 * This is NOT the MSIX identity version. The two are separate counters that
 * OpenAI advances independently: a package whose MSIX identity is
 * 26.803.10989.0 displays 26.803.81509. Only the first four-part number exists
 * in the store manifest, and once this bundle is installed by Inno Setup the
 * MSIX is gone entirely -- so the number a user can actually read on the
 * machine is this one, which is why the release is named after it.
 *
 * Electron's app.getVersion() returns exactly this field, so it is the same
 * string the application renders.
 *
 * Usage:
 *   node scripts/get-app-asar-version.mjs --asar <path-to-app.asar>
 *
 * Prints the bare version to stdout. Diagnostics go to stderr, so the caller
 * can capture stdout directly.
 *
 * Exit codes:
 *   0  version printed
 *   1  archive missing, package.json absent, or no usable version field
 */

import { createRequire } from 'module';
import { parseArgs } from 'util';
import fs from 'fs';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');

function fail(message) {
  console.error(`[get-app-asar-version] ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: { asar: { type: 'string' } },
  allowPositionals: false,
});

if (!values.asar) {
  fail('--asar <path-to-app.asar> is required.');
}
if (!fs.existsSync(values.asar)) {
  fail(`Archive not found: ${values.asar}`);
}

let raw;
try {
  raw = asar.extractFile(values.asar, 'package.json');
} catch (error) {
  // Listing the root entries turns "it did not work" into something that can
  // be acted on: if the layout ever changes, the failure names the alternative.
  let roots = [];
  try {
    roots = asar
      .listPackage(values.asar)
      .filter((entry) => entry.split('/').filter(Boolean).length === 1);
  } catch {
    // The archive itself is unreadable; the original error says more.
  }
  fail(
    `Could not read package.json from ${values.asar}: ${error.message}` +
      (roots.length ? `\nRoot entries: ${roots.join(', ')}` : '')
  );
}

let pkg;
try {
  pkg = JSON.parse(raw.toString('utf8'));
} catch (error) {
  fail(`package.json inside ${values.asar} is not valid JSON: ${error.message}`);
}

const version = typeof pkg.version === 'string' ? pkg.version.trim() : '';
if (!version) {
  fail(`package.json inside ${values.asar} has no "version" field.`);
}

process.stdout.write(version);
