import { RequestContext } from '../context/request-context.js';
import { SimOperation } from './sim-handler.js';
import { SimRoute } from './sim-route.js';

/**
 * Authorization boundary interface for the symbolic router.
 * Prepares the architecture for Prompt 8 (ABAC Policy Engine) integration
 * without requiring router redesign.
 */
export interface ISimAuthorizer {
  /**
   * Evaluates whether the active context is authorized to invoke
   * the specified operation on the target symbolic route.
   */
  authorize(
    route: SimRoute,
    operation: SimOperation,
    context: RequestContext
  ): Promise<boolean> | boolean;
}

/**
 * Baseline internal authorizer used for Prompt 3 foundation testing.
 * Future Prompt 8 will replace or wrap this with the comprehensive ABAC Policy Engine.
 */
export class DefaultSimAuthorizer implements ISimAuthorizer {
  public authorize(
    _route: SimRoute,
    _operation: SimOperation,
    _context: RequestContext
  ): boolean {
    return true;
  }
}
