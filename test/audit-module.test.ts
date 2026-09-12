import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule, AuditSessionState } from '../src/modules/audit/audit-module.js';
import { AuditStreamPayload } from '../src/modules/audit/audit-artifacts.js';
import { MetadataModule, MetadataSessionState } from '../src/modules/metadata/metadata-module.js';
import {
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
} from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Audit Module & Evidence Consistency Tests (Requirements 12-54)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;
  let auditModule: AuditModule;
  let metadataModule: MetadataModule;

  beforeEach(async () => {
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();
    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });

    const config = validateAndBuildConfig({ environment: 'test' });
    sessionStore = new SessionStore(config);

    metadataModule = new MetadataModule(routeRegistry);
    auditModule = new AuditModule(routeRegistry);

    moduleRegistry.register(metadataModule);
    moduleRegistry.register(auditModule);

    await engine.initialize();
  });

  // --- Audit (12-23) ---
  it('12. Audit module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('audit'), true);
    assert.equal(moduleRegistry.get('audit')?.id, 'audit');
  });

  it('13. Fixed audit routes are registered in SimRouteRegistry', () => {
    const fixedRoutes = [
      'sim://audit/bootstrap-history',
      'sim://audit/trust-events',
      'sim://audit/failed-transitions',
      'sim://audit/correlation-records',
    ];

    for (const r of fixedRoutes) {
      const parsed = parseSimRoute(r);
      assert.equal(routeRegistry.hasRoute(parsed, 'READ'), true, `Route ${r} must be registered`);
    }
  });

  it('14. Audit retrieval is deterministic across repeated calls', async () => {
    const route = parseSimRoute('sim://audit/bootstrap-history');
    const reqCtx = new RequestContext();

    const res1 = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', reqCtx);
    const res2 = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', reqCtx);

    assert.deepEqual(res1.data, res2.data);
    assert.equal(res1.data.evidence.id, 'EVD-AUD-01-BOOTSTRAP');
  });

  it('15. Events have stable, deterministic IDs (e.g. EVT-1001)', async () => {
    const route = parseSimRoute('sim://audit/bootstrap-history');
    const res = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', new RequestContext());

    const events = res.data.evidence.content.events;
    assert.equal(events.length, 3);
    assert.equal(events[0].event_id, 'EVT-1001');
    assert.equal(events[1].event_id, 'EVT-1002');
    assert.equal(events[2].event_id, 'EVT-1003');
  });

  it('16. Timestamps are deterministic and formatted in ISO-8601 UTC', async () => {
    const route = parseSimRoute('sim://audit/trust-events');
    const res = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', new RequestContext());

    for (const evt of res.data.evidence.content.events) {
      assert.match(evt.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      // Ensure it is not a newly generated timestamp
      assert(evt.timestamp.startsWith('2026-08-20'));
    }
  });

  it('17. Chronology is logically ordered sequentially within event streams', async () => {
    const route = parseSimRoute('sim://audit/failed-transitions');
    const res = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', new RequestContext());

    const events = res.data.evidence.content.events;
    for (let i = 0; i < events.length - 1; i++) {
      const t1 = new Date(events[i].timestamp).getTime();
      const t2 = new Date(events[i + 1].timestamp).getTime();
      assert(t1 <= t2, `Event ${events[i].event_id} (${t1}) must precede ${events[i + 1].event_id} (${t2})`);
    }
  });

  it('18. Correlation references resolve and link between failure events and deployment records', async () => {
    const route = parseSimRoute('sim://audit/failed-transitions');
    const res = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', new RequestContext());

    const failEvent = res.data.evidence.content.events.find((e) => e.event_id === 'EVT-4091');
    assert.ok(failEvent);
    assert.equal(failEvent.correlation_id, 'REF-CORR-99201-B');
    assert.equal(failEvent.outcome, 'FAILED');
  });

  it('19. Failed events contain safe contextual error messages without internal stack traces', async () => {
    const route = parseSimRoute('sim://audit/failed-transitions');
    const res = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(route, 'READ', new RequestContext());

    for (const evt of res.data.evidence.content.events) {
      const json = JSON.stringify(evt);
      assert(!json.includes('.ts:'), 'Must not contain source paths');
      assert(!json.includes('Error:'), 'Must not contain raw stack traces');
    }
  });

  it('20. Audit discovery is recorded server-side in session context', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    const route = parseSimRoute('sim://audit/bootstrap-history');
    await engine.dispatch(route, 'READ', reqCtx);

    const auditState = session.context.getNamespaceState<AuditSessionState>('audit');
    assert.ok(auditState);
    assert.equal(auditState.accessCount, 1);
    assert.deepEqual(auditState.discoveredEvidence, ['EVD-AUD-01-BOOTSTRAP']);
  });

  it('21. Audit module cannot overwrite metadata namespace state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('metadata', { hijacked: true }, 'audit'),
      StateOwnershipError
    );
  });

  it('22. Unknown audit route fails safely with SimRouteNotFoundError', async () => {
    const unknownRoute = parseSimRoute('sim://audit/nonexistent-audit');
    await assert.rejects(
      () => engine.dispatch(unknownRoute, 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('23. Unsupported operation (WRITE) on audit route fails with SimOperationNotAllowedError', async () => {
    const route = parseSimRoute('sim://audit/bootstrap-history');
    await assert.rejects(
      () => engine.dispatch(route, 'WRITE', new RequestContext()),
      SimOperationNotAllowedError
    );
  });

  // --- Evidence Consistency (24-30) ---
  it('24. Metadata references and service accounts are internally consistent with audit trails', async () => {
    const metaRoute = parseSimRoute('sim://metadata/workload-profile');
    const auditRoute = parseSimRoute('sim://audit/failed-transitions');

    const metaRes = await engine.dispatch<EvidenceResponse<any>>(metaRoute, 'READ', new RequestContext());
    const auditRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(auditRoute, 'READ', new RequestContext());

    const activeSa = metaRes.data.evidence.content.active_service_account;
    const successorEvt = auditRes.data.evidence.content.events.find((e) => e.event_id === 'EVT-4092');

    assert.equal(activeSa, successorEvt?.resource_reference, 'Active SA in metadata must match successor in audit');
  });

  it('25. Audit references and target domains match trust boundary specifications', async () => {
    const boundaryRoute = parseSimRoute('sim://metadata/trust-boundary');
    const trustAuditRoute = parseSimRoute('sim://audit/trust-events');

    const boundaryRes = await engine.dispatch<EvidenceResponse<any>>(boundaryRoute, 'READ', new RequestContext());
    const trustRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(trustAuditRoute, 'READ', new RequestContext());

    const targetDomain = boundaryRes.data.evidence.content.target_federation_domain;
    const bindEvt = trustRes.data.evidence.content.events.find((e) => e.event_id === 'EVT-2001');

    assert.equal(targetDomain, (bindEvt?.details as any).target_domain);
  });

  it('26. Cross-module references are valid (REF-CORR-99201-B links metadata and audit)', async () => {
    const compatRoute = parseSimRoute('sim://metadata/compatibility-record');
    const corrRoute = parseSimRoute('sim://audit/correlation-records');

    const compatRes = await engine.dispatch<EvidenceResponse<any>>(compatRoute, 'READ', new RequestContext());
    const corrRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(corrRoute, 'READ', new RequestContext());

    const compatTrace = compatRes.data.evidence.content.correlation_trace_id;
    const corrEvt = corrRes.data.evidence.content.events.find((e) => e.event_id === 'EVT-5002');

    assert.equal(compatTrace, corrEvt?.correlation_id);
    assert.equal(compatTrace, 'REF-CORR-99201-B');
  });

  it('27. No contradictory identifiers exist across metadata and audit', async () => {
    const metaRoute = parseSimRoute('sim://metadata/execution-context');
    const auditRoute = parseSimRoute('sim://audit/bootstrap-history');

    const metaRes = await engine.dispatch<EvidenceResponse<any>>(metaRoute, 'READ', new RequestContext());
    const auditRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(auditRoute, 'READ', new RequestContext());

    const enclaveId = metaRes.data.evidence.content.enclave_id;
    const initEvt = auditRes.data.evidence.content.events.find((e) => e.event_id === 'EVT-1001');

    assert.equal(enclaveId, 'edge-telemetry-enclave');
    assert.equal(initEvt?.resource_reference, 'enclave:edge-telemetry-enclave');
  });

  it('28. No dangling correlation references exist in audit records', async () => {
    const corrRoute = parseSimRoute('sim://audit/correlation-records');
    const corrRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(corrRoute, 'READ', new RequestContext());

    const evt5002 = corrRes.data.evidence.content.events.find((e) => e.event_id === 'EVT-5002');
    const proofId = (evt5002?.details as any).proof_correlation_id;

    // Check that this proofId exists in failed-transitions audit stream
    const failRoute = parseSimRoute('sim://audit/failed-transitions');
    const failRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(failRoute, 'READ', new RequestContext());
    const matchingEvt = failRes.data.evidence.content.events.find((e) => e.correlation_id === proofId);

    assert.ok(matchingEvt, `Proof correlation ${proofId} must resolve to a valid historical event`);
  });

  it('29. Historical chronology ordering is strictly consistent', async () => {
    // Bootstrap events (Aug 15) < Trust events (Aug 20) < Failure events (Aug 25) < Correlation events (Aug 26)
    const bRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(parseSimRoute('sim://audit/bootstrap-history'), 'READ', new RequestContext());
    const tRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(parseSimRoute('sim://audit/trust-events'), 'READ', new RequestContext());
    const fRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(parseSimRoute('sim://audit/failed-transitions'), 'READ', new RequestContext());
    const cRes = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(parseSimRoute('sim://audit/correlation-records'), 'READ', new RequestContext());

    const bTime = new Date(bRes.data.evidence.content.events[0].timestamp).getTime();
    const tTime = new Date(tRes.data.evidence.content.events[0].timestamp).getTime();
    const fTime = new Date(fRes.data.evidence.content.events[0].timestamp).getTime();
    const cTime = new Date(cRes.data.evidence.content.events[0].timestamp).getTime();

    assert(bTime < tTime && tTime < fTime && fTime < cTime, 'Cross-stream chronology must progress forward in time');
  });

  it('30. Future relevance artifacts (state machine prerequisites) do not expose future secrets or flags', async () => {
    const corrRoute = parseSimRoute('sim://audit/correlation-records');
    const res = await engine.dispatch<EvidenceResponse<AuditStreamPayload>>(corrRoute, 'READ', new RequestContext());

    const str = JSON.stringify(res.data);
    assert(!str.includes('BPCTF{'));
    assert(!str.includes('private_key'));
    assert(!str.includes('master_seed'));
  });

  // --- Session Isolation (31-34) ---
  it('31. Session A discovery does not appear in Session B context', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', new RequestContext({ session: sessionA }));

    const stateA = sessionA.context.getNamespaceState<MetadataSessionState>('metadata');
    const stateB = sessionB.context.getNamespaceState<MetadataSessionState>('metadata');

    assert.deepEqual(stateA?.discoveredEvidence, ['EVD-META-01-PROFILE']);
    assert.equal(stateB, undefined, 'Session B must have zero discovery state');
  });

  it('32. Session B discovery does not modify or corrupt Session A context', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', new RequestContext({ session: sessionA }));
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', new RequestContext({ session: sessionB }));

    const metaA = sessionA.context.getNamespaceState<MetadataSessionState>('metadata');
    const auditA = sessionA.context.getNamespaceState<AuditSessionState>('audit');

    const metaB = sessionB.context.getNamespaceState<MetadataSessionState>('metadata');
    const auditB = sessionB.context.getNamespaceState<AuditSessionState>('audit');

    assert.deepEqual(metaA?.discoveredEvidence, ['EVD-META-01-PROFILE']);
    assert.equal(auditA, undefined);

    assert.equal(metaB, undefined);
    assert.deepEqual(auditB?.discoveredEvidence, ['EVD-AUD-01-BOOTSTRAP']);
  });

  it('33. Destroyed session discovery state is completely inaccessible', async () => {
    const session = sessionStore.createSession();
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', new RequestContext({ session }));

    sessionStore.destroySession(session.id);
    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  it('34. Expired session discovery state is purged safely', () => {
    const session = sessionStore.createSession();
    session.expiresAt = Date.now() - 1000; // Force expiration

    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  // --- Security (35-45) ---
  it('35-40. All artifacts are strictly sanitized of real cloud credentials, API keys, and flag data', async () => {
    const allRoutes = [
      'sim://metadata/workload-profile',
      'sim://metadata/execution-context',
      'sim://metadata/trust-boundary',
      'sim://metadata/compatibility-record',
      'sim://audit/bootstrap-history',
      'sim://audit/trust-events',
      'sim://audit/failed-transitions',
      'sim://audit/correlation-records',
    ];

    for (const r of allRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', new RequestContext());
      const json = JSON.stringify(res.data);

      assert(!json.includes('AKIA'), 'Must not contain AWS Access Key');
      assert(!json.includes('ya29.'), 'Must not contain Google OAuth Token');
      assert(!json.includes('BEGIN PRIVATE KEY'), 'Must not contain private key');
      assert(!json.includes('BPCTF{'), 'Must not contain flag format');
      assert(!json.includes('169.254.169.254'), 'Must not contain cloud metadata IP');
    }
  });

  it('41. Route enumeration is strictly barred (no directory listing route exists)', async () => {
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://metadata/list'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
    await assert.rejects(
      () => engine.dispatch(parseSimRoute('sim://audit/index'), 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('42-44. Arbitrary evidence lookup, filtering, or query expressions do not exist', async () => {
    // Queries are rejected at parse time
    assert.throws(() => parseSimRoute('sim://audit/events?query=SELECT'), Error);
    assert.throws(() => parseSimRoute('sim://audit/events?filter=EVT-1001'), Error);
  });

  it('45. Player-controlled route registration is completely prevented', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(
      () => routeRegistry.register(parseSimRoute('sim://metadata/injected'), 'READ', () => 'pwned'),
      Error
    );
  });
});
