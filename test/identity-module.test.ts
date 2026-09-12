import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule, AuditSessionState } from '../src/modules/audit/audit-module.js';
import { MetadataModule, MetadataSessionState } from '../src/modules/metadata/metadata-module.js';
import { ConfigModule, ConfigSessionState } from '../src/modules/config/config-module.js';
import { IdentityModule, IdentitySessionState } from '../src/modules/identity/identity-module.js';
import { IDENTITY_ARTIFACTS } from '../src/modules/identity/identity-artifacts.js';
import {
  IdentityConsistencyError,
  validateIdentityArtifacts,
} from '../src/modules/identity/identity-validator.js';
import {
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
} from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Prompt 6: Identity Context & Trust Resolution Foundation Tests (Requirements 1-64)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const fixedIdentityRoutes = [
    'sim://identity/context',
    'sim://identity/binding',
    'sim://identity/trust-membership',
    'sim://identity/lineage',
    'sim://identity/compatibility',
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
    moduleRegistry.register(new IdentityModule(routeRegistry));

    await engine.initialize();
  });

  // ========================================================
  // 1. Module Initialization (Req 1-4)
  // ========================================================
  it('1. Identity module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('identity'), true);
    const mod = moduleRegistry.get('identity');
    assert.equal(mod?.id, 'identity');
    assert.equal(mod?.version, '1.0.0');
    assert.deepEqual(mod?.requiredDependencies, ['metadata', 'audit', 'config']);
  });

  it('2. Fixed identity routes register successfully in SimRouteRegistry', () => {
    for (const r of fixedIdentityRoutes) {
      const parsed = parseSimRoute(r);
      assert.equal(routeRegistry.hasRoute(parsed, 'READ'), true, `Route ${r} must be registered`);
    }
  });

  it('3. Duplicate identity route registration during initialization fails', () => {
    const testRegistry = new SimRouteRegistry();
    const route = parseSimRoute('sim://identity/context');
    testRegistry.register(route, 'READ', () => 'first');
    assert.throws(
      () => testRegistry.register(route, 'READ', () => 'second'),
      Error
    );
  });

  it('4. Registration after engine lock fails', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(
      () => routeRegistry.register(parseSimRoute('sim://identity/injected'), 'READ', () => 'pwn'),
      Error
    );
  });

  // ========================================================
  // 2. Retrieval (Req 5-9)
  // ========================================================
  it('5. Each fixed route returns deterministic evidence across repeated calls', async () => {
    for (const r of fixedIdentityRoutes) {
      const parsed = parseSimRoute(r);
      const reqCtx = new RequestContext();
      const res1 = await engine.dispatch<EvidenceResponse>(parsed, 'READ', reqCtx);
      const res2 = await engine.dispatch<EvidenceResponse>(parsed, 'READ', reqCtx);

      assert.equal(res1.status, 'success');
      assert.equal(res1.data.status, 'ok');
      assert.deepEqual(res1.data, res2.data, `Route ${r} must be completely deterministic`);
    }
  });

  it('6. Evidence IDs are stable and start with EVD-IDN-', async () => {
    const expected = [
      ['sim://identity/context', 'EVD-IDN-01-CONTEXT'],
      ['sim://identity/binding', 'EVD-IDN-02-BINDING'],
      ['sim://identity/trust-membership', 'EVD-IDN-03-TRUST-MEMBERSHIP'],
      ['sim://identity/lineage', 'EVD-IDN-04-LINEAGE'],
      ['sim://identity/compatibility', 'EVD-IDN-05-COMPAT'],
    ];

    for (const [r, id] of expected) {
      const res = await engine.dispatch<EvidenceResponse>(parseSimRoute(r), 'READ', new RequestContext());
      assert.equal(res.data.evidence.id, id);
    }
  });

  it('7. Evidence source is strictly "identity"', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse>(parseSimRoute(r), 'READ', new RequestContext());
      assert.equal(res.data.evidence.source, 'identity');
    }
  });

  it('8. Unsupported operations fail safely with SimOperationNotAllowedError', async () => {
    const route = parseSimRoute('sim://identity/context');
    await assert.rejects(
      () => engine.dispatch(route, 'WRITE', new RequestContext()),
      SimOperationNotAllowedError
    );
  });

  it('9. Unknown routes fail safely with SimRouteNotFoundError', async () => {
    const route = parseSimRoute('sim://identity/non-existent');
    await assert.rejects(
      () => engine.dispatch(route, 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  // ========================================================
  // 3. Identity Semantics (Req 10-17)
  // ========================================================
  it('10. Identity context is internally valid and resolved', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/context'),
      'READ',
      new RequestContext()
    );
    assert.equal(
      res.data.evidence.content.logical_identity_id,
      'hyperion://identity/telemetry/collector-v2'
    );
    assert.equal(res.data.evidence.content.resolution_state, 'RESOLVED_ACTIVE');
  });

  it('11. Binding references resolve and bind to hardware integrity anchor', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/binding'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.bound_workload, 'wrk-hyperion-telemetry-edge');
    assert.equal(res.data.evidence.content.integrity_anchor_ref, 'enclave-integrity-anchor-889f');
    assert.equal(res.data.evidence.content.binding_verification, 'anchor-consistent');
  });

  it('12. Trust references resolve to recognized trust zone and federation boundary', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/trust-membership'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.primary_trust_zone, 'trust-zone-alpha');
    assert.equal(
      res.data.evidence.content.federation_boundary_ref,
      'strata://federation.stage-build.internal'
    );
  });

  it('13. Lineage references resolve historical succession from v1 to v2', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/lineage'),
      'READ',
      new RequestContext()
    );
    assert.equal(
      res.data.evidence.content.current_active_identity,
      'hyperion://identity/telemetry/collector-v2'
    );
    assert.equal(
      res.data.evidence.content.predecessor_identity,
      'hyperion://identity/telemetry/collector-v1'
    );
    assert.equal(res.data.evidence.content.historical_deployment_ref, 'REF-CORR-99201-B');
  });

  it('14. Compatibility references resolve historical trace REF-CORR-99201-B', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/compatibility'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.preserved_lineage_trace, 'REF-CORR-99201-B');
    assert.equal(res.data.evidence.content.compatibility_mode, 'strata-legacy-v1-fallback');
  });

  it('15. Declared and effective contexts are distinguishable', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/compatibility'),
      'READ',
      new RequestContext()
    );
    assert.equal(
      res.data.evidence.content.declared_identity_ref,
      'hyperion://identity/telemetry/collector-v1'
    );
    assert.equal(res.data.evidence.content.compatibility_interpretation, 'HISTORICAL_ONLY');
  });

  it('16. Active information takes precedence over compatibility information', async () => {
    const activeRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/context'),
      'READ',
      new RequestContext()
    );
    const compatRes = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/compatibility'),
      'READ',
      new RequestContext()
    );

    assert.equal(activeRes.data.evidence.status, 'ACTIVE');
    assert.equal(compatRes.data.evidence.status, 'COMPATIBILITY');
    assert.equal(compatRes.data.evidence.content.active_specification_precedence, true);
  });

  it('17. Compatibility does not override active context', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/compatibility'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.compatibility_interpretation, 'HISTORICAL_ONLY');
    assert.match(
      res.data.evidence.content.resolution_principle,
      /active specification takes precedence/i
    );
  });

  // ========================================================
  // 4. Cross-Module Consistency (Req 18-23)
  // ========================================================
  it('18. Metadata references resolve consistently in Identity artifacts', async () => {
    const meta = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/workload-profile'),
      'READ',
      new RequestContext()
    );
    const idn = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/context'),
      'READ',
      new RequestContext()
    );

    assert.equal(meta.data.evidence.content.workload_id, idn.data.evidence.content.workload_association);
    assert.equal(meta.data.evidence.content.active_service_account, idn.data.evidence.content.logical_identity_id);
  });

  it('19. Audit references resolve consistently in Identity artifacts', async () => {
    const auditBoot = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/bootstrap-history'),
      'READ',
      new RequestContext()
    );
    const idnBinding = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/binding'),
      'READ',
      new RequestContext()
    );

    assert.equal(
      auditBoot.data.evidence.content.events[1].details.attestation_anchor,
      idnBinding.data.evidence.content.integrity_anchor_ref
    );
  });

  it('20. Config references resolve consistently in Identity artifacts', async () => {
    const cfgSpec = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    const idnContext = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/context'),
      'READ',
      new RequestContext()
    );

    assert.equal(
      cfgSpec.data.evidence.content.authoritative_principal,
      idnContext.data.evidence.content.logical_identity_id
    );
  });

  it('21. Direct relationships are valid across modules', async () => {
    const idnBinding = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/binding'),
      'READ',
      new RequestContext()
    );
    const cfgBinding = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/binding-profile'),
      'READ',
      new RequestContext()
    );

    assert.equal(idnBinding.data.evidence.content.bound_workload, cfgBinding.data.evidence.content.workload_id);
    assert.equal(
      idnBinding.data.evidence.content.integrity_anchor_ref,
      cfgBinding.data.evidence.content.hardware_security_anchor
    );
  });

  it('22. Indirect relationships are internally consistent across modules', async () => {
    const auditFails = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/failed-transitions'),
      'READ',
      new RequestContext()
    );
    const idnLineage = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/lineage'),
      'READ',
      new RequestContext()
    );

    assert.equal(
      auditFails.data.evidence.content.events[2].details.supersedes,
      idnLineage.data.evidence.content.predecessor_identity
    );
    assert.equal(
      auditFails.data.evidence.content.events[2].resource_reference,
      idnLineage.data.evidence.content.current_active_identity
    );
  });

  it('23. No dangling references exist in Identity artifacts', () => {
    assert.doesNotThrow(() => validateIdentityArtifacts(IDENTITY_ARTIFACTS));
  });

  // ========================================================
  // 5. Trust Distinction (Req 24-26)
  // ========================================================
  it('24. Identity does not imply authority (effective_authority_granted is false)', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/context'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.effective_authority_granted, false);
  });

  it('25. Trust membership does not imply authority (authority_conferred is false)', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/trust-membership'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.content.authority_conferred, false);
    assert.match(
      res.data.evidence.content.boundary_principle,
      /trust membership establishes boundary recognition; execution authority requires explicit downstream governance verification/i
    );
  });

  it('26. Identity binding does not expose permissions or role grants', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/binding'),
      'READ',
      new RequestContext()
    );
    const json = JSON.stringify(res.data);
    assert(!json.includes('permissions'));
    assert(!json.includes('allow'));
    assert(!json.includes('grant'));
  });

  // ========================================================
  // 6. Session Discovery Tracking (Req 27-36)
  // ========================================================
  it('27. Identity discovery is recorded server-side in "identity" namespace', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    const state = session.context.getNamespaceState<IdentitySessionState>('identity');
    assert(state !== undefined);
    assert.deepEqual(state?.discoveredIdentities, ['EVD-IDN-01-CONTEXT']);
    assert.equal(state?.lastAccessedIdentity, 'EVD-IDN-01-CONTEXT');
    assert.equal(state?.accessCount, 1);
  });

  it('28. Duplicate discovery behaves safely (no duplicate IDs in discovered list)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    const state = session.context.getNamespaceState<IdentitySessionState>('identity');
    assert.deepEqual(state?.discoveredIdentities, ['EVD-IDN-01-CONTEXT']);
    assert.equal(state?.accessCount, 2);
  });

  it('29. Session A discovery does not affect Session B context', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', new RequestContext({ session: sessionA }));

    const stateA = sessionA.context.getNamespaceState<IdentitySessionState>('identity');
    const stateB = sessionB.context.getNamespaceState<IdentitySessionState>('identity');

    assert.deepEqual(stateA?.discoveredIdentities, ['EVD-IDN-01-CONTEXT']);
    assert.equal(stateB, undefined);
  });

  it('30. Session B discovery does not affect Session A context', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', new RequestContext({ session: sessionA }));
    await engine.dispatch(parseSimRoute('sim://identity/binding'), 'READ', new RequestContext({ session: sessionB }));

    const stateA = sessionA.context.getNamespaceState<IdentitySessionState>('identity');
    const stateB = sessionB.context.getNamespaceState<IdentitySessionState>('identity');

    assert.deepEqual(stateA?.discoveredIdentities, ['EVD-IDN-01-CONTEXT']);
    assert.deepEqual(stateB?.discoveredIdentities, ['EVD-IDN-02-BINDING']);
  });

  it('31. Identity module cannot overwrite Metadata state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('metadata', { hacked: true }, 'identity'),
      StateOwnershipError
    );
  });

  it('32. Identity module cannot overwrite Audit state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('audit', { hacked: true }, 'identity'),
      StateOwnershipError
    );
  });

  it('33. Identity module cannot overwrite Config state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('config', { hacked: true }, 'identity'),
      StateOwnershipError
    );
  });

  it('34. Other modules cannot overwrite Identity state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('identity', { hacked: true }, 'metadata'),
      StateOwnershipError
    );
    assert.throws(
      () => session.context.setNamespaceState('identity', { hacked: true }, 'audit'),
      StateOwnershipError
    );
    assert.throws(
      () => session.context.setNamespaceState('identity', { hacked: true }, 'config'),
      StateOwnershipError
    );
  });

  it('35. Destroyed sessions are inaccessible', async () => {
    const session = sessionStore.createSession();
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', new RequestContext({ session }));

    sessionStore.destroySession(session.id);
    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  it('36. Expired sessions are inaccessible', () => {
    const session = sessionStore.createSession();
    session.expiresAt = Date.now() - 1000;

    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  // ========================================================
  // 7. Immutability (Req 37-40)
  // ========================================================
  it('37. Returned identity evidence cannot mutate shared evidence', async () => {
    const route = parseSimRoute('sim://identity/context');
    const res = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());

    assert.throws(() => {
      (res.data.evidence as any).id = 'TAMPERED';
    }, TypeError);
  });

  it('38. Nested objects remain protected via deep freeze', async () => {
    const route = parseSimRoute('sim://identity/context');
    const res = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());

    assert.throws(() => {
      (res.data.evidence.content as any).resolution_state = 'TAMPERED';
    }, TypeError);
  });

  it('39. Session A mutation attempts do not affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const route = parseSimRoute('sim://identity/binding');
    const resA = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext({ session: sessionA }));
    const resB = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext({ session: sessionB }));

    assert.deepEqual(resA.data, resB.data);
  });

  it('40. Repeated retrieval remains deterministic', async () => {
    const route = parseSimRoute('sim://identity/trust-membership');
    for (let i = 0; i < 5; i++) {
      const res = await engine.dispatch<EvidenceResponse<any>>(route, 'READ', new RequestContext());
      assert.equal(res.data.evidence.content.primary_trust_zone, 'trust-zone-alpha');
    }
  });

  // ========================================================
  // 8. Security (Req 41-51)
  // ========================================================
  it('41-48. No real credentials, tokens, keys, certs, passwords, or flag data exist in Identity evidence', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('AKIA'), 'Must not contain AWS key');
      assert(!json.includes('ya29.'), 'Must not contain OAuth token');
      assert(!json.includes('BEGIN PRIVATE KEY'), 'Must not contain private key');
      assert(!json.includes('BEGIN CERTIFICATE'), 'Must not contain certificate');
      assert(!json.includes('password'), 'Must not contain password');
      assert(!json.includes('jwt'), 'Must not contain JWT references');
      assert(!json.includes('BPCTF{'), 'Must not contain flag format');
      assert(!json.includes('master_seed'), 'Must not contain master seed');
    }
  });

  it('49. No arbitrary identity lookup exists (uppercase or unregistered segment fails)', async () => {
    assert.throws(() => parseSimRoute('sim://identity/EVD-IDN-01-CONTEXT'), Error);
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://identity/evd-idn-01-context'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('50. No route enumeration exists (listing endpoints fail safely with 404)', async () => {
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://identity/list'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://identity/index'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('51. Zero network primitives are invoked by identity routing', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://identity/context'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.status, 'success');
  });

  // ========================================================
  // 9. Information Leakage Hardening (Req 52-57)
  // ========================================================
  it('52. No challenge meta-language is exposed in identity evidence', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!/prompt\s*\d+/i.test(json));
      assert(!/phase\s*\d+/i.test(json));
      assert(!/subsequent\s+phase/i.test(json));
      assert(!/next\s+stage/i.test(json));
      assert(!/you\s+will\s+need/i.test(json));
      assert(!/obtainable\s+via/i.test(json));
    }
  });

  it('53. No exact future endpoint inventory is exposed in identity evidence', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('sim://sts/'));
      assert(!json.includes('sim://policy/'));
      assert(!json.includes('sim://controlplane/'));
      assert(!json.includes('sim://vault/'));
    }
  });

  it('54. No exact future authorization syntax is exposed', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('strata:PrincipalTag'));
      assert(!json.includes('AuditRefCheck'));
    }
  });

  it('55. No future role inventory is exposed', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('OrbitalReleaseRole'));
      assert(!json.includes('PipelineDeployerRole'));
    }
  });

  it('56. No exact future state-machine details are exposed', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('"STAGED"'));
      assert(!json.includes('"CONFIRMED"'));
    }
  });

  it('57. No vault prerequisites are exposed', async () => {
    for (const r of fixedIdentityRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('vault unseal'));
      assert(!json.includes('direct_vault_ingress'));
    }
  });

  // ========================================================
  // 10. Full Regression (Req 58-64)
  // ========================================================
  it('58. All Prompt 3 router tests pass regression', () => {
    for (const r of fixedIdentityRoutes) {
      const route = parseSimRoute(r);
      assert.equal(route.namespace, 'identity');
      assert.equal(route.canonical, r);
    }
  });

  it('59. All Prompt 4 Metadata tests continue to return valid evidence', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://metadata/workload-profile'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.id, 'EVD-META-01-PROFILE');
  });

  it('60. All Prompt 4 Audit tests continue to return valid evidence', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://audit/bootstrap-history'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.id, 'EVD-AUD-01-BOOTSTRAP');
  });

  it('61. All Prompt 5 Config tests continue to return valid evidence', async () => {
    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://config/active-specification'),
      'READ',
      new RequestContext()
    );
    assert.equal(res.data.evidence.id, 'EVD-CFG-01-ACTIVE-SPEC');
  });

  it('62. Cross-module discovery isolation remains intact across all 4 modules', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    const meta = session.context.getNamespaceState<MetadataSessionState>('metadata');
    const audit = session.context.getNamespaceState<AuditSessionState>('audit');
    const cfg = session.context.getNamespaceState<ConfigSessionState>('config');
    const idn = session.context.getNamespaceState<IdentitySessionState>('identity');

    assert.deepEqual(meta?.discoveredEvidence, ['EVD-META-01-PROFILE']);
    assert.deepEqual(audit?.discoveredEvidence, ['EVD-AUD-01-BOOTSTRAP']);
    assert.deepEqual(cfg?.discoveredArtifacts, ['EVD-CFG-01-ACTIVE-SPEC']);
    assert.deepEqual(idn?.discoveredIdentities, ['EVD-IDN-01-CONTEXT']);
  });

  it('63-64. Engine is fully initialized, ready, and locked with all 4 modules active', () => {
    assert.equal(engine.isReady(), true);
    assert.equal(moduleRegistry.isLocked(), true);
    assert.equal(routeRegistry.isLocked(), true);
    assert.equal(moduleRegistry.has('metadata'), true);
    assert.equal(moduleRegistry.has('audit'), true);
    assert.equal(moduleRegistry.has('config'), true);
    assert.equal(moduleRegistry.has('identity'), true);
  });

  // ========================================================
  // 11. Prompt 6.1 Information-Leakage & Scope Hardening Tests
  // ========================================================
  describe('Prompt 6.1: Identity Information-Leakage & Scope Hardening', () => {
    it('P6.1-1. Identity context uses project-native logical identity reference', async () => {
      const res = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      assert.equal(
        res.data.evidence.content.logical_identity_id,
        'hyperion://identity/telemetry/collector-v2'
      );
    });

    it('P6.1-2. Identity context does not contain spiffe://', async () => {
      const res = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      const json = JSON.stringify(res.data);
      assert(!json.includes('spiffe://'));
    });

    it('P6.1-3. Player-visible Identity evidence contains no SPIFFE, SPIRE, or SVID', async () => {
      for (const r of fixedIdentityRoutes) {
        const res = await engine.dispatch<EvidenceResponse<any>>(
          parseSimRoute(r),
          'READ',
          new RequestContext()
        );
        const json = JSON.stringify(res.data);
        assert(!/\b(spiffe|spire|svid)\b/i.test(json), `Found technology leak in ${r}: ${json}`);
      }
    });

    it('P6.1-4. The logical identity reference is deterministic across repeated calls', async () => {
      const res1 = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      const res2 = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      assert.equal(
        res1.data.evidence.content.logical_identity_id,
        res2.data.evidence.content.logical_identity_id
      );
      assert.equal(
        res1.data.evidence.content.logical_identity_id,
        'hyperion://identity/telemetry/collector-v2'
      );
    });

    it('P6.1-5. Logical identity is not a credential and contains no secrets', async () => {
      const res = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      const id = res.data.evidence.content.logical_identity_id;
      assert(!id.includes('AKIA'));
      assert(!id.includes('token'));
      assert(!id.includes('secret'));
      assert(!id.includes('key'));
      assert(!id.includes('cert'));
    });

    it('P6.1-6. Logical identity scheme (hyperion://) is NOT registered in router', () => {
      assert.throws(
        () => parseSimRoute('hyperion://identity/telemetry/collector-v2'),
        (err: any) => err.name === 'SimRouteSyntaxError' || err.message.includes('sim://')
      );
    });

    it('P6.1-7. sim:// remains the only valid retrieval protocol scheme', () => {
      assert.throws(() => parseSimRoute('http://identity/context'));
      assert.throws(() => parseSimRoute('https://identity/context'));
      assert.throws(() => parseSimRoute('spiffe://identity/context'));
      assert.throws(() => parseSimRoute('hyperion://identity/context'));
    });

    it('P6.1-8. Compatibility identity remains present and preserves lineage relevance', async () => {
      const res = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/compatibility'),
        'READ',
        new RequestContext()
      );
      assert.equal(res.data.evidence.content.preserved_lineage_trace, 'REF-CORR-99201-B');
      assert.equal(
        res.data.evidence.content.declared_identity_ref,
        'hyperion://identity/telemetry/collector-v1'
      );
      assert.equal(res.data.evidence.content.compatibility_interpretation, 'HISTORICAL_ONLY');
    });

    it('P6.1-9. Compatibility identity does not override active specification', async () => {
      const res = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/compatibility'),
        'READ',
        new RequestContext()
      );
      assert.equal(res.data.evidence.content.active_specification_precedence, true);
    });

    it('P6.1-10. Historical compatibility is clearly distinguishable from active identity', async () => {
      const activeRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      const compatRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/compatibility'),
        'READ',
        new RequestContext()
      );
      assert.notEqual(
        activeRes.data.evidence.content.logical_identity_id,
        compatRes.data.evidence.content.declared_identity_ref
      );
      assert.equal(activeRes.data.evidence.status, 'ACTIVE');
      assert.equal(compatRes.data.evidence.status, 'COMPATIBILITY');
    });

    it('P6.1-11. No player-visible Identity evidence contains REVOKED_FOR_EXECUTION or execution-denial semantics', async () => {
      for (const r of fixedIdentityRoutes) {
        const res = await engine.dispatch<EvidenceResponse<any>>(
          parseSimRoute(r),
          'READ',
          new RequestContext()
        );
        const json = JSON.stringify(res.data);
        assert(!json.includes('REVOKED_FOR_EXECUTION'));
        assert(!json.includes('DENIED_FOR_EXECUTION'));
        assert(!json.includes('NOT_AUTHORIZED'));
        assert(!json.includes('EXECUTION_BLOCKED'));
        assert(!json.includes('ACCESS_DENIED'));
        assert(!json.includes('PERMISSION_REVOKED'));
      }
    });

    it('P6.1-12. Cross-module correlation consistency is preserved with hyperion:// references', async () => {
      const metaRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://metadata/workload-profile'),
        'READ',
        new RequestContext()
      );
      const cfgRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://config/active-specification'),
        'READ',
        new RequestContext()
      );
      const idnRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );

      assert.equal(
        metaRes.data.evidence.content.active_service_account,
        'hyperion://identity/telemetry/collector-v2'
      );
      assert.equal(
        cfgRes.data.evidence.content.authoritative_principal,
        'hyperion://identity/telemetry/collector-v2'
      );
      assert.equal(
        idnRes.data.evidence.content.logical_identity_id,
        'hyperion://identity/telemetry/collector-v2'
      );
    });

    it('P6.1-13. Validator rejects artifacts containing SPIFFE / SPIRE / SVID leakage', () => {
      const badArtifacts: any = {
        ...IDENTITY_ARTIFACTS,
        'test-leak': {
          artifactId: 'EVD-IDN-99-LEAK',
          evidenceId: 'EVD-IDN-99-LEAK',
          source: 'identity',
          classification: 'IDENTITY_CONTEXT',
          status: 'ACTIVE',
          relevance: 'PRIMARY_PATH',
          correlationReferences: ['wrk-hyperion-telemetry-edge'],
          content: {
            identity: 'spiffe://example.internal/sa/test',
          },
        },
      };

      assert.throws(
        () => validateIdentityArtifacts(badArtifacts),
        (err: any) =>
          err instanceof IdentityConsistencyError &&
          err.message.includes('prohibited real-world identity technology')
      );
    });

    it('P6.1-14. Validator rejects artifacts containing REVOKED_FOR_EXECUTION or denial semantics', () => {
      const badArtifacts: any = {
        ...IDENTITY_ARTIFACTS,
        'test-denial': {
          artifactId: 'EVD-IDN-99-DENIAL',
          evidenceId: 'EVD-IDN-99-DENIAL',
          source: 'identity',
          classification: 'COMPATIBILITY_IDENTITY',
          status: 'COMPATIBILITY',
          relevance: 'CORRELATION_CONTEXT',
          correlationReferences: ['wrk-hyperion-telemetry-edge'],
          content: {
            active_specification_precedence: true,
            status: 'REVOKED_FOR_EXECUTION',
          },
        },
      };

      assert.throws(
        () => validateIdentityArtifacts(badArtifacts),
        (err: any) =>
          err instanceof IdentityConsistencyError &&
          err.message.includes('prohibited execution-oriented or authorization denial semantics')
      );
    });

    it('P6.1-15. Deep freeze and immutability prevent mutation of logical identity and compatibility interpretation', async () => {
      const idnRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      assert.throws(() => {
        (idnRes.data.evidence.content as any).logical_identity_id = 'mutated-value';
      });

      const compatRes = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/compatibility'),
        'READ',
        new RequestContext()
      );
      assert.throws(() => {
        (compatRes.data.evidence.content as any).compatibility_interpretation = 'MUTATED';
      });

      // Verify original evidence remains unchanged
      const idnRes2 = await engine.dispatch<EvidenceResponse<any>>(
        parseSimRoute('sim://identity/context'),
        'READ',
        new RequestContext()
      );
      assert.equal(
        idnRes2.data.evidence.content.logical_identity_id,
        'hyperion://identity/telemetry/collector-v2'
      );
    });
  });
});
