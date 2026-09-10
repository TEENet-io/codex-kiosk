import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function preparePetNative(resources) {
  const source = path.dirname(require.resolve('koffi/package.json'));
  const target = path.join(resources, 'codex-pet-native/koffi');
  fs.mkdirSync(path.join(target, 'build/koffi/win32_x64'), { recursive: true });
  for (const file of ['index.js', 'indirect.js', 'package.json', 'LICENSE.txt', 'build/koffi/win32_x64/koffi.node']) {
    fs.copyFileSync(path.join(source, file), path.join(target, file));
  }
}
