# Root File Map

Date: 2026-03-06

## Root Policy

Repository root should contain only runtime/tooling essentials.

Primary categories:

- build/runtime config: `angular.json`, `package.json`, `package-lock.json`, `tsconfig*`, `playwright.config.ts`, `vitest.config.ts`
- deployment/runtime files: `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `proxy*.json`
- project metadata: `README.md`, `LICENSE`, `CONTRIBUTING`, `CHANGELOG`
- tooling config: `.eslintrc.json`, `.prettierrc.json`, `.gitignore`, `.npmrc`, `compodoc.json`
- controlled folders: `src/`, `docs/`, `scripts/`, `e2e/`, `.github/`

## Root Artifacts Blocked By Guard

`scripts/architecture-guard.cjs` fails if any of these are present:

- `_upgrade_backups`
- `public`
- `emptydir`
- `documentation/archive`
- `tmp-board-add-debug.png`
- `dev-server.log`
- `dev-server.err.log`
- `watch-build.log`
- `NUL`
- `NUL.map`

Deprecated duplicate config files are also blocked:

- `.prettierrc`
- `.compodocrc.json`

## Documentation Policy

- `docs/` is for hand-written documentation.
- `docs/quality/` contains quality baselines and generated quality reports.
- `documentation/` is generated Compodoc output and should not be hand-edited.

## Maintenance Notes

- Run `npm run clean:workspace` to remove common generated artifacts.
- If root policy changes, update this file and `scripts/architecture-guard.cjs` in the same PR.
