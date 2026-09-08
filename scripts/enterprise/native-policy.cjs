'use strict';
const policy = require('./policy.cjs');
const path = require('node:path');
const home = process.env.CODEX_HOME || path.join(require('node:os').homedir(), '.codex');
exports.internalRequestDenial = request => policy.internalRequestDenial(request, [
  path.join(home, '.tmp/bundled-marketplaces/openai-bundled'),
  path.join(process.resourcesPath || '', 'plugins/openai-bundled'),
]);
