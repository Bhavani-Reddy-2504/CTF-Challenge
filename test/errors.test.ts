import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from '../src/errors/app-error.js';
import { formatPublicError } from '../src/errors/error-handler.js';

describe('Error Framework Tests (Requirements 30-33)', () => {
  const testCorrelationId = 'req_trace_987654321';

  it('30. Public errors contain safe fields only', () => {
    const err = new BadRequestError('Invalid input parameter.');
    const formatted = formatPublicError(err, testCorrelationId);

    assert.equal(formatted.statusCode, 400);
    assert.deepEqual(Object.keys(formatted.publicResponse).sort(), [
      'code',
      'correlation_id',
      'message',
      'status',
    ]);
    assert.equal(formatted.publicResponse.status, 'error');
    assert.equal(formatted.publicResponse.code, 'BAD_REQUEST');
    assert.equal(formatted.publicResponse.message, 'Invalid input parameter.');
    assert.equal(formatted.publicResponse.correlation_id, testCorrelationId);
  });

  it('31. Stack traces are not exposed in public error response', () => {
    const internalErr = new Error('Database connection failed at /app/secret/db.ts:42\n    at internalFunction');
    const formatted = formatPublicError(internalErr, testCorrelationId);

    const json = JSON.stringify(formatted.publicResponse);
    assert(!json.includes('stack'), 'JSON must not contain stack field');
    assert(!json.includes('/app/secret/db.ts'), 'JSON must not contain internal source paths');
    assert(!json.includes('internalFunction'), 'JSON must not contain function names');
  });

  it('32. Internal exception messages are not exposed for unexpected faults', () => {
    const rawError = new Error('CRITICAL_PRIVATE_KEY_UNAVAILABLE: /etc/ssl/certs/key.pem is missing');
    const formatted = formatPublicError(rawError, testCorrelationId);

    assert.equal(formatted.statusCode, 500);
    assert.equal(formatted.publicResponse.code, 'INTERNAL_FAULT');
    // Public message must be generic, not the raw exception
    assert(!formatted.publicResponse.message.includes('/etc/ssl/certs/key.pem'));
    assert.equal(
      formatted.publicResponse.message,
      'An internal error occurred. Please refer to correlation_id for tracing.'
    );
  });

  it('33. Correlation IDs are always included in the public response', () => {
    const errors = [
      new BadRequestError('Bad request'),
      new ForbiddenError('Forbidden'),
      new NotFoundError('Not found'),
      new InternalServerError('Internal error'),
      new TypeError('Unexpected type error'),
    ];

    for (const err of errors) {
      const formatted = formatPublicError(err, testCorrelationId);
      assert.equal(formatted.publicResponse.correlation_id, testCorrelationId);
    }
  });
});
