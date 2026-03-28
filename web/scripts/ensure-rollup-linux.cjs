/**
 * Render/Linux: npm sometimes skips Rollup's optional native binding (npm/cli#4828).
 * Install the correct @rollup/* package if missing, matching the resolved rollup version.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

if (process.platform !== 'linux' || process.arch !== 'x64') {
  process.exit(0);
}

let rollupVersion;
try {
  const rollupPkg = require.resolve('rollup/package.json', { paths: [root] });
  rollupVersion = JSON.parse(fs.readFileSync(rollupPkg, 'utf8')).version;
} catch {
  process.exit(0);
}

function musl() {
  try {
    const header = process.report?.getReport?.()?.header;
    if (header && !header.glibcVersionRuntime) return true;
  } catch {
    /* ignore */
  }
  return false;
}

const pkgName = musl() ? '@rollup/rollup-linux-x64-musl' : '@rollup/rollup-linux-x64-gnu';

function bindingPresent() {
  try {
    require.resolve(`${pkgName}/package.json`, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

if (bindingPresent()) {
  process.exit(0);
}

execSync(`npm install ${pkgName}@${rollupVersion} --no-save --no-audit --no-fund`, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
