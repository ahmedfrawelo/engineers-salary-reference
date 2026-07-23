#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const PKG_JSON = path.join(ROOT, 'package.json');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmExecPath = process.env.npm_execpath;
const FLAT_CONFIG_FILES = [
  'eslint.config.js',
  'eslint.config.cjs',
  'eslint.config.mjs',
  'eslint.config.ts',
  'eslint.config.mts',
  'eslint.config.cts'
];
const LEGACY_CONFIG_FILES = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runNpmView(args) {
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, 'view', ...args, '--json'], {
        cwd: ROOT,
        encoding: 'utf8'
      })
    : spawnSync(npmCmd, ['view', ...args, '--json'], {
        cwd: ROOT,
        encoding: 'utf8'
      });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(stderr || `npm view ${args.join(' ')} failed`);
  }

  const raw = (result.stdout || '').trim();
  if (!raw) {
    throw new Error(`npm view ${args.join(' ')} returned empty output`);
  }

  return JSON.parse(raw);
}

function loadSemver() {
  try {
    return require('semver');
  } catch {
    return null;
  }
}

function main() {
  const pkg = readJson(PKG_JSON);
  const currentDeclared = pkg.devDependencies?.eslint;
  if (!currentDeclared) {
    console.log('[deps] eslint not found in devDependencies. Skipping eslint ecosystem check.');
    process.exit(0);
  }

  const semver = loadSemver();
  if (!semver) {
    console.log('[deps] semver package is unavailable. Skipping eslint ecosystem check.');
    process.exit(0);
  }

  const currentVersion = semver.coerce(currentDeclared)?.version;
  if (!currentVersion) {
    console.log(`[deps] unable to parse eslint version \"${currentDeclared}\". Skipping check.`);
    process.exit(0);
  }

  const latestEslintVersion = runNpmView(['eslint', 'version']);
  const angularPeerRange = runNpmView(['@angular-eslint/eslint-plugin@latest', 'peerDependencies.eslint']);
  const tsPeerRange = runNpmView(['@typescript-eslint/eslint-plugin@latest', 'peerDependencies.eslint']);

  const currentMajor = semver.major(currentVersion);
  const latestMajor = semver.major(String(latestEslintVersion));
  const supportsLatestAngular = semver.satisfies(`${latestMajor}.0.0`, String(angularPeerRange), {
    includePrerelease: true
  });
  const supportsLatestTs = semver.satisfies(`${latestMajor}.0.0`, String(tsPeerRange), {
    includePrerelease: true
  });

  console.log(`[deps] eslint current: ${currentVersion}`);
  console.log(`[deps] eslint latest: ${latestEslintVersion}`);
  console.log(`[deps] @angular-eslint peer range: ${angularPeerRange}`);
  console.log(`[deps] @typescript-eslint peer range: ${tsPeerRange}`);

  if (latestMajor <= currentMajor) {
    console.log('[deps] eslint major is up to date.');
    process.exit(0);
  }

  if (!supportsLatestAngular || !supportsLatestTs) {
    console.log(
      `[deps] eslint@${latestMajor} is deferred: waiting for official peer support from @angular-eslint and @typescript-eslint.`
    );
    process.exit(0);
  }

  const hasFlatConfig = FLAT_CONFIG_FILES.some(file => fs.existsSync(path.join(ROOT, file)));
  const hasLegacyConfig = LEGACY_CONFIG_FILES.some(file => fs.existsSync(path.join(ROOT, file)));
  if (!hasFlatConfig && hasLegacyConfig) {
    console.log(
      `[deps] eslint@${latestMajor} support is available, but workspace still uses legacy .eslintrc config. Defer upgrade until flat-config migration is completed.`
    );
    process.exit(0);
  }

  console.error(
    `[deps] eslint@${latestMajor} is now officially supported by @angular-eslint and @typescript-eslint. Upgrade lint stack in one step.`
  );
  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[deps] eslint ecosystem check failed: ${message}`);
  process.exit(1);
}
