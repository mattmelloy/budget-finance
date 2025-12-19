/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Add VITE_ prefixed environment variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
