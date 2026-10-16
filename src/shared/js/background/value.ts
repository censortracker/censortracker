// Data from storage, messages and network responses is checked at its boundary.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const toRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

// Thrown values have no static type.
export const errorMessage = (error: unknown) =>
  isRecord(error) && typeof error.message === 'string'
    ? error.message : String(error)

// Diagnostics read these fields from the cause chain.
export const requestError = (message: string,
  fields: { code?: string; httpStatus?: number; name?: string }) =>
  Object.assign(new Error(message), fields)
