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
import { TransitionSessionState } from '../transition/transition-types.js';
import { TrustSessionState } from '../trust/trust-types.js';
import { SYNTHESIS_ARTIFACTS } from './synthesis-artifacts.js';
import {
  SynthesisNotEstablishedError,
  SynthesisSessionState,
} from './synthesis-types.js';
import { validateSynthesisArtifacts } from './synthesis-validator.js';

/**
 * SynthesisModule implements the Controlled Evidence Synthesis &
 * Multi-Perspective Reconstruction Layer.
 * Provides deterministic evaluation across multiple analytical perspectives.
 *
 * Gating structure (non-linear multi-perspective model):
 * - Specification Perspective: structural evidence (config spec, trust binding, constraint spec, infer spec, graph topology)
 * - Lineage Perspective: historical evidence (audit fails, config compat, identity lineage, trust lineage, constraint continuity, infer lineage, graph corr)
 * - Boundary Perspective: environmental evidence (meta context, config binding, identity trust membership, constraint boundary, infer boundary, graph ctx)
 * Note: Specification, Lineage, and Boundary perspectives are independently discoverable in any order.
 * - Relational Perspective: cross-domain reconciliation (transition reconciled, trust interp, constraint recon, infer recon, graph convergence)
 * - Multi-Perspective: holistic synthesis requiring all 4 preceding synthesis perspectives plus infer convergence and graph reconstruction.
 */
export class SynthesisModule implements IChallengeModule {
  public readonly id: ModuleId = 'synthesis';
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
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate synthesis artifacts, internal synthesis model, and anti-leakage constraints
    validateSynthesisArtifacts(SYNTHESIS_ARTIFACTS);

    // 2. Register canonical symbolic routes
    for (const [segment, artifact] of Object.entries(SYNTHESIS_ARTIFACTS)) {
      const route = parseSimRoute(`sim://synthesis/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        if (!context.sessionContext) {
          throw new SynthesisNotEstablishedError();
        }

        const session = context.sessionContext;

        // Server-side discovery gating
        switch (segment) {
          case 'specification-perspective': {
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              !cfg?.discoveredEvidence?.includes('EVD-CFG-01-ACTIVE-SPEC') ||
              !trust?.discoveredEvidence?.includes('EVD-TRUST-02-BINDING') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-01-SPECIFICATION') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-01-SPECIFICATION') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-03-TOPOLOGY')
            ) {
              throw new SynthesisNotEstablishedError();
            }
            break;
          }

          case 'lineage-perspective': {
            const audit = session.getNamespaceState<AuditSessionState>('audit');
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              !audit?.discoveredEvidence?.includes('EVD-AUD-03-FAILS') ||
              !cfg?.discoveredEvidence?.includes('EVD-CFG-04-COMPAT') ||
              !idn?.discoveredEvidence?.includes('EVD-IDN-04-LINEAGE') ||
              !trust?.discoveredEvidence?.includes('EVD-TRUST-03-LINEAGE') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-02-CONTINUITY') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-02-LINEAGE') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-02-CORRELATION')
            ) {
              throw new SynthesisNotEstablishedError();
            }
            break;
          }

          case 'boundary-perspective': {
            const meta = session.getNamespaceState<MetadataSessionState>('metadata');
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              !meta?.discoveredEvidence?.includes('EVD-META-02-CONTEXT') ||
              !cfg?.discoveredEvidence?.includes('EVD-CFG-02-BINDING') ||
              !idn?.discoveredEvidence?.includes('EVD-IDN-03-TRUST-MEMBERSHIP') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-03-BOUNDARY') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-03-BOUNDARY') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-01-CONTEXT')
            ) {
              throw new SynthesisNotEstablishedError();
            }
            break;
          }

          case 'relational-perspective': {
            const trans = session.getNamespaceState<TransitionSessionState>('transition');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');

            if (
              trans?.currentState !== 'RECONCILED' ||
              !trans?.recordedTransitions?.includes('EVD-TRANS-03-RECONCILIATION') ||
              !trust?.discoveredEvidence?.includes('EVD-TRUST-05-INTERPRETATION') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-04-RECONCILIATION') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-04-RECONCILIATION') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-04-CONVERGENCE')
            ) {
              throw new SynthesisNotEstablishedError();
            }
            break;
          }

          case 'multi-perspective': {
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');

            if (
              !infer?.discoveredEvidence?.includes('EVD-INFER-05-CONVERGENCE') ||
              !graph?.discoveredEvidence?.includes('EVD-GRAPH-05-RECONSTRUCTION') ||
              !synth?.discoveredEvidence?.includes('EVD-SYNTH-01-SPECIFICATION') ||
              !synth?.discoveredEvidence?.includes('EVD-SYNTH-02-LINEAGE') ||
              !synth?.discoveredEvidence?.includes('EVD-SYNTH-03-BOUNDARY') ||
              !synth?.discoveredEvidence?.includes('EVD-SYNTH-04-RELATIONAL')
            ) {
              throw new SynthesisNotEstablishedError();
            }
            break;
          }

          default:
            throw new SynthesisNotEstablishedError();
        }

        // Record discovery in session context under 'synthesis' namespace
        const currentSynthesisState =
          session.getNamespaceState<SynthesisSessionState>('synthesis') ?? {
            discoveredEvidence: [],
            accessCount: 0,
          };

        const updatedDiscovered = Array.from(
          new Set([...currentSynthesisState.discoveredEvidence, artifact.artifactId])
        );

        session.setNamespaceState<SynthesisSessionState>(
          'synthesis',
          {
            discoveredEvidence: updatedDiscovered,
            accessCount: currentSynthesisState.accessCount + 1,
            lastAccessedSynthesis: artifact.artifactId,
          },
          'synthesis'
        );

        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
