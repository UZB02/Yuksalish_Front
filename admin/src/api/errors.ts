import type { ApiErrorBody, ApiFieldError, ErrorCode } from './types'

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: ApiFieldError[]

  constructor(code: ErrorCode, message: string, status = 0, details: ApiFieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function codeFromStatus(status: number): ErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION_ERROR'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 429) return 'RATE_LIMITED'
  return 'INTERNAL'
}

/** Axios xatosini yagona ApiError ga aylantiradi. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const err = error as {
    response?: { status: number; data?: Partial<ApiErrorBody> }
    message?: string
  }
  if (!err || !err.response) {
    return new ApiError('NETWORK', err?.message ?? 'Network error', 0)
  }
  const { status, data } = err.response
  const body = data?.error
  return new ApiError(
    body?.code ?? codeFromStatus(status),
    body?.message ?? err.message ?? 'Request failed',
    status,
    body?.details ?? [],
  )
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
