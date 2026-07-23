# Engineers Salary Reference

Professional engineering reference platform. The first module replaces the Google Form and Excel salary sheet with a structured salary submission and browsing experience.

## Stack

- Frontend: Angular 21 standalone app, signals, reactive forms, typed HTTP services.
- Production API: Cloudflare Worker.
- Production database: Neon PostgreSQL.
- Local/reference backend: .NET 10 Web API with EF Core migrations.
- Tests: xUnit for backend, Angular unit tests with Vitest runner.

## Production deployment

The live application uses Cloudflare Pages for the frontend, Cloudflare Workers for the API, and Neon for persistent data. The .NET backend remains in the repository for local development and future migration work, but it is not a deployed hosting target. See [DEPLOYMENT.md](DEPLOYMENT.md), [OPERATIONS.md](OPERATIONS.md), and [SECURITY.md](SECURITY.md).

For a safe, detailed project and recovery handoff for another AI or engineer, see [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md).

## Structure

```text
backend/
  EngineersSalary.Api/
  EngineersSalary.Application/
  EngineersSalary.Contracts/
  EngineersSalary.Domain/
  EngineersSalary.Infrastructure/
  EngineersSalary.Tests/
frontend/
  src/app/
docs/
```

## Local Run

From `backend`:

```powershell
dotnet tool restore
dotnet tool run dotnet-ef database update --project .\EngineersSalary.Infrastructure --startup-project .\EngineersSalary.Api
dotnet run --project .\EngineersSalary.Api --launch-profile https
```

From `frontend`:

```powershell
npm install
npm run build
npm run preview
```

Open `http://127.0.0.1:4300`.

The preview server serves the production Angular build and proxies `/api/*` to `http://localhost:5145` by default. Set `API_TARGET` if the API is running elsewhere.

## Imported Data

The Drive workbook was downloaded to:

`data/imports/google-drive/Open Salary Database for Engineers (7-2026).xlsx`

Importer:

```powershell
$env:PYTHONIOENCODING='utf-8'
C:\Users\ahmed\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe .\tools\import_google_drive_salary_sheet.py ".\data\imports\google-drive\Open Salary Database for Engineers (7-2026).xlsx" --dry-run
C:\Users\ahmed\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe .\tools\import_google_drive_salary_sheet.py ".\data\imports\google-drive\Open Salary Database for Engineers (7-2026).xlsx"
```

The importer reads the workbook, maps the Google Form columns into the API contract, and posts to `http://localhost:5145/api` by default. Use `--api-base` for another API URL. It skips a populated development database unless `--force` is passed; use `--dry-run` first to review import/skipped counts without creating reports.

The workbook import needs Python packages for Excel files, including `pandas` and `openpyxl`. The bundled Codex runtime path above includes them; a plain system `python` may fail with `ModuleNotFoundError: No module named 'pandas'`.

Current local SQL Server development database has 1,917 imported salary reports from the sheet. The Google-native Form was visible in Drive but not downloadable by `gdown`; the app form now mirrors the sheet/form questions that produced the workbook.

## Development URLs

- Frontend preview: `http://127.0.0.1:4300`
- API HTTP: `http://localhost:5145`
- API HTTPS: `https://localhost:7013`
- Health: `http://localhost:5145/api/health`
- OpenAPI document: `http://localhost:5145/openapi/v1.json`

## Verification

```powershell
cd backend
dotnet build .\EngineersSalary.slnx
dotnet test .\EngineersSalary.slnx --no-build

cd ..\frontend
npm run build
npm test -- --watch=false

cd ..
C:\Users\ahmed\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe .\tools\test_import_google_drive_salary_sheet.py
```
