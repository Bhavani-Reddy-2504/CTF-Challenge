import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { AuditSessionState } from '../audit/audit-module.js';
import { ConfigSessionState } from '../config/config-module.js';
import { ConstraintSessionState } from '../constraint/constraint-types.js';
import { IdentitySessionState } from '../identity/identity-module.js';
import { MetadataSessionState } from '../metadata/metadata-module.js';
import { TransitionSessionState } from '../transition/transition-types.js';
import { TrustSessionState } from '../trust/trust-types.js';
import { INFERENCE_ARTIFACTS } from './inference-artifacts.js';
import {
  InferenceNotEstablishedError,
  InferenceSessionState,
} from './inference-types.js';
import { validateInferenceArtifacts } from './inference-validator.js';

/**
 * InferenceModule implements the Multi-Domain Inference Engine & Controlled Hypothesis Resolution.
 * Provides deterministic evaluation across structural specification, historical lineage,
 * environmental boundary, and cross-domain reconciliation candidate models.
 *
 * Gating:
 * - specification-model: requires relevant config, trust, constraint evidence.
 * - lineage-model: requires relevant audit, config, identity, constraint evidence.
 * - boundary-model: requires relevant metadata, identity, constraint evidence.
 * - reconciliation-model: requires reconciled transition, trust, constraint evidence.
 * - convergence: requires discovery of all four prior inference models.
 */
export class InferenceModule implements IChallengeModule {
  public readonly id: ModuleId = 'inference';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
    'metadata',
    'audit',
    'config',
    'identity',
    'trust',
    'transition',
    'constraint',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate inference artifacts and anti-leakage constraints
    validateInferenceArtifacts(INFERENCE_ARTIFACTS);

    // 2. Register canonical symbolic routes
    for (const [segment, artifact] of Object.entries(INFERENCE_ARTIFACTS)) {
      const route = parseSimRoute(`sim://inference/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        if (!context.sessionContext) {
          throw new InferenceNotEstablishedError();
        }

        const session = context.sessionContext;

        // Server-side discovery gating
        switch (segment) {
          case 'specification-model': {
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');

            if (
              !cfg?.discoveredEvidence?.includes('EVD-CFG-01-ACTIVE-SPEC') ||
              !trust?.discoveredEvidence?.includes('EVD-TRUST-02-BINDING') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-01-SPECIFICATION')
            ) {
              throw new InferenceNotEstablishedError();
            }
            break;
          }

          case 'lineage-model': {
            const audit = session.getNamespaceState<AuditSessionState>('audit');
            const cfg = session.getNamespaceState<ConfigSessionState>('config');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');

            if (
              !audit?.discoveredEvidence?.includes('EVD-AUD-03-FAILS') ||
              !cfg?.discoveredEvidence?.includes('EVD-CFG-04-COMPAT') ||
              !idn?.discoveredEvidence?.includes('EVD-IDN-04-LINEAGE') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-02-CONTINUITY')
            ) {
              throw new InferenceNotEstablishedError();
            }
            break;
          }

          case 'boundary-model': {
            const meta = session.getNamespaceState<MetadataSessionState>('metadata');
            const idn = session.getNamespaceState<IdentitySessionState>('identity');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');

            if (
              !meta?.discoveredEvidence?.includes('EVD-META-02-CONTEXT') ||
              !idn?.discoveredEvidence?.includes('EVD-IDN-03-TRUST-MEMBERSHIP') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-03-BOUNDARY')
            ) {
              throw new InferenceNotEstablishedError();
            }
            break;
          }

          case 'reconciliation-model': {
            const trans = session.getNamespaceState<TransitionSessionState>('transition');
            const trust = session.getNamespaceState<TrustSessionState>('trust');
            const constraint = session.getNamespaceState<ConstraintSessionState>('constraint');

            if (
              trans?.currentState !== 'RECONCILED' ||
              !trans?.recordedTransitions?.includes('EVD-TRANS-03-RECONCILIATION') ||
              !trust?.discoveredEvidence?.includes('EVD-TRUST-05-INTERPRETATION') ||
              !constraint?.discoveredEvidence?.includes('EVD-CONSTRAINT-04-RECONCILIATION')
            ) {
              throw new InferenceNotEstablishedError();
            }
            break;
          }

          case 'convergence': {
            const infer = session.getNamespaceState<InferenceSessionState>('inference');

            if (
              !infer?.discoveredEvidence?.includes('EVD-INFER-01-SPECIFICATION') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-02-LINEAGE') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-03-BOUNDARY') ||
              !infer?.discoveredEvidence?.includes('EVD-INFER-04-RECONCILIATION')
            ) {
              throw new InferenceNotEstablishedError();
            }
            break;
          }

          default:
            throw new InferenceNotEstablishedError();
        }

        // Record discovery in session context under 'inference' namespace
        const currentInferenceState =
          session.getNamespaceState<InferenceSessionState>('inference') ?? {
            discoveredEvidence: [],
            accessCount: 0,
          };

        const updatedDiscovered = Array.from(
          new Set([...currentInferenceState.discoveredEvidence, artifact.artifactId])
        );

        session.setNamespaceState<InferenceSessionState>(
          'inference',
          {
            discoveredEvidence: updatedDiscovered,
            accessCount: currentInferenceState.accessCount + 1,
            lastAccessedInference: artifact.artifactId,
          },
          'inference'
        );

        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
