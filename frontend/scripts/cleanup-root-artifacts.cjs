#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const ROOT_ARTIFACTS = ['NUL', 'NUL.map'];

function removeWindowsReservedArtifact(name) {
  const absolutePath = path.join(ROOT, name);
  const extendedPath = `\\\\?\\${absolutePath}`;
  const result = spawnSync('cmd.exe', ['/c', 'del', extendedPath], { stdio: 'ignore' });
  return result.status === 0;
}

function removeStandardArtifact(name) {
  try {
    fs.rmSync(path.join(ROOT, name), { force: true });
    return true;
  } catch {
    return false;
  }
}

const existingArtifacts = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter(entry => entry.isFile() && ROOT_ARTIFACTS.includes(entry.name))
  .map(entry => entry.name);

const removed = [];

for (const artifact of existingArtifacts) {
  const wasRemoved =
    process.platform === 'win32'
      ? removeWindowsReservedArtifact(artifact)
      : removeStandardArtifact(artifact);

  if (wasRemoved) {
    removed.push(artifact);
  }
}

if (removed.length) {
  console.log(`[cleanup-root] Removed: ${removed.join(', ')}`);
} else {
  console.log('[cleanup-root] Nothing to remove.');
}
