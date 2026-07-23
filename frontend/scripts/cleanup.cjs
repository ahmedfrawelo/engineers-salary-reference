#!/usr/bin/env node

/**
 * Workspace cleanup script.
 * Removes generated artifacts and local caches to keep the repository lean.
 */

const fs = require('fs');
const path = require('path');

const targets = [
  { label: '.angular', path: path.resolve(process.cwd(), '.angular') },
  { label: 'dist', path: path.resolve(process.cwd(), 'dist') },
  { label: 'coverage', path: path.resolve(process.cwd(), 'coverage') },
  { label: 'out-tsc', path: path.resolve(process.cwd(), 'out-tsc') },
  { label: 'storybook-static', path: path.resolve(process.cwd(), 'storybook-static') },
  { label: 'documentation', path: path.resolve(process.cwd(), 'documentation') },
  { label: 'playwright-report', path: path.resolve(process.cwd(), 'playwright-report') },
  { label: 'test-results', path: path.resolve(process.cwd(), 'test-results') },
  { label: 'tmp-board-add-debug.png', path: path.resolve(process.cwd(), 'tmp-board-add-debug.png') },
  { label: 'dev-server.log', path: path.resolve(process.cwd(), 'dev-server.log') },
  { label: 'dev-server.err.log', path: path.resolve(process.cwd(), 'dev-server.err.log') },
  { label: 'watch-build.log', path: path.resolve(process.cwd(), 'watch-build.log') },
  { label: 'NUL', path: path.resolve(process.cwd(), 'NUL') },
  { label: 'NUL.map', path: path.resolve(process.cwd(), 'NUL.map') }
];

const removed = [];

for (const target of targets) {
  if (!fs.existsSync(target.path)) {
    continue;
  }

  try {
    fs.rmSync(target.path, { recursive: true, force: true });
    removed.push(target.label);
  } catch (error) {
    console.error(`[clean] Failed to remove ${target.label}:`, error.message);
  }
}

if (removed.length) {
  console.log(`[clean] Removed: ${removed.join(', ')}`);
} else {
  console.log('[clean] Nothing to remove.');
}
