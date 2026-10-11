// Data from storage, messages and network responses is checked at its boundary.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export interface RequestError extends Error {
  cause?: RequestError
  code?: string
  netError?: string
  httpStatus?: number
  status?: number
}
