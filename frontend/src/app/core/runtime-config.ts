type LooseValue = ReturnType<typeof JSON.parse>;
export type RuntimeConfig = {
  apiBaseUrl?: string;
  withCredentials?: boolean;
  timeoutMs?: number;
  retries?: number;
  useMock?: boolean;
  useCookieAuth?: boolean;
  allowSelfRegistration?: boolean;
  googleAuth?: {
    enabled?: boolean;
    loginPath?: string;
    signupPath?: string;
    callbackUrl?: string;
  };
  /**
   * Optional override for bearer token when using external auth providers
   * (e.g., Azure B2C / MSAL). If provided, ApiClient/AuthService will use it.
   */
  bearerToken?: string;
  accessToken?: string;
  deleteProtection?: {
    enabled?: boolean;
    headerName?: string;
    promptMessage?: string;
  };
  featureFlags?: Record<string, unknown> | Array<Record<string, unknown>>;
  notifications?: {
    apiBaseUrl?: string;
    listPath?: string;
    queryPath?: string;
    detailPath?: string;
    markReadPath?: string;
    markUnreadPath?: string;
    markAllReadPath?: string;
    markAllUnreadPath?: string;
    statsPath?: string;
    unreadCountPath?: string;
    archivePath?: string;
    unarchivePath?: string;
    archiveReadPath?: string;
    deletePath?: string;
    deleteArchivedPath?: string;
    wsUrl?: string;
    wsPath?: string;
    wsEnabled?: boolean;
    wsTokenParam?: string;
    fetchOnInit?: boolean;
    maxInitial?: number;
    defaultPageSize?: number;
  };
};

export const runtimeConfig = (): RuntimeConfig => {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = (window as LooseValue).__ENGINEERS_SALARY_REFERENCE_RUNTIME_CONFIG__;
  return raw && typeof raw === 'object' ? (raw as RuntimeConfig) : {};
};
