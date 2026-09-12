import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigValidationError, validateAndBuildConfig } from '../src/config/config.js';

describe('Configuration Tests (Requirements 1-5)', () => {
  it('1. Valid configuration loads with expected defaults', () => {
    const config = validateAndBuildConfig({
      environment: 'development',
      port: 9000,
      sessionLifetimeMs: 1800000,
    });

    assert.equal(config.environment, 'development');
    assert.equal(config.port, 9000);
    assert.equal(config.sessionLifetimeMs, 1800000);
    assert.equal(config.cookie.httpOnly, true);
    assert.equal(config.cookie.sameSite, 'Strict');
    assert.equal(config.cookie.path, '/');
  });

  it('2. Invalid port fails validation', () => {
    assert.throws(
      () => validateAndBuildConfig({ port: 70000 }),
      ConfigValidationError,
      'Should throw ConfigValidationError for port > 65535'
    );

    assert.throws(
      () => validateAndBuildConfig({ port: -1 }),
      ConfigValidationError,
      'Should throw ConfigValidationError for port < 1'
    );

    assert.throws(
      () => validateAndBuildConfig({ port: 'invalid_port' }),
      ConfigValidationError,
      'Should throw ConfigValidationError for non-numeric port'
    );
  });

  it('3. Invalid session lifetime fails validation', () => {
    // Too short (< 60,000ms = 1m)
    assert.throws(
      () => validateAndBuildConfig({ sessionLifetimeMs: 1000 }),
      ConfigValidationError,
      'Should throw ConfigValidationError for sessionLifetimeMs < 60,000'
    );

    // Too long (> 86,400,000ms = 24h)
    assert.throws(
      () => validateAndBuildConfig({ sessionLifetimeMs: 90000000 }),
      ConfigValidationError,
      'Should throw ConfigValidationError for sessionLifetimeMs > 86,400,000'
    );
  });

  it('4. Invalid security-critical configuration fails startup (Insecure cookies in production)', () => {
    assert.throws(
      () =>
        validateAndBuildConfig({
          environment: 'production',
          cookieSecure: false,
        }),
      (err: unknown) => {
        if (err instanceof ConfigValidationError) {
          assert(err.message.includes('Insecure cookies'));
          return true;
        }
        return false;
      },
      'Production must forbid insecure cookies'
    );
  });

  it('5. Development/production cookie behavior follows explicit configuration', () => {
    // In production, secure is strictly true by default
    const prodConfig = validateAndBuildConfig({
      environment: 'production',
      cookieSecure: true,
    });
    assert.equal(prodConfig.cookie.secure, true);

    // In development, secure can be false if explicitly configured
    const devConfig = validateAndBuildConfig({
      environment: 'development',
      cookieSecure: false,
    });
    assert.equal(devConfig.cookie.secure, false);

    // In development with explicit cookieSecure=true, it honors true
    const devSecureConfig = validateAndBuildConfig({
      environment: 'development',
      cookieSecure: true,
    });
    assert.equal(devSecureConfig.cookie.secure, true);
  });
});
