/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ANTMEDIA_URL: string;
  readonly VITE_ANTMEDIA_WS_URL: string;
  readonly VITE_ANTMEDIA_APP: string;
  readonly VITE_TURN_URL: string;
  readonly VITE_TURN_USERNAME: string;
  readonly VITE_TURN_PASSWORD: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
