# Engineers Salary Reference — AI Handoff

**Last updated:** 2026-07-22  
**Purpose:** Give another AI or engineer enough accurate context to continue this project without rediscovering the deployment, data-recovery, and repository history. This document deliberately contains **no passwords, tokens, connection strings, API keys, or personal credentials**.

## Read this first

The production architecture that is currently working is:

```text
Angular frontend
  -> Cloudflare Pages
  -> https://engineers-salary-reference.pages.dev

Angular API calls
  -> Cloudflare Worker: engineers-salary-api
  -> https://engineers-salary-api.engref-cloud.workers.dev
  -> Neon PostgreSQL project: engref-db
```

The current live Worker reads from Neon and returns **1,917 salary reports**. Do not replace this architecture casually or delete any of the active resources below.

## Active services and what they own

| Service | Active resource | Why it must remain |
| --- | --- | --- |
| GitHub | `ahmedfrawelo/engineers-salary-reference` | Source control, CI, deployment history |
| Cloudflare Pages | `engineers-salary-reference` | Hosts the Angular frontend |
| Cloudflare Workers | `engineers-salary-api` | Hosts the production public API |
| Neon | project `engref-db` | Hosts the production PostgreSQL schema and salary data |

### Safe deletion candidate

There is one confirmed unused Cloudflare resource:

| Resource | State | Action |
| --- | --- | --- |
| Cloudflare D1 database `engineers_salary_reference` | Empty: 0 tables; created during an earlier experiment | It can be deleted after an explicit user confirmation. It is not used by the current Worker. |

Do **not** delete the Cloudflare account, the Pages project, the Worker, the Neon project, or the GitHub repository.

## Repository layout

```text
backend/                         .NET 10 reference/local API and EF Core code
frontend/                        Angular 21 application
worker/                          Cloudflare Worker production API
infra/                            Earlier Azure Bicep path (not the active runtime)
scripts/recover-neon.ps1         Recovery/import/deploy helper for Neon
data/imports/google-drive/        Original salary workbook import source
docs/                             Design and operational notes
```

The `.NET` backend is retained for local development, migrations, import behavior, and a possible future hosting change. It is **not** the currently deployed production API.

## Current deployment endpoints

- Frontend: `https://engineers-salary-reference.pages.dev`
- Worker health: `https://engineers-salary-api.engref-cloud.workers.dev/health/live`
- Worker data endpoint: `https://engineers-salary-api.engref-cloud.workers.dev/api/salary-reports/read-rows?pageNumber=1&pageSize=1`

Expected production checks:

```powershell
curl.exe --fail https://engineers-salary-api.engref-cloud.workers.dev/health/live
curl.exe --fail 'https://engineers-salary-api.engref-cloud.workers.dev/api/salary-reports/read-rows?pageNumber=1&pageSize=1'
curl.exe --fail https://engineers-salary-reference.pages.dev/salary-reports
```

The read-rows response must have `totalCount` greater than zero; the known recovered count is `1917`.

## What happened during this chat

### 1. Production UI and API symptoms were investigated

The user reported that the deployed salary-report page looked different from the local page, navigation labels were missing, and the frontend was not showing expected data. Browser console output also showed a `404` for a legacy events endpoint. The production path was audited rather than assuming the local development configuration matched production.

Important current rule: do not make production Angular code depend on `localhost`. The production frontend must use the Worker HTTPS URL through runtime configuration.

### 2. The original deployment design changed

The repository initially contained an Azure Container Apps / Azure SQL / GHCR deployment path and Bicep infrastructure because that was the original requested architecture. It remains in the repository as an optional/manual path.

The active zero-card runtime was changed to:

- Cloudflare Pages for Angular
- Cloudflare Worker for API behavior compatible with the frontend contract
- Neon Free PostgreSQL for persistent data

The reason was practical free-tier operation. Do not assume the Azure scripts were executed or that Azure resources exist merely because Azure files are present.

### 3. GitHub repository recovery

The GitHub repository was accidentally deleted during the work and was recreated. The active repository is:

`https://github.com/ahmedfrawelo/engineers-salary-reference`

The current `main` branch contains the recovery changes. The most relevant recovery commit is:

```text
ce2ac52 fix: harden Neon recovery deployment
```

### 4. Neon project and data recovery

The initial Neon state became unusable/deleted. A new Neon Free project named `engref-db` was created. Its PostgreSQL branch received:

- the existing PostgreSQL EF schema/migrations;
- the salary dataset from `data/imports/google-drive/Open Salary Database for Engineers (7-2026).xlsx`;
- 1,917 recovered salary reports.

The deployed Worker was verified against the recovered database, not only against a local connection.

### 5. Worker secret and version behavior

Cloudflare Worker secrets are version-bound. A successful recovery deploy must:

1. publish the Worker version;
2. set `DATABASE_URL` on the newly deployed Worker version;
3. verify the live API returns data.

Setting the secret and then deploying can produce a new Worker version without the intended updated secret. This was a root cause of earlier live `500` responses.

### 6. Hidden-character connection-string failure

A pasted Neon URL can contain a leading invisible UTF-8 BOM or zero-width character. The Worker database library rejects such a URL as invalid.

`scripts/recover-neon.ps1` now trims BOM, zero-width, newline, tab, and surrounding whitespace before validation. It also converts the URI format into the Npgsql key/value format required by the local .NET recovery host.

### 7. Database credential safety action

During diagnosis, a database connection string was exposed in an error response. The PostgreSQL role password was rotated and the Worker `DATABASE_URL` secret was updated. Do not reuse any connection URL seen in chat transcripts, old terminal output, screenshots, or prior diagnostics.

## Recovery procedure

Use this only if the live Worker returns `500` because Neon or its data was lost.

1. Create or select the correct Neon project and copy a fresh PostgreSQL URL.
2. Run from the repository root, supplying the URL only at the command prompt/process level:

```powershell
./scripts/recover-neon.ps1 -ConnectionString '<fresh Neon URL>'
```

3. The script:
   - normalizes the URL safely;
   - builds the .NET API;
   - applies the supported PostgreSQL schema/startup migration path;
   - synchronizes the workbook data;
   - validates that the local import created reports;
   - validates Worker tests and type checking;
   - deploys the Worker;
   - applies `DATABASE_URL` to the deployed Worker version;
   - verifies the public Worker endpoint.

4. Never place the connection URL in `appsettings*.json`, `.env` files committed to Git, Angular runtime configuration, GitHub logs, or documentation.

## Worker details

Location: `worker/`

Important files:

- `worker/wrangler.jsonc` — Worker name, compatibility date, CORS vars.
- `worker/src/index.ts` — HTTP routing and API contract.
- `worker/src/repository.ts` — Neon adapter using `@neondatabase/serverless`.
- `worker/test/api.test.ts` — API contract tests.

Production configuration:

- Worker name: `engineers-salary-api`
- Worker secret: `DATABASE_URL` only
- `ENVIRONMENT=production`
- Allowed frontend origin: `https://engineers-salary-reference.pages.dev`
- Worker observability is intentionally disabled after recovery diagnostics.

Useful commands:

```powershell
cd worker
npm test
npm run typecheck
npx wrangler deploy
npx wrangler secret list --name engineers-salary-api
```

## Frontend details

Location: `frontend/`

- Angular version: 21.
- Production hosting: Cloudflare Pages.
- SPA refresh must continue to work through `frontend/src/assets/_redirects`.
- Runtime API configuration must contain only the public HTTPS Worker base URL; it must never contain database or Cloudflare secrets.

Cloudflare Pages is Git-connected to the GitHub `main` branch. A push to `main` can trigger a frontend deployment. Confirm the exact build configuration in the Cloudflare Pages dashboard before changing it.

## Legacy/optional Azure path

`infra/`, Azure scripts, and Azure-related GitHub workflows are historical optional assets. They are not the active production deployment. There was no Azure subscription/resource returned by the local account check during this work.

Before deleting Azure-related source files, decide whether preserving the optional .NET/Azure deployment path matters. Removing files from Git is separate from closing an Azure account and should be handled as a reviewed cleanup task.

## Data source

The workbook source is:

```text
data/imports/google-drive/Open Salary Database for Engineers (7-2026).xlsx
```

Do not delete this file unless a newer verified source/export is stored elsewhere. It is the practical recovery source for the 1,917 historical reports.

## Current verified state

At the time this handoff was written:

| Check | Result |
| --- | --- |
| Worker `/health/live` | HTTP 200 and `Healthy` |
| Worker read-rows endpoint | HTTP 200 |
| Live report total | 1,917 |
| Pages `/salary-reports` SPA route | HTTP 200 |
| Worker test suite | 6 passed |
| Worker TypeScript typecheck | passed |
| Worker secret list | only `DATABASE_URL` |
| Unused D1 database | present, empty, safe deletion candidate |

## Recommendations for the next AI/engineer

1. **Do not switch databases again without a migration plan.** The live system is now Neon PostgreSQL. Preserve the current schema and imports before any provider change.
2. **Add a small automated production smoke check.** After every Worker deployment, call `/health/live` and `read-rows?pageNumber=1&pageSize=1`, require `totalCount > 0`, and fail the deployment otherwise.
3. **Keep secrets out of conversations and diagnostics.** If a connection string appears anywhere public or in logs, rotate the Neon role password and update the Worker secret immediately.
4. **Delete the empty D1 database only after explicit approval.** It is the one confirmed unused deployment resource.
5. **Consider removing the obsolete Azure path later.** Do this only in a separate cleanup pull request after confirming that no future Azure/.NET deployment is wanted.
6. **Keep the Google Drive workbook backed up.** Store a versioned, access-controlled copy outside the working directory before any data-cleaning or new import.
7. **Maintain a short deployment runbook.** Update `DEPLOYMENT.md`, `OPERATIONS.md`, and this file whenever the active host, project name, data source, or recovery process changes.

## Prompt for another AI

Copy this when handing the work to another AI:

> Read `docs/AI_HANDOFF.md`, `DEPLOYMENT.md`, `OPERATIONS.md`, and `SECURITY.md` before making changes. The active production stack is Cloudflare Pages + Cloudflare Worker + Neon PostgreSQL. Preserve the live API contract and the 1,917 recovered salary reports. Never print, commit, or place database URLs and tokens in frontend configuration. Verify the live Worker and Pages route after deployment. The empty Cloudflare D1 database is obsolete and is not part of production.

