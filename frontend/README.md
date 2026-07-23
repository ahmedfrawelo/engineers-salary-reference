# ENGINEERS_SALARY_REFERENCE Portal Frontend

ENGINEERS_SALARY_REFERENCE Portal Frontend is the Angular client for ENGINEERS_SALARY_REFERENCE business workflows across
tendering, procurement, in-hand project execution, CRM, HR, task tracking, and
account management.

The repository is structured around feature-layered architecture, automated
dependency guards, deployment verification, and project documentation that lives
with the codebase.

## At A Glance

- Framework: Angular 21
- Language: TypeScript 5.9
- Reactive layer: RxJS 7
- UI quality: ESLint, Prettier, and Markdown linting
- Testing: Angular unit tests and Playwright E2E coverage
- Documentation: hand-written docs in `docs/` and generated Compodoc output in
  `documentation/`

## Business Areas

Current feature domains under `src/app/features/` include:

- `tender`
- `in-hand`
- `operations`
- `crm`
- `hr`
- `tasks`
- `stores`
- `account`
- `auth`
- `settings`
- `dashboard`

## Repository Layout

The source of truth for the application lives in these paths:

- `src/app/features/`: business features organized by `domain`,
  `application`, `infrastructure`, and `presentation`
- `src/app/core/`: cross-cutting runtime services and internal platform rules
- `src/app/shared/`: reusable UI building blocks, utilities, and data-grid
  infrastructure
- `src/app/shared-kernel/`: framework-agnostic shared primitives
- `src/app/platform/`: Angular runtime wiring and platform adapters
- `src/app/infrastructure/`: cross-feature technical adapters
- `src/assets/`: static assets, icons, translations, and PWA resources
- `scripts/`: validation, cleanup, deployment, and architecture guard scripts
- `docs/`: project documentation, playbooks, and architecture notes
- `e2e/`: Playwright test coverage

Generated or local-only folders such as `node_modules/`, `dist/`,
`documentation/`, `storybook-static/`, `.angular/`, and `out-tsc/` are not the
source of truth for project structure.

## Architecture Rules

- Every business feature should keep its layered structure inside
  `src/app/features/<feature>/`.
- `src/app/pages/**` runtime imports are intentionally blocked by architecture
  guards.
- Dependency direction is enforced by scripts, not by convention alone.
- When architecture, build behavior, or deployment flow changes, `README.md`
  and the relevant files inside `docs/` should be updated in the same change.

## Getting Started

Prerequisites:

- Node.js 22 or newer
- npm 10 or newer

Install dependencies:

```bash
npm install
```

If your local workflow needs environment-specific values, create `.env` from
`.env.example` before running deployment-related scripts.

Start the default local development server:

```bash
npm start
```

Useful alternatives:

- `npm run start:remote`: start with the remote proxy configuration
- `npm run dev`: run the app on port `4300`
- `npm run dev:remote`: run the remote proxy flow on port `4300`

Default local URL: `http://localhost:4200/`

CRM persistence is served by the real backend through the local `/api` proxy using `GET /api/crm/bootstrap` plus the CRM CRUD endpoints.

## Daily Commands

Development and build:

- `npm start`
- `npm run dev`
- `npm run build`
- `npm run build:prod`
- `npm run build:prod:clean`

Validation and quality:

- `npm run architecture:check`
- `npm run architecture:health`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run verify:quick`
- `npm run verify:all`

Testing and docs:

- `npm run test -- --watch=false`
- `npm run test:e2e`
- `npm run test:e2e:cross`
- `npm run test:e2e:mobile`
- `npm run docs:build`
- `npm run docs:serve`
- `npm run storybook`

## Deployment Workflow

Production is deployed by Cloudflare Pages Git integration; this repository does
not upload frontend files to a VPS. Configure the Pages project with:

- root directory: `frontend`
- build command: `npm run build:cloudflare`
- output directory: `dist/engineers-salary-reference`
- environment variable: `API_BASE_URL=https://<container-app-fqdn>/api`

`npm run deploy` is a local production-build validation alias. Cloudflare performs
the actual deployment from Git, so CI does not duplicate the Pages release.

- `build:cloudflare` generates `assets/runtime-config.json` from the HTTPS API URL.
- `npm run verify:deploy-build` validates the generated `dist/engineers-salary-reference`
  manifest when run as an additional local check.
- SPA refresh routing is provided by `src/assets/_redirects`.
- Backend and infrastructure deployment details live in the repository-root
  `DEPLOYMENT.md`.

## Documentation Map

- `docs/README.md`: documentation hub
- `docs/CLEAN_ARCHITECTURE_GUIDE.md`: architecture rules and dependency policy
- `docs/architecture/CLEAN_ARCHITECTURE_FINAL.md`: final migration target state
- `docs/architecture/FRONTEND_THEME_SYSTEM_GUIDE.md`: theme and shared styling
  workflow
- `docs/quality/`: quality baselines and generated reports
- `docs/troubleshooting/`: incident-style troubleshooting playbooks
- `CONTRIBUTING`: contribution expectations for validation and architecture

## Contribution Expectations

Before opening a PR or merging a large change:

1. Run `npm run verify:quick`.
2. Keep architecture boundaries green with `npm run architecture:check`.
3. Update docs when structure, routing, build steps, or deployment behavior
   changes.
4. Avoid committing generated output and local workspace artifacts.
