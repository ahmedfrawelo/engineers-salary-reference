# Operations Monitor Plan

## Goal

Build an internal admin-only monitoring page inside the frontend to observe the live health of the ENGINEERS_SALARY_REFERENCE production stack from one place instead of checking the VPS manually.

This page is intended for:

- API health
- database connectivity
- service status
- server resource usage
- backup status
- deployment/build info
- websocket/realtime status

It is **not** intended to replace full external monitoring, but it should cover the day-to-day operational needs of the team.

## Why We Want This

Right now, operational checks are spread across:

- manual VPS inspection
- direct API health checks
- deploy script output
- SQL backup verification
- manual websocket/auth checks

That works, but it is slow and fragmented.

We want one internal page that gives:

- clear status
- quick diagnostics
- basic historical context
- a single place to validate production readiness after deploys

## Product Decision

Create a new internal page:

- Name: `Operations Monitor`
- Audience: admin / super-admin only
- Location: under an internal admin/operations area in the frontend
- Access: protected route + backend authorization

## Scope For V1

### 1. System Summary Cards

Top summary cards should show:

- API status
- database status
- websocket/realtime status
- backup status
- deploy status
- server resource status

Each card should have:

- current status: `Healthy / Warning / Failed`
- last checked time
- short detail line

### 2. Service Status Section

Show live state of:

- `engineers-salary-reference-api`
- `nginx`
- `mssql-server`
- `fail2ban`
- backup timer/service if applicable

For each service:

- active/inactive/failed
- optional uptime
- last restart time if available

### 3. Resource Usage Section

Show:

- CPU load
- memory usage
- disk usage
- swap usage
- uptime

Preferred presentation:

- compact metric cards
- warning colors when thresholds are crossed

### 4. Backup Section

Show:

- last backup time
- last backup result
- backup file size
- backup age
- retention policy summary

If no recent backup exists, show a red state immediately.

### 5. Deployment Section

Show:

- current frontend bundle hash
- current backend version/build info
- last deploy time
- last deploy result

This lets us quickly confirm whether production is serving the latest deployment.

### 6. API / Realtime Section

Show:

- `/api/health` status
- websocket connectivity status
- last websocket event time
- auth/session status summary if useful

### 7. Logs / Recent Events

V1 can keep this light:

- recent operational events
- last failed checks
- last deploy result
- last backup result

No raw log dump in V1.

## Out Of Scope For V1

Do **not** include these in the first version:

- full log streaming
- shell access
- server command execution from UI
- heavy analytics dashboards
- external alerting integrations
- full audit explorer

## Recommended Route

Suggested frontend route:

- `/operations/monitor`

If there is already an internal operations area, place it there.

## UX Layout

Recommended structure:

1. Header
   - page title
   - environment badge
   - auto-refresh indicator
   - manual refresh button

2. Summary row
   - 5 to 6 high-signal cards

3. Detailed sections
   - Services
   - Resources
   - Backups
   - Deployments
   - Realtime/API

4. Recent events
   - compact table/list

## Refresh Strategy

Use polling, not aggressive realtime, for server metrics.

Recommended:

- summary: every `15s`
- resource metrics: every `15s`
- backup/deploy info: every `60s`
- full page manual refresh button always available

Realtime/websocket can be used only for:

- websocket connection state
- deploy completion event later if needed

## Backend Design

Do **not** let the frontend call shell commands or read server files directly.

The backend should expose dedicated read-only admin endpoints.

Recommended V1 endpoints:

- `GET /api/admin/operations/summary`
- `GET /api/admin/operations/services`
- `GET /api/admin/operations/resources`
- `GET /api/admin/operations/backups`
- `GET /api/admin/operations/deployments`
- `GET /api/admin/operations/realtime`

## Backend Response Model

### Summary

Should return:

- overallStatus
- apiStatus
- databaseStatus
- websocketStatus
- backupStatus
- deployStatus
- resourceStatus
- checkedAt

### Services

Should return entries like:

- name
- status
- uptime
- lastRestartAt
- details

### Resources

Should return:

- cpuLoad
- memoryUsedMb
- memoryTotalMb
- memoryUsagePercent
- diskUsedGb
- diskTotalGb
- diskUsagePercent
- swapUsedMb
- uptime
- checkedAt

### Backups

Should return:

- lastBackupAt
- lastBackupStatus
- lastBackupFileName
- lastBackupFileSizeMb
- retentionDays
- nextRunAt

### Deployments

Should return:

- backendVersion
- frontendBundle
- lastDeployAt
- lastDeployStatus
- environment

### Realtime

Should return:

- websocketConnected
- lastEventAt
- connectionCount if available
- details if degraded

## Data Sources On Backend

The backend can gather data from:

- app health checks
- process/service inspection on the VPS
- backup directory metadata
- deployment output markers/files if we choose to store them
- websocket service state

Important:

- keep this read-only
- no shell from the UI
- no server mutation actions in V1

## Security Rules

This page must be:

- authenticated
- admin-only
- read-only in V1

Do not expose:

- raw secrets
- connection strings
- private keys
- raw server paths unless necessary

If an error occurs, show a clean operational error message, not stack traces.

## Frontend Implementation Plan

### Step 1. Backend contracts

Add the admin operations endpoints and DTOs.

### Step 2. Frontend API service

Create a dedicated service for:

- summary
- services
- resources
- backups
- deployments
- realtime

### Step 3. Page shell

Create the page route and the top-level operations monitor shell.

### Step 4. Summary cards

Implement the first visible section with polling.

### Step 5. Detailed sections

Add service/resource/backup/deployment/realtime panels.

### Step 6. State management

Add clean refresh/polling logic with:

- loading state
- stale state
- partial failure handling

### Step 7. Tests

Add unit tests for:

- API mapping
- state transitions
- status color mapping

Add E2E flow for:

- page loads
- statuses render
- polling refresh does not break layout

## Suggested Frontend File Structure

One reasonable structure:

- `src/app/features/operations/monitor/...`

Suggested slices:

- `application`
- `infrastructure`
- `presentation`

Possible files:

- `operations-monitor.api.ts`
- `operations-monitor.models.ts`
- `operations-monitor.page.ts`
- `operations-monitor.page.html`
- `operations-monitor.page.scss`
- `operations-monitor.state.ts`

## Status Mapping

Use consistent status levels:

- `healthy`
- `warning`
- `failed`
- `unknown`

Each should map to:

- pill color
- icon
- label

No flashy gradients.
Keep it flat, clear, and operations-oriented.

## Acceptance Criteria

This feature is considered done when:

- admin can open the monitor page
- page loads production operational state cleanly
- status cards are accurate
- backup info is visible
- deploy info is visible
- services/resources reflect live state
- page handles partial backend failure cleanly
- polling works without layout jitter or console noise

## Nice-To-Have After V1

Possible V2 additions:

- lightweight incident timeline
- deploy history list
- recent websocket/auth anomalies
- manual test buttons for health probes
- alert thresholds configurable from admin UI

## Open Questions To Resolve During Implementation

- Where exactly should this page live in the navigation?
- Do we want a single aggregate endpoint for the first render?
- Should deployment metadata be persisted in a file or table?
- Do we want resource history or only current snapshots in V1?

## Recommended Implementation Order For Tomorrow

1. Define backend DTOs and admin endpoints
2. Add frontend API service
3. Build the page shell and summary cards
4. Add services/resources/backups/deploy sections
5. Add polling and tests

## Current Decision

We are **not** implementing the feature in this file.

This document is the agreed execution plan so the next session can continue directly without re-analysis.
