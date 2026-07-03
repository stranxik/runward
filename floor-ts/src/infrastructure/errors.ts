// Typed error model. Single source of truth for application errors.
// A boundary that fails must say so in a typed, actionable way, not through a
// generic Error lost in the logs.

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "APPROVAL_DENIED"
  | "MODEL_PROVIDER"
  | "INTERNAL";

// Base class. Every application error inherits from it.
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;

  constructor(code: ErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    // Keeps a clean stack even after transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Invalid input at a boundary (typically a zod schema rejecting).
export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION", 400, message);
  }
}

// Requested resource does not exist (e.g. a run missing from the repository).
export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", 404, message);
  }
}

// Access denied: the role is not allowed to call the requested tool.
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super("UNAUTHORIZED", 403, message);
  }
}

// An impactful tool required an approval that was denied.
export class ApprovalDeniedError extends AppError {
  constructor(message: string) {
    super("APPROVAL_DENIED", 403, message);
  }
}

// The real model provider failed (network, timeout, non-2xx status,
// unreadable or empty response, unconfigured tier). Typed model boundary.
export class ModelProviderError extends AppError {
  constructor(message: string) {
    super("MODEL_PROVIDER", 502, message);
  }
}

// Handy type guard to tell our errors from unexpected ones.
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
