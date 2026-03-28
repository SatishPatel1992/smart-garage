/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production API origin, e.g. https://api.example.com — baked in at build time */
  readonly VITE_API_URL?: string;
  /** Local dev: Vite proxy target for /api (default http://localhost:3000) */
  readonly VITE_DEV_API_URL?: string;
}
