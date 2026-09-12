import { RequestContext } from '../context/request-context.js';
import { Logger, rootLogger } from '../logging/logger.js';
import { DefaultSimAuthorizer, ISimAuthorizer } from '../router/sim-authorizer.js';
import { SimDispatcher } from '../router/sim-dispatcher.js';
import { SimDispatchResult, SimOperation } from '../router/sim-handler.js';
import { SimRoute } from '../router/sim-route.js';
import { SimRouteRegistry } from '../router/sim-registry.js';
import { IChallengeModule, ModuleId } from './module-contract.js';
import { ModuleRegistry } from './module-registry.js';

export class ChallengeEngineError extends Error {
  constructor(message: string) {
    super(`ChallengeEngine Error: ${message}`);
    this.name = 'ChallengeEngineError';
  }
}

export interface ChallengeEngineOptions {
  readonly routeRegistry?: SimRouteRegistry;
  readonly authorizer?: ISimAuthorizer;
  readonly logger?: Logger;
}

/**
 * ChallengeEngine is the central coordinator for the simulated cloud fabric.
 * Manages module lifecycle, enforces dependency injection boundaries,
 * and coordinates interactions safely without reflection or dynamic dispatch.
 */
export class ChallengeEngine {
  private readonly registry: ModuleRegistry;
  private readonly routeRegistry: SimRouteRegistry;
  private readonly dispatcher: SimDispatcher;
  private readonly logger: Logger;
  private initialized = false;

  constructor(
    registry: ModuleRegistry,
    loggerOrOptions: Logger | ChallengeEngineOptions = rootLogger
  ) {
    this.registry = registry;
    if (loggerOrOptions instanceof Logger) {
      this.logger = loggerOrOptions;
      this.routeRegistry = new SimRouteRegistry();
      this.dispatcher = new SimDispatcher(this.routeRegistry, new DefaultSimAuthorizer(), this.logger);
    } else {
      this.logger = loggerOrOptions.logger ?? rootLogger;
      this.routeRegistry = loggerOrOptions.routeRegistry ?? new SimRouteRegistry();
      const authorizer = loggerOrOptions.authorizer ?? new DefaultSimAuthorizer();
      this.dispatcher = new SimDispatcher(this.routeRegistry, authorizer, this.logger);
    }
  }

  /**
   * Initializes all registered modules in dependency order,
   * injecting strictly only their declared dependencies, then locks the registry.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      throw new ChallengeEngineError('ChallengeEngine is already initialized.');
    }

    this.logger.info('Initializing ChallengeEngine and resolving module dependencies...');

    const modules = this.registry.getAll();

    // 1. Verify all required dependencies exist
    for (const mod of modules) {
      for (const depId of mod.requiredDependencies) {
        if (!this.registry.has(depId)) {
          throw new ChallengeEngineError(
            `Unsatisfied dependency: Module '${mod.id}' requires '${depId}', but it is not registered.`
          );
        }
      }
    }

    // 2. Initialize each module with strictly filtered dependency map
    for (const mod of modules) {
      const injectedDeps: Map<ModuleId, IChallengeModule> = new Map();
      for (const depId of mod.requiredDependencies) {
        const dep = this.registry.get(depId);
        if (dep) {
          injectedDeps.set(depId, dep);
        }
      }

      this.logger.debug(`Initializing module: ${mod.id} (v${mod.version})`, undefined, {
        dependencies: mod.requiredDependencies,
      });

      await mod.initialize(injectedDeps);
    }

    // 3. Lock both module and route registries permanently
    this.registry.lock();
    this.routeRegistry.lock();
    this.initialized = true;

    this.logger.info('ChallengeEngine initialization complete. Module and route registries locked.', undefined, {
      active_modules: modules.map((m) => m.id),
    });
  }

  /**
   * Validates that the request context has an active session before processing.
   */
  public validateContext(context: RequestContext): void {
    if (!context.hasSession()) {
      throw new ChallengeEngineError('Operation requires an active, authenticated challenge session.');
    }
  }

  /**
   * Returns whether the engine is ready to service requests.
   */
  public isReady(): boolean {
    return this.initialized && this.registry.isLocked() && this.routeRegistry.isLocked();
  }

  /**
   * Returns the internal route registry for trusted module registration.
   */
  public getRouteRegistry(): SimRouteRegistry {
    return this.routeRegistry;
  }

  /**
   * Returns the internal dispatcher.
   */
  public getDispatcher(): SimDispatcher {
    return this.dispatcher;
  }

  /**
   * Executes a controlled symbolic dispatch.
   */
  public async dispatch<T = unknown>(
    route: SimRoute,
    operation: SimOperation,
    context: RequestContext
  ): Promise<SimDispatchResult<T>> {
    return this.dispatcher.dispatch<T>(route, operation, context);
  }

  /**
   * Controlled module lookup by typed ModuleId.
   */
  public getModule<T extends IChallengeModule>(id: ModuleId): T | undefined {
    return this.registry.get(id) as T | undefined;
  }

  /**
   * Evaluates a candidate final interpretation submission through the registered evaluation module.
   */
  public async submitFinalInterpretation<R = { status: string }>(
    context: RequestContext,
    submission: unknown
  ): Promise<R> {
    const evalModule = this.getModule('evaluation');
    if (!evalModule || typeof (evalModule as { submitFinalInterpretation?: unknown }).submitFinalInterpretation !== 'function') {
      throw new ChallengeEngineError("Evaluation module is not registered or does not support submission.");
    }
    return (evalModule as unknown as { submitFinalInterpretation: (ctx: RequestContext, sub: unknown) => Promise<R> }).submitFinalInterpretation(context, submission);
  }

  /**
   * Shuts down all registered modules in reverse order.
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down ChallengeEngine...');
    const modules = [...this.registry.getAll()].reverse();

    for (const mod of modules) {
      if (typeof mod.shutdown === 'function') {
        try {
          await mod.shutdown();
        } catch (err) {
          this.logger.error(`Error during module '${mod.id}' shutdown`, undefined, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.initialized = false;
    this.logger.info('ChallengeEngine shutdown completed.');
  }
}
