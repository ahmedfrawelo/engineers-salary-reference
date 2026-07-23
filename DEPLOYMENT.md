# Zero-card free MVP deployment

The active deployment is Cloudflare Pages + Cloudflare Workers + Neon Free. The TypeScript Worker in `worker/` is the production API and Neon is the production database.

## One-time account inputs

1. Create a Neon Free project and copy its TLS connection URL. For EF migrations, convert URL format to Npgsql keyword format if needed:
   `Host=<host>;Database=<database>;Username=<user>;Password=<password>;SSL Mode=Require;Timeout=15;Maximum Pool Size=20;`
2. Apply `backend/EngineersSalary.PostgreSqlMigrations` once with `Database__Provider=PostgreSQL` and the Neon connection string supplied only through the process environment.
3. From `worker`, run `npx wrangler secret put DATABASE_URL`, then `npm ci`, `npm test`, `npm run typecheck`, and `npx wrangler deploy`.
4. Build and publish Cloudflare Pages from `frontend`:

   ```powershell
   $env:API_BASE_URL='https://<worker-name>.<workers-subdomain>.workers.dev/api'
   npm --prefix frontend ci
   npm --prefix frontend run build:cloudflare
   npx --yes wrangler@latest pages deploy frontend/dist/engineers-salary-reference --project-name engineers-salary-reference --branch main --commit-dirty=true
   ```

Cloudflare uses the existing default URL `https://engineers-salary-reference.pages.dev`. No custom domain is required. `frontend/src/assets/_redirects` preserves SPA route refreshes.

The live defaults are:

- Frontend: `https://engineers-salary-reference.pages.dev`
- API: `https://<worker-name>.<workers-subdomain>.workers.dev`

## Configuration names

- Worker secret: `DATABASE_URL`
- Worker vars: `ENVIRONMENT=production`, `ALLOWED_ORIGIN=https://engineers-salary-reference.pages.dev`
- GitHub secret: `CLOUDFLARE_API_TOKEN`
- GitHub variables: `CLOUDFLARE_ACCOUNT_ID`, `PRODUCTION_API_BASE_URL`

Never add the Neon URL or generated keys to GitHub, Cloudflare runtime configuration, or repository files. R2 remains unnecessary until the application adds a file-upload feature.

## Verification

```powershell
Invoke-WebRequest https://<worker-name>.<workers-subdomain>.workers.dev/health/live
Invoke-WebRequest https://<worker-name>.<workers-subdomain>.workers.dev/api/salary-reports/read-rows/summary
Invoke-WebRequest https://engineers-salary-reference.pages.dev/assets/runtime-config.json
Invoke-WebRequest https://engineers-salary-reference.pages.dev/salary-reports
```

Use Cloudflare Workers Deployments to roll back to a prior Worker version and Pages Deployments to roll back the frontend. Neon branches can be used for migration rehearsal within the free quota.
