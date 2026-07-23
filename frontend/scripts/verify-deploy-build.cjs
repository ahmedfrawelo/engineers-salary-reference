const fs = require('fs');
const path = require('path');

function validateHashedProductionBuild(options = {}) {
  const buildDir = path.resolve(
    options.buildDir ?? path.join(process.cwd(), 'dist', 'engineers-salary-reference')
  );
  const indexPath = path.join(buildDir, 'index.html');

  if (!fs.existsSync(buildDir)) {
    throw new Error(`Build directory not found: ${buildDir}`);
  }

  if (!fs.existsSync(indexPath)) {
    throw new Error(`index.html not found in build output: ${indexPath}`);
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  // Support both old webpack format (main-HASH.js) and new esbuild format (main.js)
  const mainMatch =
    indexHtml.match(/<script[^>]+src="(main-[A-Za-z0-9]+\.js)"/i) ||
    indexHtml.match(/<script[^>]+src="(main\.js)"/i);
  const stylesMatch =
    indexHtml.match(/<link[^>]+href="(styles-[A-Za-z0-9]+\.css)"/i) ||
    indexHtml.match(/<link[^>]+href="(styles\.css)"/i);

  if (!mainMatch) {
    throw new Error(
      'Build output is not a production bundle. Expected index.html to reference main.js or main-*.js.'
    );
  }

  if (!stylesMatch) {
    throw new Error(
      'Build output is not a production bundle. Expected index.html to reference styles.css or styles-*.css.'
    );
  }

  // For new esbuild format, verify at least one hashed chunk exists (proof of production build)
  const mainBundle = mainMatch[1];
  const stylesBundle = stylesMatch[1];
  if (mainBundle === 'main.js') {
    const hasHashedChunks = fs.readdirSync(buildDir).some(f => /^chunk-[A-Za-z0-9]+\.js$/.test(f));
    if (!hasHashedChunks) {
      throw new Error('Build output missing hashed chunk files — this does not appear to be a production build.');
    }
  }
  const mainPath = path.join(buildDir, mainBundle);
  const stylesPath = path.join(buildDir, stylesBundle);

  if (!fs.existsSync(mainPath)) {
    throw new Error(`Referenced main bundle is missing from dist: ${mainBundle}`);
  }

  if (!fs.existsSync(stylesPath)) {
    throw new Error(`Referenced styles bundle is missing from dist: ${stylesBundle}`);
  }

  const mainStat = fs.statSync(mainPath);
  const stylesStat = fs.statSync(stylesPath);

  if (mainStat.size <= 0) {
    throw new Error(`Referenced main bundle is empty: ${mainBundle}`);
  }

  if (stylesStat.size <= 0) {
    throw new Error(`Referenced styles bundle is empty: ${stylesBundle}`);
  }

  return {
    buildDir,
    indexPath,
    mainBundle,
    stylesBundle,
    mainPath,
    stylesPath,
  };
}

function fail(message) {
  console.error(`[verify-deploy-build] ${message}`);
  process.exit(1);
}

if (require.main === module) {
  try {
    const result = validateHashedProductionBuild();
    console.log(
      `[verify-deploy-build] OK: ${result.mainBundle} and ${result.stylesBundle} are present in ${result.buildDir}`
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

module.exports = {
  validateHashedProductionBuild,
};
