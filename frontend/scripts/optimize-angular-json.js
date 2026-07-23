/**
 * Angular.json Optimization Script
 *
 * Automatically optimizes angular.json with best practices
 * for bundle size reduction and performance
 *
 * Usage:
 * ```bash
 * node scripts/optimize-angular-json.js
 * ```
 */

const fs = require('fs');
const path = require('path');

const ANGULAR_JSON_PATH = path.join(__dirname, '..', 'angular.json');

/**
 * Get optimized build configuration
 */
function getOptimizedBuildConfig() {
  return {
    optimization: {
      scripts: true,
      styles: {
        minify: true,
        inlineCritical: true
      },
      fonts: {
        inline: true
      }
    },
    outputHashing: 'all',
    sourceMap: false,
    namedChunks: false,
    extractLicenses: true,
    buildOptimizer: true,
    commonChunk: true,
    vendorChunk: true,
    budgets: [
      {
        type: 'initial',
        maximumWarning: '2mb',
        maximumError: '5mb'
      },
      {
        type: 'anyComponentStyle',
        maximumWarning: '6kb',
        maximumError: '10kb'
      }
    ],
    fileReplacements: [
      {
        replace: 'src/environments/environment.ts',
        with: 'src/environments/environment.production.ts'
      }
    ]
  };
}

/**
 * Optimize angular.json
 */
function optimizeAngularJson() {
  console.log('🔧 Optimizing angular.json...\n');

  if (!fs.existsSync(ANGULAR_JSON_PATH)) {
    console.error('❌ angular.json not found!');
    process.exit(1);
  }

  // Read angular.json
  const angularJson = JSON.parse(fs.readFileSync(ANGULAR_JSON_PATH, 'utf8'));

  // Get project name (first project)
  const projectName = Object.keys(angularJson.projects)[0];
  const project = angularJson.projects[projectName];

  console.log(`📦 Project: ${projectName}\n`);

  // Backup original
  const backupPath = ANGULAR_JSON_PATH + '.backup';
  fs.writeFileSync(backupPath, JSON.stringify(angularJson, null, 2));
  console.log(`✅ Backup created: ${backupPath}\n`);

  // Apply optimizations
  const buildConfig = project.architect.build.configurations.production;
  const optimizedConfig = getOptimizedBuildConfig();

  // Merge configurations
  Object.assign(buildConfig, optimizedConfig);

  // Add development optimization (less aggressive)
  if (!project.architect.build.configurations.development) {
    project.architect.build.configurations.development = {};
  }

  project.architect.build.configurations.development = {
    ...project.architect.build.configurations.development,
    optimization: false,
    sourceMap: true,
    namedChunks: true,
    extractLicenses: false,
    buildOptimizer: false
  };

  // Write optimized angular.json
  fs.writeFileSync(ANGULAR_JSON_PATH, JSON.stringify(angularJson, null, 2));

  console.log('✅ Optimization applied successfully!\n');
  console.log('📊 Changes:');
  console.log('  ✓ Script optimization enabled');
  console.log('  ✓ Style minification with critical CSS inlining');
  console.log('  ✓ Font inlining enabled');
  console.log('  ✓ Output hashing for all files');
  console.log('  ✓ Build optimizer enabled');
  console.log('  ✓ Vendor chunk splitting enabled');
  console.log('  ✓ Bundle budgets configured (2MB warning, 5MB error)');
  console.log('  ✓ Source maps disabled for production');
  console.log('  ✓ Development configuration added');
  console.log('\n💡 To restore original: mv angular.json.backup angular.json\n');
}

// Run optimization
try {
  optimizeAngularJson();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
