#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

const forbiddenFileFragments = [
  '/app/temp-bypass-permissions.ts',
  '.design-backup',
  '/app/shared/error-boundary/error-boundary.component.ts',
  '/app/shared/ui/skeleton/skeleton.component.ts'
];

const forbiddenFileNamePatterns = [
  /(^|\/)[^/]*\.refactor\.[^/]*$/i,
  /(^|\/)[^/]*\.temp\.[^/]*$/i,
  /(^|\/)[^/]*([-_.]copy[-_.]|[-_.]copy\.)[^/]*$/i
];

const forbiddenImportPatterns = [
  /material-classification-copy/,
  /temp-bypass-permissions$/,
  /pricing\/ui\/temp2?$/,
  /\.design-backup$/,
  /\.refactor\./,
  /\.temp\./,
  /[-_.]copy[-_.]/i,
  /core\/logger\.service$/,
  /core\/loading\.service$/,
  /core\/api-client\.service$/,
  /core\/api\/api\.service$/,
  /core\/users\/users\.api$/,
  /core\/network\/network-status\.service$/,
  /core\/theme\/theme-overrides\.util$/
];

const forbiddenExistingPaths = [
  'src/app/temp-bypass-permissions.ts',
  'src/app/pages',
  'src/app/shared/error-boundary',
  'src/app/shared/ui/skeleton'
];

const rootPolicyForbiddenPaths = [
  '_upgrade_backups',
  'public',
  'emptydir',
  'documentation/archive',
  'tmp-board-add-debug.png',
  'dev-server.log',
  'dev-server.err.log',
  'watch-build.log',
  'NUL',
  'NUL.map'
];

const rootPolicyForbiddenConfigs = ['.prettierrc', '.compodocrc.json'];

const rootPolicyDuplicateConfigGroups = [
  ['.prettierrc.json', '.prettierrc'],
  ['compodoc.json', '.compodocrc.json']
];

const FEATURE_LAYER_NAMES = ['application', 'domain', 'infrastructure', 'presentation'];
const FEATURE_ROOT_ALLOWED_FILES = new Set(['index.ts']);

const STRICT_LAYER_FORBIDDEN_IMPORT_PATTERNS = [
  /^@angular\//,
  /^@infrastructure\//,
  /^@platform\//,
  /\/infrastructure\//,
  /\/platform\//,
  /HttpClient$/,
  /ApiService$/,
  /\/api\/api\.service$/,
  /\/core\/api-client\.service$/
];

const STRICT_LAYER_FORBIDDEN_GLOBAL_PATTERNS = [
  /\blocalStorage\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bnavigator\b/
];

const APP_ROUTES_FORBIDDEN_DYNAMIC_IMPORT_PATTERNS = [
  /import\(\s*['"]\.\/pages\//,
  /import\(\s*['"]\.\/auth\//
];

const FEATURE_PRESENTATION_ROUTE_FORBIDDEN_IMPORT_PATTERNS = [
  /\/pages\//,
  /\/auth\/login\.component$/,
  /\/pages\/.+\/routes$/,
  /\/auth\/auth\.routes$/
];

const FEATURE_PRESENTATION_NON_LEGACY_FORBIDDEN_IMPORT_PATTERNS = [/\/pages\//];

const APP_COMPONENT_FORBIDDEN_IMPORT_PATTERNS = [/\/pages\//];

const FEATURES_OUTSIDE_LEGACY_FORBIDDEN_IMPORT_PATTERNS = [/\/pages\//];

const PRESENTATION_PAGE_IMPORT_FORBIDDEN_IMPORT_PATTERNS = [/\/pages\//];

const TENDER_PROJECTS_PRESENTATION_FORBIDDEN_IMPORT_PATTERNS = [
  /\/infrastructure\//,
  /^@infrastructure\//
];

const PRESENTATION_HEURISTIC_FORBIDDEN_IMPORT_PATTERNS = [
  /\/api\/api\.service$/,
  /\/core\/api-client\.service$/,
  /HttpClient$/,
  /ApiService$/
];

const PRESENTATION_HEURISTIC_FORBIDDEN_TOKEN_PATTERNS = [
  /\binject\(\s*HttpClient\s*\)/,
  /\binject\(\s*ApiService\s*\)/,
  /\bnew\s+HttpClient\b/,
  /\bnew\s+ApiService\b/
];

const LEGACY_ROUTE_FILE_PATTERNS = [
  /^src\/app\/auth\/auth\.routes\.ts$/,
  /^src\/app\/pages\/.+\/routes\.ts$/,
  /^src\/app\/pages\/.+\.routes\.ts$/
];

const APP_ROOT_ALLOWED_SOURCE_FILES = new Set([
  'src/app/app.component.ts',
  'src/app/app.config.ts',
  'src/app/app.routes.ts',
  'src/app/tokens.ts',
  'src/app/data.service.ts',
  'src/app/models.ts'
]);

const LAYER_ALLOWED_DEPENDENCIES = {
  app: new Set(['app', 'platform', 'infrastructure', 'features', 'core', 'shared', 'auth', 'other']),
  platform: new Set(['platform', 'infrastructure', 'core', 'shared', 'other']),
  infrastructure: new Set(['infrastructure', 'platform', 'core', 'shared', 'other']),
  features: new Set(['features', 'infrastructure', 'core', 'shared', 'auth', 'other']),
  // Core must stay framework/domain-centric and must not depend on UI-oriented shared code.
  core: new Set(['core', 'other']),
  shared: new Set(['shared', 'platform', 'infrastructure', 'core', 'other']),
  auth: new Set(['auth', 'infrastructure', 'core', 'shared', 'other']),
  other: new Set(['other', 'app', 'platform', 'infrastructure', 'features', 'core', 'shared', 'auth'])
};

// Backlog wrappers tracked during migration. New wrapper-only components are blocked.
const LEGACY_COMPONENT_WRAPPER_ALLOWLIST = new Set([]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function toSystemPath(posixPath) {
  return path.join(ROOT, ...posixPath.split('/'));
}

function pathExistsByDirectoryEntries(relativePath) {
  const segments = relativePath.split('/').filter(Boolean);
  let currentDir = ROOT;

  for (let index = 0; index < segments.length; index += 1) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return false;
    }

    const entry = entries.find(candidate => candidate.name === segments[index]);
    if (!entry) {
      return false;
    }

    if (index < segments.length - 1) {
      if (!entry.isDirectory()) {
        return false;
      }
      currentDir = path.join(currentDir, entry.name);
    }
  }

  return segments.length > 0;
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function isSourceFile(relativePath) {
  return /\.(ts|tsx|js|mjs|cjs)$/.test(relativePath);
}

function isStrictDomainOrApplicationFile(relativePath) {
  return /(^|\/)(domain|application)\//.test(relativePath);
}

function isLegacyScopedFile(relativePath) {
  return /\/legacy\//.test(relativePath) || /\/legacy[-_.][^/]*\.[^/]+$/.test(relativePath);
}

function detectLayer(relativePath) {
  if (relativePath.startsWith('src/app/platform/')) return 'platform';
  if (relativePath.startsWith('src/app/infrastructure/')) return 'infrastructure';
  if (relativePath.startsWith('src/app/features/')) return 'features';
  if (relativePath.startsWith('src/app/core/')) return 'core';
  if (relativePath.startsWith('src/app/shared-kernel/')) return 'shared';
  if (relativePath.startsWith('src/app/shared/')) return 'shared';
  if (relativePath.startsWith('src/app/auth/')) return 'auth';
  if (relativePath.startsWith('src/app/')) return 'app';
  return 'other';
}

function tryResolveImportFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function resolveImportPath(importerAbsolutePath, specifier) {
  if (specifier.startsWith('.')) {
    const absoluteBase = path.resolve(path.dirname(importerAbsolutePath), specifier);
    const resolved = tryResolveImportFile(absoluteBase);
    if (!resolved) return null;
    return toPosix(path.relative(ROOT, resolved));
  }

  if (specifier.startsWith('@features/')) {
    const absoluteBase = path.join(ROOT, 'src', 'app', 'features', specifier.slice('@features/'.length));
    const resolved = tryResolveImportFile(absoluteBase);
    if (!resolved) return null;
    return toPosix(path.relative(ROOT, resolved));
  }

  if (specifier.startsWith('@shared-kernel/')) {
    const absoluteBase = path.join(
      ROOT,
      'src',
      'app',
      'shared-kernel',
      specifier.slice('@shared-kernel/'.length)
    );
    const resolved = tryResolveImportFile(absoluteBase);
    if (!resolved) return null;
    return toPosix(path.relative(ROOT, resolved));
  }

  if (specifier.startsWith('@platform/')) {
    const absoluteBase = path.join(ROOT, 'src', 'app', 'platform', specifier.slice('@platform/'.length));
    const resolved = tryResolveImportFile(absoluteBase);
    if (!resolved) return null;
    return toPosix(path.relative(ROOT, resolved));
  }

  if (specifier.startsWith('@infrastructure/')) {
    const absoluteBase = path.join(
      ROOT,
      'src',
      'app',
      'infrastructure',
      specifier.slice('@infrastructure/'.length)
    );
    const resolved = tryResolveImportFile(absoluteBase);
    if (!resolved) return null;
    return toPosix(path.relative(ROOT, resolved));
  }

  if (specifier.startsWith('src/')) {
    return toPosix(specifier);
  }

  if (specifier.startsWith('/src/')) {
    return toPosix(specifier.slice(1));
  }

  return null;
}

function isComponentWrapperOnly(content) {
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();

  if (!withoutComments) {
    return false;
  }

  const wrapperExportPattern =
    /export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]\.\/[^'"]+\.internal['"];\s*/g;
  const hasWrapperExports =
    /export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]\.\/[^'"]+\.internal['"];\s*/.test(
      withoutComments
    );
  if (!hasWrapperExports) {
    return false;
  }

  const remaining = withoutComments.replace(wrapperExportPattern, '').trim();
  return remaining.length === 0;
}

function collectRootPolicyViolations() {
  const forbiddenRootPaths = [];
  const forbiddenRootConfigs = [];
  const duplicateRootConfigs = [];

  for (const relativePath of rootPolicyForbiddenPaths) {
    if (pathExistsByDirectoryEntries(relativePath)) {
      forbiddenRootPaths.push(relativePath);
    }
  }

  for (const configName of rootPolicyForbiddenConfigs) {
    if (pathExistsByDirectoryEntries(configName)) {
      forbiddenRootConfigs.push(configName);
    }
  }

  for (const group of rootPolicyDuplicateConfigGroups) {
    const existing = group.filter(configName => pathExistsByDirectoryEntries(configName));
    if (existing.length > 1) {
      duplicateRootConfigs.push(existing.join(', '));
    }
  }

  return {
    forbiddenRootPaths,
    forbiddenRootConfigs,
    duplicateRootConfigs
  };
}

function collectFeatureStructureViolations() {
  const missingFeatureLayers = [];
  const unexpectedFeatureRootFiles = [];
  const featuresRoot = path.join(ROOT, 'src', 'app', 'features');

  if (!fs.existsSync(featuresRoot) || !fs.statSync(featuresRoot).isDirectory()) {
    return { missingFeatureLayers, unexpectedFeatureRootFiles };
  }

  const featureEntries = fs.readdirSync(featuresRoot, { withFileTypes: true });
  for (const featureEntry of featureEntries) {
    if (!featureEntry.isDirectory()) {
      continue;
    }

    const featureDir = path.join(featuresRoot, featureEntry.name);
    const relativeFeatureRoot = toPosix(path.relative(ROOT, featureDir));
    const entries = fs.readdirSync(featureDir, { withFileTypes: true });
    const directories = new Set(entries.filter(entry => entry.isDirectory()).map(entry => entry.name));
    const missingLayers = FEATURE_LAYER_NAMES.filter(layer => !directories.has(layer));
    if (missingLayers.length) {
      missingFeatureLayers.push(`${relativeFeatureRoot} -> missing layers: ${missingLayers.join(', ')}`);
    }

    const rootFiles = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .filter(fileName => !FEATURE_ROOT_ALLOWED_FILES.has(fileName));
    for (const fileName of rootFiles) {
      unexpectedFeatureRootFiles.push(`${relativeFeatureRoot}/${fileName}`);
    }
  }

  return { missingFeatureLayers, unexpectedFeatureRootFiles };
}

function collectViolations(files) {
  const forbiddenFiles = [];
  const forbiddenFileNames = [];
  const forbiddenExisting = [];
  const forbiddenImports = [];
  const layerViolations = [];
  const appRootViolations = [];
  const componentWrapperViolations = [];
  const componentWrapperBacklog = [];
  const strictLayerForbiddenImports = [];
  const strictLayerForbiddenGlobals = [];
  const appRoutesViolations = [];
  const featurePresentationRouteViolations = [];
  const featurePresentationNonLegacyViolations = [];
  const presentationPageImportViolations = [];
  const tenderProjectsPresentationViolations = [];
  const presentationHeuristicViolations = [];
  const appComponentForbiddenImportViolations = [];
  const featureOutsideLegacyForbiddenImportViolations = [];
  const legacyRouteFiles = [];
  const { missingFeatureLayers, unexpectedFeatureRootFiles } = collectFeatureStructureViolations();

  for (const forbiddenPath of forbiddenExistingPaths) {
    if (fs.existsSync(toSystemPath(forbiddenPath))) {
      forbiddenExisting.push(forbiddenPath);
    }
  }

  for (const absolutePath of files) {
    const relativePath = toPosix(path.relative(ROOT, absolutePath));
    const fromLayer = detectLayer(relativePath);

    if (
      isSourceFile(relativePath) &&
      /^src\/app\/[^/]+\.(ts|tsx|js|mjs|cjs)$/.test(relativePath) &&
      !APP_ROOT_ALLOWED_SOURCE_FILES.has(relativePath)
    ) {
      appRootViolations.push(relativePath);
    }

    for (const fragment of forbiddenFileFragments) {
      if (relativePath.includes(fragment)) {
        forbiddenFiles.push(relativePath);
        break;
      }
    }
    for (const pattern of forbiddenFileNamePatterns) {
      if (pattern.test(relativePath)) {
        forbiddenFileNames.push(relativePath);
        break;
      }
    }

    if (LEGACY_ROUTE_FILE_PATTERNS.some(pattern => pattern.test(relativePath))) {
      legacyRouteFiles.push(relativePath);
    }

    if (!isSourceFile(relativePath)) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const strictDomainApplicationScope = isStrictDomainOrApplicationFile(relativePath);

    if (relativePath === 'src/app/app.routes.ts') {
      for (const pattern of APP_ROUTES_FORBIDDEN_DYNAMIC_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          appRoutesViolations.push(
            `${relativePath} contains forbidden dynamic import pattern: ${pattern}`
          );
        }
      }
    }

    if (/(^|\/)[^/]*\.component\.ts$/i.test(relativePath) && isComponentWrapperOnly(content)) {
      if (LEGACY_COMPONENT_WRAPPER_ALLOWLIST.has(relativePath)) {
        componentWrapperBacklog.push(relativePath);
      } else {
        componentWrapperViolations.push(relativePath);
      }
    }

    const importRegex =
      /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) {
        continue;
      }
      const violated = forbiddenImportPatterns.find(pattern => pattern.test(specifier));
      if (violated) {
        forbiddenImports.push(`${relativePath} -> ${specifier}`);
      }

      if (
        strictDomainApplicationScope &&
        STRICT_LAYER_FORBIDDEN_IMPORT_PATTERNS.some(pattern => pattern.test(specifier))
      ) {
        strictLayerForbiddenImports.push(`${relativePath} -> ${specifier}`);
      }

      if (
        /^src\/app\/features\/.+\/presentation\/[^/]*routes\.ts$/.test(relativePath) &&
        FEATURE_PRESENTATION_ROUTE_FORBIDDEN_IMPORT_PATTERNS.some(pattern =>
          pattern.test(specifier)
        )
      ) {
        featurePresentationRouteViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        /^src\/app\/features\/.+\/presentation\/(?!legacy\/).+\.ts$/.test(relativePath) &&
        FEATURE_PRESENTATION_NON_LEGACY_FORBIDDEN_IMPORT_PATTERNS.some(pattern =>
          pattern.test(specifier)
        )
      ) {
        featurePresentationNonLegacyViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        /^src\/app\/features\/.+\/presentation\/.+\.ts$/.test(relativePath) &&
        !isLegacyScopedFile(relativePath) &&
        PRESENTATION_PAGE_IMPORT_FORBIDDEN_IMPORT_PATTERNS.some(pattern => pattern.test(specifier))
      ) {
        presentationPageImportViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        relativePath.startsWith('src/app/features/tender/projects/presentation/page/') &&
        !isLegacyScopedFile(relativePath) &&
        TENDER_PROJECTS_PRESENTATION_FORBIDDEN_IMPORT_PATTERNS.some(pattern =>
          pattern.test(specifier)
        )
      ) {
        tenderProjectsPresentationViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        /^src\/app\/features\/.+\/presentation\/.+\.ts$/.test(relativePath) &&
        !isLegacyScopedFile(relativePath) &&
        PRESENTATION_HEURISTIC_FORBIDDEN_IMPORT_PATTERNS.some(pattern => pattern.test(specifier))
      ) {
        presentationHeuristicViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        relativePath === 'src/app/app.component.ts' &&
        APP_COMPONENT_FORBIDDEN_IMPORT_PATTERNS.some(pattern => pattern.test(specifier))
      ) {
        appComponentForbiddenImportViolations.push(`${relativePath} -> ${specifier}`);
      }

      if (
        relativePath.startsWith('src/app/features/') &&
        !isLegacyScopedFile(relativePath) &&
        FEATURES_OUTSIDE_LEGACY_FORBIDDEN_IMPORT_PATTERNS.some(pattern =>
          pattern.test(specifier)
        )
      ) {
        featureOutsideLegacyForbiddenImportViolations.push(`${relativePath} -> ${specifier}`);
      }

      const targetPath = resolveImportPath(absolutePath, specifier);
      if (!targetPath) {
        continue;
      }

      const toLayer = detectLayer(targetPath);
      const allowedTargets = LAYER_ALLOWED_DEPENDENCIES[fromLayer];
      if (!allowedTargets || allowedTargets.has(toLayer)) {
        continue;
      }

      layerViolations.push(`${relativePath} -> ${specifier} (layer: ${fromLayer} -> ${toLayer})`);
    }

    if (strictDomainApplicationScope) {
      for (const pattern of STRICT_LAYER_FORBIDDEN_GLOBAL_PATTERNS) {
        if (pattern.test(content)) {
          strictLayerForbiddenGlobals.push(`${relativePath} -> token ${pattern}`);
        }
      }
    }

    if (
      /^src\/app\/features\/.+\/presentation\/.+\.ts$/.test(relativePath) &&
      !isLegacyScopedFile(relativePath)
    ) {
      for (const pattern of PRESENTATION_HEURISTIC_FORBIDDEN_TOKEN_PATTERNS) {
        if (pattern.test(content)) {
          presentationHeuristicViolations.push(`${relativePath} -> token ${pattern}`);
        }
      }
    }
  }

  return {
    forbiddenFiles,
    forbiddenFileNames,
    forbiddenExisting,
    forbiddenImports,
    layerViolations,
    appRootViolations,
    componentWrapperViolations,
    componentWrapperBacklog,
    strictLayerForbiddenImports,
    strictLayerForbiddenGlobals,
    appRoutesViolations,
    featurePresentationRouteViolations,
    featurePresentationNonLegacyViolations,
    presentationPageImportViolations,
    tenderProjectsPresentationViolations,
    presentationHeuristicViolations,
    appComponentForbiddenImportViolations,
    featureOutsideLegacyForbiddenImportViolations,
    legacyRouteFiles,
    missingFeatureLayers,
    unexpectedFeatureRootFiles
  };
}

function printSection(title, lines) {
  if (!lines.length) {
    return;
  }
  console.error(`\n${title}`);
  for (const line of lines) {
    console.error(`- ${line}`);
  }
}

function main() {
  const files = fs.existsSync(SRC_DIR) ? walkFiles(SRC_DIR) : [];
  if (!fs.existsSync(SRC_DIR)) {
    console.warn('[architecture] src/ not found. Running root-policy checks only.');
  }

  const {
    forbiddenFiles,
    forbiddenFileNames,
    forbiddenExisting,
    forbiddenImports,
    layerViolations,
    appRootViolations,
    componentWrapperViolations,
    componentWrapperBacklog,
    strictLayerForbiddenImports,
    strictLayerForbiddenGlobals,
    appRoutesViolations,
    featurePresentationRouteViolations,
    featurePresentationNonLegacyViolations,
    presentationPageImportViolations,
    tenderProjectsPresentationViolations,
    presentationHeuristicViolations,
    appComponentForbiddenImportViolations,
    featureOutsideLegacyForbiddenImportViolations,
    legacyRouteFiles,
    missingFeatureLayers,
    unexpectedFeatureRootFiles
  } = collectViolations(files);

  const { forbiddenRootPaths, forbiddenRootConfigs, duplicateRootConfigs } =
    collectRootPolicyViolations();

  const hasViolations =
    forbiddenFiles.length > 0 ||
    forbiddenFileNames.length > 0 ||
    forbiddenExisting.length > 0 ||
    forbiddenImports.length > 0 ||
    layerViolations.length > 0 ||
    appRootViolations.length > 0 ||
    componentWrapperViolations.length > 0 ||
    strictLayerForbiddenImports.length > 0 ||
    strictLayerForbiddenGlobals.length > 0 ||
    appRoutesViolations.length > 0 ||
    featurePresentationRouteViolations.length > 0 ||
    featurePresentationNonLegacyViolations.length > 0 ||
    presentationPageImportViolations.length > 0 ||
    tenderProjectsPresentationViolations.length > 0 ||
    presentationHeuristicViolations.length > 0 ||
    appComponentForbiddenImportViolations.length > 0 ||
    featureOutsideLegacyForbiddenImportViolations.length > 0 ||
    legacyRouteFiles.length > 0 ||
    missingFeatureLayers.length > 0 ||
    unexpectedFeatureRootFiles.length > 0 ||
    forbiddenRootPaths.length > 0 ||
    forbiddenRootConfigs.length > 0 ||
    duplicateRootConfigs.length > 0;

  if (hasViolations) {
    console.error('[architecture] Failed.');
    printSection('Forbidden files detected:', forbiddenFiles);
    printSection('Forbidden temporary naming detected:', forbiddenFileNames);
    printSection('Forbidden paths present in repository:', forbiddenExisting);
    printSection('Forbidden imports detected:', forbiddenImports);
    printSection('Layer boundary violations detected:', layerViolations);
    printSection('Unexpected source files in src/app root:', appRootViolations);
    printSection('Component wrapper-only re-exports detected:', componentWrapperViolations);
    printSection(
      'Strict domain/application forbidden imports detected:',
      strictLayerForbiddenImports
    );
    printSection(
      'Strict domain/application forbidden global tokens detected:',
      strictLayerForbiddenGlobals
    );
    printSection('App routes forbidden imports detected:', appRoutesViolations);
    printSection(
      'Feature presentation routes forbidden imports detected:',
      featurePresentationRouteViolations
    );
    printSection(
      'Feature presentation non-legacy forbidden imports detected:',
      featurePresentationNonLegacyViolations
    );
    printSection(
      'Feature presentation direct page imports detected:',
      presentationPageImportViolations
    );
    printSection(
      'Tender projects presentation direct infrastructure imports detected:',
      tenderProjectsPresentationViolations
    );
    printSection(
      'Feature presentation heuristic business-logic violations detected:',
      presentationHeuristicViolations
    );
    printSection(
      'App component forbidden imports detected:',
      appComponentForbiddenImportViolations
    );
    printSection(
      'Feature files outside legacy forbidden imports detected:',
      featureOutsideLegacyForbiddenImportViolations
    );
    printSection('Legacy route modules detected:', legacyRouteFiles);
    printSection('Feature roots missing required clean-architecture layers:', missingFeatureLayers);
    printSection('Unexpected files in feature roots:', unexpectedFeatureRootFiles);
    printSection('Root-policy forbidden paths detected:', forbiddenRootPaths);
    printSection('Root-policy forbidden config files detected:', forbiddenRootConfigs);
    printSection('Duplicate root config groups detected:', duplicateRootConfigs);
    process.exit(1);
  }

  console.log(
    `[architecture] Legacy component wrappers tracked: ${componentWrapperBacklog.length}.`
  );
  console.log('[architecture] Passed.');
}

main();
