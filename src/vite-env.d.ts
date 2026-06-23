/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DASHBOARD_DATA_SOURCE?: string;
  readonly VITE_ENABLE_MOCKS?: string;
  readonly VITE_MOCK_LATENCY?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
