import { RequestContext } from '../context/request-context.js';
import { ChallengeSessionContext } from '../session/session-context.js';
import { SimRoute } from './sim-route.js';

export type SimOperation = 'READ' | 'WRITE';

/**
 * Context passed strictly to registered symbolic route handlers.
 * Isolates handlers from raw HTTP requests, response objects, and arbitrary input.
 */
export interface SimHandlerContext {
  readonly route: SimRoute;
  readonly requestContext: RequestContext;
  readonly sessionContext?: ChallengeSessionContext;
}

/**
 * Strongly-typed handler function for a symbolic route.
 */
export type SimRouteHandler<TResult = unknown> = (
  context: SimHandlerContext
) => Promise<TResult> | TResult;

/**
 * Controlled dispatch result wrapper returned by SimDispatcher.
 */
export interface SimDispatchResult<T = unknown> {
  readonly status: 'success';
  readonly route: string;
  readonly operation: SimOperation;
  readonly data: T;
  readonly correlation_id: string;
}
