export type ErrorClassification =
  | 'CLIENT_INPUT'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL_FAULT';

export interface PublicErrorResponse {
  readonly status: 'error';
  readonly code: string;
  readonly message: string;
  readonly correlation_id: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly classification: ErrorClassification;
  public readonly isOperational: boolean;
  public readonly internalDetails?: unknown;

  constructor(options: {
    code: string;
    message: string;
    statusCode?: number;
    classification?: ErrorClassification;
    isOperational?: boolean;
    internalDetails?: unknown;
    cause?: Error;
  }) {
    super(options.message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.classification = options.classification ?? 'INTERNAL_FAULT';
    this.isOperational = options.isOperational ?? true;
    this.internalDetails = options.internalDetails;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request parameters.', internalDetails?: unknown) {
    super({
      code: 'BAD_REQUEST',
      message,
      statusCode: 400,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication credentials are required or invalid.', internalDetails?: unknown) {
    super({
      code: 'UNAUTHORIZED',
      message,
      statusCode: 401,
      classification: 'AUTHENTICATION',
      internalDetails,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access to this resource is prohibited.', internalDetails?: unknown) {
    super({
      code: 'FORBIDDEN',
      message,
      statusCode: 403,
      classification: 'AUTHORIZATION',
      internalDetails,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource does not exist.', internalDetails?: unknown) {
    super({
      code: 'NOT_FOUND',
      message,
      statusCode: 404,
      classification: 'NOT_FOUND',
      internalDetails,
    });
  }
}

export class ResourceExhaustedError extends AppError {
  constructor(message = 'System resource limit reached.', internalDetails?: unknown) {
    super({
      code: 'RESOURCE_EXHAUSTED',
      message,
      statusCode: 429,
      classification: 'RESOURCE_EXHAUSTED',
      internalDetails,
    });
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = 'Too many requests. Please slow down.', internalDetails?: unknown) {
    super({
      code: 'RATE_LIMITED',
      message,
      statusCode: 429,
      classification: 'RATE_LIMIT',
      internalDetails,
    });
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(message = 'HTTP method not allowed for this endpoint.', internalDetails?: unknown) {
    super({
      code: 'METHOD_NOT_ALLOWED',
      message,
      statusCode: 405,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected internal fault occurred.', internalDetails?: unknown, cause?: Error) {
    super({
      code: 'INTERNAL_FAULT',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
      isOperational: false,
      internalDetails,
      cause,
    });
  }
}

export class ConfigurationError extends AppError {
  constructor(message = 'Required server configuration is unavailable.', internalDetails?: unknown) {
    super({
      code: 'CONFIGURATION_ERROR',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
      isOperational: false,
      internalDetails,
    });
  }
}

