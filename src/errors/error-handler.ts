import { AppError, PublicErrorResponse } from './app-error.js';

export interface FormattedError {
  readonly statusCode: number;
  readonly publicResponse: PublicErrorResponse;
  readonly internalDetails?: unknown;
  readonly cause?: Error;
}

/**
 * Maps any caught exception into a sanitized, safe public error response.
 * Completely strips stack traces, internal paths, and secret details.
 */
export function formatPublicError(err: unknown, correlationId: string): FormattedError {
  if (err instanceof AppError && err.isOperational) {
    return {
      statusCode: err.statusCode,
      publicResponse: Object.freeze({
        status: 'error',
        code: err.code,
        message: err.message,
        correlation_id: correlationId,
      }),
      internalDetails: err.internalDetails,
      cause: err.cause instanceof Error ? err.cause : undefined,
    };
  }

  // Handle generic / unexpected error or non-operational fault
  const standardError = err instanceof Error ? err : new Error(String(err));
  return {
    statusCode: 500,
    publicResponse: Object.freeze({
      status: 'error',
      code: 'INTERNAL_FAULT',
      message: 'An internal error occurred. Please refer to correlation_id for tracing.',
      correlation_id: correlationId,
    }),
    internalDetails: standardError.message,
    cause: standardError,
  };
}
