/**
 * Production environment configuration.
 * Replace `API_BASE_URL` with the public endpoint of your VPS backend before deploying.
 * You can override these values at runtime by defining `window.__ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__`
 * in a script that you host alongside the build (see ApiClient for the supported keys).
 */
export const environment = {
  production: true,
  // The uploaded VPS build is often deployed as static files only, without the local dev proxy
  // or the repo nginx reverse-proxy rules. Calling the backend directly keeps production aligned
  // with the remote backend used by local `proxy.remote.conf.json`.
  API_BASE_URL: '',
  authHeaderScheme: 'bearer',

  useMock: false,
  useMockAuth: false, // Connect to real backend in production
  autoLoginMockUser: false,
  bypassPermissionsInDevelopment: false,
  mockAuthUser: {
    id: 'auto-mock',
    email: 'demo@engineers-salary-reference.app',
    password: 'demo-password',
    name: 'ENGINEERS_SALARY_REFERENCE Demo',
    roles: ['Admin'],
    permissions: [],
    remember: true
  },

  // ── Supplier connections flags ────────────────────────────────────────────
  // The Tender Suppliers page is server-driven via TenderSuppliersPageApi
  // (bootstrap / list / filter-options / details). The old client-side
  // full-load path is disabled. Flags marked DEAD are kept only so legacy
  // code paths that still reference them do not throw at import time.
  //
  // DEAD (legacy client-side load path — never re-enable):
  preferLegacySupplierConnections: false,
  allowLegacySupplierConnectionsFallback: false,
  enableSupplierConnectionsDetailsEndpoint: false,
  useSupplierConnectionsDatasource: false,
  supplierConnectionsUseServerPagination: false,
  autoFetchSupplierReferenceData: false,
  supplierConnectionsPersistentCacheEnabled: false,
  supplierConnectionsPersistentCacheTtlMs: 5 * 60 * 1000,
  //
  // ACTIVE (used by connection detail/edit panels — do not remove):
  supplierConnectionsParallelLoading: true,
  supplierConnectionsParallelBatchSize: 10,
  supplierConnectionsParallelMaxPages: 500,
  supplierConnectionsEntryStageSize: 300,
  supplierConnectionsClientTarget: Number.MAX_SAFE_INTEGER,
  supplierConnectionsLoadTimeoutMs: 30000,
  supplierConnectionsCacheEnabled: true,
  supplierConnectionsCacheTtlMs: 2 * 60 * 1000,
  supplierConnectionsHardLimitPages: 2000,
  // ── Supplier material category resource path overrides ─────────────────────────────────────
  materialCategoriesResource: 'material-categories',
  materialCategoriesFallbackResource: 'material-categories',

  version: '1.0.0',
  enableDebugLogs: false,

  security: {
    requireHttps: true,
    tokenExpirationHours: 24,
    enableCsrfProtection: true,
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
    timeout: 60000,
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

  // Analytics Configuration
  analytics: {
    enabled: false,
    trackingId: '' // Set your GA4 tracking ID before release or via runtime config.
  },

  featureFlags: {
    'offline-mode': true
  },

  // i18n Configuration
  i18n: {
    enabled: true,
    defaultLanguage: 'ar',
    supportedLanguages: ['ar', 'en']
  }
};
