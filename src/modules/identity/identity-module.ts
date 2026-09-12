import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { IDENTITY_ARTIFACTS } from './identity-artifacts.js';
import { validateIdentityArtifacts } from './identity-validator.js';

export interface IdentitySessionState {
  readonly discoveredIdentities: readonly string[];
  readonly discoveredEvidence: readonly string[];
  readonly lastAccessedIdentity?: string;
  readonly accessCount: number;
}

/**
 * IdentityModule simulates the logical identity context and trust resolution layer.
 * Exposes fixed symbolic routes for identity context, binding records,
 * trust-domain memberships, lineage continuity, and compatibility interpretations.
 */
export class IdentityModule implements IChallengeModule {
  public readonly id: ModuleId = 'identity';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
    'metadata',
    'audit',
    'config',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  /**
   * Initializes the module, validates internal consistency, and registers fixed routes.
   */
  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Perform strict initialization-time consistency and safety validation
    validateIdentityArtifacts(IDENTITY_ARTIFACTS);

    // 2. Register explicit, fixed symbolic routes
    for (const [segment, artifact] of Object.entries(IDENTITY_ARTIFACTS)) {
      const route = parseSimRoute(`sim://identity/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        // Record discovery in session context if session is active
        if (context.sessionContext) {
          const currentState =
            context.sessionContext.getNamespaceState<IdentitySessionState>('identity') ?? {
              discoveredIdentities: [],
              discoveredEvidence: [],
              accessCount: 0,
            };

          const updatedDiscovered = Array.from(
            new Set([...currentState.discoveredIdentities, artifact.artifactId])
          );

          context.sessionContext.setNamespaceState<IdentitySessionState>(
            'identity',
            {
              discoveredIdentities: updatedDiscovered,
              discoveredEvidence: updatedDiscovered,
              lastAccessedIdentity: artifact.artifactId,
              accessCount: currentState.accessCount + 1,
            },
            'identity' // Strictly validated caller ID matching namespace
          );
        }

        // Return sanitized public evidence representation (defensively copied and frozen)
        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
