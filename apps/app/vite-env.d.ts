/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" when the bundle is built for a self hosted instance. */
  readonly VITE_SELF_HOSTED?: string;
}

/**
 * Instance specific settings of a self hosted instance, injected into the index document by the backend.
 *
 * Not part of the bundle, so the published images stay independent of the domain they run on.
 */
interface VemetricRuntimeConfig {
  /** Absolute origin of the dashboard, e.g. https://app.example.com. */
  readonly appOrigin?: string;
  /** Absolute origin of the event ingestion endpoint. */
  readonly hubOrigin?: string;
  /** Absolute origin of the bare domain. Falls back to appOrigin when absent. */
  readonly rootOrigin?: string;
  /** Social login providers configured on the instance. Absent or empty means none is offered. */
  readonly socialProviders?: readonly string[];
}

interface Window {
  /** Present only on self hosted instances, injected by the backend before the bundle runs. */
  __VEMETRIC_RUNTIME_CONFIG__?: VemetricRuntimeConfig;
}
