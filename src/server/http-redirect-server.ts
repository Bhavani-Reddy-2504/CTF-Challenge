/**
 * HTTP → HTTPS Redirect Server
 *
 * Listens on the plain-HTTP port and redirects every incoming request
 * to its HTTPS equivalent with a 301 Moved Permanently response.
 *
 * This ensures that accidental HTTP access is transparently upgraded
 * to encrypted HTTPS, and supports HSTS preload compliance.
 */

import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { Logger, rootLogger } from '../logging/logger.js';

export interface HttpRedirectServerOptions {
  /** Port to listen on for plain HTTP (e.g. 8080). */
  httpPort: number;
  /** HTTPS port to redirect to (e.g. 8443). */
  httpsPort: number;
  /** Host to bind the redirect server to. */
  host: string;
  logger?: Logger;
}

export class HttpRedirectServer {
  private readonly options: HttpRedirectServerOptions;
  private readonly logger: Logger;
  private server?: Server;

  constructor(options: HttpRedirectServerOptions) {
    this.options = options;
    this.logger = options.logger ?? rootLogger;
  }

  /** Starts the HTTP redirect server. */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleRedirect(req, res);
      });

      // Apply the same DoS protections as the HTTPS server
      this.server.maxConnections = 200;
      this.server.keepAliveTimeout = 5000;   // Close idle HTTP connections fast
      this.server.headersTimeout = 5000;     // Drop slow-header attacks quickly
      this.server.requestTimeout = 10000;

      this.server.on('error', (err: Error) => {
        this.logger.error('HTTP Redirect Server Error', undefined, { error: err.message });
        reject(err);
      });

      this.server.listen(this.options.httpPort, this.options.host, () => {
        this.logger.info(
          `HTTP→HTTPS redirect server listening on ${this.options.host}:${this.options.httpPort}`,
          undefined,
          { redirectsTo: `https://${this.options.host}:${this.options.httpsPort}` }
        );
        resolve();
      });
    });
  }

  /** Stops the redirect server cleanly. */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.closeAllConnections?.();
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  /**
   * Handles every incoming HTTP request by issuing a 301 redirect to HTTPS.
   *
   * Security notes:
   * - Uses a fixed host (does NOT trust the incoming Host header) to prevent
   *   open-redirect attacks where an attacker crafts `Host: evil.com`.
   * - Adds minimal hardening headers even on redirect responses.
   * - No body is included (browsers follow 301 with no body).
   */
  private handleRedirect(req: IncomingMessage, res: ServerResponse): void {
    const { httpsPort, host } = this.options;

    // Build the redirect target from the safe server-controlled host, not req.headers.host
    const portSuffix = httpsPort === 443 ? '' : `:${httpsPort}`;
    const targetUrl = `https://${host}${portSuffix}${req.url ?? '/'}`;

    // Minimal security headers on the redirect response
    res.setHeader('Location', targetUrl);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    // Tell browsers to never use HTTP again for this host (30 days)
    res.setHeader('Strict-Transport-Security', 'max-age=2592000; includeSubDomains');
    res.setHeader('Server', 'StrataCore/1.0');
    res.removeHeader('X-Powered-By');
    res.writeHead(301);
    res.end();
  }
}
