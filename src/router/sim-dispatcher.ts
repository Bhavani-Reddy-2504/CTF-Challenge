import { RequestContext } from '../context/request-context.js';
import { Logger, rootLogger } from '../logging/logger.js';
import { DefaultSimAuthorizer, ISimAuthorizer } from './sim-authorizer.js';
import {
  SimDispatchError,
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
} from './sim-errors.js';
import { SimDispatchResult, SimHandlerContext, SimOperation } from './sim-handler.js';
import { SimRoute } from './sim-route.js';
import { SimRouteRegistry } from './sim-registry.js';

export class SimDispatcher {
  private readonly registry: SimRouteRegistry;
  private readonly authorizer: ISimAuthorizer;
  private readonly logger: Logger;

  constructor(
    registry: SimRouteRegistry,
    authorizer: ISimAuthorizer = new DefaultSimAuthorizer(),
    logger: Logger = rootLogger
  ) {
    this.registry = registry;
    this.authorizer = authorizer;
    this.logger = logger;
  }

  /**
   * Executes a controlled dispatch to an explicitly registered symbolic route handler.
   * Enforces registry locking, authorizer evaluation, and isolated handler context.
   */
  public async dispatch<T = unknown>(
    route: SimRoute,
    operation: SimOperation,
    context: RequestContext
  ): Promise<SimDispatchResult<T>> {
    // 1. Strict route type verification
    if (!(route instanceof SimRoute)) {
      throw new SimDispatchError('Invalid route: must be an instance of SimRoute.');
    }

    // 2. Strict operation verification
    if (operation !== 'READ' && operation !== 'WRITE') {
      throw new SimOperationNotAllowedError(`Operation '${String(operation)}' is not permitted.`);
    }

    // 3. Strict request context verification
    if (!context || !(context instanceof RequestContext) || !context.correlationId) {
      throw new SimDispatchError('Valid RequestContext is required for symbolic dispatch.');
    }

    // 4. Registry lock enforcement
    if (!this.registry.isLocked()) {
      throw new SimDispatchError('Dispatcher requires a locked route registry.');
    }

    // 5. Route existence check
    if (!this.registry.hasRouteAny(route)) {
      this.logger.debug('Symbolic route not found', context.correlationId, {
        route: route.canonical,
      });
      throw new SimRouteNotFoundError('Requested symbolic resource does not exist.');
    }

    if (!this.registry.hasRoute(route, operation)) {
      this.logger.debug('Symbolic operation not supported for route', context.correlationId, {
        route: route.canonical,
        operation,
      });
      throw new SimOperationNotAllowedError(
        `Operation '${operation}' is not supported for symbolic resource '${route.canonical}'.`
      );
    }

    // 6. Authorization boundary evaluation (Extension point for Prompt 8 ABAC Policy Engine)
    const isAuthorized = await this.authorizer.authorize(route, operation, context);
    if (!isAuthorized) {
      this.logger.warn('Symbolic route authorization denied', context.correlationId, {
        route: route.canonical,
        operation,
      });
      throw new SimOperationNotAllowedError('Access denied: operation not authorized for this context.');
    }

    // 7. Resolve explicit handler
    const handler = this.registry.getHandler(route, operation);
    if (!handler) {
      throw new SimRouteNotFoundError('Handler not registered for requested route and operation.');
    }

    // 8. Build isolated handler context (contains zero raw HTTP objects)
    const handlerContext: SimHandlerContext = Object.freeze({
      route,
      requestContext: context,
      sessionContext: context.getChallengeContext(),
    });

    // 9. Execute handler
    const data = await handler(handlerContext);

    // 10. Return sanitized result wrapper
    const result: SimDispatchResult<T> = Object.freeze({
      status: 'success' as const,
      route: route.canonical,
      operation,
      data: data as T,
      correlation_id: context.correlationId,
    });
    return result;
  }
}
