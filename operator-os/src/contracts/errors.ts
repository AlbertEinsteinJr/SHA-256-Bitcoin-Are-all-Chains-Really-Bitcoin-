// One error hierarchy — consistent across subsystems and serializable across the
// API/CLI boundary.
export type ErrorCode =
  | "KILL_TRIPPED"
  | "CAP_EXCEEDED"
  | "CONSTITUTION"
  | "APPROVAL_REQUIRED"
  | "VALIDATION"
  | "UPSTREAM"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class OperatorError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly meta?: Record<string, unknown>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
  toJSON() {
    return { error: this.name, code: this.code, message: this.message, meta: this.meta };
  }
}

export class KillSwitchTrippedError extends OperatorError {
  constructor(reason?: string) {
    super(`KILL switch is tripped${reason ? `: ${reason}` : ""}`, "KILL_TRIPPED");
  }
}
export class CapExceededError extends OperatorError {
  constructor(kind: string, meta?: Record<string, unknown>) {
    super(`cap exceeded: ${kind}`, "CAP_EXCEEDED", meta);
  }
}
export class ConstitutionViolation extends OperatorError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, "CONSTITUTION", meta);
  }
}
export class ApprovalRequiredError extends OperatorError {
  constructor(action: string) {
    super(
      `action "${action}" requires an APPROVED-${action}-<YYYYMMDD> token`,
      "APPROVAL_REQUIRED",
      { action },
    );
  }
}
export class ValidationError extends OperatorError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, "VALIDATION", meta);
  }
}
export class ExternalServiceError extends OperatorError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "UPSTREAM", undefined, options);
  }
}
export class NotFoundError extends OperatorError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}
export class ConflictError extends OperatorError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}
