import { describe, expect, it } from 'vitest';

import {
  readProjectNotificationRouteIntent,
  resolveProjectNotificationFocus
} from './tender-projects.notification-route.helper';

describe('tender-projects.notification-route.helper', () => {
  it('opens project details when a backend link only carries projectId', () => {
    expect(
      readProjectNotificationRouteIntent({
        panel: null,
        projectId: '42'
      })
    ).toEqual({
      panel: 'details',
      projectId: 42,
      section: null,
      commentId: null,
      checklistId: null
    });
  });

  it('maps comment links to the activity section', () => {
    const intent = readProjectNotificationRouteIntent({
      panel: null,
      projectId: '42',
      commentId: '9'
    });

    expect(resolveProjectNotificationFocus(intent)).toEqual({
      section: 'activity',
      commentId: 9,
      checklistId: null
    });
  });

  it('maps checklist links to the checklist section', () => {
    const intent = readProjectNotificationRouteIntent({
      panel: 'details',
      projectId: '42',
      checklistId: '17'
    });

    expect(resolveProjectNotificationFocus(intent)).toEqual({
      section: 'checklists',
      commentId: null,
      checklistId: 17
    });
  });
});
