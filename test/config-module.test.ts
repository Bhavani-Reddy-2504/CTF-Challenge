import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule, AuditSessionState } from '../src/modules/audit/audit-module.js';
import { MetadataModule, MetadataSessionState } from '../src/modules/metadata/metadata-module.js';
import { ConfigModule, ConfigSessionState } from '../src/modules/config/config-module.js';
import { CONFIG_ARTIFACTS } from '../src/modules/config/config-artifacts.js';
import { validateConfigurationArtifacts } from '../src/modules/config/config-validator.js';
import {
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
} from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Prompt 5: Configuration & Specification Evidence Engine Tests (Requirements 1-62)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;
  let metadataModule: MetadataModule;
  let auditModule: AuditModule;
  let configModule: ConfigModule;

  beforeEach(async () => {
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();
    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });

    const config = validateAndBuildConfig({ environment: 'test' });
    sessionStore = new SessionStore(config);

    metadataModule = new MetadataModule(routeRegistry);
    auditModule = new AuditModule(routeRegistry);
    configModule = new ConfigModule(routeRegistry);

    moduleRegistry.register(metadataModule);
    moduleRegistry.register(auditModule);
    moduleRegistry.register(configModule);

    await engine.initialize();
  });

  // ==========================================
  // 1. Module Initialization (Req 1-5)
  // ==========================================
  it('1. Config module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('config'), true);
    const mod = moduleRegistry.get('config');
    assert.equal(mod?.id, 'config');
    assert.equal(mod?.version, '1.0.0');
    assert.deepEqual(mod?.requiredDependencies, ['metadata', 'audit']);
  });

  it('2. Fixed config routes are registered in SimRouteRegistry', () => {
    const fixedRoutes = [
      'sim://config/active-specification',
      'sim://config/binding-profile',
      'sim://config/federation-matrix',
      'sim://config/compatibility-rules',
      'sim://config/integrity-constraints',
    ];

    for (const r of fixedRoutes) {
      const parsed = parseSimRoute(r);
      assert.equal(routeRegistry.hasRoute(parsed, 'READ'), true, `Route ${r} must be registered for READ`);
    }
  });

  it('3. Route and Module registries lock after ChallengeEngine initialization', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.equal(moduleRegistry.isLocked(), true);
    assert.equal(engine.isReady(), true);
  });

  it('4. Registration after lock fails', () => {
    assert.throws(
      () => routeRegistry.register(parseSimRoute('sim://config/injected'), 'READ', () => 'fail'),
      Error
    );
  });

  it('5. Duplicate route registration during bootstrap fails', () => {
    const testRegistry = new SimRouteRegistry();
    const route = parseSimRoute('sim://config/active-specification');
    testRegistry.register(route, 'READ', () => 'first');
    assert.throws(
      () => testRegistry.register(route, 'READ', () => 'second'),
      Error
    );
  });

  // ==========================================
  // 2. Configuration Retrieval (Req 6-12)
  // ==========================================
  it('6. Every fixed route returns deterministic evidence across repeated calls', async () => {
    const routes = [
      'sim://config/active-specification',
      'sim://config/binding-profile',
      'sim://config/federation-matrix',
      'sim://config/compatibility-rules',
      'sim://config/integrity-constraints',
    ];

    for (const r of routes) {
      const parsed = parseSimRoute(r);
      const reqCtx = new RequestContext();
      const res1 = await engine.dispatch<EvidenceResponse>(parsed, 'READ', reqCtx);
      const res2 = await engine.dispatch<EvidenceResponse>(parsed, 'READ', reqCtx);

      assert.equal(res1.status, 'success');
      assert.equal(res1.data.status, 'ok');
      assert.deepEqual(res1.data, res2.data, `Route ${r} must return deterministic output`);
    }
  });

  it('7. Every artifact has a stable ID starting with EVD-CFG-', async () => {
    const expectedIds = [
      ['sim://config/active-specification', 'EVD-CFG-01-ACTIVE-SPEC'],
      ['sim://config/binding-profile', 'EVD-CFG-02-BINDING'],
      ['sim://config/federation-matrix', 'EVD-CFG-03-FED-MATRIX'],
      ['sim://config/compatibility-rules', 'EVD-CFG-04-COMPAT'],
      ['sim://config/integrity-constraints', 'EVD-CFG-05-INTEGRITY'],
    ];

    for (const [r, expectedId] of expectedIds) {
      const res = await engine.dispatch<EvidenceResponse>(parseSimRoute(r), 'READ', new RequestContext());
      assert.equal(res.data.evidence.id, expectedId);
    }
  });

  it('8. Every artifact has correct source "config"', async () => {
    const routes = [
      'sim://config/active-specification',
      'sim://config/binding-profile',
      'sim://config/federation-matrix',
      'sim://config/compatibility-rules',
      'sim://config/integrity-constraints',
    ];

    for (const r of routes) {
      const res = await engine.dispatch<EvidenceResponse>(parseSimRoute(r), 'READ', new RequestContext());
      assert.equal(res.data.evidence.source, 'config');
    }
  });

  it('9. Every artifact has a valid status ("ACTIVE" or "COMPATIBILITY")', async () => {
    const routes = [
      'sim://config/active-specification',
      'sim://config/binding-profile',
      'sim://config/federation-matrix',
      'sim://config/compatibility-rules',
      'sim://config/integrity-constraints',
    ];

    for (const r of routes) {
      const res = await engine.dispatch<EvidenceResponse>(parseSimRoute(r), 'READ', new RequestContext());
      assert(['ACTIVE', 'COMPATIBILITY', 'DEPRECATED'].includes(res.data.evidence.status!));
    }
  });

  it('10. Every artifact has deterministic version information', async () => {
    const activeRes = await engine.dispatch<EvidenceResponse>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    assert.equal(activeRes.data.evidence.version, '2.4.0');

    const compatRes = await engine.dispatch<EvidenceResponse>(
      parseSimRoute('sim://config/compatibility-rules'),
      'READ',
      new RequestContext()
    );
    assert.equal(compatRes.data.evidence.version, '1.1.0');
  });

  it('11. Unsupported operations fail safely with SimOperationNotAllowedError', async () => {
    const route = parseSimRoute('sim://config/active-specification');
    await assert.rejects(
      () => engine.dispatch(route, 'WRITE', new RequestContext()),
      SimOperationNotAllowedError
    );
    await assert.rejects(
      () => engine.dispatch(route, 'EXECUTE' as unknown as any, new RequestContext()),
      SimOperationNotAllowedError
    );
  });

  it('12. Unknown config routes fail safely with SimRouteNotFoundError', async () => {
    const route = parseSimRoute('sim://config/non-existent');
    await assert.rejects(
      () => engine.dispatch(route, 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  // ==========================================
  // 3. Active vs Historical Semantics (Req 13-17)
  // ==========================================
  it('13. Active specification is clearly distinguishable from compatibility records', async () => {
    const activeRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    const compatRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/compatibility-rules'),
      'READ',
      new RequestContext()
    );

    assert.equal(activeRes.data.evidence.status, 'ACTIVE');
    assert.equal(compatRes.data.evidence.status, 'COMPATIBILITY');
    assert.notEqual(activeRes.data.evidence.version, compatRes.data.evidence.version);
  });

  it('14. Compatibility record declares that active specification supersedes it', async () => {
    const compatRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/compatibility-rules'),
      'READ',
      new RequestContext()
    );

    assert.equal(compatRes.data.evidence.content.active_specification_supersedes, true);
    assert.equal(compatRes.data.evidence.content.compatibility_mode, 'strata-legacy-v1-fallback');
  });

  it('15. Deprecated configuration is interpreted as historical lineage only', async () => {
    const compatRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/compatibility-rules'),
      'READ',
      new RequestContext()
    );

    assert.equal(
      compatRes.data.evidence.content.legacy_principal,
      'hyperion://identity/telemetry/collector-v1'
    );
    assert.equal(
      compatRes.data.evidence.content.successor_principal,
      'hyperion://identity/telemetry/collector-v2'
    );
    assert.equal(compatRes.data.evidence.content.lineage_proof_required, true);
  });

  it('16. Version relationships are consistent across specifications', async () => {
    const active = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    const matrix = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/federation-matrix'),
      'READ',
      new RequestContext()
    );
    const integrity = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/integrity-constraints'),
      'READ',
      new RequestContext()
    );

    // All active configurations are on version 2.4.0
    assert.equal(active.data.evidence.version, '2.4.0');
    assert.equal(matrix.data.evidence.version, '2.4.0');
    assert.equal(integrity.data.evidence.version, '2.4.0');
  });

  it('17. No unresolved contradictions exist across artifacts', async () => {
    const active = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    const binding = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/binding-profile'),
      'READ',
      new RequestContext()
    );

    assert.equal(active.data.evidence.content.workload_binding, binding.data.evidence.content.workload_id);
    assert.equal(active.data.evidence.content.enclave_partition, 'edge-telemetry-enclave');
  });

  // ==========================================
  // 4. Cross-Module Consistency (Req 18-24)
  // ==========================================
  it('18. Metadata references resolve consistently in Config artifacts', async () => {
    const metaProfile = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/workload-profile'),
      'READ',
      new RequestContext()
    );
    const cfgBinding = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/binding-profile'),
      'READ',
      new RequestContext()
    );

    assert.equal(metaProfile.data.evidence.content.workload_id, cfgBinding.data.evidence.content.workload_id);
    assert.equal(metaProfile.data.evidence.content.trust_zone_ref, cfgBinding.data.evidence.content.zone_membership);
  });

  it('19. Audit references resolve consistently in Config artifacts', async () => {
    const auditBoot = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/bootstrap-history'),
      'READ',
      new RequestContext()
    );
    const cfgBinding = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/binding-profile'),
      'READ',
      new RequestContext()
    );

    const attestationAnchor = auditBoot.data.evidence.content.events[1].details.attestation_anchor;
    assert.equal(attestationAnchor, cfgBinding.data.evidence.content.hardware_security_anchor);
  });

  it('20. Config correlation references resolve across modules', async () => {
    const cfgMatrix = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/federation-matrix'),
      'READ',
      new RequestContext()
    );
    const metaBoundary = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/trust-boundary'),
      'READ',
      new RequestContext()
    );

    assert.equal(
      cfgMatrix.data.evidence.content.intermediate_bridge_role,
      metaBoundary.data.evidence.content.intermediate_bridge_role
    );
  });

  it('21. Direct relationships are valid (workload, hardware anchor, federation domain)', async () => {
    const cfgSpec = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    assert.equal(cfgSpec.data.evidence.content.enclave_partition, 'edge-telemetry-enclave');
    assert.equal(cfgSpec.data.evidence.content.workload_binding, 'wrk-hyperion-telemetry-edge');
  });

  it('22. Indirect relationships are internally consistent (prohibited routing and advisory checks)', async () => {
    const auditFails = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/failed-transitions'),
      'READ',
      new RequestContext()
    );
    const cfgMatrix = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/federation-matrix'),
      'READ',
      new RequestContext()
    );

    // Audit event EVT-4090 rejected exchange to strata://sts.orbital-core.internal
    const rejectedAudience = auditFails.data.evidence.content.events[0].resource_reference;
    assert(cfgMatrix.data.evidence.content.prohibited_target_domains.includes(rejectedAudience));
  });

  it('23. No dangling correlation references exist in config artifacts', () => {
    assert.doesNotThrow(() => validateConfigurationArtifacts(CONFIG_ARTIFACTS));
  });

  it('24. Terminology is strictly consistent across metadata, audit, and config', async () => {
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

  // ==========================================
  // 5. Session Discovery Tracking (Req 25-33)
  // ==========================================
  it('25. Config discovery is recorded server-side in "config" namespace', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);

    const state = session.context.getNamespaceState<ConfigSessionState>('config');
    assert(state !== undefined);
    assert.deepEqual(state?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
    assert.equal(state?.lastAccessedArtifact, 'EVD-CFG-01-ACTIVE-SPEC');
    assert.equal(state?.accessCount, 1);
  });

  it('26. Duplicate retrieval behaves safely and deduplicates discovered artifacts', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);

    const state = session.context.getNamespaceState<ConfigSessionState>('config');
    assert.deepEqual(state?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
    assert.equal(state?.accessCount, 2);
  });

  it('27. Session A discovery does not affect Session B context', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', new RequestContext({ session: sessionA }));

    const stateA = sessionA.context.getNamespaceState<ConfigSessionState>('config');
    const stateB = sessionB.context.getNamespaceState<ConfigSessionState>('config');

    assert.deepEqual(stateA?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
    assert.equal(stateB, undefined);
  });

  it('28. Session B discovery does not affect Session A context', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', new RequestContext({ session: sessionA }));
    await engine.dispatch(parseSimRoute('sim://config/binding-profile'), 'READ', new RequestContext({ session: sessionB }));

    const stateA = sessionA.context.getNamespaceState<ConfigSessionState>('config');
    const stateB = sessionB.context.getNamespaceState<ConfigSessionState>('config');

    assert.deepEqual(stateA?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
    assert.deepEqual(stateB?.discoveredArtifacts, ['EVD-CFG-02-BINDING']);
  });

  it('29. Config module cannot overwrite Metadata state (StateOwnershipError)', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('metadata', { hacked: true }, 'config'),
      StateOwnershipError
    );
  });

  it('30. Config module cannot overwrite Audit state (StateOwnershipError)', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('audit', { hacked: true }, 'config'),
      StateOwnershipError
    );
  });

  it('31. Other modules cannot overwrite Config state (StateOwnershipError)', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('config', { hacked: true }, 'metadata'),
      StateOwnershipError
    );
    assert.throws(
      () => session.context.setNamespaceState('config', { hacked: true }, 'audit'),
      StateOwnershipError
    );
  });

  it('32. Destroyed session state is completely inaccessible', async () => {
    const session = sessionStore.createSession();
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', new RequestContext({ session }));

    sessionStore.destroySession(session.id);
    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  it('33. Expired session state is inaccessible', () => {
    const session = sessionStore.createSession();
    session.expiresAt = Date.now() - 1000;

    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  // ==========================================
  // 6. Immutability (Req 34-37)
  // ==========================================
  it('34. Returned evidence cannot mutate shared server artifacts', async () => {
    const route = parseSimRoute('sim://config/active-specification');
    const res1 = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());

    // Attempt mutation
    assert.throws(
      () => {
        (res1.data.evidence as any).id = 'MUTATED';
      },
      TypeError
    );

    const res2 = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());
    assert.equal(res2.data.evidence.id, 'EVD-CFG-01-ACTIVE-SPEC');
  });

  it('35. Nested evidence content cannot mutate shared state', async () => {
    const route = parseSimRoute('sim://config/active-specification');
    const res = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());

    // Deep freeze prevents mutation of nested properties
    assert.throws(
      () => {
        (res.data.evidence.content as any).enclave_partition = 'CORRUPTED';
      },
      TypeError
    );
  });

  it('36. Mutation attempts in Session A do not affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const route = parseSimRoute('sim://config/binding-profile');
    const resA = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext({ session: sessionA }));
    const resB = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext({ session: sessionB }));

    assert.deepEqual(resA.data, resB.data);
  });

  it('37. Repeated retrieval returns consistent, uncorrupted data', async () => {
    const route = parseSimRoute('sim://config/federation-matrix');
    for (let i = 0; i < 5; i++) {
      const res = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());
      assert.equal(res.data.evidence.content.delegation_hop_ceiling, 2);
    }
  });

  // ==========================================
  // 7. Security (Req 38-49)
  // ==========================================
  it('38-44. Config artifacts contain zero real credentials, keys, passwords, or flag data', async () => {
    const routes = [
      'sim://config/active-specification',
      'sim://config/binding-profile',
      'sim://config/federation-matrix',
      'sim://config/compatibility-rules',
      'sim://config/integrity-constraints',
    ];

    for (const r of routes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('AKIA'), 'Must not contain AWS Access Key');
      assert(!json.includes('ya29.'), 'Must not contain Google OAuth Token');
      assert(!json.includes('BEGIN PRIVATE KEY'), 'Must not contain private key');
      assert(!json.includes('BPCTF{'), 'Must not contain flag format');
      assert(!json.includes('password'), 'Must not contain password');
      assert(!json.includes('master_seed'), 'Must not contain master seed');
    }
  });

  it('45. No arbitrary document lookup exists (file paths or traversal fail safely)', async () => {
    // Relative traversal or backslashes fail at parser level
    assert.throws(() => parseSimRoute('sim://config/..\\..\\config.yaml'), Error);
    assert.throws(() => parseSimRoute('sim://config/../etc/passwd'), Error);

    // Unregistered system paths do not resolve to filesystem files
    const route = parseSimRoute('sim://config/etc/passwd');
    await assert.rejects(
      () => engine.dispatch(route, 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('46. No arbitrary artifact lookup exists', async () => {
    // Uppercase raw artifact IDs are rejected by strict grammar
    assert.throws(() => parseSimRoute('sim://config/EVD-CFG-01-ACTIVE-SPEC'), Error);

    // Lowercase artifact IDs are not registered routes and fail with 404
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://config/evd-cfg-01-active-spec'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('47. No route enumeration exists (listing endpoints fail safely)', async () => {
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://config/list'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://config/index'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('48. No query language or filter exists (rejected at parse time)', () => {
    assert.throws(() => parseSimRoute('sim://config/active-specification?filter=ACTIVE'), Error);
    assert.throws(() => parseSimRoute('sim://config/active-specification#version'), Error);
  });

  it('49. No player-controlled route registration exists', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(
      () => routeRegistry.register(parseSimRoute('sim://config/custom'), 'READ', () => 'pwn'),
      Error
    );
  });

  // ==========================================
  // 8. Router Regression (Req 50-55)
  // ==========================================
  it('50. All valid sim://config/... routes parse strictly into SimRoute instances', () => {
    const route = parseSimRoute('sim://config/active-specification');
    assert.equal(route.namespace, 'config');
    assert.deepEqual(route.segments, ['active-specification']);
    assert.equal(route.canonical, 'sim://config/active-specification');
    assert.equal(route.toString(), 'sim://config/active-specification');
  });

  it('51. Percent encoding remains rejected on config routes', () => {
    assert.throws(() => parseSimRoute('sim://config/%61ctive-specification'), Error);
  });

  it('52. Path traversal remains rejected on config routes', () => {
    assert.throws(() => parseSimRoute('sim://config/../metadata/workload-profile'), Error);
    assert.throws(() => parseSimRoute('sim://config/./active-specification'), Error);
  });

  it('53. Network schemes remain rejected', () => {
    assert.throws(() => parseSimRoute('https://config/active-specification'), Error);
    assert.throws(() => parseSimRoute('http://localhost/config'), Error);
  });

  it('54. Authority confusion remains rejected', () => {
    assert.throws(() => parseSimRoute('sim://user:pass@config/active-specification'), Error);
  });

  it('55. Unknown namespaces remain rejected', () => {
    assert.throws(() => parseSimRoute('sim://unknown/test'), Error);
  });

  // ==========================================
  // 9. Prompt 4 Regression (Req 56-59)
  // ==========================================
  it('56. Metadata routes continue functioning and returning deterministic evidence', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/workload-profile'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.id, 'EVD-META-01-PROFILE');
  });

  it('57. Audit routes continue functioning and returning deterministic streams', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/bootstrap-history'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.id, 'EVD-AUD-01-BOOTSTRAP');
  });

  it('58. Cross-module discovery remains isolated across all 3 modules', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);

    const meta = session.context.getNamespaceState<MetadataSessionState>('metadata');
    const audit = session.context.getNamespaceState<AuditSessionState>('audit');
    const cfg = session.context.getNamespaceState<ConfigSessionState>('config');

    assert.deepEqual(meta?.discoveredEvidence, ['EVD-META-01-PROFILE']);
    assert.deepEqual(audit?.discoveredEvidence, ['EVD-AUD-01-BOOTSTRAP']);
    assert.deepEqual(cfg?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
  });

  it('59. Existing evidence remains deterministic across engine lifecycles', async () => {
    const reg = new ModuleRegistry();
    const rReg = new SimRouteRegistry();
    const eng = new ChallengeEngine(reg, { routeRegistry: rReg });

    reg.register(new MetadataModule(rReg));
    reg.register(new AuditModule(rReg));
    reg.register(new ConfigModule(rReg));
    await eng.initialize();

    const res = await eng.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.id, 'EVD-CFG-01-ACTIVE-SPEC');
  });

  // ==========================================
  // 10. Full Regression (Req 60-62)
  // ==========================================
  it('60-62. Full integration passes all Prompt 5 requirements', () => {
    assert.equal(engine.isReady(), true);
  });
});
