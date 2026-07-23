#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const FEATURES_DIR = path.join(ROOT, 'src', 'app', 'features');

const ALLOWED_LAYER_DEPENDENCIES = {
  domain: new Set(['domain']),
  application: new Set(['application', 'domain']),
  infrastructure: new Set(['infrastructure', 'application', 'domain']),
  presentation: new Set(['presentation', 'infrastructure', 'application', 'domain']),
  other: new Set(['other'])
};

const FORBIDDEN_DOMAIN_APPLICATION_IMPORT_PATTERNS = [
  /^@angular\//,
  /^@infrastructure\//,
  /^@platform\//,
  /\/infrastructure\//,
  /\/platform\//,
  /\/api\/api\.service$/,
  /ApiService$/,
  /HttpClient$/
];

const FORBIDDEN_DOMAIN_APPLICATION_TOKENS = [
  /\blocalStorage\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bnavigator\b/
];

const FEATURE_LAYER_SEGMENTS = new Set([
  'domain',
  'application',
  'infrastructure',
  'presentation'
]);

const FORBIDDEN_NON_AUTH_FEATURE_IMPORT_PATTERNS = [
  /^@auth\//,
  /^(\.\.\/)+auth\//,
  /^src\/app\/auth\//
];

function toPosix(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function detectLayer(relativePath) {
  if (relativePath.includes('/domain/')) return 'domain';
  if (relativePath.includes('/application/')) return 'application';
  if (relativePath.includes('/infrastructure/')) return 'infrastructure';
  if (relativePath.includes('/presentation/')) return 'presentation';
  return 'other';
}

function detectFeatureScope(relativePath) {
  if (!relativePath.startsWith('src/app/features/')) {
    return null;
  }

  const segments = relativePath.split('/');
  const featurePath = segments.slice(3);

  if (featurePath.length === 0) {
    return null;
  }

  if (featurePath.length >= 2 && FEATURE_LAYER_SEGMENTS.has(featurePath[1])) {
    return featurePath[0];
  }

  if (featurePath.length >= 3 && FEATURE_LAYER_SEGMENTS.has(featurePath[2])) {
    return `${featurePath[0]}/${featurePath[1]}`;
  }

  return featurePath[0];
}

function isScopeThroughContextBoundaryAllowed(fromScope, toScope) {
  if (!fromScope || !toScope) {
    return true;
  }

  if (fromScope === toScope) {
    return true;
  }

  const fromSegments = fromScope.split('/');
  const toSegments = toScope.split('/');
  const sameContext = fromSegments[0] === toSegments[0];
  if (!sameContext) {
    return false;
  }

  const fromIsContext = fromSegments.length === 1;
  const toIsContext = toSegments.length === 1;
  return fromIsContext || toIsContext;
}

function tryResolve(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function resolveImportPath(importerPath, specifier) {
  if (specifier.startsWith('.')) {
    const base = path.resolve(path.dirname(importerPath), specifier);
    const resolved = tryResolve(base);
    if (!resolved) return null;
    return toPosix(path.relative(ROOT, resolved));
  }

  if (specifier.startsWith('@features/')) {
    const suffix = specifier.slice('@features/'.length);
    const base = path.join(ROOT, 'src', 'app', 'features', suffix);
    const resolved = tryResolve(base);
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('@shared-kernel/')) {
    const suffix = specifier.slice('@shared-kernel/'.length);
    const base = path.join(ROOT, 'src', 'app', 'shared-kernel', suffix);
    const resolved = tryResolve(base);
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('@platform/')) {
    const suffix = specifier.slice('@platform/'.length);
    const base = path.join(ROOT, 'src', 'app', 'platform', suffix);
    const resolved = tryResolve(base);
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('@infrastructure/')) {
    const suffix = specifier.slice('@infrastructure/'.length);
    const base = path.join(ROOT, 'src', 'app', 'infrastructure', suffix);
    const resolved = tryResolve(base);
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  if (specifier.startsWith('src/')) {
    const resolved = tryResolve(path.join(ROOT, specifier));
    return resolved ? toPosix(path.relative(ROOT, resolved)) : null;
  }

  return null;
}

function printSection(title, items) {
  if (!items.length) {
    return;
  }
  console.error(`\n${title}`);
  for (const item of items) {
    console.error(`- ${item}`);
  }
}

function main() {
  if (!fs.existsSync(FEATURES_DIR)) {
    console.log('[layer-guard] features directory not found. Skipping.');
    process.exit(0);
  }

  const files = walkFiles(FEATURES_DIR);
  const layerViolations = [];
  const forbiddenImportViolations = [];
  const forbiddenTokenViolations = [];
  const crossFeatureViolations = [];
  const featureAuthImportViolations = [];

  for (const absolutePath of files) {
    const relativePath = toPosix(path.relative(ROOT, absolutePath));
    const fromLayer = detectLayer(relativePath);
    const fromScope = detectFeatureScope(relativePath);
    if (fromLayer === 'other') {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const importRegex =
      /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) {
        continue;
      }

      if (
        (fromLayer === 'domain' || fromLayer === 'application') &&
        FORBIDDEN_DOMAIN_APPLICATION_IMPORT_PATTERNS.some(pattern => pattern.test(specifier))
      ) {
        forbiddenImportViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        relativePath.startsWith('src/app/features/') &&
        !relativePath.startsWith('src/app/features/auth/') &&
        FORBIDDEN_NON_AUTH_FEATURE_IMPORT_PATTERNS.some(pattern => pattern.test(specifier))
      ) {
        featureAuthImportViolations.push(`${relativePath} -> ${specifier}`);
      }

      const resolvedTarget = resolveImportPath(absolutePath, specifier);
      if (!resolvedTarget) {
        continue;
      }

      const toScope = detectFeatureScope(resolvedTarget);
      if (!isScopeThroughContextBoundaryAllowed(fromScope, toScope)) {
        crossFeatureViolations.push(
          `${relativePath} -> ${specifier} (feature: ${fromScope} -> ${toScope})`
        );
      }

      const toLayer = detectLayer(resolvedTarget);
      if (toLayer === 'other') {
        if (resolvedTarget.startsWith('src/app/shared-kernel/')) {
          continue;
        }
        if (resolvedTarget.startsWith('src/app/platform/') && fromLayer === 'infrastructure') {
          continue;
        }
        continue;
      }

      const allowed = ALLOWED_LAYER_DEPENDENCIES[fromLayer];
      if (!allowed || allowed.has(toLayer)) {
        continue;
      }
      layerViolations.push(`${relativePath} -> ${specifier} (layer: ${fromLayer} -> ${toLayer})`);
    }

    if (fromLayer === 'domain' || fromLayer === 'application') {
      for (const pattern of FORBIDDEN_DOMAIN_APPLICATION_TOKENS) {
        if (pattern.test(content)) {
          forbiddenTokenViolations.push(`${relativePath} -> token ${pattern}`);
        }
      }
    }
  }

  const hasViolations =
    layerViolations.length > 0 ||
    forbiddenImportViolations.length > 0 ||
    forbiddenTokenViolations.length > 0 ||
    crossFeatureViolations.length > 0 ||
    featureAuthImportViolations.length > 0;

  if (hasViolations) {
    console.error('[layer-guard] Failed.');
    printSection('Layer dependency violations:', layerViolations);
    printSection('Cross-feature coupling violations:', crossFeatureViolations);
    printSection('Forbidden auth imports outside auth feature:', featureAuthImportViolations);
    printSection('Forbidden imports in domain/application:', forbiddenImportViolations);
    printSection('Forbidden browser/global tokens in domain/application:', forbiddenTokenViolations);
    process.exit(1);
  }

  console.log('[layer-guard] Passed.');
}

main();
