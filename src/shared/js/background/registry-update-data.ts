// Registry update periods in minutes; 0 disables scheduled updates.
export const registryUpdateIntervals = [0, 30, 60, 180, 360, 720, 1440]
export const defaultRegistryUpdateInterval = 60

export const validRegistryUpdateInterval = (value: unknown): value is number =>
  typeof value === 'number' && registryUpdateIntervals.includes(value)
