import { SimOperation, SimRouteHandler } from './sim-handler.js';
import { SimRoute } from './sim-route.js';
import { SimDispatchError } from './sim-errors.js';

/**
 * Route registry storing trusted in-process operation handlers.
 * Enforces explicit registration, duplicate rejection, and post-bootstrap immutability.
 */
export class SimRouteRegistry {
  private readonly routes: Map<string, SimRouteHandler> = new Map();
  private readonly registeredCanonicals: Set<string> = new Set();
  private locked = false;

  private makeKey(route: SimRoute, operation: SimOperation): string {
    return `${route.canonical}#${operation}`;
  }

  /**
   * Registers a handler for a specific symbolic route and operation.
   * Throws if the registry is locked or if the route/operation pair is already registered.
   */
  public register(route: SimRoute, operation: SimOperation, handler: SimRouteHandler): void {
    if (this.locked) {
      throw new SimDispatchError('RouteRegistry is locked. Registrations cannot occur after application bootstrap.');
    }

    if (!(route instanceof SimRoute)) {
      throw new SimDispatchError('Invalid route: must be an instance of SimRoute.');
    }

    if (typeof handler !== 'function') {
      throw new SimDispatchError('Handler must be a function.');
    }

    const key = this.makeKey(route, operation);
    if (this.routes.has(key)) {
      throw new SimDispatchError(`Duplicate route registration: '${key}' is already registered.`);
    }

    this.routes.set(key, handler);
    this.registeredCanonicals.add(route.canonical);
  }

  /**
   * Locks the registry permanently. After this call, register() will fail.
   */
  public lock(): void {
    this.locked = true;
  }

  /**
   * Returns whether the registry has been locked.
   */
  public isLocked(): boolean {
    return this.locked;
  }

  /**
   * Retrieves the registered handler for the given route and operation.
   */
  public getHandler(route: SimRoute, operation: SimOperation): SimRouteHandler | undefined {
    const key = this.makeKey(route, operation);
    return this.routes.get(key);
  }

  /**
   * Checks if a route is registered for any operation (used to distinguish 404 vs 403).
   */
  public hasRouteAny(route: SimRoute): boolean {
    return this.registeredCanonicals.has(route.canonical);
  }

  /**
   * Checks if an exact (route, operation) pair is registered.
   */
  public hasRoute(route: SimRoute, operation: SimOperation): boolean {
    const key = this.makeKey(route, operation);
    return this.routes.has(key);
  }

  /**
   * Clears all routes (testing only).
   */
  public resetForTesting(): void {
    this.routes.clear();
    this.registeredCanonicals.clear();
    this.locked = false;
  }
}
