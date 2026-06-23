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

export async function readVercelDeploymentLogs(
  connection: ServiceProviderConnection,
  deploymentId: string,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderDeploymentLogLine[]> {
  const logsUrl = appendVercelTeamId(new URL(`https://api.vercel.com/v2/deployments/${encodeURIComponent(deploymentId)}/events`), connection.teamId)
  logsUrl.searchParams.set('limit', '100')
  const logsJson = await readJsonResponse(await fetcher(logsUrl, { headers: getVercelHeaders(connection) }), '读取 Vercel 部署日志')
  const events = Array.isArray(logsJson) ? logsJson : asArray(asRecord(logsJson).events)

  return events.map((eventItem): ProviderDeploymentLogLine => {
    const event = asRecord(eventItem)
    const payload = asRecord(event.payload)
    const timestamp = timestampField(event, 'createdAt', 'date', 'timestamp') || timestampField(payload, 'createdAt', 'date', 'timestamp')
    const message = stringField(event, 'text', 'message') || stringField(payload, 'text', 'message')

    return {
      timestamp,
      level: stringField(event, 'type', 'level') || stringField(payload, 'type', 'level'),
      message,
      source: stringField(event, 'source') || stringField(payload, 'source')
    }
  })
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

function getRailwayProjects(data: Record<string, unknown>): Record<string, unknown>[] {
  const candidates = [
    asRecord(asRecord(data.projectToken).project),
    asRecord(data.project),
    ...asArray(data.projects).map(asRecord),
    ...asArray(asRecord(data.viewer).projects).map(asRecord),
    ...asArray(asRecord(data.workspace).projects).map(asRecord)
  ]

  return candidates.filter((project) => stringField(project, 'id', 'name'))
}

function createRailwayEnvironment(environment: Record<string, unknown>): ProviderServiceEnvironmentSnapshot {
  const deployment = asRecord(asArray(environment.deployments)[0])

  return {
    name: stringField(environment, 'name') || 'production',
    externalEnvironmentId: stringField(environment, 'id'),
    deploymentStatus: stringField(deployment, 'status', 'state'),
    latestDeploymentId: stringField(deployment, 'id'),
    latestDeploymentUrl: stringField(deployment, 'url'),
    latestCommit: stringField(deployment, 'commit')
  }
}

function getRailwayServiceDomains(service: Record<string, unknown>, environments: ProviderServiceEnvironmentSnapshot[]): ProviderServiceDomainSnapshot[] {
  const domains = asArray(service.domains)
    .map((domainItem): ProviderServiceDomainSnapshot | null => {
      const domainRecord = asRecord(domainItem)
      const domain = stringField(domainRecord, 'domain', 'hostname', 'url')
      const environmentId = stringField(domainRecord, 'environmentId')
      const environment = environments.find((item) => item.externalEnvironmentId === environmentId)

      return domain
        ? {
            domain,
            environmentName: environment?.name,
            kind: stringField(domainRecord, 'kind') === 'custom' ? 'custom' : 'generated',
            enabled: true
          }
        : null
    })
    .filter((domain): domain is ProviderServiceDomainSnapshot => Boolean(domain))

  if (domains.length === 0) {
    for (const environment of environments) {
      if (environment.latestDeploymentUrl) {
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

export async function syncRailwayProviderServices(
  connection: ServiceProviderConnection,
  fetcher: ServiceProviderFetch = fetch
): Promise<ProviderServiceSnapshot[]> {
  const query = `
    query ForgeDeskServiceSync {
      projectToken {
        project {
          id
          name
          services { edges { node { id name } } }
          environments { edges { node { id name deployments { edges { node { id status url } } } } } }
        }
      }
      projects { edges { node { id name services { edges { node { id name } } } environments { edges { node { id name deployments { edges { node { id status url } } } } } } } } }
    }
  `
  const response = await fetcher(railwayGraphqlEndpoint, {
    method: 'POST',
    headers: getRailwayHeaders(connection),
    body: JSON.stringify({ query })
  })
  const json = asRecord(await readJsonResponse(response, '读取 Railway 服务'))
  const data = asRecord(json.data)
  const projects = getRailwayProjects(data)
  const services: ProviderServiceSnapshot[] = []

  for (const project of projects) {
    const environments = asArray(project.environments).map((environment) => createRailwayEnvironment(asRecord(environment)))
    const projectServices = asArray(project.services).map(asRecord)

    for (const service of projectServices) {
      const serviceName = stringField(service, 'name', 'id')

      services.push({
        provider: 'railway',
        name: serviceName,
        externalProjectId: stringField(project, 'id'),
        externalServiceId: stringField(service, 'id') || serviceName,
        environments,
        domains: getRailwayServiceDomains(service, environments)
      })
    }
  }

  return services
}
