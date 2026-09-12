import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { TransitionSessionState } from '../transition/transition-types.js';
import { CONSTRAINT_ARTIFACTS } from './constraint-artifacts.js';
import {
  ConstraintNotEstablishedError,
  ConstraintSessionState,
} from './constraint-types.js';
import { validateConstraintArtifacts } from './constraint-validator.js';

/**
 * ConstraintModule implements the Constraint Interpretation & Evidence Contradiction Engine.
 * Provides deterministic interpretation of structural definitions, historical continuity,
 * perimeter boundaries, and cross-domain reconciliation invariants.
 *
 * Gating: Accessible only after legitimate predecessor progression to the RECONCILED state.
 * Returns generic 422 errors when prerequisites are not established.
 */
export class ConstraintModule implements IChallengeModule {
  public readonly id: ModuleId = 'constraint';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
    'metadata',
    'audit',
    'config',
    'identity',
    'trust',
    'transition',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate constraint artifacts, contradiction matrix, and anti-leakage constraints
    validateConstraintArtifacts(CONSTRAINT_ARTIFACTS);

    // 2. Register canonical symbolic routes
    for (const [segment, artifact] of Object.entries(CONSTRAINT_ARTIFACTS)) {
      const route = parseSimRoute(`sim://constraint/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        if (!context.sessionContext) {
          throw new ConstraintNotEstablishedError();
        }

        // Server-side discovery gating: Player must have reached RECONCILED state
        const transitionState =
          context.sessionContext.getNamespaceState<TransitionSessionState>('transition');

        if (
          !transitionState ||
          transitionState.currentState !== 'RECONCILED' ||
          !transitionState.recordedTransitions.includes('EVD-TRANS-03-RECONCILIATION')
        ) {
          throw new ConstraintNotEstablishedError();
        }

        // Record constraint discovery in session context under 'constraint' namespace
        const currentConstraintState =
          context.sessionContext.getNamespaceState<ConstraintSessionState>('constraint') ?? {
            discoveredEvidence: [],
            accessCount: 0,
          };

        const updatedDiscovered = Array.from(
          new Set([...currentConstraintState.discoveredEvidence, artifact.artifactId])
        );

        context.sessionContext.setNamespaceState<ConstraintSessionState>(
          'constraint',
          {
            discoveredEvidence: updatedDiscovered,
            accessCount: currentConstraintState.accessCount + 1,
            lastAccessedConstraint: artifact.artifactId,
          },
          'constraint'
        );

        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
