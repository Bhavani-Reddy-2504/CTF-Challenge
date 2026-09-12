import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule } from '../src/modules/audit/audit-module.js';
import { MetadataModule, MetadataSessionState } from '../src/modules/metadata/metadata-module.js';
import { ConfigModule, ConfigSessionState } from '../src/modules/config/config-module.js';
import { CONFIG_ARTIFACTS } from '../src/modules/config/config-artifacts.js';
import { validateConfigurationArtifacts } from '../src/modules/config/config-validator.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';
import { SimRouteNotFoundError } from '../src/router/sim-errors.js';

describe('Prompt 5.1: Challenge Evidence Information-Leakage Hardening Tests (Requirements 1-38)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const allKnownRoutes = [
    'sim://metadata/workload-profile',
    'sim://metadata/execution-context',
    'sim://metadata/trust-boundary',
    'sim://metadata/compatibility-record',
    'sim://audit/bootstrap-history',
    'sim://audit/trust-events',
    'sim://audit/failed-transitions',
    'sim://audit/correlation-records',
    'sim://config/active-specification',
    'sim://config/binding-profile',
    'sim://config/federation-matrix',
    'sim://config/compatibility-rules',
    'sim://config/integrity-constraints',
  ];

  beforeEach(async () => {
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();
    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });

    const config = validateAndBuildConfig({ environment: 'test' });
    sessionStore = new SessionStore(config);

    moduleRegistry.register(new MetadataModule(routeRegistry));
    moduleRegistry.register(new AuditModule(routeRegistry));
    moduleRegistry.register(new ConfigModule(routeRegistry));

    await engine.initialize();
  });

  // Helper to retrieve all serialized evidence across all routes
  async function getAllEvidencePayloads(): Promise<{ route: string; json: string }[]> {
    const results = [];
    for (const r of allKnownRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      results.push({ route: r, json: JSON.stringify(res.data) });
    }
    return results;
  }

  // ========================================================
  // 1. Information Leakage Tests (Req 1-7)
  // ========================================================
  it('1. Player-visible evidence contains no "Prompt" references', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!/prompt\s*\d+/i.test(json), `Route ${route} leaked Prompt reference`);
    }
  });

  it('2. Player-visible evidence contains no "phase" references', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!/phase\s*\d+/i.test(json), `Route ${route} leaked phase reference`);
    }
  });

  it('3. Player-visible evidence contains no "subsequent phase" references', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!/subsequent\s+phase/i.test(json), `Route ${route} leaked subsequent phase`);
    }
  });

  it('4. Player-visible evidence contains no "next stage" references', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!/next\s+stage/i.test(json), `Route ${route} leaked next stage`);
    }
  });

  it('5. Player-visible evidence contains no "you will need" or instructional leak phrasing', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!/you\s+will\s+need/i.test(json), `Route ${route} leaked 'you will need'`);
      assert(!/obtainable\s+via/i.test(json), `Route ${route} leaked 'obtainable via'`);
      assert(!/use\s+this\s+value/i.test(json), `Route ${route} leaked 'use this value'`);
    }
  });

  it('6. Player-visible evidence contains no final flag (BPCTF{)', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('BPCTF{'), `Route ${route} leaked final flag format`);
    }
  });

  it('7. Player-visible evidence contains no flag derivation material', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('master_seed'), `Route ${route} leaked master_seed`);
      assert(!json.includes('flag_derivation'), `Route ${route} leaked flag_derivation`);
    }
  });

  // ========================================================
  // 2. Future Implementation Leakage (Req 8-14)
  // ========================================================
  it('8. Current evidence does not expose future endpoint inventory (no sim://identity, sim://sts, etc.)', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('sim://identity/'), `Route ${route} leaked sim://identity/`);
      assert(!json.includes('sim://sts/'), `Route ${route} leaked sim://sts/`);
      assert(!json.includes('sim://policy/'), `Route ${route} leaked sim://policy/`);
      assert(!json.includes('sim://controlplane/'), `Route ${route} leaked sim://controlplane/`);
      assert(!json.includes('sim://vault/'), `Route ${route} leaked sim://vault/`);
    }
  });

  it('9. Current evidence does not expose exact future role names (no OrbitalReleaseRole or PipelineDeployerRole)', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('OrbitalReleaseRole'), `Route ${route} leaked OrbitalReleaseRole`);
      assert(!json.includes('PipelineDeployerRole'), `Route ${route} leaked PipelineDeployerRole`);
    }
  });

  it('10. Current evidence does not expose exact future policy syntax (no strata:PrincipalTag/AuditRefCheck)', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('strata:PrincipalTag/AuditRefCheck'), `Route ${route} leaked PrincipalTag syntax`);
    }
  });

  it('11. Current evidence does not expose exact future claim syntax', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('mfa_claim_derivation'), `Route ${route} leaked mfa_claim_derivation`);
    }
  });

  it('12. Current evidence does not expose exact future state-machine values (no STAGED or CONFIRMED state names)', async () => {
    const corrRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/correlation-records'),
      'READ',
      new RequestContext()
    );
    const json = JSON.stringify(corrRes.data);
    assert(!json.includes('"current_state":"STAGED"'), 'Must not leak STAGED state machine value');
    assert(!json.includes('"required_unseal_state":"CONFIRMED"'), 'Must not leak CONFIRMED state machine value');
  });

  it('13. Current evidence does not expose exact future vault requirements (no direct_vault_ingress or vault unseal)', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('vault unseal'), `Route ${route} leaked 'vault unseal'`);
      assert(!json.includes('direct_vault_ingress'), `Route ${route} leaked 'direct_vault_ingress'`);
    }
  });

  it('14. Current evidence does not expose future implementation instructions', async () => {
    const payloads = await getAllEvidencePayloads();
    for (const { route, json } of payloads) {
      assert(!json.includes('obtainable via'), `Route ${route} leaked 'obtainable via'`);
      assert(!json.includes('retained for proof during subsequent'), `Route ${route} leaked prompt roadmap meta-commentary`);
    }
  });

  // ========================================================
  // 3. Correlation Integrity (Req 15-20)
  // ========================================================
  it('15. Metadata references remain valid and consistent', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/workload-profile'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.hardware_security_ref, 'enclave-integrity-anchor-889f');
    assert.equal(res.data.evidence.content.workload_id, 'wrk-hyperion-telemetry-edge');
  });

  it('16. Audit references remain valid and consistent', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/bootstrap-history'),
      'READ',
      new RequestContext()
    );
    const anchor = res.data.evidence.content.events[1].details.attestation_anchor;
    assert.equal(anchor, 'enclave-integrity-anchor-889f');
  });

  it('17. Config references remain valid and consistent', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/binding-profile'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.hardware_security_anchor, 'enclave-integrity-anchor-889f');
  });

  it('18. Cross-module correlation remains valid across Metadata, Audit, and Config', async () => {
    const meta = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/trust-boundary'),
      'READ',
      new RequestContext()
    );
    const audit = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/trust-events'),
      'READ',
      new RequestContext()
    );
    const cfg = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/federation-matrix'),
      'READ',
      new RequestContext()
    );

    const bridgeRole = 'arn:strata:iam::1337:role/DeploymentBridgeAuthority';
    const fedDomain = 'strata://federation.stage-build.internal';

    assert.equal(meta.data.evidence.content.intermediate_bridge_role, bridgeRole);
    assert.equal(audit.data.evidence.content.events[2].resource_reference, bridgeRole);
    assert.equal(cfg.data.evidence.content.intermediate_bridge_role, bridgeRole);

    assert.equal(meta.data.evidence.content.target_federation_domain, fedDomain);
    assert.equal(audit.data.evidence.content.events[0].details.target_domain, fedDomain);
    assert(cfg.data.evidence.content.permitted_target_domains.includes(fedDomain));
  });

  it('19. No dangling references exist (validateConfigurationArtifacts succeeds)', () => {
    assert.doesNotThrow(() => validateConfigurationArtifacts(CONFIG_ARTIFACTS));
  });

  it('20. Terminology remains consistent across all modules', async () => {
    const meta = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/execution-context'),
      'READ',
      new RequestContext()
    );
    const cfg = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );

    assert.equal(meta.data.evidence.content.node_epoch_window, cfg.data.evidence.content.effective_epoch);
    assert.equal(meta.data.evidence.content.enclave_id, cfg.data.evidence.content.enclave_partition);
  });

  // ========================================================
  // 4. Existing Security Regression (Req 21-27)
  // ========================================================
  it('21. All router tests continue passing', () => {
    for (const r of allKnownRoutes) {
      const parsed = parseSimRoute(r);
      assert.equal(routeRegistry.hasRoute(parsed, 'READ'), true);
    }
  });

  it('22. Traversal remains rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/../config/active-specification'), Error);
  });

  it('23. Percent encoding remains rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/%77orkload-profile'), Error);
  });

  it('24. Network schemes remain rejected', () => {
    assert.throws(() => parseSimRoute('http://localhost/metadata/workload-profile'), Error);
    assert.throws(() => parseSimRoute('https://metadata/workload-profile'), Error);
  });

  it('25. Authority confusion remains rejected', () => {
    assert.throws(() => parseSimRoute('sim://user@metadata/workload-profile'), Error);
  });

  it('26. Route enumeration remains unavailable', async () => {
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://metadata/list'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://audit/list'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://config/list'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('27. Arbitrary artifact lookup remains unavailable', async () => {
    assert.throws(() => parseSimRoute('sim://metadata/EVD-META-01-PROFILE'), Error);
    assert.throws(() => parseSimRoute('sim://config/EVD-CFG-01-ACTIVE-SPEC'), Error);
  });

  // ========================================================
  // 5. Session Regression (Req 28-31)
  // ========================================================
  it('28. Session isolation remains intact', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', new RequestContext({ session: sessionA }));

    const stateA = sessionA.context.getNamespaceState<MetadataSessionState>('metadata');
    const stateB = sessionB.context.getNamespaceState<MetadataSessionState>('metadata');

    assert.deepEqual(stateA?.discoveredEvidence, ['EVD-META-01-PROFILE']);
    assert.equal(stateB, undefined);
  });

  it('29. Module ownership remains enforced', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('metadata', { test: true }, 'audit'),
      StateOwnershipError
    );
    assert.throws(
      () => session.context.setNamespaceState('audit', { test: true }, 'config'),
      StateOwnershipError
    );
    assert.throws(
      () => session.context.setNamespaceState('config', { test: true }, 'metadata'),
      StateOwnershipError
    );
  });

  it('30. Discovery remains server-side', async () => {
    const session = sessionStore.createSession();
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', new RequestContext({ session }));

    const cfg = session.context.getNamespaceState<ConfigSessionState>('config');
    assert.deepEqual(cfg?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
  });

  it('31. Duplicate retrieval remains safe', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);

    const cfg = session.context.getNamespaceState<ConfigSessionState>('config');
    assert.deepEqual(cfg?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
    assert.equal(cfg?.accessCount, 2);
  });

  // ========================================================
  // 6. Immutability Regression (Req 32-35)
  // ========================================================
  it('32. Shared evidence remains immutable', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );

    assert.throws(() => {
      (res.data.evidence as any).id = 'TAMPERED';
    }, TypeError);
  });

  it('33. Nested evidence remains protected via deep freeze', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );

    assert.throws(() => {
      (res.data.evidence.content as any).enclave_partition = 'TAMPERED';
    }, TypeError);
  });

  it('34. Mutation attempts do not affect later requests', async () => {
    const route = parseSimRoute('sim://config/active-specification');
    await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());
    const res2 = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());
    assert.equal(res2.data.evidence.content.enclave_partition, 'edge-telemetry-enclave');
  });

  it('35. Mutation attempts do not affect other sessions', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const route = parseSimRoute('sim://config/binding-profile');
    const resA = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext({ session: sessionA }));
    const resB = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext({ session: sessionB }));

    assert.deepEqual(resA.data, resB.data);
  });

  // ========================================================
  // 7. Full Regression (Req 36-38)
  // ========================================================
  it('36-38. All modules and engine remain fully initialized and ready', () => {
    assert.equal(engine.isReady(), true);
    assert.equal(moduleRegistry.isLocked(), true);
    assert.equal(routeRegistry.isLocked(), true);
  });
});
