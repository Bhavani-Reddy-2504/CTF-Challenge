import { AppError } from '../errors/app-error.js';

export class InvalidSimRouteError extends AppError {
  constructor(message = 'Invalid symbolic route syntax.', internalDetails?: unknown) {
    super({
      code: 'INVALID_SIM_ROUTE',
      message,
      statusCode: 400,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
  }
}

export class UnsupportedSimNamespaceError extends AppError {
  constructor(message = 'Symbolic namespace is not supported or recognized.', internalDetails?: unknown) {
    super({
      code: 'UNSUPPORTED_SIM_NAMESPACE',
      message,
      statusCode: 400,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
  }
}

export class SimRouteNotFoundError extends AppError {
  constructor(message = 'Requested symbolic resource does not exist.', internalDetails?: unknown) {
    super({
      code: 'SIM_ROUTE_NOT_FOUND',
      message,
      statusCode: 404,
      classification: 'NOT_FOUND',
      internalDetails,
    });
  }
}

export class SimOperationNotAllowedError extends AppError {
  constructor(message = 'Requested operation is not permitted on this symbolic resource.', internalDetails?: unknown) {
    super({
      code: 'SIM_OPERATION_NOT_ALLOWED',
      message,
      statusCode: 403,
      classification: 'AUTHORIZATION',
      internalDetails,
    });
  }
}

export class SimDispatchError extends AppError {
  constructor(message = 'Symbolic dispatch request was rejected.', internalDetails?: unknown) {
    super({
      code: 'SIM_DISPATCH_REJECTED',
      message,
      statusCode: 403,
      classification: 'AUTHORIZATION',
      internalDetails,
    });
  }
}
