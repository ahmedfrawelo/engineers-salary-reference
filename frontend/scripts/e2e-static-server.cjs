const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number.parseInt(process.argv[2] || '4301', 10);
const staticDirInput = process.env.E2E_STATIC_DIR;
const staticDirCandidates = [
  staticDirInput,
  'dist/engineers-salary-reference',
  'dist/engineers-salary-reference/browser',
  'dist/browser'
]
  .filter(Boolean)
  .map(candidate => path.resolve(process.cwd(), candidate));

const hasFileSync = target => {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
};

const hasDirectorySync = target => {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
};

const rootDir =
  staticDirCandidates.find(candidate => hasFileSync(path.join(candidate, 'index.html'))) ||
  staticDirCandidates.find(candidate => hasDirectorySync(candidate)) ||
  staticDirCandidates[0];

const fallbackIndexCandidates = [
  path.join(rootDir, 'index.html'),
  ...staticDirCandidates
    .filter(candidate => candidate !== rootDir)
    .map(candidate => path.join(candidate, 'index.html'))
];

const startupIndexFile = fallbackIndexCandidates.find(candidate => hasFileSync(candidate));

if (!startupIndexFile) {
  console.error('[e2e-static-server] Static build index.html was not found.');
  console.error(`[e2e-static-server] checked: ${fallbackIndexCandidates.join(', ')}`);
  console.error('[e2e-static-server] run: npm run build or npm run test:e2e:fresh');
  process.exit(1);
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const isPathInsideRoot = (candidate) => {
  const relative = path.relative(rootDir, candidate);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const fileExists = async (target) => {
  try {
    const stats = await fs.promises.stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
};

const directoryExists = async (target) => {
  try {
    const stats = await fs.promises.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const origin = `http://${req.headers.host || 'localhost'}`;
    const url = new URL(req.url || '/', origin);
    const pathname = decodeURIComponent(url.pathname);

    let resolvedPath = path.normalize(path.join(rootDir, pathname));
    if (resolvedPath === rootDir || pathname.endsWith('/')) {
      resolvedPath = path.join(resolvedPath, 'index.html');
    }

    const inRoot = resolvedPath === rootDir || isPathInsideRoot(resolvedPath);
    if (!inRoot) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (await directoryExists(resolvedPath)) {
      resolvedPath = path.join(resolvedPath, 'index.html');
    }

    const targetPath = (await fileExists(resolvedPath)) ? resolvedPath : startupIndexFile;
    const ext = path.extname(targetPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });

    if ((req.method || 'GET').toUpperCase() === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(targetPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('File not found');
    });
    stream.pipe(res);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`[e2e-static-server] serving ${rootDir} on http://localhost:${port}`);
  console.log(`[e2e-static-server] index file: ${startupIndexFile}`);
  console.log(`[e2e-static-server] index candidates: ${fallbackIndexCandidates.join(', ')}`);
});

const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
