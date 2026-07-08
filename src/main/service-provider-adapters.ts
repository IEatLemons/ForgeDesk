export type ServiceProviderType = 'railway' | 'vercel'

export type RailwayTokenType = 'account' | 'workspace' | 'project'

export type ServiceProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

export type ServiceProviderConnection = {
  token: string
  teamId?: string
  workspaceId?: string
  railwayTokenType?: RailwayTokenType
}

export type ProviderServiceEnvironmentSnapshot = {
  name: string
  externalEnvironmentId?: string
  deploymentStatus?: string
  latestDeploymentId?: string
  latestDeploymentUrl?: string
  latestCommit?: string
}

export type ProviderServiceDomainSnapshot = {
  domain: string
  environmentName?: string
  kind?: 'custom' | 'generated' | 'manual'
  enabled?: boolean
}

export type ProviderServiceSnapshot = {
  provider: ServiceProviderType
  name: string
  externalProjectId: string
  externalProjectName?: string
  externalServiceId?: string
  environments: ProviderServiceEnvironmentSnapshot[]
  domains: ProviderServiceDomainSnapshot[]
}

export type ProviderDeploymentLogLine = {
  timestamp: string
  level: string
  message: string
  source: string
}

export type VercelDeploymentSummary = {
  id: string
  url: string
  target: string
  state: string
  createdAt: string
  readyAt: string
  creator: string
  meta: Record<string, unknown>
  commitSha: string
  environmentId?: string
  projectId?: string
  serviceId?: string
  canRedeploy?: boolean
  canRollback?: boolean
  deploymentStopped?: boolean
}

export type ServiceDeploymentSummary = VercelDeploymentSummary

export type VercelDeploymentListOptions = {
  target?: string
  limit?: number
}

export type ServiceDeploymentListOptions = VercelDeploymentListOptions

export type VercelEnvVarRecord = {
  id: string
  key: string
  type: string
  target: string[]
  gitBranch: string
  customEnvironmentIds: string[]
  comment: string
  createdAt: string
  updatedAt: string
  decrypted: boolean
  value?: string
}

export type ServiceEnvVarRecord = VercelEnvVarRecord

export type VercelEnvVarInput = {
  id?: string
  key: string
  value?: string
  type: string
  target?: string[]
  customEnvironmentIds?: string[]
  gitBranch?: string
  comment?: string
}

export type VercelDomainInput = {
  name: string
  environmentName?: string
  gitBranch?: string
  redirect?: string
  redirectStatusCode?: number
}

export type VercelDomainConfig = {
  configured: boolean
  misconfigured: boolean
  acceptedChallenges: unknown[]
  recommendedRecords: unknown[]
  raw: Record<string, unknown>
}

const railwayGraphqlEndpoint = 'https://backboard.railway.app/graphql/v2'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  const record = asRecord(value)
  const nodes = record.nodes
  const edges = record.edges

  if (Array.isArray(nodes)) {
    return nodes
  }

  if (Array.isArray(edges)) {
    return edges.map((edge) => asRecord(edge).node).filter(Boolean)
  }

  return []
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number') {
      return String(value)
    }
  }

  return ''
}

function stringArrayField(record: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key]

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    }

    if (typeof value === 'string' && value.trim()) {
      return [value.trim()]
    }
  }

  return []
}

function booleanField(record: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase()

      if (normalized === 'true') {
        return true
      }

      if (normalized === 'false') {
        return false
      }
    }
  }

  return undefined
}

function timestampField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString()
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

async function readJsonResponse(response: Response, context: string): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`${context}失败：${response.status} ${response.statusText}${detail ? ` ${detail}` : ''}`.trim())
  }

  return response.json()
}

async function readTextResponse(response: Response, context: string): Promise<string> {
  const text = await response.text().catch(() => '')

  if (!response.ok) {
    throw new Error(`${context}失败：${response.status} ${response.statusText}${text ? ` ${text}` : ''}`.trim())
  }

  return text
}

function appendVercelTeamId(url: URL, teamId?: string): URL {
  if (teamId?.trim()) {
    url.searchParams.set('teamId', teamId.trim())
  }

  return url
}

function getVercelHeaders(connection: ServiceProviderConnection): Record<string, string> {
  return {
    Authorization: `Bearer ${connection.token}`,
    'Content-Type': 'application/json'
  }
}

function createVercelApiUrl(pathname: string, teamId?: string): URL {
  return appendVercelTeamId(new URL(pathname, 'https://api.vercel.com'), teamId)
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim())
}

function cleanJsonBody(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && !(typeof value === 'string' && !value.trim()))
  )
}

async function readVercelJson(
  connection: ServiceProviderConnection,
  url: URL,
  context: string,
  fetcher: ServiceProviderFetch,
  init: RequestInit = {}
): Promise<unknown> {
  return readJsonResponse(
    await fetcher(url, {
      ...init,
      headers: {
        ...getVercelHeaders(connection),
        ...(init.headers as Record<string, string> | undefined)
      }
    }),
    context
  )
}

function normalizeVercelDeployment(item: unknown): VercelDeploymentSummary {
  const deployment = asRecord(item)
  const meta = asRecord(deployment.meta)
  const creator = asRecord(deployment.creator)

  return {
    id: stringField(deployment, 'uid', 'id'),
    url: stringField(deployment, 'url'),
    target: stringField(deployment, 'target', 'environment') || getVercelDeploymentEnvironment(deployment),
    state: stringField(deployment, 'state', 'readyState'),
    createdAt: timestampField(deployment, 'createdAt', 'created'),
    readyAt: timestampField(deployment, 'ready', 'readyAt', 'aliasAssignedAt'),
    creator: stringField(creator, 'username', 'name', 'email', 'uid'),
    meta,
    commitSha: stringField(meta, 'githubCommitSha', 'gitlabCommitSha', 'bitbucketCommitSha')
  }
}

function normalizeVercelEnvVar(item: unknown, includeValue = false): VercelEnvVarRecord {
  const env = asRecord(item)
  const output: VercelEnvVarRecord = {
    id: stringField(env, 'id'),
    key: stringField(env, 'key'),
    type: stringField(env, 'type'),
    target: stringArrayField(env, 'target'),
    gitBranch: stringField(env, 'gitBranch'),
    customEnvironmentIds: stringArrayField(env, 'customEnvironmentIds'),
    comment: stringField(env, 'comment'),
    createdAt: timestampField(env, 'createdAt'),
    updatedAt: timestampField(env, 'updatedAt'),
    decrypted: Boolean(env.decrypted)
  }

  if (includeValue) {
    output.value = stringField(env, 'value')
  }

  return output
}

function getLogMessage(record: Record<string, unknown>, payload: Record<string, unknown>): string {
  const proxy = asRecord(record.proxy)
  const payloadProxy = asRecord(payload.proxy)
  const proxyRecord = Object.keys(proxy).length ? proxy : payloadProxy
  const message = stringField(record, 'text', 'message') || stringField(payload, 'text', 'message')

  if (message) {
    return message
  }

  if (Object.keys(proxyRecord).length) {
    return [stringField(proxyRecord, 'method'), stringField(proxyRecord, 'path'), stringField(proxyRecord, 'statusCode')].filter(Boolean).join(' ')
  }

  return ''
}

function normalizeVercelLogLine(item: unknown): ProviderDeploymentLogLine {
  if (typeof item === 'string') {
    return {
      timestamp: '',
      level: 'log',
      message: item,
      source: ''
    }
  }

  const event = asRecord(item)
  const payload = asRecord(event.payload)

  return {
    timestamp:
      timestampField(event, 'timestamp', 'createdAt', 'created', 'date') || timestampField(payload, 'timestamp', 'createdAt', 'created', 'date'),
    level: stringField(event, 'type', 'level') || stringField(payload, 'type', 'level'),
    message: getLogMessage(event, payload),
    source: stringField(event, 'source') || stringField(payload, 'source')
  }
}

function parseVercelLogText(text: string): unknown[] {
  const trimmed = text.trim()

  if (!trimmed) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmed)

    if (Array.isArray(parsed)) {
      return parsed
    }

    return asArray(asRecord(parsed).events || asRecord(parsed).logs)
  } catch {
    return trimmed.split(/\r?\n/).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return line
      }
    })
  }
}

function createVercelDeploymentsUrl(projectId: string, projectName: string, teamId?: string, target?: string, limit = '20'): URL {
  const deploymentUrl = appendVercelTeamId(new URL('https://api.vercel.com/v6/deployments'), teamId)
  deploymentUrl.searchParams.set('projectId', projectId || projectName)
  deploymentUrl.searchParams.set('limit', limit)

  if (target) {
    deploymentUrl.searchParams.set('target', target)
  }

  return deploymentUrl
}

function getVercelDeploymentEnvironment(deployment: Record<string, unknown>): string {
  const customEnvironment = asRecord(deployment.customEnvironment)
  const customEnvironmentName = stringField(customEnvironment, 'slug', 'name')

  if (customEnvironmentName) {
    return customEnvironmentName
  }

  return stringField(deployment, 'target', 'environment') || 'production'
}

function createVercelEnvironment(deployment: Record<string, unknown>): ProviderServiceEnvironmentSnapshot {
  const meta = asRecord(deployment.meta)
  const customEnvironment = asRecord(deployment.customEnvironment)

  return {
    name: getVercelDeploymentEnvironment(deployment),
    externalEnvironmentId: stringField(customEnvironment, 'id'),
    deploymentStatus: stringField(deployment, 'state', 'readyState'),
    latestDeploymentId: stringField(deployment, 'uid', 'id'),
    latestDeploymentUrl: stringField(deployment, 'url'),
    latestCommit: stringField(meta, 'githubCommitSha', 'gitlabCommitSha', 'bitbucketCommitSha')
  }
}

function upsertVercelEnvironment(
  environmentsByName: Map<string, ProviderServiceEnvironmentSnapshot>,
  environment: ProviderServiceEnvironmentSnapshot
): void {
  const existing = environmentsByName.get(environment.name)

  environmentsByName.set(environment.name, {
    ...existing,
    ...environment,
    externalEnvironmentId: environment.externalEnvironmentId || existing?.externalEnvironmentId
  })
}

function createEmptyVercelEnvironment(name: string): ProviderServiceEnvironmentSnapshot {
  return {
    name,
    deploymentStatus: '',
    latestDeploymentId: '',
    latestDeploymentUrl: '',
    latestCommit: ''
  }
}

function getOrderedVercelEnvironments(environmentsByName: Map<string, ProviderServiceEnvironmentSnapshot>): ProviderServiceEnvironmentSnapshot[] {
  for (const environmentName of ['production', 'preview']) {
    if (!environmentsByName.has(environmentName)) {
      environmentsByName.set(environmentName, createEmptyVercelEnvironment(environmentName))
    }
  }

  return [...environmentsByName.values()].sort((left, right) => {
    const order = new Map([
      ['production', 0],
      ['preview', 1]
    ])
    const leftOrder = order.get(left.name) ?? 10
    const rightOrder = order.get(right.name) ?? 10

    return leftOrder === rightOrder ? left.name.localeCompare(right.name) : leftOrder - rightOrder
  })
}

function getVercelCustomEnvironments(json: unknown): ProviderServiceEnvironmentSnapshot[] {
  const record = asRecord(json)
  const environments = [
    ...asArray(record.environments),
    ...asArray(record.customEnvironments),
    ...asArray(record.items)
  ]

  return environments
    .map((environmentItem): ProviderServiceEnvironmentSnapshot | null => {
      const environment = asRecord(environmentItem)
      const name = stringField(environment, 'slug', 'name')

      return name
        ? {
            name,
            externalEnvironmentId: stringField(environment, 'id'),
            deploymentStatus: stringField(environment, 'status')
          }
        : null
    })
    .filter((environment): environment is ProviderServiceEnvironmentSnapshot => Boolean(environment))
}

export async function syncVercelProviderServices(
  connection: ServiceProviderConnection,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderServiceSnapshot[]> {
  const projectsUrl = appendVercelTeamId(new URL('https://api.vercel.com/v9/projects'), connection.teamId)
  const projectsJson = asRecord(await readJsonResponse(await fetcher(projectsUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 项目'))
  const projects = asArray(projectsJson.projects)

  return Promise.all(
    projects.map(async (item): Promise<ProviderServiceSnapshot> => {
      const project = asRecord(item)
      const projectId = stringField(project, 'id')
      const projectName = stringField(project, 'name', 'framework') || projectId
      const deploymentUrl = createVercelDeploymentsUrl(projectId, projectName, connection.teamId)
      const domainsUrl = appendVercelTeamId(new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId || projectName)}/domains`), connection.teamId)
      const customEnvironmentsUrl = appendVercelTeamId(
        new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId || projectName)}/custom-environments`),
        connection.teamId
      )
      const [deploymentsJson, domainsJson, customEnvironmentsJson] = await Promise.all([
        readJsonResponse(await fetcher(deploymentUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 部署'),
        readJsonResponse(await fetcher(domainsUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 域名').catch(() => ({ domains: [] })),
        readJsonResponse(await fetcher(customEnvironmentsUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 自定义环境').catch(() => ({ environments: [] }))
      ])
      const deployments = asArray(asRecord(deploymentsJson).deployments)
      const environmentsByName = new Map<string, ProviderServiceEnvironmentSnapshot>()

      for (const environment of getVercelCustomEnvironments(customEnvironmentsJson)) {
        upsertVercelEnvironment(environmentsByName, environment)
      }

      for (const deploymentItem of deployments) {
        const environment = createVercelEnvironment(asRecord(deploymentItem))

        upsertVercelEnvironment(environmentsByName, environment)
      }

      const targetedDeploymentTargets = [...new Set(['production', 'preview', ...environmentsByName.keys()])]
      const targetedDeploymentsJson = await Promise.all(
        targetedDeploymentTargets.map(async (target) =>
          readJsonResponse(
            await fetcher(createVercelDeploymentsUrl(projectId, projectName, connection.teamId, target, '1'), { headers: getVercelHeaders(connection) }),
            `读取 Vercel ${target} 部署`
          ).catch(() => ({ deployments: [] }))
        )
      )

      for (const targetDeploymentsJson of targetedDeploymentsJson) {
        for (const deploymentItem of asArray(asRecord(targetDeploymentsJson).deployments)) {
          upsertVercelEnvironment(environmentsByName, createVercelEnvironment(asRecord(deploymentItem)))
        }
      }

      const domains = asArray(asRecord(domainsJson).domains)
        .map((domainItem): ProviderServiceDomainSnapshot | null => {
          const domain = stringField(asRecord(domainItem), 'name', 'domain')
          return domain ? { domain, kind: 'custom', enabled: true } : null
        })
        .filter((domain): domain is ProviderServiceDomainSnapshot => Boolean(domain))

      return {
        provider: 'vercel',
        name: projectName,
        externalProjectId: projectId || projectName,
        environments: getOrderedVercelEnvironments(environmentsByName),
        domains
      }
    })
  )
}

export async function listVercelDeployments(
  connection: ServiceProviderConnection,
  projectId: string,
  options: VercelDeploymentListOptions = {},
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelDeploymentSummary[]> {
  const deploymentsUrl = createVercelApiUrl('/v7/deployments', connection.teamId)
  deploymentsUrl.searchParams.set('projectId', projectId)
  deploymentsUrl.searchParams.set('limit', String(options.limit ?? 20))

  if (options.target) {
    deploymentsUrl.searchParams.set('target', options.target)
  }

  const deploymentsJson = await readVercelJson(connection, deploymentsUrl, '读取 Vercel 部署历史', fetcher)

  return asArray(asRecord(deploymentsJson).deployments).map(normalizeVercelDeployment)
}

export async function redeployVercelDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelDeploymentSummary> {
  const deploymentsUrl = createVercelApiUrl('/v13/deployments', connection.teamId)
  const deploymentJson = await readVercelJson(connection, deploymentsUrl, '重新部署 Vercel 部署', fetcher, {
    method: 'POST',
    body: JSON.stringify({ deploymentId })
  })

  return normalizeVercelDeployment(deploymentJson)
}

export async function cancelVercelDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelDeploymentSummary> {
  const cancelUrl = createVercelApiUrl(`/v12/deployments/${encodePathSegment(deploymentId)}/cancel`, connection.teamId)
  const deploymentJson = await readVercelJson(connection, cancelUrl, '取消 Vercel 部署', fetcher, { method: 'PATCH' })

  return normalizeVercelDeployment(deploymentJson)
}

export async function promoteVercelDeployment(
  connection: ServiceProviderConnection,
  projectId: string,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const promoteUrl = createVercelApiUrl(`/v10/projects/${encodePathSegment(projectId)}/promote/${encodePathSegment(deploymentId)}`, connection.teamId)
  await readVercelJson(connection, promoteUrl, '提升 Vercel 部署为生产', fetcher, { method: 'POST' })
}

export async function rollbackVercelDeployment(
  connection: ServiceProviderConnection,
  projectId: string,
  deploymentId: string,
  description = '',
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const rollbackUrl = createVercelApiUrl(`/v1/projects/${encodePathSegment(projectId)}/rollback/${encodePathSegment(deploymentId)}`, connection.teamId)

  if (description.trim()) {
    rollbackUrl.searchParams.set('description', description.trim())
  }

  await readVercelJson(connection, rollbackUrl, '回滚 Vercel 部署', fetcher, { method: 'POST' })
}

export async function listVercelProjectEnvVars(
  connection: ServiceProviderConnection,
  projectId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelEnvVarRecord[]> {
  const envUrl = createVercelApiUrl(`/v10/projects/${encodePathSegment(projectId)}/env`, connection.teamId)
  envUrl.searchParams.set('decrypt', 'false')
  const envJson = await readVercelJson(connection, envUrl, '读取 Vercel 环境变量', fetcher)
  const envs = asArray(asRecord(envJson).envs || asRecord(envJson).env || envJson)

  return envs.map((env) => normalizeVercelEnvVar(env, false))
}

export async function readVercelEnvVar(
  connection: ServiceProviderConnection,
  projectId: string,
  envVarId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelEnvVarRecord> {
  const envUrl = createVercelApiUrl(`/v1/projects/${encodePathSegment(projectId)}/env/${encodePathSegment(envVarId)}`, connection.teamId)
  const envJson = await readVercelJson(connection, envUrl, '读取 Vercel 环境变量值', fetcher)

  return normalizeVercelEnvVar(envJson, true)
}

function createVercelEnvBody(input: VercelEnvVarInput): Record<string, unknown> {
  return cleanJsonBody({
    key: input.key,
    value: input.value,
    type: input.type,
    target: input.target,
    customEnvironmentIds: input.customEnvironmentIds,
    gitBranch: input.gitBranch,
    comment: input.comment
  })
}

export async function saveVercelProjectEnvVar(
  connection: ServiceProviderConnection,
  projectId: string,
  input: VercelEnvVarInput,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelEnvVarRecord> {
  const envUrl = input.id
    ? createVercelApiUrl(`/v9/projects/${encodePathSegment(projectId)}/env/${encodePathSegment(input.id)}`, connection.teamId)
    : createVercelApiUrl(`/v10/projects/${encodePathSegment(projectId)}/env`, connection.teamId)
  const envJson = await readVercelJson(connection, envUrl, input.id ? '更新 Vercel 环境变量' : '创建 Vercel 环境变量', fetcher, {
    method: input.id ? 'PATCH' : 'POST',
    body: JSON.stringify(createVercelEnvBody(input))
  })

  return normalizeVercelEnvVar(envJson, false)
}

export async function removeVercelProjectEnvVar(
  connection: ServiceProviderConnection,
  projectId: string,
  envVarId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const envUrl = createVercelApiUrl(`/v9/projects/${encodePathSegment(projectId)}/env/${encodePathSegment(envVarId)}`, connection.teamId)
  await readVercelJson(connection, envUrl, '删除 Vercel 环境变量', fetcher, { method: 'DELETE' })
}

export async function addVercelProjectDomain(
  connection: ServiceProviderConnection,
  projectId: string,
  input: VercelDomainInput,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const domainsUrl = createVercelApiUrl(`/v10/projects/${encodePathSegment(projectId)}/domains`, connection.teamId)
  await readVercelJson(connection, domainsUrl, '添加 Vercel 项目域名', fetcher, {
    method: 'POST',
    body: JSON.stringify(
      cleanJsonBody({
        name: input.name,
        gitBranch: input.gitBranch,
        customEnvironmentId: input.environmentName,
        redirect: input.redirect,
        redirectStatusCode: input.redirectStatusCode
      })
    )
  })
}

export async function removeVercelProjectDomain(
  connection: ServiceProviderConnection,
  projectId: string,
  domain: string,
  removeRedirects = false,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const domainUrl = createVercelApiUrl(`/v9/projects/${encodePathSegment(projectId)}/domains/${encodePathSegment(domain)}`, connection.teamId)
  await readVercelJson(connection, domainUrl, '删除 Vercel 项目域名', fetcher, {
    method: 'DELETE',
    body: JSON.stringify({ removeRedirects })
  })
}

export async function verifyVercelProjectDomain(
  connection: ServiceProviderConnection,
  projectId: string,
  domain: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  const domainUrl = createVercelApiUrl(`/v9/projects/${encodePathSegment(projectId)}/domains/${encodePathSegment(domain)}/verify`, connection.teamId)
  await readVercelJson(connection, domainUrl, '验证 Vercel 项目域名', fetcher, { method: 'POST' })
}

export async function inspectVercelDomainConfig(
  connection: ServiceProviderConnection,
  projectId: string,
  domain: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<VercelDomainConfig> {
  const configUrl = createVercelApiUrl(`/v6/domains/${encodePathSegment(domain)}/config`, connection.teamId)
  configUrl.searchParams.set('projectIdOrName', projectId)
  const configJson = asRecord(await readVercelJson(connection, configUrl, '检查 Vercel 域名配置', fetcher))
  const misconfigured = Boolean(configJson.misconfigured)

  return {
    configured: Boolean(configJson.configured) || (!misconfigured && Boolean(stringField(configJson, 'configuredBy') || asArray(configJson.acceptedChallenges).length)),
    misconfigured,
    acceptedChallenges: asArray(configJson.acceptedChallenges),
    recommendedRecords: asArray(configJson.recommendedRecords),
    raw: configJson
  }
}

export async function readVercelDeploymentLogs(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderDeploymentLogLine[]> {
  const logsUrl = createVercelApiUrl(`/v3/deployments/${encodePathSegment(deploymentId)}/events`, connection.teamId)
  logsUrl.searchParams.set('limit', '100')
  const logsJson = await readJsonResponse(await fetcher(logsUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 部署日志')
  const events = Array.isArray(logsJson) ? logsJson : asArray(asRecord(logsJson).events)

  return events.map(normalizeVercelLogLine)
}

export async function readVercelRuntimeLogs(
  connection: ServiceProviderConnection,
  projectId: string,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderDeploymentLogLine[]> {
  const logsUrl = createVercelApiUrl(
    `/v1/projects/${encodePathSegment(projectId)}/deployments/${encodePathSegment(deploymentId)}/runtime-logs`,
    connection.teamId
  )
  const logText = await readTextResponse(await fetcher(logsUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 运行日志')

  return parseVercelLogText(logText).map(normalizeVercelLogLine)
}

function getRailwayHeaders(connection: ServiceProviderConnection): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (connection.railwayTokenType === 'project') {
    headers['Project-Access-Token'] = connection.token
  } else {
    headers.Authorization = `Bearer ${connection.token}`
  }

  return headers
}

function getRailwayTokenType(connection: ServiceProviderConnection): RailwayTokenType {
  return connection.railwayTokenType ?? 'workspace'
}

const railwayDeploymentSelection = `
  id
  canRedeploy
  canRollback
  deploymentStopped
  environmentId
  projectId
  serviceId
  status
  url
  staticUrl
  createdAt
  updatedAt
  statusUpdatedAt
  meta
`

async function readRailwayGraphql(
  connection: ServiceProviderConnection,
  context: string,
  query: string,
  variables: Record<string, unknown>,
  fetcher: ServiceProviderFetch
): Promise<Record<string, unknown>> {
  const json = asRecord(
    await readJsonResponse(
      await fetcher(railwayGraphqlEndpoint, {
        method: 'POST',
        headers: getRailwayHeaders(connection),
        body: JSON.stringify({ query, variables })
      }),
      context
    )
  )
  const errors = asArray(json.errors).map((error) => stringField(asRecord(error), 'message')).filter(Boolean)

  if (errors.length > 0) {
    throw new Error(`${context}失败：${errors.join('; ')}`)
  }

  return asRecord(json.data)
}

function getRailwayPageInfo(connection: unknown): { hasNextPage: boolean; endCursor: string } {
  const pageInfo = asRecord(asRecord(connection).pageInfo)

  return {
    hasNextPage: Boolean(pageInfo.hasNextPage),
    endCursor: stringField(pageInfo, 'endCursor')
  }
}

function getRailwayProjectServices(project: Record<string, unknown>): Record<string, unknown>[] {
  return asArray(project.services).map(asRecord).filter((service) => stringField(service, 'id', 'name'))
}

function getRailwayProjectEnvironments(project: Record<string, unknown>, requiredEnvironmentId = ''): Record<string, unknown>[] {
  const environments = asArray(project.environments)
    .map(asRecord)
    .filter((environment) => stringField(environment, 'id', 'name'))
  const scoped = requiredEnvironmentId ? environments.filter((environment) => stringField(environment, 'id') === requiredEnvironmentId) : environments

  if (scoped.length === 0 && requiredEnvironmentId) {
    return [{ id: requiredEnvironmentId, name: 'production' }]
  }

  return scoped
}

function normalizeRailwayDeployment(item: unknown, environmentName = ''): ServiceDeploymentSummary {
  const deployment = asRecord(item)
  const meta = asRecord(deployment.meta)
  const creator = asRecord(deployment.creator)
  const environmentId = stringField(deployment, 'environmentId')
  const projectId = stringField(deployment, 'projectId')
  const serviceId = stringField(deployment, 'serviceId')

  return {
    id: stringField(deployment, 'id'),
    url: stringField(deployment, 'url', 'staticUrl'),
    target: environmentName || stringField(deployment, 'environmentName') || environmentId,
    state: stringField(deployment, 'status', 'state'),
    createdAt: timestampField(deployment, 'createdAt', 'created'),
    readyAt: timestampField(deployment, 'statusUpdatedAt', 'updatedAt', 'finishedAt'),
    creator: stringField(creator, 'name', 'username', 'email', 'id'),
    meta,
    commitSha: stringField(meta, 'commitSha', 'githubCommitSha') || stringField(deployment, 'commitSha', 'commit'),
    environmentId,
    projectId,
    serviceId,
    canRedeploy: booleanField(deployment, 'canRedeploy'),
    canRollback: booleanField(deployment, 'canRollback'),
    deploymentStopped: booleanField(deployment, 'deploymentStopped')
  }
}

function normalizeRailwayLogLine(item: unknown, source: string): ProviderDeploymentLogLine {
  if (typeof item === 'string') {
    return { timestamp: '', level: 'log', message: item, source }
  }

  const log = asRecord(item)

  return {
    timestamp: timestampField(log, 'timestamp', 'createdAt'),
    level: stringField(log, 'severity', 'level') || 'log',
    message: stringField(log, 'message', 'text'),
    source
  }
}

function normalizeRailwayDomain(item: unknown, kind: ProviderServiceDomainSnapshot['kind'], environment: ProviderServiceEnvironmentSnapshot): ProviderServiceDomainSnapshot | null {
  const domainRecord = asRecord(item)
  const domain = stringField(domainRecord, 'domain', 'hostname', 'url')

  return domain
    ? {
        domain,
        environmentName: environment.name,
        kind,
        enabled: true
      }
    : null
}

async function listRailwayProjectsPage(
  connection: ServiceProviderConnection,
  fetcher: ServiceProviderFetch,
  workspaceId = ''
): Promise<Record<string, unknown>[]> {
  const projects: Record<string, unknown>[] = []
  let after = ''

  do {
    const data = await readRailwayGraphql(
      connection,
      '读取 Railway 项目',
      `
        query ForgeDeskRailwayProjects($first: Int!, $after: String, $workspaceId: String) {
          projects(first: $first, after: $after, workspaceId: $workspaceId) {
            edges {
              node {
                id
                name
                services { edges { node { id name } } }
                environments { edges { node { id name } } }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      cleanJsonBody({ first: 50, after, workspaceId }),
      fetcher
    )
    const projectsConnection = asRecord(data.projects)

    projects.push(...asArray(projectsConnection).map(asRecord).filter((project) => stringField(project, 'id', 'name')))

    const pageInfo = getRailwayPageInfo(projectsConnection)
    after = pageInfo.hasNextPage ? pageInfo.endCursor : ''
  } while (after)

  return projects
}

async function listRailwayProjectTokenProject(connection: ServiceProviderConnection, fetcher: ServiceProviderFetch): Promise<Record<string, unknown>[]> {
  const data = await readRailwayGraphql(
    connection,
    '读取 Railway Project Token',
    `
      query ForgeDeskRailwayProjectTokenSync {
        projectToken {
          environmentId
          projectId
          project {
            id
            name
            services { edges { node { id name } } }
            environments { edges { node { id name } } }
          }
        }
      }
    `,
    {},
    fetcher
  )
  const projectToken = asRecord(data.projectToken)
  const project = asRecord(projectToken.project)
  const environmentId = stringField(projectToken, 'environmentId')

  if (environmentId) {
    project.environments = {
      edges: getRailwayProjectEnvironments(project, environmentId).map((environment) => ({ node: environment }))
    }
  }

  return stringField(project, 'id', 'name') ? [project] : []
}

async function listRailwayAccessibleWorkspaceIds(connection: ServiceProviderConnection, fetcher: ServiceProviderFetch): Promise<string[]> {
  const data = await readRailwayGraphql(
    connection,
    '发现 Railway Workspace',
    `
      query ForgeDeskRailwayTokenWorkspaces {
        apiToken {
          workspaces {
            id
            name
          }
        }
      }
    `,
    {},
    fetcher
  )
  const workspaceIds = asArray(asRecord(data.apiToken).workspaces)
    .map((workspace) => stringField(asRecord(workspace), 'id'))
    .filter(Boolean)

  return Array.from(new Set(workspaceIds))
}

function appendRailwayProjects(projectsById: Map<string, Record<string, unknown>>, projects: Record<string, unknown>[]): void {
  for (const project of projects) {
    const key = stringField(project, 'id') || stringField(project, 'name')

    if (key) {
      projectsById.set(key, project)
    }
  }
}

async function listRailwayAccountProjects(connection: ServiceProviderConnection, fetcher: ServiceProviderFetch): Promise<Record<string, unknown>[]> {
  const projectsById = new Map<string, Record<string, unknown>>()

  appendRailwayProjects(projectsById, await listRailwayProjectsPage(connection, fetcher))

  try {
    const workspaceIds = await listRailwayAccessibleWorkspaceIds(connection, fetcher)

    for (const workspaceId of workspaceIds) {
      appendRailwayProjects(projectsById, await listRailwayProjectsPage(connection, fetcher, workspaceId))
    }
  } catch {
    // Some Railway tokens cannot introspect workspace membership. The empty sync
    // diagnostic below points users to an explicit Workspace ID when discovery fails.
  }

  return Array.from(projectsById.values())
}

async function listRailwayProjects(connection: ServiceProviderConnection, fetcher: ServiceProviderFetch): Promise<Record<string, unknown>[]> {
  const tokenType = getRailwayTokenType(connection)

  if (tokenType === 'project') {
    return listRailwayProjectTokenProject(connection, fetcher)
  }

  const workspaceId = connection.workspaceId?.trim()

  if (tokenType === 'workspace' && !workspaceId) {
    throw new Error('Railway Workspace Token 需要填写 Workspace ID')
  }

  if (workspaceId) {
    return listRailwayProjectsPage(connection, fetcher, workspaceId)
  }

  if (tokenType === 'account') {
    return listRailwayAccountProjects(connection, fetcher)
  }

  return listRailwayProjectsPage(connection, fetcher)
}

function getRailwayEmptySyncMessage(connection: ServiceProviderConnection): string {
  const tokenType = getRailwayTokenType(connection)
  const workspaceId = connection.workspaceId?.trim()

  if (tokenType === 'account' && !workspaceId) {
    return 'Railway 未同步到任何服务。Account Token 未填写 Workspace ID 时会同步个人项目并尝试发现可访问的 Workspace；如果项目在 Workspace 中，请填写 Workspace ID，并确认 Token 具备该 Workspace 权限。'
  }

  if (tokenType === 'workspace') {
    return 'Railway 未同步到任何服务，请检查 Workspace ID 是否正确，以及 Token 是否具备该 Workspace 权限。'
  }

  if (tokenType === 'project') {
    return 'Railway 未同步到任何服务，请检查 Project Token 绑定的项目、服务和环境范围。'
  }

  return 'Railway 未同步到任何服务，请检查 Token 类型、Workspace ID，或 Project Token 绑定的环境范围。'
}

export async function listRailwayDeployments(
  connection: ServiceProviderConnection,
  projectId: string,
  serviceId: string,
  environmentId = '',
  options: ServiceDeploymentListOptions = {},
  fetcher: ServiceProviderFetch = fetch,
  environmentName = ''
): Promise<ServiceDeploymentSummary[]> {
  const deployments: ServiceDeploymentSummary[] = []
  let after = ''
  const limit = Math.max(1, Math.min(options.limit ?? 20, 50))

  do {
    const data = await readRailwayGraphql(
      connection,
      '读取 Railway 部署',
      `
        query ForgeDeskRailwayDeployments($first: Int!, $after: String, $input: DeploymentListInput!) {
          deployments(first: $first, after: $after, input: $input) {
            edges {
              node {
                ${railwayDeploymentSelection}
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      cleanJsonBody({
        first: Math.min(limit - deployments.length, 50),
        after,
        input: cleanJsonBody({ projectId, serviceId, environmentId })
      }),
      fetcher
    )
    const deploymentsConnection = asRecord(data.deployments)

    deployments.push(...asArray(deploymentsConnection).map((deployment) => normalizeRailwayDeployment(deployment, environmentName)))

    const pageInfo = getRailwayPageInfo(deploymentsConnection)
    after = pageInfo.hasNextPage && deployments.length < limit ? pageInfo.endCursor : ''
  } while (after && deployments.length < limit)

  return deployments
}

export async function readRailwayDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceDeploymentSummary> {
  const data = await readRailwayGraphql(
    connection,
    '读取 Railway 部署',
    `
      query ForgeDeskRailwayDeployment($id: String!) {
        deployment(id: $id) {
          ${railwayDeploymentSelection}
        }
      }
    `,
    { id: deploymentId },
    fetcher
  )

  return normalizeRailwayDeployment(data.deployment)
}

export async function deployRailwayServiceInstance(
  connection: ServiceProviderConnection,
  serviceId: string,
  environmentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<string> {
  const data = await readRailwayGraphql(
    connection,
    '部署 Railway 服务',
    `
      mutation ForgeDeskRailwayServiceInstanceDeploy($environmentId: String!, $serviceId: String!) {
        serviceInstanceDeployV2(environmentId: $environmentId, serviceId: $serviceId)
      }
    `,
    { environmentId, serviceId },
    fetcher
  )

  return stringField(data, 'serviceInstanceDeployV2')
}

export async function redeployRailwayDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceDeploymentSummary> {
  const data = await readRailwayGraphql(
    connection,
    '重新部署 Railway 部署',
    `
      mutation ForgeDeskRailwayDeploymentRedeploy($id: String!, $usePreviousImageTag: Boolean) {
        deploymentRedeploy(id: $id, usePreviousImageTag: $usePreviousImageTag) {
          ${railwayDeploymentSelection}
        }
      }
    `,
    { id: deploymentId },
    fetcher
  )

  return normalizeRailwayDeployment(data.deploymentRedeploy)
}

export async function restartRailwayDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  await readRailwayGraphql(
    connection,
    '重启 Railway 部署',
    `
      mutation ForgeDeskRailwayDeploymentRestart($id: String!) {
        deploymentRestart(id: $id)
      }
    `,
    { id: deploymentId },
    fetcher
  )
}

export async function rollbackRailwayDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  await readRailwayGraphql(
    connection,
    '回滚 Railway 部署',
    `
      mutation ForgeDeskRailwayDeploymentRollback($id: String!) {
        deploymentRollback(id: $id)
      }
    `,
    { id: deploymentId },
    fetcher
  )
}

export async function stopRailwayDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  await readRailwayGraphql(
    connection,
    '停止 Railway 部署',
    `
      mutation ForgeDeskRailwayDeploymentStop($id: String!) {
        deploymentStop(id: $id)
      }
    `,
    { id: deploymentId },
    fetcher
  )
}

export async function cancelRailwayDeployment(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<void> {
  await readRailwayGraphql(
    connection,
    '取消 Railway 部署',
    `
      mutation ForgeDeskRailwayDeploymentCancel($id: String!) {
        deploymentCancel(id: $id)
      }
    `,
    { id: deploymentId },
    fetcher
  )
}

async function listRailwayServiceDomains(
  connection: ServiceProviderConnection,
  projectId: string,
  serviceId: string,
  environments: ProviderServiceEnvironmentSnapshot[],
  fetcher: ServiceProviderFetch
): Promise<ProviderServiceDomainSnapshot[]> {
  const domains: ProviderServiceDomainSnapshot[] = []
  const seen = new Set<string>()

  for (const environment of environments) {
    if (!environment.externalEnvironmentId) {
      continue
    }

    const data = await readRailwayGraphql(
      connection,
      '读取 Railway 域名',
      `
        query ForgeDeskRailwayDomains($environmentId: String!, $projectId: String!, $serviceId: String!) {
          domains(environmentId: $environmentId, projectId: $projectId, serviceId: $serviceId) {
            customDomains { id domain environmentId serviceId }
            serviceDomains { id domain environmentId serviceId }
          }
        }
      `,
      { environmentId: environment.externalEnvironmentId, projectId, serviceId },
      fetcher
    )
    const domainData = asRecord(data.domains)
    const nextDomains = [
      ...asArray(domainData.customDomains).map((domain) => normalizeRailwayDomain(domain, 'custom', environment)),
      ...asArray(domainData.serviceDomains).map((domain) => normalizeRailwayDomain(domain, 'generated', environment))
    ].filter((domain): domain is ProviderServiceDomainSnapshot => Boolean(domain))

    for (const domain of nextDomains) {
      const key = `${domain.kind}:${domain.environmentName}:${domain.domain}`

      if (!seen.has(key)) {
        seen.add(key)
        domains.push(domain)
      }
    }

    if (nextDomains.length === 0 && environment.latestDeploymentUrl) {
      const key = `generated:${environment.name}:${environment.latestDeploymentUrl}`

      if (!seen.has(key)) {
        seen.add(key)
        domains.push({
          domain: environment.latestDeploymentUrl,
          environmentName: environment.name,
          kind: 'generated',
          enabled: true
        })
      }
    }
  }

  return domains
}

export async function listRailwayProjectEnvVars(
  connection: ServiceProviderConnection,
  projectId: string,
  serviceId: string,
  environments: Array<Pick<ProviderServiceEnvironmentSnapshot, 'name' | 'externalEnvironmentId'>>,
  fetcher: ServiceProviderFetch = fetch
): Promise<ServiceEnvVarRecord[]> {
  const records: ServiceEnvVarRecord[] = []

  for (const environment of environments) {
    if (!environment.externalEnvironmentId) {
      continue
    }

    const data = await readRailwayGraphql(
      connection,
      '读取 Railway 环境变量',
      `
        query ForgeDeskRailwayVariables($environmentId: String!, $projectId: String!, $serviceId: String, $unrendered: Boolean) {
          variables(environmentId: $environmentId, projectId: $projectId, serviceId: $serviceId, unrendered: $unrendered)
        }
      `,
      { environmentId: environment.externalEnvironmentId, projectId, serviceId, unrendered: true },
      fetcher
    )
    const variables = asRecord(data.variables)

    for (const key of Object.keys(variables)) {
      if (!key.trim()) {
        continue
      }

      const variableValue = variables[key]

      records.push({
        id: `${environment.externalEnvironmentId}:${key}`,
        key,
        type: 'railway',
        target: [environment.name || environment.externalEnvironmentId],
        gitBranch: '',
        customEnvironmentIds: [],
        comment: '',
        createdAt: '',
        updatedAt: '',
        decrypted: false,
        value: variableValue === undefined || variableValue === null ? '' : String(variableValue)
      })
    }
  }

  return records
}

export async function readRailwayDeploymentLogs(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderDeploymentLogLine[]> {
  const data = await readRailwayGraphql(
    connection,
    '读取 Railway 部署日志',
    `
      query ForgeDeskRailwayDeploymentLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          timestamp
          severity
          message
        }
      }
    `,
    { deploymentId, limit: 100 },
    fetcher
  )

  return asArray(data.deploymentLogs).map((log) => normalizeRailwayLogLine(log, 'deployment'))
}

export async function readRailwayEnvironmentLogs(
  connection: ServiceProviderConnection,
  environmentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderDeploymentLogLine[]> {
  const data = await readRailwayGraphql(
    connection,
    '读取 Railway 运行日志',
    `
      query ForgeDeskRailwayEnvironmentLogs($environmentId: String!, $beforeLimit: Int) {
        environmentLogs(environmentId: $environmentId, beforeLimit: $beforeLimit) {
          timestamp
          severity
          message
        }
      }
    `,
    { environmentId, beforeLimit: 100 },
    fetcher
  )

  return asArray(data.environmentLogs).map((log) => normalizeRailwayLogLine(log, 'environment'))
}

export async function syncRailwayProviderServices(
  connection: ServiceProviderConnection,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderServiceSnapshot[]> {
  const projects = await listRailwayProjects(connection, fetcher)
  const services: ProviderServiceSnapshot[] = []

  for (const project of projects) {
    const projectId = stringField(project, 'id')
    const projectServices = getRailwayProjectServices(project)
    const projectEnvironments = getRailwayProjectEnvironments(project)

    for (const service of projectServices) {
      const serviceId = stringField(service, 'id')
      const serviceName = stringField(service, 'name', 'id')
      const environments: ProviderServiceEnvironmentSnapshot[] = []

      for (const environment of projectEnvironments) {
        const environmentId = stringField(environment, 'id')
        const environmentName = stringField(environment, 'name') || 'production'
        const [latestDeployment] = environmentId
          ? await listRailwayDeployments(connection, projectId, serviceId, environmentId, { limit: 1 }, fetcher, environmentName)
          : []

        environments.push({
          name: environmentName,
          externalEnvironmentId: environmentId,
          deploymentStatus: latestDeployment?.state ?? '',
          latestDeploymentId: latestDeployment?.id ?? '',
          latestDeploymentUrl: latestDeployment?.url ?? '',
          latestCommit: latestDeployment?.commitSha ?? ''
        })
      }

      services.push({
        provider: 'railway',
        name: serviceName,
        externalProjectId: projectId,
        externalProjectName: stringField(project, 'name'),
        externalServiceId: serviceId || serviceName,
        environments,
        domains: await listRailwayServiceDomains(connection, projectId, serviceId, environments, fetcher)
      })
    }
  }

  if (services.length === 0) {
    throw new Error(getRailwayEmptySyncMessage(connection))
  }

  return services
}
