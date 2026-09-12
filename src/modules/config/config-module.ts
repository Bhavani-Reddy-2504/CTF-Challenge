import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { CONFIG_ARTIFACTS } from './config-artifacts.js';
import { validateConfigurationArtifacts } from './config-validator.js';

export interface ConfigSessionState {
  readonly discoveredArtifacts: readonly string[];
  readonly discoveredEvidence: readonly string[];
  readonly lastAccessedArtifact?: string;
  readonly accessCount: number;
}

/**
 * ConfigModule simulates the environment and workload configuration/specification layer.
 * Exposes fixed symbolic routes for active specifications, binding profiles,
 * federation matrices, compatibility rules, and integrity constraints.
 */
export class ConfigModule implements IChallengeModule {
  public readonly id: ModuleId = 'config';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze(['metadata', 'audit']);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  /**
   * Initializes the module, validates internal consistency, and registers fixed routes.
   */
  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Perform strict initialization-time consistency and safety validation
    validateConfigurationArtifacts(CONFIG_ARTIFACTS);

    // 2. Register explicit, fixed symbolic routes
    for (const [segment, artifact] of Object.entries(CONFIG_ARTIFACTS)) {
      const route = parseSimRoute(`sim://config/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        // Record discovery in session context if session is active
        if (context.sessionContext) {
          const currentState =
            context.sessionContext.getNamespaceState<ConfigSessionState>('config') ?? {
              discoveredArtifacts: [],
              discoveredEvidence: [],
              accessCount: 0,
            };

          const updatedDiscovered = Array.from(
            new Set([...currentState.discoveredArtifacts, artifact.artifactId])
          );

          context.sessionContext.setNamespaceState<ConfigSessionState>(
            'config',
            {
              discoveredArtifacts: updatedDiscovered,
              discoveredEvidence: updatedDiscovered,
              lastAccessedArtifact: artifact.artifactId,
              accessCount: currentState.accessCount + 1,
            },
            'config' // Strictly validated caller ID matching namespace
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
