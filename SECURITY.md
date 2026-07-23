# Security

Production secrets are supplied only through GitHub encrypted secrets and Cloudflare Worker secrets. The Neon connection URL is stored only as the Worker secret `DATABASE_URL`; safe defaults and browser runtime configuration contain no database credentials.

The production Worker accepts requests only from the exact Cloudflare Pages origin, returns generic API errors without exception details, and keeps synchronization operations authenticated. The browser receives only the public HTTPS API base URL.

There is currently no application file-upload feature. If introduced, it must use a private R2 bucket through an `IObjectStorage` abstraction, random server-generated keys, ownership checks, short-lived presigned URLs, MIME/extension/size validation, an 8 GiB global cap, and metadata-only SQL records. Container filesystem and SQL binary storage are prohibited.

Report vulnerabilities privately to the repository owner. Do not include credentials, tokens, connection strings, or personal salary records in issues or logs.
