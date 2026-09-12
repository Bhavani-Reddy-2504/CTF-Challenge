import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { AuditSessionState } from '../audit/audit-module.js';
import { ConfigSessionState } from '../config/config-module.js';
import { ConstraintSessionState } from '../constraint/constraint-types.js';
import { GraphSessionState } from '../graph/graph-types.js';
import { IdentitySessionState } from '../identity/identity-module.js';
import { InferenceSessionState } from '../inference/inference-types.js';
import { MetadataSessionState } from '../metadata/metadata-module.js';
import { SynthesisSessionState } from '../synthesis/synthesis-types.js';
import { TransitionSessionState } from '../transition/transition-types.js';
import { TrustSessionState } from '../trust/trust-types.js';
import { RESOLUTION_ARTIFACTS } from './resolution-artifacts.js';
import {
  ResolutionNotEstablishedError,
  ResolutionSessionState,
} from './resolution-types.js';
import { validateResolutionArtifacts } from './resolution-validator.js';

function hasEvidence(discovered: unknown, id: string): boolean {
  if (!discovered) return false;
  if (discovered instanceof Set) return discovered.has(id);
  if (Array.isArray(discovered)) return discovered.includes(id);
  return false;
}

/**
 * ResolutionModule implements the Controlled Resolution Framework &
 * Non-Oracular Decision Preparation Layer.
 * Prepares deterministic resolution contexts across multiple domains without
 * revealing the final solution, flag, winner, or completion state.
 *
 * Gating structure (non-linear multi-domain resolution model):
 * - Structural Context: requires structural evidence across domains (Config spec, Trust binding, Constraint spec, Infer spec, Graph topology, Synthesis spec).
 * - Historical Context: requires historical evidence across domains (Audit fails, Identity lineage, Trust lineage, Constraint continuity, Infer lineage, Graph corr, Synthesis lineage).
 * - Environmental Context: requires environmental evidence across domains (Metadata context, Config binding, Identity membership, Constraint boundary, Infer boundary, Graph ctx, Synthesis boundary).
 * Note: Structural, Historical, and Environmental contexts are independently discoverable in any order.
 * - Relational Context: requires cross-domain reconciliation (Transition reconciled, Trust interpretation, Constraint recon, Infer recon, Graph convergence, Synthesis relational).
 * - Unified Resolution Context: requires all 4 preceding resolution contexts plus Inference convergence, Graph reconstruction, and Synthesis multi-perspective.
 */
export class ResolutionModule implements IChallengeModule {
  public readonly id: ModuleId = 'resolution';
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
    'graph',
    'synthesis',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate resolution artifacts, internal model, and anti-leakage constraints
    validateResolutionArtifacts(RESOLUTION_ARTIFACTS);

    // 2. Register canonical symbolic routes
    for (const [segment, artifact] of Object.entries(RESOLUTION_ARTIFACTS)) {
      const route = parseSimRoute(`sim://resolution/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        if (!context.sessionContext) {
          throw new ResolutionNotEstablishedError();
        }

        const session = context.sessionContext;

        // Server-side discovery gating
        switch (segment) {
          case 'structural-context': {
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');

            if (
              !hasEvidence(cfg?.discoveredEvidence, 'EVD-CFG-01-ACTIVE-SPEC') ||
              !hasEvidence(trust?.discoveredEvidence, 'EVD-TRUST-02-BINDING') ||
              !hasEvidence(constraint?.discoveredEvidence, 'EVD-CONSTRAINT-01-SPECIFICATION') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-01-SPECIFICATION') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-03-TOPOLOGY') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-01-SPECIFICATION')
            ) {
              throw new ResolutionNotEstablishedError();
            }
            break;
          }

          case 'historical-context': {
            const audit = session.getNamespaceState<AuditSessionState>('audit');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');

            if (
              !hasEvidence(audit?.discoveredEvidence, 'EVD-AUD-03-FAILS') ||
              !hasEvidence(idn?.discoveredEvidence, 'EVD-IDN-04-LINEAGE') ||
              !hasEvidence(trust?.discoveredEvidence, 'EVD-TRUST-03-LINEAGE') ||
              !hasEvidence(constraint?.discoveredEvidence, 'EVD-CONSTRAINT-02-CONTINUITY') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-02-LINEAGE') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-02-CORRELATION') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-02-LINEAGE')
            ) {
              throw new ResolutionNotEstablishedError();
            }
            break;
          }

          case 'environmental-context': {
            const meta = session.getNamespaceState<MetadataSessionState>('metadata');
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');

            if (
              !hasEvidence(meta?.discoveredEvidence, 'EVD-META-02-CONTEXT') ||
              !hasEvidence(cfg?.discoveredEvidence, 'EVD-CFG-02-BINDING') ||
              !hasEvidence(idn?.discoveredEvidence, 'EVD-IDN-03-TRUST-MEMBERSHIP') ||
              !hasEvidence(constraint?.discoveredEvidence, 'EVD-CONSTRAINT-03-BOUNDARY') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-03-BOUNDARY') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-01-CONTEXT') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-03-BOUNDARY')
            ) {
              throw new ResolutionNotEstablishedError();
            }
            break;
          }

          case 'relational-context': {
            const trans = session.getNamespaceState<TransitionSessionState>('transition');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');

            if (
              trans?.currentState !== 'RECONCILED' ||
              !trans?.recordedTransitions?.includes('EVD-TRANS-03-RECONCILIATION') ||
              !hasEvidence(trust?.discoveredEvidence, 'EVD-TRUST-05-INTERPRETATION') ||
              !hasEvidence(constraint?.discoveredEvidence, 'EVD-CONSTRAINT-04-RECONCILIATION') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-04-RECONCILIATION') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-04-CONVERGENCE') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-04-RELATIONAL')
            ) {
              throw new ResolutionNotEstablishedError();
            }
            break;
          }

          case 'resolution-context': {
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');
            const res = session.getNamespaceState<ResolutionSessionState>('resolution');

            if (
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-01-STRUCTURAL') ||
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-02-HISTORICAL') ||
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-03-ENVIRONMENTAL') ||
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-04-RELATIONAL') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-05-CONVERGENCE') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-05-RECONSTRUCTION') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-05-MULTI-PERSPECTIVE')
            ) {
              throw new ResolutionNotEstablishedError();
            }
            break;
          }

          default:
            throw new ResolutionNotEstablishedError();
        }

        // Record discovery in session context under 'resolution' namespace
        const currentResolutionState =
          session.getNamespaceState<ResolutionSessionState>('resolution');

        const prevSet =
          currentResolutionState?.discoveredEvidence instanceof Set
            ? currentResolutionState.discoveredEvidence
            : new Set(currentResolutionState?.discoveredEvidence ?? []);

        const updatedDiscovered = new Set([...prevSet, artifact.artifactId]);

        session.setNamespaceState<ResolutionSessionState>(
          'resolution',
          {
            discoveredEvidence: Object.freeze(updatedDiscovered),
            accessCount: (currentResolutionState?.accessCount ?? 0) + 1,
            lastAccessedResolution: artifact.artifactId,
          },
          'resolution'
        );

        return formatEvidenceResponse(artifact);
      });
    }
  }
}
