import { CookieConfig } from '../config/config.js';

/**
 * Serializes a session ID into a hardened Set-Cookie header string.
 */
export function serializeSessionCookie(
  sessionId: string,
  config: CookieConfig,
  maxAgeSeconds?: number
): string {
  const parts: string[] = [
    `${config.name}=${encodeURIComponent(sessionId)}`,
    `Path=${config.path}`,
    `SameSite=${config.sameSite}`,
  ];

  if (config.httpOnly) {
    parts.push('HttpOnly');
  }

  if (config.secure) {
    parts.push('Secure');
  }

  if (maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }

  return parts.join('; ');
}

/**
 * Serializes an expired cookie to clear it on the client.
 */
export function serializeClearSessionCookie(config: CookieConfig): string {
  return `${config.name}=; Path=${config.path}; Max-Age=0; SameSite=${config.sameSite}${
    config.httpOnly ? '; HttpOnly' : ''
  }${config.secure ? '; Secure' : ''}`;
}

/**
 * Extracts the session ID from an incoming Cookie header.
 */
export function parseSessionCookie(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return undefined;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const equalIdx = trimmed.indexOf('=');
    if (equalIdx > 0) {
      const name = trimmed.substring(0, equalIdx).trim();
      if (name === cookieName) {
        const rawValue = trimmed.substring(equalIdx + 1).trim();
        try {
          return decodeURIComponent(rawValue);
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}
