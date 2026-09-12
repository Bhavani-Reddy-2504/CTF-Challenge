import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';

describe('Request Context Tests (Requirements 27-29)', () => {
  it('27. Correlation IDs are generated automatically with expected prefix', () => {
    const ctx = new RequestContext();
    assert.ok(ctx.correlationId);
    assert.match(ctx.correlationId, /^req_[a-f0-9]{32}$/);
    assert.ok(ctx.timestamp <= Date.now());
  });

  it('28. Correlation IDs are propagated safely when provided', () => {
    const customId = 'req_custom_trace_identifier_123';
    const ctx = new RequestContext({ correlationId: customId });
    assert.equal(ctx.correlationId, customId);
  });

  it('29. Sensitive request data is not placed in safe metadata', () => {
    const ctx = new RequestContext();

    ctx.attachSafeMetadata({
      method: 'POST',
      path: '/api/v1/test',
      clientIp: '127.0.0.1',
      // The following sensitive keys must be rejected by attachSafeMetadata:
      password: 'super_secret_password',
      token: 'jwt_bearer_token',
      cookie: 'strata_session=123',
      session_id: 'secret_session',
      credential_key: 'private_key_data',
      flag: 'BPCTF{secret}',
    });

    const safeMeta = ctx.getSafeMetadata();

    assert.equal(safeMeta.method, 'POST');
    assert.equal(safeMeta.path, '/api/v1/test');
    assert.equal(safeMeta.clientIp, '127.0.0.1');

    assert.equal(safeMeta.password, undefined);
    assert.equal(safeMeta.token, undefined);
    assert.equal(safeMeta.cookie, undefined);
    assert.equal(safeMeta.session_id, undefined);
    assert.equal(safeMeta.credential_key, undefined);
    assert.equal(safeMeta.flag, undefined);
  });
});
