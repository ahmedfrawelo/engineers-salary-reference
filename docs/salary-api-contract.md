# Salary API contract

The canonical frontend table contract is the normalized SQL read model exposed below. New clients must not use the legacy entity-shaped list endpoint.

## Canonical read endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/salary-reports/read-rows` | Paginated, filtered, sorted salary rows |
| `GET` | `/api/salary-reports/read-rows/summary` | SQL-backed summary and grouped breakdowns |
| `POST` | `/api/salary-reports/read-rows/aggregates` | Whitelisted grid aggregate calculations |
| `GET` | `/api/salary-reports/read-rows/filter-options` | Distinct server-side filter values |
| `GET` | `/api/salary-reports/{id}` | One published report |
| `GET` | `/api/salary-reports/options` | Contribution form reference options |
| `GET` | `/api/salary-reports/events` | Server-sent change notifications |
| `POST` | `/api/salary-reports` | Idempotent salary contribution |

The former entity-shaped `GET /api/salary-reports` and legacy `/summary` endpoints were removed after the dashboard migrated to the canonical read model.

`GET /api/salary-reports/options` uses the source vocabulary exactly. Company classification is exposed as `companyTypes`; legacy role-title, seniority, company-name, company-sector, and employment-type option arrays are not part of this contract.

Submission and detail responses expose the 19 source-answer fields plus `id` and `submittedAt` metadata. They do not synthesize role title, seniority, company name, employment type, anonymity, company-sector, or additional-notes properties.

Each source-answer field is stored in its own one-to-one SQL table with a bidirectional domain relationship to `SalaryReport`. Currency and monthly net salary are intentionally separate tables; `vwSalaryReportReadRows` joins all 19 field tables into the single frontend read contract.

## Query guarantees

- Page size is capped server-side.
- Sort fields and directions are allowlisted.
- Numeric ranges are validated before repository execution.
- Text and numeric aggregate operations are type checked.
- Filter option counts are capped.
- Read responses use tagged output caching; successful create/import notifications invalidate the tag.

## Mutation guarantees

- `POST /api/salary-reports` requires an `Idempotency-Key` header between 16 and 100 safe characters.
- Replaying the same key and body returns the original report with `Idempotent-Replay: true`.
- Reusing a key with a different body returns `409`.
- Contributions and imported rows are persisted through the normalized relational field tables.

## Operations

- `/api/health/live` checks process liveness.
- `/api/health/ready` checks the SQL connection and canonical read view.
- SSE connections are limited per source address and receive a heartbeat every 15 seconds.
