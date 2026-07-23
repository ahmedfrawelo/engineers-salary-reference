# No-card free-tier guardrails

- Keep the API on Cloudflare Workers Free and the frontend on Pages Free. Do not enable Workers Paid, Containers, paid observability, custom domains, or paid certificates.
- Workers have no durable filesystem. Never store uploads, database files, or durable state in a Worker.
- Neon must remain on the Free plan: 0.5 GB storage and 100 CU-hours per project/month at the current published limits. Use autosuspend and a maximum application pool of 20 connections.
- Keep Cloudflare Pages on the default `pages.dev` domain. R2 is introduced only when file upload exists, with the existing 8 GiB application cap.
- Do not enable Neon paid compute, paid storage, or automatic paid overage.
- GitHub Actions remains the release gate; deployment uses immutable repository commits and Cloudflare version history for rollback.

These plans are suitable for a zero-cost MVP, not an SLA-backed production workload. Cold starts and quota suspension are expected hard limits.
