import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { AuditSessionState } from '../audit/audit-module.js';
import { ConfigSessionState } from '../config/config-module.js';
import { IdentitySessionState } from '../identity/identity-module.js';
import { MetadataSessionState } from '../metadata/metadata-module.js';
import { TrustSessionState } from '../trust/trust-types.js';
import { TRANSITION_ARTIFACTS } from './transition-artifacts.js';
import {
  TransitionNotEstablishedError,
  TransitionSessionState,
} from './transition-types.js';
import { validateTransitionArtifacts } from './transition-validator.js';

/**
 * TransitionModule implements the deterministic Transition State Engine & Controlled Progression.
 * Evaluates whether state progression is internally justified based on discovered
 * evidence across Metadata, Audit, Config, Identity, and Trust modules.
 *
 * Enforces strict server-side state progression:
 * UNINITIALIZED -> OBSERVED -> CORRELATED -> RECONCILED
 *
 * Core Principle: Transition Eligibility != Authority
 * Successful transitions record progression but NEVER grant permissions, credentials,
 * tokens, roles, capabilities, or execution rights.
 */
export class TransitionModule implements IChallengeModule {
  public readonly id: ModuleId = 'transition';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
    'metadata',
    'audit',
    'config',
    'identity',
    'trust',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  /**
   * Initializes the Transition module, validates transition progression integrity,
   * and registers canonical, fixed symbolic routes.
   */
  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate progression graph, integrity, and anti-leakage constraints
    validateTransitionArtifacts(TRANSITION_ARTIFACTS);

    // 2. Register fixed symbolic transition routes
    this.registerObservationRoute();
    this.registerCorrelationRoute();
    this.registerReconciliationRoute();
  }

  private registerObservationRoute(): void {
    const route = parseSimRoute('sim://transition/observation');
    const artifact = TRANSITION_ARTIFACTS.observation;

    this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
      if (!context.sessionContext) {
        throw new TransitionNotEstablishedError();
      }

      const sessionState = this.getOrCreateSessionState(context);

      // Idempotency: If already established, return deterministic record
      if (sessionState.recordedTransitions.includes(artifact.artifactId)) {
        this.incrementAccessCount(context, sessionState);
        return formatEvidenceResponse(artifact);
      }

      // State check: Must be at initial state UNINITIALIZED
      if (sessionState.currentState !== 'UNINITIALIZED') {
        throw new TransitionNotEstablishedError();
      }

      // Check evidence prerequisites spanning primary domains
      const discoveredEvidence = this.collectDiscoveredEvidence(context);
      const hasAllPrerequisites = artifact.supportingEvidence.every((evId) =>
        discoveredEvidence.has(evId)
      );

      if (!hasAllPrerequisites) {
        throw new TransitionNotEstablishedError();
      }

      // Advance state to OBSERVED
      const updatedTransitions = [...sessionState.recordedTransitions, artifact.artifactId];
      const updatedHistory = [
        ...sessionState.transitionHistory,
        {
          transitionId: artifact.artifactId,
          fromState: 'UNINITIALIZED' as const,
          toState: 'OBSERVED' as const,
          timestamp: new Date().toISOString(),
        },
      ];

      context.sessionContext.setNamespaceState<TransitionSessionState>(
        'transition',
        {
          currentState: 'OBSERVED',
          recordedTransitions: updatedTransitions,
          discoveredEvidence: updatedTransitions,
          transitionHistory: updatedHistory,
          accessCount: sessionState.accessCount + 1,
          lastTransitionId: artifact.artifactId,
        },
        'transition'
      );

      return formatEvidenceResponse(artifact);
    });
  }

  private registerCorrelationRoute(): void {
    const route = parseSimRoute('sim://transition/correlation');
    const artifact = TRANSITION_ARTIFACTS.correlation;

    this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
      if (!context.sessionContext) {
        throw new TransitionNotEstablishedError();
      }

      const sessionState = this.getOrCreateSessionState(context);

      // Idempotency: If already established, return deterministic record
      if (sessionState.recordedTransitions.includes(artifact.artifactId)) {
        this.incrementAccessCount(context, sessionState);
        return formatEvidenceResponse(artifact);
      }

      // Prevent direct jumps: Must have completed Observation and be in OBSERVED state
      if (
        sessionState.currentState !== 'OBSERVED' ||
        !sessionState.recordedTransitions.includes('EVD-TRANS-01-OBSERVATION')
      ) {
        throw new TransitionNotEstablishedError();
      }

      // Check trust resolution prerequisites
      const discoveredEvidence = this.collectDiscoveredEvidence(context);
      const hasAllPrerequisites = artifact.supportingEvidence.every((evId) =>
        discoveredEvidence.has(evId)
      );

      if (!hasAllPrerequisites) {
        throw new TransitionNotEstablishedError();
      }

      // Advance state to CORRELATED
      const updatedTransitions = [...sessionState.recordedTransitions, artifact.artifactId];
      const updatedHistory = [
        ...sessionState.transitionHistory,
        {
          transitionId: artifact.artifactId,
          fromState: 'OBSERVED' as const,
          toState: 'CORRELATED' as const,
          timestamp: new Date().toISOString(),
        },
      ];

      context.sessionContext.setNamespaceState<TransitionSessionState>(
        'transition',
        {
          currentState: 'CORRELATED',
          recordedTransitions: updatedTransitions,
          discoveredEvidence: updatedTransitions,
          transitionHistory: updatedHistory,
          accessCount: sessionState.accessCount + 1,
          lastTransitionId: artifact.artifactId,
        },
        'transition'
      );

      return formatEvidenceResponse(artifact);
    });
  }

  private registerReconciliationRoute(): void {
    const route = parseSimRoute('sim://transition/reconciliation');
    const artifact = TRANSITION_ARTIFACTS.reconciliation;

    this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
      if (!context.sessionContext) {
        throw new TransitionNotEstablishedError();
      }

      const sessionState = this.getOrCreateSessionState(context);

      // Idempotency: If already established, return deterministic record
      if (sessionState.recordedTransitions.includes(artifact.artifactId)) {
        this.incrementAccessCount(context, sessionState);
        return formatEvidenceResponse(artifact);
      }

      // Prevent direct jumps: Must have completed Correlation and be in CORRELATED state
      if (
        sessionState.currentState !== 'CORRELATED' ||
        !sessionState.recordedTransitions.includes('EVD-TRANS-02-CORRELATION')
      ) {
        throw new TransitionNotEstablishedError();
      }

      // Check reconciliation prerequisites (lineage, interpretation, compatibility)
      const discoveredEvidence = this.collectDiscoveredEvidence(context);
      const hasAllPrerequisites = artifact.supportingEvidence.every((evId) =>
        discoveredEvidence.has(evId)
      );

      if (!hasAllPrerequisites) {
        throw new TransitionNotEstablishedError();
      }

      // Advance state to RECONCILED
      const updatedTransitions = [...sessionState.recordedTransitions, artifact.artifactId];
      const updatedHistory = [
        ...sessionState.transitionHistory,
        {
          transitionId: artifact.artifactId,
          fromState: 'CORRELATED' as const,
          toState: 'RECONCILED' as const,
          timestamp: new Date().toISOString(),
        },
      ];

      context.sessionContext.setNamespaceState<TransitionSessionState>(
        'transition',
        {
          currentState: 'RECONCILED',
          recordedTransitions: updatedTransitions,
          discoveredEvidence: updatedTransitions,
          transitionHistory: updatedHistory,
          accessCount: sessionState.accessCount + 1,
          lastTransitionId: artifact.artifactId,
        },
        'transition'
      );

      return formatEvidenceResponse(artifact);
    });
  }

  private getOrCreateSessionState(context: SimHandlerContext): TransitionSessionState {
    const existing =
      context.sessionContext!.getNamespaceState<TransitionSessionState>('transition');

    if (existing) {
      return existing;
    }

    return {
      currentState: 'UNINITIALIZED',
      recordedTransitions: [],
      discoveredEvidence: [],
      transitionHistory: [],
      accessCount: 0,
    };
  }

  private incrementAccessCount(
    context: SimHandlerContext,
    currentState: TransitionSessionState
  ): void {
    context.sessionContext!.setNamespaceState<TransitionSessionState>(
      'transition',
      {
        ...currentState,
        accessCount: currentState.accessCount + 1,
      },
      'transition'
    );
  }

  private collectDiscoveredEvidence(context: SimHandlerContext): Set<string> {
    const metaState =
      context.sessionContext!.getNamespaceState<MetadataSessionState>('metadata');
    const auditState =
      context.sessionContext!.getNamespaceState<AuditSessionState>('audit');
    const configState =
      context.sessionContext!.getNamespaceState<ConfigSessionState>('config');
    const identityState =
      context.sessionContext!.getNamespaceState<IdentitySessionState>('identity');
    const trustState =
      context.sessionContext!.getNamespaceState<TrustSessionState>('trust');

    return new Set<string>([
      ...(metaState?.discoveredEvidence ?? []),
      ...(auditState?.discoveredEvidence ?? []),
      ...(configState?.discoveredArtifacts ?? []),
      ...(configState?.discoveredEvidence ?? []),
      ...(identityState?.discoveredIdentities ?? []),
      ...(identityState?.discoveredEvidence ?? []),
      ...(trustState?.discoveredResolutions ?? []),
      ...(trustState?.discoveredEvidence ?? []),
    ]);
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
