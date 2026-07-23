const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const port = Number.parseInt(process.argv[2] || '4300', 10);
const apiTarget = process.env.LOCAL_API_TARGET || 'http://localhost:5145/api';
const root = path.resolve(__dirname, '..', 'dist', 'engineers-salary-reference');
const indexFile = path.join(root, 'index.html');

const app = express();

app.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(
  '/api',
  createProxyMiddleware({
    target: apiTarget,
    changeOrigin: true
  })
);

app.use(express.static(root));
app.use((_request, response) => response.sendFile(indexFile));

app.listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://localhost:${port}`);
  console.log(`API target: ${apiTarget}`);
});
