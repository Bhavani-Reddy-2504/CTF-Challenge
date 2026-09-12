import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigValidationError } from '../../src/config/config.js';
import {
  sanitizeConfigForInspection,
  validateEnvironment,
  validateHost,
  validatePort,
} from '../../src/config/environment-validator.js';
import { getSafeRuntimeConfig, loadRuntimeConfig } from '../../src/config/runtime-config.js';

describe('Prompt 17: Production Configuration Safety & Environment Validation', () => {
  describe('Environment Validation', () => {
    it('1. Accepts valid environment modes: production, development, test', () => {
      assert.equal(validateEnvironment('production'), 'production');
      assert.equal(validateEnvironment('PRODUCTION'), 'production');
      assert.equal(validateEnvironment('development'), 'development');
      assert.equal(validateEnvironment('test'), 'test');
    });

    it('2. Strictly rejects unexpected or non-standard environment modes', () => {
      const invalidEnvs = ['staging', 'qa', 'dev', 'local', 'preview', 'sandbox', 'prod', ''];
      for (const env of invalidEnvs) {
        assert.throws(
          () => validateEnvironment(env),
          ConfigValidationError,
          `Should have rejected environment '${env}'`
        );
      }
    });
  });

  describe('Port & Host Validation', () => {
    it('3. Accepts valid port numbers between 1 and 65535 in production', () => {
      assert.equal(validatePort(8080, 'production'), 8080);
      assert.equal(validatePort('3000', 'production'), 3000);
      assert.equal(validatePort(443, 'production'), 443);
      assert.equal(validatePort(1, 'production'), 1);
      assert.equal(validatePort(65535, 'production'), 65535);
    });

    it('4. Rejects port 0 in production mode (only permitted in test)', () => {
      assert.throws(() => validatePort(0, 'production'), ConfigValidationError);
      assert.equal(validatePort(0, 'test'), 0);
    });

    it('5. Rejects out-of-range, negative, or malformed ports', () => {
      const invalidPorts = [-1, 70000, 999999, 'abc', '8080xyz', NaN];
      for (const p of invalidPorts) {
        assert.throws(() => validatePort(p, 'production'), ConfigValidationError);
      }
    });

    it('6. Validates network bind hosts with safe defaults', () => {
      assert.equal(validateHost('0.0.0.0', 'production'), '0.0.0.0');
      assert.equal(validateHost('127.0.0.1', 'production'), '127.0.0.1');
      assert.equal(validateHost('app.internal.domain', 'production'), 'app.internal.domain');

      // Rejection of invalid hosts
      assert.throws(() => validateHost('', 'production'), ConfigValidationError);
      assert.throws(() => validateHost('bad host with spaces', 'production'), ConfigValidationError);
      assert.throws(() => validateHost('host;rm -rf', 'production'), ConfigValidationError);
    });
  });

  describe('Production Cookie & Secret Safeguards', () => {
    it('7. Strictly rejects insecure cookies in production mode', () => {
      assert.throws(() => {
        loadRuntimeConfig({
          environment: 'production',
          cookieSecure: false,
        });
      }, ConfigValidationError);
    });

    it('8. Sanitizes configuration objects to scrub secret/env keys', () => {
      const dirtyConfig = {
        host: '0.0.0.0',
        port: 8080,
        secret_key: 'SUPER_SECRET_123',
        api_token: 'TOKEN_XYZ',
        preimage: '8dffab8c9cdc...',
        flag_val: 'BPCTF{secret}',
        nested: {
          app_mode: 'standard',
          admin_password: 'root',
        },
      };

      const clean = sanitizeConfigForInspection(dirtyConfig);
      assert.equal(clean.host, '0.0.0.0');
      assert.equal(clean.port, 8080);
      assert.equal(clean.secret_key, undefined);
      assert.equal(clean.api_token, undefined);
      assert.equal(clean.preimage, undefined);
      assert.equal(clean.flag_val, undefined);
      assert.equal((clean.nested as Record<string, unknown>).admin_password, undefined);
      assert.equal((clean.nested as Record<string, unknown>).app_mode, 'standard');
    });

    it('9. getSafeRuntimeConfig produces a clean inspectable copy without secrets', () => {
      const config = loadRuntimeConfig({
        environment: 'test',
        port: 0,
      });

      const safe = getSafeRuntimeConfig(config);
      assert.equal(safe.environment, 'test');
      assert.equal(safe.port, 0);
      assert.equal(safe.isTest, true);
      assert.equal((safe as Record<string, unknown>).cookie, undefined);
    });
  });
});
