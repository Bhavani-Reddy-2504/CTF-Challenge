import { IncomingMessage, ServerResponse, createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer, Server } from 'node:https';
import { SecureContextOptions } from 'node:tls';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AppConfig } from '../config/config.js';
import { RequestContext } from '../context/request-context.js';
import { ChallengeEngine } from '../engine/challenge-engine.js';
import {
  BadRequestError,
  MethodNotAllowedError,
  NotFoundError,
  RateLimitExceededError,
  UnauthorizedError,
} from '../errors/app-error.js';
import { formatPublicError } from '../errors/error-handler.js';
import { Logger, rootLogger } from '../logging/logger.js';
import { parseSimRoute } from '../router/sim-parser.js';
import { parseSessionCookie, serializeClearSessionCookie, serializeSessionCookie } from '../session/session-cookie.js';
import { isValidSessionId } from '../session/session-id.js';
import { SessionStore } from '../session/session-store.js';
import { InMemoryRateLimiter } from './rate-limiter.js';
import type { TlsCredentials } from './tls-utils.js';

export type ServerLifecycleState = 'STARTING' | 'READY' | 'DRAINING' | 'STOPPED';

/**
 * Normalizes an IPv4-mapped IPv6 address to a plain IPv4 address.
 * e.g. "::ffff:127.0.0.1" → "127.0.0.1"
 * This prevents the same IPv4 client from having two different rate-limiter keys.
 */
function normalizeClientIp(raw: string): string {
  if (raw.startsWith('::ffff:')) {
    return raw.slice(7);
  }
  return raw;
}

export class HttpServer {
  private readonly config: AppConfig;
  private readonly sessionStore: SessionStore;
  private readonly engine: ChallengeEngine;
  private readonly logger: Logger;
  private readonly tlsCredentials: TlsCredentials | undefined;
  public readonly rateLimiter: InMemoryRateLimiter;
  private server?: Server | ReturnType<typeof createHttpServer>;
  private state: ServerLifecycleState = 'STARTING';

  constructor(options: {
    config: AppConfig;
    sessionStore: SessionStore;
    engine: ChallengeEngine;
    /**
     * TLS credentials for HTTPS. Required for dev/production.
     * May be undefined only in test environment (plain HTTP is used there).
     */
    tlsCredentials?: TlsCredentials;
    logger?: Logger;
  }) {
    this.config = options.config;
    this.sessionStore = options.sessionStore;
    this.engine = options.engine;
    this.tlsCredentials = options.tlsCredentials;
    this.logger = options.logger ?? rootLogger;
    this.rateLimiter = new InMemoryRateLimiter();
  }

  /**
   * Applies mandatory hardened security headers to every HTTPS response.
   * Security hardening applied:
   *  - HSTS with preload — forces HTTPS permanently and enables browser preload lists
   *  - CSP with upgrade-insecure-requests — forces browser to upgrade subresource fetches
   *  - Alt-Svc: clear — prevents alt-svc protocol downgrade attacks
   *  - Server header suppressed to hide platform info
   *  - X-Powered-By cleared
   *  - Vary: * prevents intermediate cache poisoning on API responses
   */
  private applySecurityHeaders(res: ServerResponse): void {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // HSTS with preload — max-age=1yr, include subdomains, submit to HSTS preload list
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // Alt-Svc: clear — tells clients not to use HTTP/3 alt-svc records (prevents downgrade)
    res.setHeader('Alt-Svc', 'clear');
    // Suppress server fingerprinting headers completely — emit nothing
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');
    // Prevent cache poisoning on all responses
    res.setHeader('Vary', '*');
  }

  /**
   * Sends a standardized JSON response.
   */
  private sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
    this.applySecurityHeaders(res);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }

  /**
   * Primary HTTP request dispatcher with comprehensive security hardening.
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Security fix: use crypto.randomBytes instead of Math.random() for correlation IDs
    const correlationId = `req_${Date.now()}_${randomBytes(6).toString('hex')}`;

    // Decouple from untrusted Host header to prevent Host header injection
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const method = req.method ?? 'GET';
    // Security fix: normalize IP to prevent IPv4-mapped IPv6 bypass of rate limits
    const clientIp = normalizeClientIp(req.socket.remoteAddress ?? '127.0.0.1');

    try {
      // 1. Enforce global HTTP Method Whitelist
      const ALLOWED_GLOBAL_METHODS = new Set(['GET', 'POST', 'HEAD', 'OPTIONS']);
      if (!ALLOWED_GLOBAL_METHODS.has(method)) {
        this.applySecurityHeaders(res);
        res.setHeader('Allow', 'GET, POST');
        throw new MethodNotAllowedError(`HTTP method '${method}' is not permitted.`);
      }

      // Handle OPTIONS preflight / discovery safely
      if (method === 'OPTIONS') {
        this.applySecurityHeaders(res);
        res.setHeader('Allow', 'GET, POST, OPTIONS, HEAD');
        res.writeHead(204);
        res.end();
        return;
      }

      // Security fix: Global per-IP rate limit (500 req/min) across ALL endpoints
      // Prevents an attacker from bypassing per-endpoint limits via flooding
      if (!this.rateLimiter.isAllowed(`global:${clientIp}`, 500, 60000)) {
        throw new RateLimitExceededError('Request rate limit exceeded. Please slow down.');
      }

      // 2. Strict Session Resolution and Validation
      // Security fix: REMOVED X-Session-Id header fallback entirely.
      // Only cookie-based sessions are accepted to prevent session fixation attacks
      // where an attacker crafts a custom session ID header.
      const rawCookie = req.headers.cookie;
      const candidateSessionId = parseSessionCookie(rawCookie, this.config.cookie.name);

      // Only query store if session ID conforms strictly to format (rejects traversal, null bytes, long strings)
      const sessionId = candidateSessionId && isValidSessionId(candidateSessionId) ? candidateSessionId : undefined;
      const session = sessionId ? this.sessionStore.getSession(sessionId) : undefined;

      // 3. Build request context
      const context = new RequestContext({
        correlationId,
        session,
        metadata: {
          method,
          path: pathname,
          clientIp,
        },
      });
      // Check server draining state
      if (this.state === 'DRAINING' && pathname === '/api/v1/session/init') {
        this.sendJson(res, 503, {
          status: 'error',
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is currently unavailable. Please try again later.',
          correlation_id: correlationId,
        });
        return;
      }

      // Explicitly reject environment / debug / admin probing endpoints
      if (
        pathname === '/env' ||
        pathname === '/config' ||
        pathname === '/debug' ||
        pathname === '/server-info'
      ) {
        throw new NotFoundError('Endpoint does not exist.');
      }

      // 4. Static Player Runtime Interface (GET / HEAD only)
      if (pathname === '/' || pathname === '/index.html') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          throw new MethodNotAllowedError('Only GET is allowed for index.');
        }
        return await this.serveStaticFile(req, res, 'index.html', 'text/html; charset=utf-8');
      }

      if (pathname === '/index.css' || pathname === '/static/index.css') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          throw new MethodNotAllowedError('Only GET is allowed for stylesheets.');
        }
        return await this.serveStaticFile(req, res, 'index.css', 'text/css; charset=utf-8');
      }

      if (pathname === '/app.js' || pathname === '/static/app.js') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          throw new MethodNotAllowedError('Only GET is allowed for scripts.');
        }
        return await this.serveStaticFile(req, res, 'app.js', 'application/javascript; charset=utf-8');
      }

      // 5. Health & Readiness Probes (GET / HEAD only)
      if (pathname === '/health' || pathname === '/health/live') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          throw new MethodNotAllowedError('Only GET is allowed for liveness probe.');
        }
        return this.handleLiveness(req, res, pathname === '/health');
      }

      if (pathname === '/ready' || pathname === '/health/ready') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          throw new MethodNotAllowedError('Only GET is allowed for readiness probe.');
        }
        return this.handleReadiness(req, res, pathname === '/ready');
      }

      // 6. Session Management Lifecycle APIs
      if (pathname === '/api/v1/session/init') {
        if (method !== 'POST') {
          res.setHeader('Allow', 'POST');
          throw new MethodNotAllowedError('Only POST is allowed for session initialization.');
        }
        const contentType = req.headers['content-type'];
        if (contentType && contentType.toLowerCase().includes('application/json')) {
          // Security fix: strict 1KB cap on session init body (was effectively uncapped before)
          await this.readJsonBody(req, 1024);
        }
        // Security fix: dropped from 30 to 5 sessions/min per IP
        // Prevents memory exhaustion via session flooding attacks
        if (!this.rateLimiter.isAllowed(`init:${clientIp}`, 5, 60000)) {
          throw new RateLimitExceededError('Too many session initialization requests. Please wait.');
        }
        return this.handleSessionInit(res, context);
      }

      if (pathname === '/api/v1/session/status') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          throw new MethodNotAllowedError('Only GET is allowed for session status.');
        }
        return this.handleSessionStatus(req, res, context);
      }

      if (pathname === '/api/v1/session/terminate') {
        if (method !== 'POST') {
          res.setHeader('Allow', 'POST');
          throw new MethodNotAllowedError('Only POST is allowed for session termination.');
        }
        return this.handleSessionTerminate(res, context);
      }

      // 7. Symbolic Route Dispatch (POST only, canonical path only)
      // Security fix: removed alias /api/v1/dispatch — single canonical endpoint only
      if (pathname === '/api/v1/sim/dispatch') {
        if (method !== 'POST') {
          res.setHeader('Allow', 'POST');
          throw new MethodNotAllowedError('Only POST is allowed for symbolic route dispatch.');
        }
        // Security fix: per-session dispatch limit dropped from 120 to 60/min
        // Security fix: additional global IP dispatch cap (100/min) to prevent session-churn bypass
        const rateKey = context.session ? `dispatch:${context.session.id}` : `dispatch:${clientIp}`;
        if (!this.rateLimiter.isAllowed(rateKey, 60, 60000)) {
          throw new RateLimitExceededError('Route dispatch rate limit exceeded. Please slow down.');
        }
        if (!this.rateLimiter.isAllowed(`dispatch-ip:${clientIp}`, 100, 60000)) {
          throw new RateLimitExceededError('Route dispatch rate limit exceeded. Please slow down.');
        }
        return await this.handleSimDispatch(req, res, context);
      }

      // 8. Evaluation Submission Boundary (POST only, canonical path only)
      // Security fix: removed alias /api/v1/submit — single canonical endpoint only
      if (pathname === '/api/v1/evaluation/submit') {
        if (method !== 'POST') {
          res.setHeader('Allow', 'POST');
          throw new MethodNotAllowedError('Only POST is allowed for evaluation submission.');
        }
        // Security fix: per-session limit of 3/min prevents brute-force guessing
        // Only apply per-session limit when session exists — unauthenticated requests
        // receive 401 from the handler anyway (no point rate-limiting before auth check)
        if (context.session) {
          if (!this.rateLimiter.isAllowed(`submit:${context.session.id}`, 3, 60000)) {
            throw new RateLimitExceededError('Evaluation submission rate limit exceeded. Please wait.');
          }
        }
        // Security fix: global IP limit prevents multi-session bypass brute-force
        if (!this.rateLimiter.isAllowed(`submit-ip:${clientIp}`, 30, 60000)) {
          throw new RateLimitExceededError('Evaluation submission rate limit exceeded. Please wait.');
        }
        return await this.handleEvaluationSubmit(req, res, context);
      }

      // No match: return standardized 404
      throw new NotFoundError('Endpoint does not exist.');
    } catch (err) {
      const formatted = formatPublicError(err, correlationId);
      this.logger.warn('Request error handled', correlationId, {
        path: pathname,
        method,
        status_code: formatted.statusCode,
        code: formatted.publicResponse.code,
      });
      this.sendJson(res, formatted.statusCode, formatted.publicResponse);
    }
  }

  /**
   * Liveness probe: returns 200 if process is alive.
   */
  private handleLiveness(req: IncomingMessage, res: ServerResponse, isPrompt17 = false): void {
    if (req.method === 'HEAD') {
      this.applySecurityHeaders(res);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end();
      return;
    }
    this.sendJson(res, 200, { status: isPrompt17 ? 'OK' : 'ok' });
  }

  /**
   * Readiness probe: returns 200 if engine is ready and server is in READY state, 503 otherwise.
   */
  private handleReadiness(req: IncomingMessage, res: ServerResponse, isPrompt17 = false): void {
    const isReady = this.state === 'READY' && this.engine.isReady();
    if (req.method === 'HEAD') {
      this.applySecurityHeaders(res);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(isReady ? 200 : 503);
      res.end();
      return;
    }
    if (isReady) {
      this.sendJson(res, 200, { status: isPrompt17 ? 'READY' : 'ok' });
    } else {
      this.sendJson(res, 503, { status: isPrompt17 ? 'NOT_READY' : 'not_ready' });
    }
  }

  /**
   * Initializes a new session and sets the HttpOnly cookie.
   * Session ID is always created fresh on the server (session fixation defense).
   */
  private handleSessionInit(res: ServerResponse, context: RequestContext): void {
    const session = this.sessionStore.createSession();
    const cookieHeader = serializeSessionCookie(
      session.id,
      this.config.cookie,
      this.config.sessionLifetimeMs / 1000
    );

    res.setHeader('Set-Cookie', cookieHeader);
    this.logger.info('New session initialized', context.correlationId);

    // Opaque success response. Never return the raw session ID in the body!
    this.sendJson(res, 200, {
      status: 'success',
      session_active: true,
      correlation_id: context.correlationId,
    });
  }

  /**
   * Checks whether the current request is bound to an active session.
   */
  private handleSessionStatus(req: IncomingMessage, res: ServerResponse, context: RequestContext): void {
    if (req.method === 'HEAD') {
      this.applySecurityHeaders(res);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end();
      return;
    }

    if (!context.hasSession()) {
      this.sendJson(res, 200, {
        status: 'anonymous',
        session_active: false,
        correlation_id: context.correlationId,
      });
      return;
    }

    // Refresh activity
    if (context.session) {
      this.sessionStore.touchSession(context.session.id);
    }

    this.sendJson(res, 200, {
      status: 'authenticated',
      session_active: true,
      correlation_id: context.correlationId,
    });
  }

  /**
   * Explicitly terminates the current session.
   */
  private handleSessionTerminate(res: ServerResponse, context: RequestContext): void {
    if (context.session) {
      this.sessionStore.destroySession(context.session.id);
    }

    const clearCookieHeader = serializeClearSessionCookie(this.config.cookie);
    res.setHeader('Set-Cookie', clearCookieHeader);

    this.sendJson(res, 200, {
      status: 'terminated',
      session_active: false,
      correlation_id: context.correlationId,
    });
  }

  /**
   * Recursively validates JSON payload against prototype pollution,
   * excessive nesting depth, and oversized strings.
   */
  private validateJsonSecurity(value: unknown, depth = 0): void {
    if (depth > 10) {
      throw new BadRequestError('JSON payload exceeds maximum allowed nesting depth.');
    }

    if (value === null || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.validateJsonSecurity(item, depth + 1);
      }
      return;
    }

    // Validate object keys
    const keys = Object.getOwnPropertyNames(value);
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new BadRequestError('Invalid request payload: prohibited property.');
      }
      const val = (value as Record<string, unknown>)[key];
      if (typeof val === 'string' && val.length > 8192) {
        throw new BadRequestError('JSON property exceeds maximum allowed string length.');
      }
      this.validateJsonSecurity(val, depth + 1);
    }
  }

  /**
   * Safely reads and parses a JSON request body with strict size limiting,
   * Content-Type validation, prototype pollution defenses, and read timeout.
   * Security fix: added hard 10-second read timeout to defeat slow-loris / slow-body attacks.
   */
  private async readJsonBody(req: IncomingMessage, maxBytes = 65536): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const contentType = req.headers['content-type'];
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        reject(new BadRequestError('Content-Type must be application/json.'));
        return;
      }

      let size = 0;
      const chunks: Buffer[] = [];
      let aborted = false;

      // Security fix: hard 10-second timeout on body reads
      // Defeats slow-loris / slow-body attacks that drip data at 1 byte/sec
      const readTimeout = setTimeout(() => {
        if (!aborted) {
          aborted = true;
          req.destroy();
          reject(new BadRequestError('Request body read timed out.'));
        }
      }, 10000);

      const cleanup = () => clearTimeout(readTimeout);

      req.on('data', (chunk: Buffer) => {
        if (aborted) return;
        size += chunk.length;
        if (size > maxBytes) {
          aborted = true;
          cleanup();
          req.destroy();
          reject(new BadRequestError('Request body exceeds maximum allowed size.'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        cleanup();
        if (aborted) return;
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (!raw.trim()) {
            resolve({});
            return;
          }
          const parsed = JSON.parse(raw);
          this.validateJsonSecurity(parsed);
          resolve(parsed);
        } catch (err) {
          if (err instanceof BadRequestError) {
            reject(err);
          } else {
            reject(new BadRequestError('Malformed JSON request body.'));
          }
        }
      });

      req.on('error', (err: Error) => {
        cleanup();
        if (!aborted) reject(err);
      });
    });
  }

  /**
   * Dispatches a symbolic challenge route on behalf of the player.
   * Delegates parsing, authorization, and gating strictly to the server engine.
   */
  private async handleSimDispatch(
    req: IncomingMessage,
    res: ServerResponse,
    context: RequestContext
  ): Promise<void> {
    if (!context.hasSession()) {
      throw new UnauthorizedError('Authentication credentials are required or invalid.');
    }

    const body = await this.readJsonBody(req);
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      !('route' in body) ||
      typeof (body as Record<string, unknown>).route !== 'string' ||
      !(body as { route: string }).route.trim()
    ) {
      throw new BadRequestError('Invalid request parameters: "route" string is required.');
    }

    const parsedRoute = parseSimRoute((body as { route: string }).route.trim());
    const dispatchResult = await this.engine.dispatch(parsedRoute, 'READ', context);

    this.sendJson(res, 200, dispatchResult.data);
  }

  /**
   * Receives and evaluates candidate final interpretations on the server.
   * Delegates evaluation logic entirely to the ChallengeEngine / EvaluationModule.
   */
  private async handleEvaluationSubmit(
    req: IncomingMessage,
    res: ServerResponse,
    context: RequestContext
  ): Promise<void> {
    if (!context.hasSession()) {
      throw new UnauthorizedError('Authentication credentials are required or invalid.');
    }

    const body = await this.readJsonBody(req);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestError('Request body must be a JSON object.');
    }

    const evalResult = await this.engine.submitFinalInterpretation(context, body);

    this.sendJson(res, 200, evalResult);
  }

  /**
   * Serves static assets for the player workspace interface.
   * Whitelists filenames strictly to eliminate directory traversal.
   */
  private async serveStaticFile(
    req: IncomingMessage,
    res: ServerResponse,
    filename: string,
    contentType: string
  ): Promise<void> {
    const allowedFiles = new Set(['index.html', 'index.css', 'app.js']);
    if (!allowedFiles.has(filename)) {
      throw new NotFoundError('Endpoint does not exist.');
    }

    const publicDir = path.resolve(process.cwd(), 'public');
    const filePath = path.resolve(publicDir, filename);

    // Guard against path traversal escaping public directory
    if (!filePath.startsWith(publicDir)) {
      throw new NotFoundError('Endpoint does not exist.');
    }

    try {
      const content = await fs.promises.readFile(filePath);
      this.applySecurityHeaders(res);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(content.length));

      if (req.method === 'HEAD') {
        res.writeHead(200);
        res.end();
        return;
      }

      res.writeHead(200);
      res.end(content);
    } catch {
      throw new NotFoundError('Static asset not found.');
    }
  }

  /**
   * Starts listening on the configured port.
   *
   * In **test** mode: uses plain node:http (no TLS) so test code can use
   * http://127.0.0.1 without needing certificate trust overrides.
   *
   * In **dev/production**: uses node:https with full TLS hardening:
   *  - TLS 1.2 / 1.3 only (bans SSLv3, TLS 1.0, TLS 1.1)
   *  - Strong AEAD cipher suites only (AES-GCM + ChaCha20)
   *  - ECDH for forward secrecy, server cipher order preference
   * Server DoS hardening:
   *  - maxConnections: 500 — prevents connection exhaustion DoS
   *  - keepAliveTimeout: 30s — drops idle connections faster
   *  - headersTimeout: 15s — drops slow-header attacks (slowloris variant)
   *  - requestTimeout: 30s — drops hung requests
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (req: IncomingMessage, res: ServerResponse) => {
        this.handleRequest(req, res).catch((err: unknown) => {
          const fallback = formatPublicError(err, 'critical_fault');
          this.sendJson(res, fallback.statusCode, fallback.publicResponse);
        });
      };

      // In test mode use plain HTTP — tests connect via http:// without a TLS cert
      if (this.config.environment === 'test' || !this.tlsCredentials) {
        this.server = createHttpServer(handler);
      } else {
        // Build hardened TLS options for dev/production
        const tlsOptions: SecureContextOptions & { minVersion?: string; maxVersion?: string } = {
          cert: this.tlsCredentials.cert,
          key: this.tlsCredentials.key,
          // Enforce minimum TLS version from config (default TLSv1.2)
          minVersion: this.config.tlsMinVersion,
          // Cap at TLSv1.3 (the latest and most secure)
          maxVersion: 'TLSv1.3',
          // Strong cipher suites only:
          //   ECDHE-RSA-AES256-GCM-SHA384  — TLS 1.2 AEAD, forward secrecy
          //   ECDHE-RSA-AES128-GCM-SHA256  — TLS 1.2 AEAD, forward secrecy
          //   ECDHE-RSA-CHACHA20-POLY1305  — TLS 1.2 AEAD, fast on mobile
          //   TLS 1.3 cipher suites are selected automatically by Node's OpenSSL
          ciphers: [
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-CHACHA20-POLY1305',
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-CHACHA20-POLY1305',
          ].join(':'),
          // Prefer server cipher order (prevents client-side cipher downgrade)
          honorCipherOrder: true,
        };
        this.server = createHttpsServer(tlsOptions, handler);
      }

      // Security fix: cap concurrent connections to prevent resource exhaustion
      this.server.maxConnections = 500;

      // Security fix: drop idle keep-alive connections after 30 seconds
      this.server.keepAliveTimeout = 30000;

      // Security fix: drop connections that take >15s to send headers (slowloris defence)
      this.server.headersTimeout = 15000;

      // Security fix: drop hung requests after 30s
      this.server.requestTimeout = 30000;

      this.server.on('connect', (_req: IncomingMessage, socket) => {
        socket.write('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n');
        socket.destroy();
      });

      this.server.on('error', (err: Error) => {
        this.logger.error('Server Error', undefined, { error: err.message });
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.state = 'READY';
        const isTest = this.config.environment === 'test' || !this.tlsCredentials;
        const scheme = isTest ? 'http' : 'https';
        if (!isTest && this.tlsCredentials?.isSelfSigned) {
          this.logger.warn(
            'Using AUTO-GENERATED self-signed TLS certificate. Browser will show a security warning. ' +
            'This is expected in development. Set TLS_CERT_PATH / TLS_KEY_PATH for production.',
            undefined
          );
        }
        this.logger.info(`Server listening on ${scheme}://${this.config.host}:${this.config.port}`, undefined, {
          env: this.config.environment,
          tls: !isTest,
        });
        resolve();
      });
    });
  }

  /**
   * Stops the server cleanly with connection draining.
   */
  public async stop(): Promise<void> {
    this.state = 'DRAINING';
    this.rateLimiter.shutdown();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.state = 'STOPPED';
          resolve();
        });
        this.server.closeAllConnections?.();
      } else {
        this.state = 'STOPPED';
        resolve();
      }
    });
  }

  public getState(): ServerLifecycleState {
    return this.state;
  }

  public getPort(): number {
    const address = this.server?.address();
    if (address && typeof address === 'object') {
      return address.port;
    }
    return this.config.port;
  }
}
