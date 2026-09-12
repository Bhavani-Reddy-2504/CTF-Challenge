import { AppConfig } from '../config/config.js';
import { ResourceExhaustedError } from '../errors/app-error.js';
import { Logger, rootLogger } from '../logging/logger.js';
import { ChallengeSessionContext } from './session-context.js';
import { createSecureSessionId, isValidSessionId } from './session-id.js';

export interface SessionRecord {
  readonly id: string;
  readonly createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  destroyed: boolean;
  readonly context: ChallengeSessionContext;
}

export class SessionStore {
  private readonly sessions: Map<string, SessionRecord> = new Map();
  private readonly destroyedIds: Set<string> = new Set();
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: AppConfig, logger: Logger = rootLogger) {
    this.config = config;
    this.logger = logger;
    this.startCleanupTimer();
  }

  /**
   * Starts periodic cleanup of expired sessions.
   */
  private startCleanupTimer(): void {
    if (this.config.sessionCleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        try {
          const cleaned = this.cleanupExpiredSessions();
          if (cleaned > 0) {
            this.logger.debug('Session cleanup completed', undefined, { cleaned_count: cleaned });
          }
        } catch (err) {
          this.logger.error('Error during scheduled session cleanup', undefined, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }, this.config.sessionCleanupIntervalMs);

      // Unref the timer so it doesn't hold open the Node event loop during shutdown/tests
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Creates a new session with an isolated ChallengeSessionContext.
   */
  public createSession(): SessionRecord {
    if (this.sessions.size >= this.config.maxActiveSessions) {
      // Run cleanup first in case there are expired sessions to reclaim
      this.cleanupExpiredSessions();

      if (this.sessions.size >= this.config.maxActiveSessions) {
        throw new ResourceExhaustedError(
          'Maximum active session capacity reached. Please retry shortly.',
          { current_sessions: this.sessions.size, max_sessions: this.config.maxActiveSessions }
        );
      }
    }

    const id = createSecureSessionId();
    const now = Date.now();
    const session: SessionRecord = {
      id,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: now + this.config.sessionLifetimeMs,
      destroyed: false,
      context: new ChallengeSessionContext(),
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Retrieves an active, non-expired, non-destroyed session.
   */
  public getSession(id: string): SessionRecord | undefined {
    if (!isValidSessionId(id)) {
      return undefined;
    }

    if (this.destroyedIds.has(id)) {
      return undefined;
    }

    const session = this.sessions.get(id);
    if (!session) {
      return undefined;
    }

    if (session.destroyed) {
      this.sessions.delete(id);
      this.destroyedIds.add(id);
      return undefined;
    }

    const now = Date.now();
    if (now >= session.expiresAt) {
      // Session has expired
      session.destroyed = true;
      this.sessions.delete(id);
      this.destroyedIds.add(id);
      return undefined;
    }

    return session;
  }

  /**
   * Refreshes the last active timestamp and extends the expiration window.
   */
  public touchSession(id: string): boolean {
    const session = this.getSession(id);
    if (!session) {
      return false;
    }

    const now = Date.now();
    session.lastActiveAt = now;
    session.expiresAt = now + this.config.sessionLifetimeMs;
    return true;
  }

  /**
   * Destroys a session, permanently preventing reuse or resurrection.
   */
  public destroySession(id: string): boolean {
    if (!isValidSessionId(id)) {
      return false;
    }

    this.destroyedIds.add(id);
    const session = this.sessions.get(id);
    if (session) {
      session.destroyed = true;
      this.sessions.delete(id);
      return true;
    }

    return false;
  }

  /**
   * Scans all stored sessions and purges expired entries.
   */
  public cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (session.destroyed || now >= session.expiresAt) {
        session.destroyed = true;
        this.sessions.delete(id);
        this.destroyedIds.add(id);
        cleanedCount++;
      }
    }

    // Cap the destroyedIds set size to prevent unbounded memory usage over time
    if (this.destroyedIds.size > 20000) {
      this.destroyedIds.clear();
    }

    return cleanedCount;
  }

  /**
   * Returns current active session count.
   */
  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Shuts down the store and terminates the cleanup timer.
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.sessions.clear();
    this.destroyedIds.clear();
  }
}
