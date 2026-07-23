export const TENDER_PROJECTS_ENDPOINTS = {
  projects: 'projects',
  bootstrap: 'projects/bootstrap',
  filterOptions: 'projects/filter-options',
  aggregates: 'projects/aggregates',
  projectPeopleSettings: (scope: 'assignTo' | 'inCharge') => `project-people-settings/${scope}`,
  projectPeopleSettingById: (scope: 'assignTo' | 'inCharge', id: number) =>
    `project-people-settings/${scope}/${id}`,
  projectById: (projectId: number) => `projects/${projectId}`,
  projectAssignment: (projectId: number) => `projects/${projectId}/assignment`,
  projectActivity: (projectId: number) => `projects/${projectId}/activity`,
  projectChecklists: (projectId: number) => `projects/${projectId}/checklists`,
  projectChecklistById: (projectId: number, checklistId: number) =>
    `projects/${projectId}/checklists/${checklistId}`,
  projectChecklistToggle: (projectId: number, checklistId: number) =>
    `projects/${projectId}/checklists/${checklistId}/toggle`,
  projectComments: (projectId: number) => `projects/${projectId}/comments`
} as const;
