import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LogEntry, Logger, redactSensitiveData } from '../src/logging/logger.js';

describe('Secure Logging Tests (Requirements 34-37)', () => {
  it('34. Sensitive fields are redacted at root level', () => {
    const rawData = {
      user_id: 'user-123',
      session_id: 'secret-session-abc',
      password: 'password123',
      api_key: 'key-999',
      safe_param: 'public_value',
    };

    const redacted = redactSensitiveData(rawData) as Record<string, unknown>;

    assert.equal(redacted.user_id, 'user-123');
    assert.equal(redacted.safe_param, 'public_value');
    assert.equal(redacted.session_id, '[REDACTED]');
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.api_key, '[REDACTED]');
  });

  it('35. Nested sensitive fields are redacted recursively', () => {
    const nestedData = {
      request: {
        headers: {
          authorization: 'Bearer secret_jwt_token',
          cookie: 'strata_session=xyz',
          'user-agent': 'curl/7.68.0',
        },
        body: {
          credentials: {
            private_key: '-----BEGIN PRIVATE KEY-----',
          },
          target_enclave: 'stage-build-mesh',
        },
      },
    };

    const redacted = redactSensitiveData(nestedData) as any;

    assert.equal(redacted.request.headers['user-agent'], 'curl/7.68.0');
    assert.equal(redacted.request.body.target_enclave, 'stage-build-mesh');

    assert.equal(redacted.request.headers.authorization, '[REDACTED]');
    assert.equal(redacted.request.headers.cookie, '[REDACTED]');
    assert.equal(redacted.request.body.credentials, '[REDACTED]');
  });

  it('36. Session identifiers are never logged through Logger methods', () => {
    const emittedLogs: string[] = [];
    const logger = new Logger('debug', (_entry: LogEntry, serialized: string) => {
      emittedLogs.push(serialized);
    });

    logger.info('User action event', 'req_123', {
      session: 'sess_secret_random_identifier',
      sessionId: 'sess_secret_random_identifier_2',
      session_cookie: 'strata_session=xyz',
      action: 'probe',
    });

    assert.equal(emittedLogs.length, 1);
    const logStr = emittedLogs[0];
    assert(!logStr.includes('sess_secret_random_identifier'), 'Session identifier was leaked in log!');
    assert(!logStr.includes('strata_session=xyz'), 'Session cookie was leaked in log!');
    assert(logStr.includes('[REDACTED]'));
    assert(logStr.includes('"action":"probe"'));
  });

  it('37. Authorization values and tokens are never logged', () => {
    const emittedLogs: string[] = [];
    const logger = new Logger('debug', (_entry: LogEntry, serialized: string) => {
      emittedLogs.push(serialized);
    });

    logger.warn('Token validation failed', 'req_456', {
      auth_header: 'Bearer eyJhbGciOiJSUzI1NiJ9.secret',
      token_payload: 'raw_secret_token',
      flag: 'BPCTF{do_not_log}',
      attempted_role: 'admin',
    });

    assert.equal(emittedLogs.length, 1);
    const logStr = emittedLogs[0];
    assert(!logStr.includes('eyJhbGciOiJSUzI1NiJ9'), 'Token header was leaked in log!');
    assert(!logStr.includes('raw_secret_token'), 'Token payload was leaked in log!');
    assert(!logStr.includes('BPCTF{do_not_log}'), 'Flag was leaked in log!');
  });
});
