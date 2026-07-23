/**
 * Test environment configuration.
 * Mirrors development settings but disables debug logs.
 */
export const environment = {
  production: false,
  // Use '/api' to route through proxy.conf.json during local development.
  API_BASE_URL: '/api',
  authHeaderScheme: 'bearer',

  useMock: false,
  useMockAuth: false,
  autoLoginMockUser: false,
  bypassPermissionsInDevelopment: false,
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

  version: '1.0.0-test',
  enableDebugLogs: false,

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
    listPath: 'Notifications',
    markReadPath: 'Notifications/:id/read',
    markAllReadPath: 'Notifications/read-all',
    wsPath: '/ws',
    wsUrl: '',
    wsEnabled: true,
    wsTokenParam: 'access_token',
    fetchOnInit: true,
    maxInitial: 20
  },

  analytics: {
    enabled: false,
    trackingId: ''
  },

  featureFlags: {
    'offline-mode': true
  }
};
