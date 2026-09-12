export type Environment = 'production' | 'development' | 'test';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type SameSiteSetting = 'Strict' | 'Lax' | 'None';

export interface CookieConfig {
  readonly name: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: SameSiteSetting;
  readonly path: string;
}

export interface AppConfig {
  readonly environment: Environment;
  readonly applicationMode: string;
  readonly host: string;
  /** HTTPS listening port (default: 8443 in dev, 443 in production). */
  readonly port: number;
  /** HTTP redirect server port (0 = disabled). Default: 8080 in dev, 80 in production. */
  readonly httpRedirectPort: number;
  /** Path to PEM certificate file. Required in production; auto-generated in dev. */
  readonly tlsCertPath: string | undefined;
  /** Path to PEM private key file. Required in production; auto-generated in dev. */
  readonly tlsKeyPath: string | undefined;
  /** Minimum TLS version accepted. Default: 'TLSv1.2'. */
  readonly tlsMinVersion: 'TLSv1.2' | 'TLSv1.3';
  readonly sessionLifetimeMs: number;
  readonly sessionCleanupIntervalMs: number;
  readonly maxActiveSessions: number;
  readonly maxRequestBodyBytes: number;
  readonly logLevel: LogLevel;
  readonly cookie: CookieConfig;
}

export interface ConfigInput {
  environment?: string;
  applicationMode?: string;
  host?: string;
  /** HTTPS port override (env: HTTPS_PORT). */
  port?: number | string;
  /** HTTP redirect port override (env: HTTP_REDIRECT_PORT). Set to 0 to disable. */
  httpRedirectPort?: number | string;
  /** Path to PEM cert (env: TLS_CERT_PATH). Production required; dev auto-generated. */
  tlsCertPath?: string;
  /** Path to PEM key (env: TLS_KEY_PATH). Production required; dev auto-generated. */
  tlsKeyPath?: string;
  /** Minimum TLS version (env: TLS_MIN_VERSION). Default 'TLSv1.2'. */
  tlsMinVersion?: string;
  sessionLifetimeMs?: number | string;
  sessionCleanupIntervalMs?: number | string;
  maxActiveSessions?: number | string;
  maxRequestBodyBytes?: number | string;
  logLevel?: string;
  cookieSecure?: boolean | string;
  cookieSameSite?: string;
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(`Configuration Error: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

export function validateAndBuildConfig(input: ConfigInput = {}): AppConfig {
  // 1. Environment validation
  const rawEnv = (input.environment ?? process.env.NODE_ENV ?? 'production').toLowerCase().trim();
  if (rawEnv !== 'production' && rawEnv !== 'development' && rawEnv !== 'test') {
    throw new ConfigValidationError(`Invalid environment '${rawEnv}'. Must be 'production', 'development', or 'test'.`);
  }
  const environment: Environment = rawEnv as Environment;

  // 2. HTTPS port validation (port 0 allowed in test for dynamic OS port allocation)
  const rawPort = input.port ?? process.env.HTTPS_PORT ?? process.env.PORT ?? (environment === 'production' ? 443 : 8443);
  const port = typeof rawPort === 'number' ? rawPort : parseInt(String(rawPort), 10);
  const minPort = environment === 'test' ? 0 : 1;
  if (isNaN(port) || port < minPort || port > 65535) {
    throw new ConfigValidationError(`Invalid HTTPS port '${rawPort}'. Port must be an integer between ${minPort} and 65535.`);
  }

  // 2b. HTTP redirect port (0 = disabled, e.g. when behind a TLS-terminating proxy)
  const rawRedirectPort = input.httpRedirectPort ?? process.env.HTTP_REDIRECT_PORT ?? (environment === 'production' ? 80 : 8080);
  const httpRedirectPort = typeof rawRedirectPort === 'number' ? rawRedirectPort : parseInt(String(rawRedirectPort), 10);
  if (isNaN(httpRedirectPort) || httpRedirectPort < 0 || httpRedirectPort > 65535) {
    throw new ConfigValidationError(`Invalid HTTP redirect port '${rawRedirectPort}'. Must be 0–65535.`);
  }

  // 2c. TLS certificate paths (optional in dev/test; required in production)
  const tlsCertPath = input.tlsCertPath ?? process.env.TLS_CERT_PATH ?? undefined;
  const tlsKeyPath = input.tlsKeyPath ?? process.env.TLS_KEY_PATH ?? undefined;

  // 2d. TLS minimum version
  const rawTlsMin = (input.tlsMinVersion ?? process.env.TLS_MIN_VERSION ?? 'TLSv1.2').trim();
  if (rawTlsMin !== 'TLSv1.2' && rawTlsMin !== 'TLSv1.3') {
    throw new ConfigValidationError(`Invalid tlsMinVersion '${rawTlsMin}'. Must be 'TLSv1.2' or 'TLSv1.3'.`);
  }
  const tlsMinVersion = rawTlsMin as 'TLSv1.2' | 'TLSv1.3';

  // 3. Host validation
  const host = input.host ?? process.env.HOST ?? (environment === 'production' ? '0.0.0.0' : '127.0.0.1');
  if (typeof host !== 'string' || host.trim().length === 0 || host.length > 255) {
    throw new ConfigValidationError('Invalid host configuration.');
  }

  // 4. Session lifetime validation
  const rawLifetime = input.sessionLifetimeMs ?? process.env.SESSION_LIFETIME_MS ?? 7200000; // 2 hours default
  const sessionLifetimeMs = typeof rawLifetime === 'number' ? rawLifetime : parseInt(rawLifetime, 10);
  if (isNaN(sessionLifetimeMs) || sessionLifetimeMs < 60000 || sessionLifetimeMs > 86400000) {
    throw new ConfigValidationError(
      `Invalid sessionLifetimeMs '${rawLifetime}'. Must be between 60,000 ms (1m) and 86,400,000 ms (24h).`
    );
  }

  // 5. Session cleanup interval validation
  const rawCleanup = input.sessionCleanupIntervalMs ?? process.env.SESSION_CLEANUP_INTERVAL_MS ?? 60000; // 1 min default
  const sessionCleanupIntervalMs = typeof rawCleanup === 'number' ? rawCleanup : parseInt(rawCleanup, 10);
  if (isNaN(sessionCleanupIntervalMs) || sessionCleanupIntervalMs < 5000 || sessionCleanupIntervalMs > 3600000) {
    throw new ConfigValidationError(
      `Invalid sessionCleanupIntervalMs '${rawCleanup}'. Must be between 5,000 ms (5s) and 3,600,000 ms (1h).`
    );
  }

  // 6. Max active sessions
  const rawMaxSessions = input.maxActiveSessions ?? process.env.MAX_ACTIVE_SESSIONS ?? 5000;
  const maxActiveSessions = typeof rawMaxSessions === 'number' ? rawMaxSessions : parseInt(rawMaxSessions, 10);
  if (isNaN(maxActiveSessions) || maxActiveSessions < 10 || maxActiveSessions > 50000) {
    throw new ConfigValidationError('Invalid maxActiveSessions. Must be between 10 and 50,000.');
  }

  // 7. Max request body bytes
  const rawMaxBytes = input.maxRequestBodyBytes ?? process.env.MAX_REQUEST_BODY_BYTES ?? 65536; // 64KB default
  const maxRequestBodyBytes = typeof rawMaxBytes === 'number' ? rawMaxBytes : parseInt(rawMaxBytes, 10);
  if (isNaN(maxRequestBodyBytes) || maxRequestBodyBytes < 512 || maxRequestBodyBytes > 10485760) {
    throw new ConfigValidationError('Invalid maxRequestBodyBytes. Must be between 512 B and 10 MB.');
  }

  // 8. Log level validation
  const rawLogLevel = (input.logLevel ?? process.env.LOG_LEVEL ?? 'info').toLowerCase().trim();
  if (rawLogLevel !== 'debug' && rawLogLevel !== 'info' && rawLogLevel !== 'warn' && rawLogLevel !== 'error') {
    throw new ConfigValidationError(`Invalid logLevel '${rawLogLevel}'. Must be 'debug', 'info', 'warn', or 'error'.`);
  }
  const logLevel: LogLevel = rawLogLevel as LogLevel;

  // 9. Cookie security — HTTPS is now always on, so Secure cookies are always safe
  // except in test (where the test runner may hit HTTP directly without TLS).
  let cookieSecure = true;
  if (input.cookieSecure !== undefined) {
    cookieSecure = input.cookieSecure === true || input.cookieSecure === 'true';
  } else if (process.env.COOKIE_SECURE !== undefined) {
    cookieSecure = process.env.COOKIE_SECURE === 'true';
  } else if (environment === 'test') {
    // Test environment may not have TLS active, allow insecure cookies there only
    cookieSecure = false;
  }
  // In development, we now serve HTTPS (self-signed cert), so Secure cookies work fine.

  // Critical security check: Never allow insecure cookies in production
  if (environment === 'production' && !cookieSecure) {
    throw new ConfigValidationError('Insecure cookies (cookie.secure = false) are strictly forbidden in production mode.');
  }

  const rawSameSite = (input.cookieSameSite ?? process.env.COOKIE_SAME_SITE ?? 'Strict').trim();
  if (rawSameSite !== 'Strict' && rawSameSite !== 'Lax' && rawSameSite !== 'None') {
    throw new ConfigValidationError(`Invalid cookieSameSite '${rawSameSite}'. Must be 'Strict', 'Lax', or 'None'.`);
  }
  const sameSite: SameSiteSetting = rawSameSite as SameSiteSetting;

  return Object.freeze({
    environment,
    applicationMode: input.applicationMode ?? process.env.APP_MODE ?? 'standard',
    host,
    port,
    httpRedirectPort,
    tlsCertPath,
    tlsKeyPath,
    tlsMinVersion,
    sessionLifetimeMs,
    sessionCleanupIntervalMs,
    maxActiveSessions,
    maxRequestBodyBytes,
    logLevel,
    cookie: Object.freeze({
      name: 'strata_session',
      httpOnly: true, // Always true, not configurable to prevent XSS session theft
      secure: cookieSecure,
      sameSite,
      path: '/',
    }),
  });
}
