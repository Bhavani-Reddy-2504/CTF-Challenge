import { AppConfig, ConfigInput, validateAndBuildConfig } from './config.js';
import {
  sanitizeConfigForInspection,
  validateEnvironment,
  validateHost,
  validatePort,
  validateProductionFlags,
} from './environment-validator.js';

export interface RuntimeConfig extends AppConfig {
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly isDevelopment: boolean;
  readonly shutdownTimeoutMs: number;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds default draining timeout

/**
 * Loads, validates, and builds a frozen RuntimeConfig for production operations.
 * Enforces production-mode safeguards and provides helper flags.
 */
export function loadRuntimeConfig(overrides: ConfigInput = {}): RuntimeConfig {
  const baseConfig = validateAndBuildConfig(overrides);

  // Re-verify with explicit environment validator
  const env = validateEnvironment(baseConfig.environment);
  validateProductionFlags(env);
  const host = validateHost(baseConfig.host, env);
  const port = validatePort(baseConfig.port, env);

  const isProduction = env === 'production';
  const isTest = env === 'test';
  const isDevelopment = env === 'development';

  const rawTimeout = process.env.SHUTDOWN_TIMEOUT_MS;
  const parsedTimeout = rawTimeout ? parseInt(rawTimeout, 10) : DEFAULT_SHUTDOWN_TIMEOUT_MS;
  const shutdownTimeoutMs = isNaN(parsedTimeout) || parsedTimeout < 1000 ? DEFAULT_SHUTDOWN_TIMEOUT_MS : parsedTimeout;

  const runtimeConfig: RuntimeConfig = {
    ...baseConfig,
    environment: env,
    host,
    port,
    isProduction,
    isTest,
    isDevelopment,
    shutdownTimeoutMs,
  };

  return Object.freeze(runtimeConfig);
}

/**
 * Returns a sanitized copy of runtime configuration safe for diagnostic inspection without exposing environment variables.
 */
export function getSafeRuntimeConfig(config: RuntimeConfig): Record<string, unknown> {
  return sanitizeConfigForInspection({
    environment: config.environment,
    host: config.host,
    port: config.port,
    sessionLifetimeMs: config.sessionLifetimeMs,
    maxActiveSessions: config.maxActiveSessions,
    maxRequestBodyBytes: config.maxRequestBodyBytes,
    isProduction: config.isProduction,
    isTest: config.isTest,
  });
}
