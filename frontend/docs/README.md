# Documentation Hub

This directory contains hand-written project documentation.
Generated API documentation is produced in `documentation/` and is not hand-edited.

## Start Here

- `../README.md`: project overview, setup, and validation commands.
- `CLEAN_ARCHITECTURE_GUIDE.md`: current architecture rules and dependency direction.
- `WORKSPACE_MCP_SETUP.md`: local Codex MCP servers prepared for the ENGINEERS_SALARY_REFERENCE frontend/backend workspace.
- `architecture/FRONTEND_THEME_SYSTEM_GUIDE.md`: shared theme-token, overlay-shell,
  and page-alias styling workflow.
- `architecture/CLEAN_ARCHITECTURE_FINAL.md`: strict migration end-state and hard gates.
- `quality/README.md`: how quality reports are generated and interpreted.
- `troubleshooting/`: issue playbooks for known UI/layout regressions.
  - `troubleshooting/TENDER_PROJECTS_SESSION_EXPIRED_PLAYBOOK.md`: online-only
    auth/session-expired investigation and deploy verification steps for
    `Tender Projects`.

## Document Groups

- `architecture/`: architecture state and migration completion notes.
- `quality/`: baselines and generated quality reports.
- `roadmap/`: historical migration roadmap and closure checklist.
- `troubleshooting/`: operational playbooks and incident-style root-cause docs.

## Update Policy

Update documentation in the same PR whenever you change:

- folder structure or routing architecture,
- quality gate behavior or thresholds,
- build/test/verification commands,
- shared UI shell contracts or troubleshooting behavior.

## Definition Of Done For Docs

Before merging architecture-affecting work:

1. `npm run architecture:check` passes.
2. `npm run architecture:health` passes.
3. `npm run docs:build` passes.
4. `README.md` and `docs/CLEAN_ARCHITECTURE_GUIDE.md` reflect the new reality.
