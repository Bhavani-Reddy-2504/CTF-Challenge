import { ConfigValidationError, Environment } from './config.js';

export const ALLOWED_ENVIRONMENTS = Object.freeze(['production', 'development', 'test'] as const);

export type AllowedEnvironment = (typeof ALLOWED_ENVIRONMENTS)[number];

export interface EnvironmentValidationResult {
  readonly valid: boolean;
  readonly environment: AllowedEnvironment;
  readonly errors: readonly string[];
}

/**
 * Validates the environment string strictly against allowed production, development, or test values.
 * Rejects undefined variations like 'staging', 'qa', 'dev', 'local' to ensure deterministic operational behavior.
 */
export function validateEnvironment(envCandidate?: string): AllowedEnvironment {
  const normalized = (envCandidate ?? process.env.NODE_ENV ?? 'production').toLowerCase().trim();

  if (!ALLOWED_ENVIRONMENTS.includes(normalized as AllowedEnvironment)) {
    throw new ConfigValidationError(
      `Invalid operational environment '${normalized}'. Allowed environments are: ${ALLOWED_ENVIRONMENTS.join(', ')}.`
    );
  }

  return normalized as AllowedEnvironment;
}

/**
 * Validates a network port number.
 * Enforces ports between 1 and 65535 in production and development.
 * Strictly restricts port 0 (ephemeral OS assignment) to test environments.
 */
export function validatePort(portCandidate: number | string | undefined, environment: Environment): number {
  const rawPort = portCandidate ?? process.env.PORT ?? 8080;
  const str = String(rawPort).trim();
  if (!/^-?\d+$/.test(str) && typeof rawPort !== 'number') {
    throw new ConfigValidationError(`Invalid port '${rawPort}'. Port must be a numeric integer.`);
  }

  const port = typeof rawPort === 'number' ? (portCandidate as number) : parseInt(str, 10);

  const minPort = environment === 'test' ? 0 : 1;
  if (isNaN(port) || port < minPort || port > 65535) {
    throw new ConfigValidationError(
      `Invalid port '${rawPort}'. Port must be an integer between ${minPort} and 65535.`
    );
  }

  return port;
}

/**
 * Validates network bind host.
 * Defaults to 0.0.0.0 in production for container/edge deployment, or 127.0.0.1 for local isolation.
 */
export function validateHost(hostCandidate: string | undefined, environment: Environment): string {
  const defaultHost = environment === 'production' ? '0.0.0.0' : '127.0.0.1';
  const host = (hostCandidate ?? process.env.HOST ?? defaultHost).trim();

  if (!host || host.length > 255 || /[^\w.-]/.test(host)) {
    throw new ConfigValidationError(`Invalid host configuration '${host}'. Must be a valid hostname or IP address.`);
  }

  return host;
}

/**
 * Validates that all required production secrets are configured in the environment.
 * Refuses to allow server launch in production if ENCLAVE_FLAG is missing or empty.
 */
export function validateProductionFlags(environment: AllowedEnvironment): void {
  if (environment === 'production') {
    const flag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (typeof flag !== 'string' || flag.trim().length === 0) {
      throw new ConfigValidationError(
        'Required production secret ENCLAVE_FLAG is missing. The server cannot start in production mode without ENCLAVE_FLAG.'
      );
    }
  }
}

/**
 * Ensures that sensitive keys or environment variables are not serialized into client or API responses.
 */
export function sanitizeConfigForInspection<T extends Record<string, unknown>>(config: T): Record<string, unknown> {
  const FORBIDDEN_CONFIG_PATTERNS = [
    /^env$/i,
    /process\.?env/i,
    /secret/i,
    /key/i,
    /token/i,
    /password/i,
    /flag/i,
    /preimage/i,
    /credential/i,
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    const isSensitive = FORBIDDEN_CONFIG_PATTERNS.some((pattern) => pattern.test(k));
    if (!isSensitive) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        sanitized[k] = sanitizeConfigForInspection(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }
  }

  return Object.freeze(sanitized);
}
