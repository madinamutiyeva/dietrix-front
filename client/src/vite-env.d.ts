/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute base URL of the backend, e.g. `https://api.dietrix.app`.
   * Leave empty in dev to use the Vite proxy on `/api`.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

