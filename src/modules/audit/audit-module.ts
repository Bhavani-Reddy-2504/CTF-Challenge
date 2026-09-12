import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { AUDIT_ARTIFACTS } from './audit-artifacts.js';

export interface AuditSessionState {
  readonly discoveredEvidence: readonly string[];
  readonly lastAccessedArtifact?: string;
  readonly accessCount: number;
}

/**
 * AuditModule simulates the immutable Event Horizon audit log engine.
 * Exposes a fixed set of deterministic chronological and correlation records.
 */
export class AuditModule implements IChallengeModule {
  public readonly id: ModuleId = 'audit';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  /**
   * Initializes the module and registers fixed symbolic audit routes.
   */
  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    for (const [segment, artifact] of Object.entries(AUDIT_ARTIFACTS)) {
      const route = parseSimRoute(`sim://audit/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        // Record discovery in session context if session is active
        if (context.sessionContext) {
          const currentState =
            context.sessionContext.getNamespaceState<AuditSessionState>('audit') ?? {
              discoveredEvidence: [],
              accessCount: 0,
            };

          const updatedDiscovered = Array.from(
            new Set([...currentState.discoveredEvidence, artifact.evidenceId])
          );

          context.sessionContext.setNamespaceState<AuditSessionState>(
            'audit',
            {
              discoveredEvidence: updatedDiscovered,
              lastAccessedArtifact: artifact.evidenceId,
              accessCount: currentState.accessCount + 1,
            },
            'audit' // Validated caller ID matching namespace
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
