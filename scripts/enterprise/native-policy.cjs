'use strict';
const policy = require('./policy.cjs');
const path = require('node:path');
const fs = require('node:fs');
const home = process.env.CODEX_HOME || path.join(require('node:os').homedir(), '.codex');
const canonical = value => {
  if (typeof value !== 'string') return value;
  try { return fs.realpathSync.native(value); } catch { return value; }
};
exports.internalRequestDenial = request => policy.internalRequestDenial({
  ...request,
  params: { ...request?.params, source: canonical(request?.params?.source), marketplacePath: canonical(request?.params?.marketplacePath) },
}, [
  path.join(home, '.tmp/bundled-marketplaces/openai-bundled'),
  path.join(process.resourcesPath || '', 'plugins/openai-bundled'),
].map(canonical));
