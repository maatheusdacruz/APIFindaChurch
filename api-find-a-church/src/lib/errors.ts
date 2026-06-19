/**
 * Erros de domínio (§3.2). O wrapper HTTP (http.ts) converte cada um
 * para o status e o `code` corretos. Nada de stack trace em produção.
 */
export type ErrorDetail = { path?: string; message: string }

export abstract class DomainError extends Error {
  abstract readonly status: number
  abstract readonly code: string
  readonly details?: ErrorDetail[]

  constructor(message: string, details?: ErrorDetail[]) {
    super(message)
    this.name = new.target.name
    this.details = details
  }
}

export class ValidationError extends DomainError {
  readonly status = 400
  readonly code = 'VALIDATION_ERROR'
}

export class NotFoundError extends DomainError {
  readonly status = 404
  readonly code = 'NOT_FOUND'
}

export class ForbiddenError extends DomainError {
  readonly status = 403
  readonly code = 'FORBIDDEN'
}

export class ConflictError extends DomainError {
  readonly status = 409
  readonly code = 'CONFLICT'
}
