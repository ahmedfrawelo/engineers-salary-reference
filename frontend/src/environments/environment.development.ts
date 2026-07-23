/**
 * Development environment configuration.
 * Uses the dev proxy by default. Set to the full backend URL to bypass the proxy.
 */
export const environment = {
  production: false,
  // The local dev proxy forwards /api to the public Worker API, avoiding browser CORS.
  API_BASE_URL: '/api',
  authHeaderScheme: 'bearer',

  useMock: false,
  useMockAuth: false,
  autoLoginMockUser: false,
  // Keep route and menu access open locally while the bootstrap build has no user session.
  bypassPermissionsInDevelopment: true,
  mockAuthUser: {
    id: 'dev-mock',
    email: 'dev@engineers-salary-reference.local',
    password: 'dev-password',
    name: 'ENGINEERS_SALARY_REFERENCE Dev',
    roles: ['Admin'],
    permissions: [],
    remember: false
  },

  // Legacy supplier-connections compatibility flags. The active Tender Suppliers page now
  // uses TenderSuppliersPageApi for bootstrap/list/details/filter-options and does not rely
  // on the old client-side full-loading path.
  preferLegacySupplierConnections: false,
  allowLegacySupplierConnectionsFallback: false,
  materialCategoriesResource: 'material-categories',
  materialCategoriesFallbackResource: 'material-categories',
  enableSupplierConnectionsDetailsEndpoint: false,
  useSupplierConnectionsDatasource: false,
  supplierConnectionsUseServerPagination: false,
  supplierConnectionsEntryStageSize: 300,
  supplierConnectionsClientTarget: Number.MAX_SAFE_INTEGER,
  autoFetchSupplierReferenceData: false,
  supplierConnectionsParallelLoading: true,
  supplierConnectionsParallelBatchSize: 10,
  supplierConnectionsParallelMaxPages: 500,
  supplierConnectionsLoadTimeoutMs: 180000,
  supplierConnectionsCacheEnabled: true,
  supplierConnectionsCacheTtlMs: 5 * 60 * 1000,
  supplierConnectionsPersistentCacheEnabled: false,
  supplierConnectionsPersistentCacheTtlMs: 30 * 60 * 1000,
  supplierConnectionsHardLimitPages: 2000,

  version: '1.0.0-dev',
  enableDebugLogs: true,

  security: {
    requireHttps: false,
    tokenExpirationHours: 24,
    enableCsrfProtection: false,
    useCookieAuth: false,
    allowSelfRegistration: true,
    deleteProtection: {
      enabled: true,
      headerName: 'X-Delete-Code',
      promptMessage:
        'This action permanently deletes data. Enter the authorized delete code to continue.'
    }
  },

  http: {
    timeout: 120000, // Increased to 2 minutes for slow backend queries
    retries: 3,
    withCredentials: false
  },

  notifications: {
    listPath: 'Notifications/query',
    queryPath: 'Notifications/query',
    detailPath: 'Notifications/:id',
    markReadPath: 'Notifications/:id/read',
    markUnreadPath: 'Notifications/:id/unread',
    markAllReadPath: 'Notifications/read-all',
    markAllUnreadPath: 'Notifications/unread-all',
    statsPath: 'Notifications/stats',
    unreadCountPath: 'Notifications/unread-count',
    archivePath: 'Notifications/:id/archive',
    unarchivePath: 'Notifications/:id/unarchive',
    archiveReadPath: 'Notifications/archive-read',
    deletePath: 'Notifications/:id',
    deleteArchivedPath: 'Notifications/archived',
    wsPath: '/ws',
    wsUrl: '',
    wsEnabled: true,
    wsTokenParam: 'access_token',
    fetchOnInit: true,
    maxInitial: 20,
    defaultPageSize: 20
  },

  analytics: {
    enabled: false,
    trackingId: ''
  },

  featureFlags: {
    'offline-mode': true
  }
};
