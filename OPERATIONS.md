# Operations

- Liveness: `/health/live`; readiness: `/health/ready`. Neither queries the database.
- Regular Worker health probes do not query Neon. Do not poll salary endpoints merely to keep Neon awake.
- PostgreSQL migrations are stored in `backend/EngineersSalary.PostgreSqlMigrations` and are applied explicitly before incompatible Worker releases.
- Inspect live API events with `npx wrangler tail engineers-salary-api`; paid log retention is disabled.
- Roll back from Cloudflare Workers Deployments and Pages Deployments. Migrations must remain backward compatible with the prior Worker version.
- Neon Free provides a short restore/time-travel window. Export important MVP data periodically using `pg_dump` to an operator-controlled encrypted location; do not commit backups.
- If Neon suspends, allow the first database request to wake it and rely on the configured transient retry strategy.
- If Pages cannot call the Worker, verify HTTPS `API_BASE_URL`, exact Pages CORS origin, `/health/live`, and the browser's CORS response.
- Source-sheet synchronization remains an authenticated on-demand operation; no hidden continuous worker runs in the free web service.
