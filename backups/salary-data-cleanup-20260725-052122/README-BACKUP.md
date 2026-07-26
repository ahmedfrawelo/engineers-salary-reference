# Salary data cleanup backup

Created at: 2026-07-25 05:21 Africa/Cairo.

## How this backup was created

This is a read-only export from the live Cloudflare Worker API:

- `/api/salary-reports/options`
- `/api/salary-reports/read-rows`

The row export was paged until all available rows were downloaded.

## Export evidence

- Total rows reported by the API: 1919
- Rows exported into this backup: 1919
- Option groups exported: 17

## Important limitation

This is an application-level backup of the salary report data exposed by the API.
It is not a full Neon `pg_dump`, because the production `DATABASE_URL` is stored
as a Cloudflare Worker secret and cannot be read back from the local machine.

Before any direct database cleanup is applied, the cleanup script must create a
database-side backup table inside Neon in the same transaction or immediately
before the update.

## Main files

- `read-rows.json`: full exported report rows in JSON format.
- `read-rows.csv`: full exported report rows in CSV format.
- `options.json`: raw option lists before cleanup.
- `discipline-values-all.csv`: all raw discipline values and counts.
- `discipline-cleanup-mapping-safe-proposed.csv`: safer proposed discipline mapping.
- `discipline-cleanup-canonical-impact.csv`: impact summary after the proposed mapping.
- `discipline-cleanup-safe-proposed.sql`: proposed SQL; review before running.

## Safety rule

Do not run destructive cleanup directly against production without:

1. reviewing the proposed mapping,
2. creating a database-side backup table,
3. running a dry-run / preview,
4. applying only reviewed mappings,
5. verifying the post-cleanup counts.

## Cleanup execution log

The safe discipline cleanup was applied through a locked Cloudflare Worker admin
endpoint, not through a locally printed database connection string.

Execution summary:

- Worker admin endpoint deployed with token protection.
- Worker tests passed before deployment.
- Worker typecheck passed before deployment.
- First live dry-run affected 81 rows.
- First live apply created Neon backup table:
  `SalaryReportDisciplines_Backup_20260725022958`
- First live apply updated 81 rows.
- Supplemental live apply created Neon backup table:
  `SalaryReportDisciplines_Backup_20260725023319`
- Supplemental live apply updated 9 rows.
- Final `/options` response was normalized by the Worker before returning
  dropdown values.

Final verification files:

- `discipline-cleanup-live-dry-run-response.json`
- `discipline-cleanup-live-apply-response.json`
- `discipline-cleanup-supplemental-apply-response.json`
- `options-final-normalized.json`
- `options-final-normalized-case-sensitive-checks.csv`

Final case-sensitive checks confirm these dirty discipline dropdown values are
not returned anymore:

- `AGRICULTURE`
- `Agriculture`
- `Agriculture Engineer`
- `Agricultural engineering`
- `Alexandria`
- `BMS`
- `IT`
- `civil`
- `information technology`
- `surveying`

## Additional full-field cleanup pass

After the discipline cleanup, a safer multi-field cleanup pass was applied to
the remaining obvious values in:

- `city`
- `companyType`
- `country`
- `currency`

The pass used the same locked Worker admin flow:

1. generate reviewed mappings from the backup,
2. live dry-run,
3. database-side backup table,
4. live apply,
5. live verification through `/options` and `/read-rows/filter-options`.

Applied updates:

- `city`: 1184 rows updated, backup table
  `SalaryReportCities_Backup_20260725024232`
- `companyType`: 630 rows updated, backup table
  `SalaryReportCompanyTypes_Backup_20260725024233`
- `country`: 1822 rows updated, backup table
  `SalaryReportCountries_Backup_20260725024233`
- `currency`: 4 rows updated, backup table
  `SalaryReportCurrencies_Backup_20260725024234`

Final verification files:

- `all-fields-cleanup-safe-mapping.csv`
- `all-fields-dry-run-summary.csv`
- `all-fields-apply-summary.csv`
- `all-fields-final-options-checks.csv`
- `all-fields-raw-final-filter-checks.csv`

The final raw filter check confirms old values such as Arabic city/country
variants, misspelled `Alexanderia`, `Main Contractor`, `Construction`, `DRHM`,
`DURHAM`, `DINAR`, and `EURO` are no longer returned by the affected filters.

## Final supplementary cleanup

A final safe pass was applied after the completion audit found additional
obvious variants in currency, country, and company type.

Applied updates:

- `currency`: 15 rows updated, backup table
  `SalaryReportCurrencies_Backup_20260725024853`
- `country`: 87 rows updated, backup table
  `SalaryReportCountries_Backup_20260725024853`
- `companyType`: 24 rows updated, backup table
  `SalaryReportCompanyTypes_Backup_20260725024854`
- `companyType`: 502 rows updated, backup table
  `SalaryReportCompanyTypes_Backup_20260725025011`

Final audit files:

- `remaining-fields-cleanup-safe-mapping.csv`
- `remaining-fields-dry-run-summary.csv`
- `remaining-fields-apply-summary.csv`
- `final-companytype-cleanup-mapping.csv`
- `final-companytype-cleanup-apply-response.json`
- `options-ultimate-audit.json`
- `ultimate-companytype-checks.csv`
- `manual-review-remaining-values.csv`

## Final all-columns review cleanup

After product direction changed to clean the remaining reviewed values, a final
pass was applied to the remaining company type and discipline values.

Applied updates:

- `companyType`: 3 English rows updated, backup table
  `SalaryReportCompanyTypes_Backup_20260725025841`
- `discipline`: 3 English rows updated, backup table
  `SalaryReportDisciplines_Backup_20260725025842`
- `companyType`: 5 Arabic rows updated, backup table
  `SalaryReportCompanyTypes_Backup_20260725030132`
- `discipline`: 4 Arabic rows updated, backup table
  `SalaryReportDisciplines_Backup_20260725030133`

Final verification:

- 1919 live rows checked through `/api/salary-reports/read-rows`.
- Old reviewed raw values found after the final Arabic cleanup: 0.
- Live `/options` after final cleanup:
  - company types: 60
  - disciplines: 41

Final report folder:

- `final-all-columns-cleanup-20260725-0600/`

Important: rows were normalized to reviewed canonical values. No salary report
rows were deleted.
