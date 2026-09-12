import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { METADATA_ARTIFACTS } from './metadata-artifacts.js';

export interface MetadataSessionState {
  readonly discoveredEvidence: readonly string[];
  readonly lastAccessedArtifact?: string;
  readonly accessCount: number;
}

/**
 * MetadataModule simulates the local node and workload metadata layer.
 * Exposes a fixed set of deterministic evidence artifacts and tracks discoveries.
 */
export class MetadataModule implements IChallengeModule {
  public readonly id: ModuleId = 'metadata';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  /**
   * Initializes the module and registers fixed symbolic routes.
   */
  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    for (const [segment, artifact] of Object.entries(METADATA_ARTIFACTS)) {
      const route = parseSimRoute(`sim://metadata/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        // Record discovery in session context if session is active
        if (context.sessionContext) {
          const currentState =
            context.sessionContext.getNamespaceState<MetadataSessionState>('metadata') ?? {
              discoveredEvidence: [],
              accessCount: 0,
            };

          const updatedDiscovered = Array.from(
            new Set([...currentState.discoveredEvidence, artifact.evidenceId])
          );

          context.sessionContext.setNamespaceState<MetadataSessionState>(
            'metadata',
            {
              discoveredEvidence: updatedDiscovered,
              lastAccessedArtifact: artifact.evidenceId,
              accessCount: currentState.accessCount + 1,
            },
            'metadata' // Validated caller ID matching namespace
          );
        }

        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
