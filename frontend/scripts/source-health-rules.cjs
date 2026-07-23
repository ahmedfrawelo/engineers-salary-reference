const HARD_LINE_LIMIT = 2145;
const COMPONENT_INTERNAL_THRESHOLD = 800;
const MAX_COMPONENT_INTERNAL_THRESHOLD_BREACHES = 0;
const HELPER_THRESHOLD = 500;
const MAX_LARGE_HELPER_FILES = 0;

// Backlog files tracked during migration. New breaches are blocked.
const LEGACY_HARD_LIMIT_ALLOWLIST = new Set([
  'src/app/features/settings/presentation/user-access-control/user-access-control.component.ts',
  'src/app/features/tender/projects/presentation/page/tender-projects.component.presenter.core.ts',
  'src/app/features/tender/suppliers/presentation/page/tender-suppliers.component.presenter.core.ts'
]);

const LEGACY_COMPONENT_INTERNAL_ALLOWLIST = new Set([
  ...LEGACY_HARD_LIMIT_ALLOWLIST,
  'src/app/features/account/presentation/account-notifications-page.component.ts',
  'src/app/features/tender/suppliers/presentation/page/tender-suppliers.persistence.core.ts',
  'src/app/features/tender/projects/presentation/page/tender-projects.component.presenter.core.ts',
  'src/app/features/tender/suppliers/presentation/page/tender-suppliers.connections.core.ts',
  'src/app/features/tender/suppliers/presentation/page/tender-suppliers.component.presenter.core.ts',
  'src/app/features/tender/dashboard/presentation/page/tender-dashboard.component.presenter.base.ts',
  'src/app/shared/ui/calendar.component.presenter.base.ts',
  'src/app/shared/general-list/status-list/app-status-list.logic.core.ts',
  'src/app/shared/data-grid/data-grid.component.part2.internal.impl.ts',
  'src/app/features/tasks/presentation/tasks-workspace/views/board/tasks-board-view.logic.ts',
  'src/app/features/tasks/presentation/page/team-tasks.component.core.ts',
  'src/app/features/tender/projects/presentation/page/tender-project-details/project-details.component.impl.ts',
  'src/app/shared/data-grid/data-grid.component.part3.internal.impl.ts',
  'src/app/shared/ui/page-design/page-design.logic.ts',
  'src/app/shared/data-grid/data-grid.component.presenter.impl.ts',
  'src/app/shared/data-grid/data-grid.component.part1.internal.impl.ts',
  'src/app/features/tasks/presentation/task-future/task-future.component.core.ts',
  'src/app/shared/data-grid/data-grid.component.part4.internal.impl.ts',
  'src/app/features/settings/presentation/user-access-control/user-access-control.roster.core.internal.impl.ts',
  'src/app/features/settings/material-classification/presentation/page/panels/add-material-panel/add-material-panel.component.presenter.core.ts',
  'src/app/features/settings/presentation/user-access-control/user-access-control.component.presenter.base.ts',
  'src/app/features/hr/presentation/leave/hr-leave-page.component.impl.ts',
  'src/app/shared/ui/overlay-panel.component.impl.ts',
  'src/app/features/tasks/presentation/task-future/task-future.logic.ts',
  'src/app/features/tender/projects/presentation/page/add-tender-tab/add-tender-panel.component.impl.ts',
  'src/app/features/tender/projects/presentation/page/tender-projects.component.core.ts',
  'src/app/features/tender/projects/presentation/page/tender-projects.component.state.ts',
  'src/app/features/tender/projects/presentation/page/tender-project-details/tabs/overview-tab.component.ts',
  'src/app/features/tender/pricing/presentation/page/tender-pricing.component.ts',
  'src/app/features/tender/suppliers/presentation/page/tabs/add-supplier-panel/add-supplier-panel.component.impl.ts',
  'src/app/features/tender/suppliers/presentation/page/editor/add-supplier-panel/add-supplier-panel.component.impl.ts',
  'src/app/features/tender/projects/presentation/page/tender-project-details/tabs/activity-tab.component.impl.ts',
  'src/app/features/tender/projects/presentation/page/tender-projects-audit.core.ts',
  'src/app/features/tender/boq/presentation/project-breakdown/project-breakdown.component.impl.ts',
  'src/app/features/tender/boq/presentation/page/tabs/project-breakdown/project-breakdown.component.impl.ts',
  'src/app/features/settings/material-classification/presentation/page/material-classification.component.core.ts',
  'src/app/features/tasks/presentation/tasks-workspace/views/calendar/tasks-calendar-view.component.core.ts',
  'src/app/features/tasks/presentation/tasks-workspace/views/gantt/tasks-gantt-view.component.core.ts',
  'src/app/features/tasks/presentation/tasks-workspace/components/group-composer/app-group-composer.component.core.ts',
  'src/app/features/tasks/presentation/page/team-tasks.logic.ts',
  'src/app/shared/data-grid/data-grid.component.state.ts',
  'src/app/features/settings/presentation/user-access-control/user-access-control.component.ts',
  'src/app/app.component.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.part1.internal.impl.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.part2.internal.impl.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.part3.internal.impl.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.part4.internal.impl.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.part5.logic.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.runtime-interactions.ts',
  'src/app/shared/data-grid/core/runtime/data-grid.component.runtime-scroll.ts',
  'src/app/shared/data-grid/core/state/data-grid.component.state.ts',
  'src/app/features/tender/reports/presentation/page/tender-reports.component.ts',
  'src/app/shared/data-grid/core/presenter/data-grid.component.presenter.grid.base.ts',
  'src/app/shared/ui/search-select.component.ts',
  'src/app/shared/data-grid/core/data-grid.component.state.ts',
  'src/app/features/tender/projects/presentation/page/tender-projects.activity.core.ts',
  'src/app/features/tender/suppliers/presentation/page/tender-suppliers.mail.internal.ts',
  'src/app/features/settings/presentation/user-access-control/presenter/user-access-control.component.presenter.core.ts'
]);

const LEGACY_HELPER_ALLOWLIST = new Set([
  'src/app/features/settings/presentation/user-access-control/helpers/user-access-control.profile-crud.helper.ts'
]);

function isComponentOrInternalUnit(filePath) {
  if (/\.spec\.ts$/i.test(filePath)) {
    return false;
  }
  return /(^|\/)[^/]*\.(component|presenter|internal|logic|core|base|impl|utility)(\.[^.]+)*\.ts$/i.test(
    filePath
  );
}

function isHelperUnit(filePath) {
  return /(^|\/)[^/]*\.helper(\.[^.]+)*\.ts$/i.test(filePath);
}

module.exports = {
  HARD_LINE_LIMIT,
  COMPONENT_INTERNAL_THRESHOLD,
  MAX_COMPONENT_INTERNAL_THRESHOLD_BREACHES,
  HELPER_THRESHOLD,
  MAX_LARGE_HELPER_FILES,
  LEGACY_HARD_LIMIT_ALLOWLIST,
  LEGACY_COMPONENT_INTERNAL_ALLOWLIST,
  LEGACY_HELPER_ALLOWLIST,
  isComponentOrInternalUnit,
  isHelperUnit
};
