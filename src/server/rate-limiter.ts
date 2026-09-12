export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

/**
 * Hardened in-memory sliding-window rate limiter.
 * Security hardening:
 *  - Max 50,000 tracked keys to prevent memory exhaustion by key flooding
 *  - Cleanup runs every 30s (was 60s) to reduce peak memory
 *  - Keys are trimmed to max 256 chars to prevent oversized-key DoS
 */
export class InMemoryRateLimiter {
  private readonly records: Map<string, number[]> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private static readonly MAX_KEYS = 50_000;
  private static readonly MAX_KEY_LENGTH = 256;

  constructor(cleanupIntervalMs = 30000) {
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Checks whether the request is allowed under the rate limit.
   * Returns true if allowed, false if limit exceeded.
   */
  public isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
    // Truncate oversized keys to prevent key-flooding memory attacks
    const safeKey = key.length > InMemoryRateLimiter.MAX_KEY_LENGTH
      ? key.substring(0, InMemoryRateLimiter.MAX_KEY_LENGTH)
      : key;

    const now = Date.now();
    const timestamps = this.records.get(safeKey) ?? [];
    const windowStart = now - windowMs;

    // Filter timestamps within the current sliding window
    const recent = timestamps.filter((ts) => ts > windowStart);

    if (recent.length >= maxRequests) {
      this.records.set(safeKey, recent);
      return false;
    }

    // Enforce global key cap: if at limit, reject new keys silently
    if (!this.records.has(safeKey) && this.records.size >= InMemoryRateLimiter.MAX_KEYS) {
      // Map is full — block as rate-limited to prevent memory exhaustion
      return false;
    }

    recent.push(now);
    this.records.set(safeKey, recent);
    return true;
  }

  /**
   * Purges expired entries across all keys.
   */
  public cleanup(): void {
    const now = Date.now();
    // 10 minute retention for cleanup
    const cutoff = now - 600000;

    for (const [key, timestamps] of this.records.entries()) {
      const active = timestamps.filter((ts) => ts > cutoff);
      if (active.length === 0) {
        this.records.delete(key);
      } else {
        this.records.set(key, active);
      }
    }
  }

  /**
   * Clears all tracked rate limit records (useful for test isolation).
   */
  public reset(): void {
    this.records.clear();
  }

  /**
   * Shuts down cleanup timer.
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.records.clear();
  }
}
