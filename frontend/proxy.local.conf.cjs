const target = process.env.API_TARGET || 'https://engineers-salary-api.engref-cloud.workers.dev';

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000
  },
  '/ws': {
    target,
    secure: false,
    changeOrigin: true,
    ws: true,
    logLevel: 'debug',
    proxyTimeout: 120000,
    timeout: 120000
  },
  '/quotes-en': {
    target: 'https://zenquotes.io',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/quotes-en': '/api/random' },
    logLevel: 'warn',
    proxyTimeout: 120000,
    timeout: 120000
  },
  '/quotes-ar': {
    target: 'https://api.quran.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/quotes-ar': '/api/v4/verses/random' },
    logLevel: 'warn',
    proxyTimeout: 120000,
    timeout: 120000
  }
};
