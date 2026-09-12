import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ChallengeSessionContext, StateOwnershipError } from '../src/session/session-context.js';

describe('State Ownership Tests (Requirements 19-21)', () => {
  it('19. Module namespaces are isolated from each other', () => {
    const ctx = new ChallengeSessionContext();

    // Module 'metadata' writes to its namespace
    ctx.setNamespaceState('metadata', { instanceId: 'inst-99', tpmQuote: 'QUOTE_0x88' }, 'metadata');

    // Module 'sts' writes to its namespace
    ctx.setNamespaceState('sts', { activeRoleArn: 'arn:strata:iam::role/test' }, 'sts');

    const metaState = ctx.getNamespaceState<{ instanceId: string }>('metadata');
    const stsState = ctx.getNamespaceState<{ activeRoleArn: string }>('sts');

    assert.equal(metaState?.instanceId, 'inst-99');
    assert.equal(stsState?.activeRoleArn, 'arn:strata:iam::role/test');
    assert.notEqual(metaState, stsState);
  });

  it('20. Unauthorized namespace overwrite is rejected', () => {
    const ctx = new ChallengeSessionContext();

    // Module 'identity' attempts to overwrite 'vault' namespace
    assert.throws(
      () => ctx.setNamespaceState('vault', { secretKey: 'hacked' }, 'identity'),
      StateOwnershipError,
      'Identity module must not be allowed to write to Vault namespace'
    );

    // Module 'sts' attempts to overwrite 'metadata' namespace
    assert.throws(
      () => ctx.setNamespaceState('metadata', { tpmQuote: 'fake' }, 'sts'),
      StateOwnershipError,
      'STS module must not be allowed to write to Metadata namespace'
    );
  });

  it('21. State ownership rules are enforced (authorized owner and system can write)', () => {
    const ctx = new ChallengeSessionContext();

    // Legitimate owner writes
    ctx.setNamespaceState('policy', { policyCached: true }, 'policy');
    const policyState = ctx.getNamespaceState<{ policyCached: boolean }>('policy');
    assert.equal(policyState?.policyCached, true);

    // System/Core can manage core namespace
    ctx.setNamespaceState('core', { initializedAt: '2026-01-01', progressionTier: 1 }, 'core');
    const coreState = ctx.getNamespaceState<{ progressionTier: number }>('core');
    assert.equal(coreState?.progressionTier, 1);

    // Non-system cannot overwrite core namespace
    assert.throws(
      () => ctx.setNamespaceState('core', { progressionTier: 99 }, 'sts'),
      StateOwnershipError
    );
  });
});
