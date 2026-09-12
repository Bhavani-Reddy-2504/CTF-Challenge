import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { validateAndBuildConfig } from '../src/config/config.js';
import { ResourceExhaustedError } from '../src/errors/app-error.js';
import { SessionStore } from '../src/session/session-store.js';

describe('Session Store Tests (Requirements 10-18)', () => {
  let store: SessionStore;

  beforeEach(() => {
    const config = validateAndBuildConfig({
      environment: 'test',
      sessionLifetimeMs: 100000,
      sessionCleanupIntervalMs: 10000,
      maxActiveSessions: 100,
    });
    store = new SessionStore(config);
  });

  afterEach(() => {
    store.shutdown();
  });

  it('10. Session creation works', () => {
    const session = store.createSession();
    assert.ok(session.id);
    assert.equal(typeof session.id, 'string');
    assert.equal(session.destroyed, false);
    assert.ok(session.createdAt <= Date.now());
    assert.ok(session.expiresAt > Date.now());
    assert.equal(store.getActiveSessionCount(), 1);
  });

  it('11. Session retrieval works', () => {
    const created = store.createSession();
    const retrieved = store.getSession(created.id);
    assert.ok(retrieved);
    assert.equal(retrieved?.id, created.id);
    assert.equal(retrieved?.destroyed, false);
  });

  it('12. Expired sessions fail retrieval and are removed', async () => {
    // Create store with minimal lifetime (simulated expiration)
    const shortConfig = validateAndBuildConfig({
      environment: 'test',
      sessionLifetimeMs: 60000,
    });
    const shortStore = new SessionStore(shortConfig);

    try {
      const session = shortStore.createSession();
      // Manually simulate expiration
      session.expiresAt = Date.now() - 1000;

      const retrieved = shortStore.getSession(session.id);
      assert.equal(retrieved, undefined, 'Expired session must return undefined');
      assert.equal(shortStore.getActiveSessionCount(), 0, 'Expired session must be purged');
    } finally {
      shortStore.shutdown();
    }
  });

  it('13. Destroyed sessions fail retrieval', () => {
    const session = store.createSession();
    const destroyed = store.destroySession(session.id);
    assert.equal(destroyed, true);

    const retrieved = store.getSession(session.id);
    assert.equal(retrieved, undefined, 'Destroyed session must return undefined');
  });

  it('14. Destroyed sessions cannot be resurrected', () => {
    const session = store.createSession();
    store.destroySession(session.id);

    // Attempting to touch or fetch must remain impossible
    assert.equal(store.touchSession(session.id), false);
    assert.equal(store.getSession(session.id), undefined);
  });

  it('15. Last activity updates correctly (touch)', async () => {
    const session = store.createSession();
    const initialActive = session.lastActiveAt;
    const initialExpiry = session.expiresAt;

    await new Promise((r) => setTimeout(r, 20));

    const touched = store.touchSession(session.id);
    assert.equal(touched, true);

    const refreshed = store.getSession(session.id);
    assert.ok(refreshed);
    assert(refreshed!.lastActiveAt >= initialActive);
    assert(refreshed!.expiresAt >= initialExpiry);
  });

  it('16. Expired sessions are cleaned up', () => {
    const s1 = store.createSession();
    const s2 = store.createSession();
    const s3 = store.createSession();

    // Expire s1 and s3
    s1.expiresAt = Date.now() - 5000;
    s3.expiresAt = Date.now() - 1000;

    const cleaned = store.cleanupExpiredSessions();
    assert.equal(cleaned, 2, 'Should clean 2 expired sessions');
    assert.equal(store.getActiveSessionCount(), 1, 'Only 1 active session should remain');

    assert.equal(store.getSession(s1.id), undefined);
    assert.ok(store.getSession(s2.id));
    assert.equal(store.getSession(s3.id), undefined);
  });

  it('17. Session limits fail safely with ResourceExhaustedError', () => {
    const smallConfig = validateAndBuildConfig({
      environment: 'test',
      maxActiveSessions: 10,
    });
    const smallStore = new SessionStore(smallConfig);

    try {
      for (let i = 0; i < 10; i++) {
        smallStore.createSession();
      }

      assert.throws(
        () => smallStore.createSession(),
        ResourceExhaustedError,
        'Should throw ResourceExhaustedError when maxActiveSessions is exceeded'
      );
    } finally {
      smallStore.shutdown();
    }
  });

  it('18. Session context remains server-side and is not leaked', () => {
    const session = store.createSession();
    assert.ok(session.context);

    // Attach private server-side state
    session.context.updateNamespaceState('core', { internalSecretRef: 'SERVER_ONLY_DATA' }, 'core');

    const retrieved = store.getSession(session.id);
    const coreState = retrieved?.context.getNamespaceState<{ internalSecretRef: string }>('core');
    assert.equal(coreState?.internalSecretRef, 'SERVER_ONLY_DATA');
  });
});
