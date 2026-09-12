import { LogLevel } from '../config/config.js';

export interface LogEntry {
  readonly timestamp: string;
  readonly severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  readonly event: string;
  readonly correlation_id?: string;
  readonly metadata?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry, serialized: string) => void;

const SENSITIVE_KEY_PATTERNS = [
  /session/i,
  /cookie/i,
  /auth/i,
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /private/i,
  /api[-_]?key/i,
  /flag/i,
  /candidate/i,
  /interpretation/i,
  /solution/i,
  /submission/i,
];

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SEVERITY_NUMERIC: Record<'DEBUG' | 'INFO' | 'WARN' | 'ERROR', number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

/**
 * Recursively deep-redacts sensitive keys and values from logging metadata.
 */
export function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    if (
      /[A-Za-z0-9_-]{3,8}\{[^}\r\n]{4,}\}/.test(obj) ||
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(obj)
    ) {
      return '[REDACTED_SECRET]';
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSensitiveData(value, depth + 1);
      }
    }

    return sanitized;
  }

  return '[UNSUPPORTED_TYPE]';
}

export class Logger {
  private minLevelNumeric: number;
  private sink: LogSink;

  constructor(level: LogLevel = 'info', sink?: LogSink) {
    this.minLevelNumeric = LOG_LEVEL_SEVERITY[level] ?? 20;
    this.sink = sink ?? ((_, serialized) => {
      process.stdout.write(serialized + '\n');
    });
  }

  public setLevel(level: LogLevel): void {
    this.minLevelNumeric = LOG_LEVEL_SEVERITY[level] ?? 20;
  }

  public setSink(sink: LogSink): void {
    this.sink = sink;
  }

  private writeLog(
    severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    event: string,
    correlationId?: string,
    metadata?: Record<string, unknown>
  ): void {
    if (SEVERITY_NUMERIC[severity] < this.minLevelNumeric) {
      return;
    }

    const sanitizedMeta = metadata
      ? (redactSensitiveData(metadata) as Record<string, unknown>)
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      event,
      ...(correlationId ? { correlation_id: correlationId } : {}),
      ...(sanitizedMeta && Object.keys(sanitizedMeta).length > 0 ? { metadata: sanitizedMeta } : {}),
    };

    const serialized = JSON.stringify(entry);
    this.sink(entry, serialized);
  }

  public debug(event: string, correlationId?: string, metadata?: Record<string, unknown>): void {
    this.writeLog('DEBUG', event, correlationId, metadata);
  }

  public info(event: string, correlationId?: string, metadata?: Record<string, unknown>): void {
    this.writeLog('INFO', event, correlationId, metadata);
  }

  public warn(event: string, correlationId?: string, metadata?: Record<string, unknown>): void {
    this.writeLog('WARN', event, correlationId, metadata);
  }

  public error(event: string, correlationId?: string, metadata?: Record<string, unknown>): void {
    this.writeLog('ERROR', event, correlationId, metadata);
  }
}

// Global root logger instance
export const rootLogger = new Logger();
