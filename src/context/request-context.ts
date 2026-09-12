import { generateCorrelationId } from '../security/crypto.js';
import { ChallengeSessionContext } from '../session/session-context.js';
import { SessionRecord } from '../session/session-store.js';

export interface SafeRequestMetadata {
  readonly method?: string;
  readonly path?: string;
  readonly clientIp?: string;
  readonly userAgentLength?: number;
  readonly [key: string]: unknown;
}

export class RequestContext {
  public readonly correlationId: string;
  public readonly timestamp: number;
  public readonly session?: SessionRecord;
  private readonly metadata: Record<string, unknown>;

  constructor(options?: {
    correlationId?: string;
    session?: SessionRecord;
    metadata?: SafeRequestMetadata;
  }) {
    this.correlationId = options?.correlationId ?? generateCorrelationId();
    this.timestamp = Date.now();
    this.session = options?.session;
    this.metadata = {};

    if (options?.metadata) {
      this.attachSafeMetadata(options.metadata);
    }
  }

  /**
   * Attaches sanitized, non-sensitive metadata to the request context.
   * Filters out any prohibited sensitive keys.
   */
  public attachSafeMetadata(meta: SafeRequestMetadata): void {
    const PROHIBITED_KEYS = ['password', 'secret', 'token', 'auth', 'cookie', 'session', 'credential', 'flag'];
    for (const [key, value] of Object.entries(meta)) {
      const lower = key.toLowerCase();
      if (PROHIBITED_KEYS.some((p) => lower.includes(p))) {
        continue; // Drop prohibited sensitive attributes
      }
      this.metadata[key] = value;
    }
  }

  /**
   * Retrieves safe metadata for logging or diagnostics.
   */
  public getSafeMetadata(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.metadata });
  }

  /**
   * Returns the ChallengeSessionContext if a valid session is bound.
   */
  public getChallengeContext(): ChallengeSessionContext | undefined {
    return this.session?.context;
  }

  /**
   * Returns whether this request context is bound to an active session.
   */
  public hasSession(): boolean {
    return this.session !== undefined && !this.session.destroyed;
  }
}
