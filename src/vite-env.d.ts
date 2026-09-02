/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "*.json" {
  const value: { version: string; [key: string]: unknown };
  export default value;
}
