import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { AuditSessionState } from '../audit/audit-module.js';
import { ConfigSessionState } from '../config/config-module.js';
import { ConstraintSessionState } from '../constraint/constraint-types.js';
import { IdentitySessionState } from '../identity/identity-module.js';
import { InferenceSessionState } from '../inference/inference-types.js';
import { MetadataSessionState } from '../metadata/metadata-module.js';
import { TransitionSessionState } from '../transition/transition-types.js';
import { TrustSessionState } from '../trust/trust-types.js';
import { GRAPH_ARTIFACTS } from './graph-artifacts.js';
import {
  GraphNotEstablishedError,
  GraphSessionState,
} from './graph-types.js';
import { validateGraphArtifacts } from './graph-validator.js';

/**
 * GraphModule implements the Evidence Graph & Non-Linear Correlation Layer.
 * Provides deterministic evaluation across non-linear correlation fragments.
 *
 * Gating structure (non-linear DAG):
 * - Branch 1 (Structural Context -> Topology):
 *     context-fragment: requires metadata context, config binding, constraint boundary.
 *     topology-fragment: requires config active spec, inference spec model, graph context fragment.
 * - Branch 2 (Historical Trace -> Convergence):
 *     correlation-fragment: requires audit fails, identity lineage, trust lineage, constraint continuity.
 *     convergence-fragment: requires reconciled transition, inference recon model, graph correlation fragment.
 * - Reconstruction (Converged Unification):
 *     reconstruction-fragment: requires inference convergence, topology fragment, convergence fragment.
 */
export class GraphModule implements IChallengeModule {
  public readonly id: ModuleId = 'graph';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
    'metadata',
    'audit',
    'config',
    'identity',
    'trust',
    'transition',
    'constraint',
    'inference',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate graph artifacts, internal graph model, and anti-leakage constraints
    validateGraphArtifacts(GRAPH_ARTIFACTS);

    // 2. Register canonical symbolic routes
    for (const [segment, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
      const route = parseSimRoute(`sim://graph/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        if (!context.sessionContext) {
          throw new GraphNotEstablishedError();
        }

        const session = context.sessionContext;

        // Server-side non-linear DAG discovery gating
        switch (segment) {
          case 'context-fragment': {
            const meta = session.getNamespaceState<MetadataSessionState>('metadata');
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');

            if (
              !meta?.discoveredEvidence?.includes('EVD-META-02-CONTEXT') ||
              !cfg?.discoveredEvidence?.includes('EVD-CFG-02-BINDING') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-03-BOUNDARY')
            ) {
              throw new GraphNotEstablishedError();
            }
            break;
          }

          case 'correlation-fragment': {
            const audit = session.getNamespaceState<AuditSessionState>('audit');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');

            if (
              !audit?.discoveredEvidence?.includes('EVD-AUD-03-FAILS') ||
              !idn?.discoveredEvidence?.includes('EVD-IDN-04-LINEAGE') ||
              !trust?.discoveredEvidence?.includes('EVD-TRUST-03-LINEAGE') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-02-CONTINUITY')
            ) {
              throw new GraphNotEstablishedError();
            }
            break;
          }

          case 'topology-fragment': {
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              !cfg?.discoveredEvidence?.includes('EVD-CFG-01-ACTIVE-SPEC') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-01-SPECIFICATION') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-01-CONTEXT')
            ) {
              throw new GraphNotEstablishedError();
            }
            break;
          }

          case 'convergence-fragment': {
            const trans = session.getNamespaceState<TransitionSessionState>('transition');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              trans?.currentState !== 'RECONCILED' ||
              !trans?.recordedTransitions?.includes('EVD-TRANS-03-RECONCILIATION') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-04-RECONCILIATION') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-02-CORRELATION')
            ) {
              throw new GraphNotEstablishedError();
            }
            break;
          }

          case 'reconstruction-fragment': {
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              !infer?.discoveredEvidence?.includes('EVD-INFER-05-CONVERGENCE') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-03-TOPOLOGY') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-04-CONVERGENCE')
            ) {
              throw new GraphNotEstablishedError();
            }
            break;
          }

          default:
            throw new GraphNotEstablishedError();
        }

        // Record discovery in session context under 'graph' namespace
        const currentGraphState =
          session.getNamespaceState<GraphSessionState>('graph') ?? {
            discoveredEvidence: [],
            accessCount: 0,
          };

        const updatedDiscovered = Array.from(
          new Set([...currentGraphState.discoveredEvidence, artifact.artifactId])
        );

        session.setNamespaceState<GraphSessionState>(
          'graph',
          {
            discoveredEvidence: updatedDiscovered,
            accessCount: currentGraphState.accessCount + 1,
            lastAccessedGraphArtifact: artifact.artifactId,
          },
          'graph'
        );

        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
