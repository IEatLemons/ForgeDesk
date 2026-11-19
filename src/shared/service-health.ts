export const serviceHealthIntervalMs = 5 * 60_000
export const serviceHealthStartupDelayMs = 10_000
export const serviceHealthTimeoutMs = 10_000

export type ServiceHealthCheckScope = { projectId?: string; serviceId?: string; environmentName?: string }
