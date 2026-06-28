import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addVercelProjectDomain,
  cancelVercelDeployment,
  inspectVercelDomainConfig,
  listRailwayDeployments,
  listRailwayProjectEnvVars,
  listVercelDeployments,
  listVercelProjectEnvVars,
  promoteVercelDeployment,
  readRailwayDeploymentLogs,
  readRailwayEnvironmentLogs,
  readVercelEnvVar,
  readVercelRuntimeLogs,
  redeployVercelDeployment,
  removeVercelProjectEnvVar,
  removeVercelProjectDomain,
  rollbackVercelDeployment,
  saveVercelProjectEnvVar,
  syncRailwayProviderServices,
  syncVercelProviderServices,
  type ServiceProviderFetch,
  verifyVercelProjectDomain
} from './service-provider-adapters.js'

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Failed',
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response
}

function createTextResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Failed',
    json: async () => JSON.parse(body),
    text: async () => body
  } as Response
}

function parseGraphqlBody(init?: RequestInit): { query: string; variables: Record<string, unknown> } {
  const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string; variables?: Record<string, unknown> }

  return {
    query: body.query ?? '',
    variables: body.variables ?? {}
  }
}

describe('service provider adapters', () => {
  it('reads Vercel projects, deployments and custom domains using bearer auth and team scope', async () => {
    const requests: Array<{ url: string; authorization: string }> = []
    const fetcher: ServiceProviderFetch = async (url, init) => {
      requests.push({
        url: String(url),
        authorization: String((init?.headers as Record<string, string>).Authorization)
      })

      if (String(url).includes('/v9/projects') && !String(url).includes('/domains')) {
        return createJsonResponse({ projects: [{ id: 'prj_1', name: 'web' }] })
      }

      if (String(url).includes('/domains')) {
        return createJsonResponse({ domains: [{ name: 'app.example.com' }] })
      }

      return createJsonResponse({
        deployments: [
          {
            uid: 'dep_1',
            name: 'web',
            target: 'production',
            state: 'READY',
            url: 'web.vercel.app',
            meta: { githubCommitSha: 'abc123' },
            createdAt: 1782172800000
          }
        ]
      })
    }

    const services = await syncVercelProviderServices(
      {
        token: 'vercel-token',
        teamId: 'team_123'
      },
      fetcher
    )

    assert.equal(services[0].name, 'web')
    assert.equal(services[0].externalProjectId, 'prj_1')
    assert.equal(services[0].environments[0].name, 'production')
    assert.equal(services[0].environments[0].deploymentStatus, 'READY')
    assert.deepEqual(services[0].environments.map((environment) => environment.name), ['production', 'preview'])
    assert.deepEqual(services[0].domains.map((domain) => domain.domain).sort(), ['app.example.com'])
    assert.equal(requests.every((request) => request.authorization === 'Bearer vercel-token'), true)
    assert.equal(requests.every((request) => request.url.includes('teamId=team_123')), true)
  })

  it('does not expose generated Vercel deployment domains as monitorable domains', async () => {
    const fetcher: ServiceProviderFetch = async (url) => {
      if (String(url).includes('/v9/projects') && !String(url).includes('/domains')) {
        return createJsonResponse({ projects: [{ id: 'prj_1', name: 'web' }] })
      }

      if (String(url).includes('/domains')) {
        return createJsonResponse({ domains: [] })
      }

      return createJsonResponse({
        deployments: [
          { uid: 'dep_2', target: 'production', state: 'READY', url: 'latest.vercel.app' },
          { uid: 'dep_1', target: 'production', state: 'READY', url: 'old.vercel.app' }
        ]
      })
    }

    const services = await syncVercelProviderServices({ token: 'vercel-token' }, fetcher)

    assert.deepEqual(services[0].domains.map((domain) => domain.domain), [])
    assert.deepEqual(services[0].environments.map((environment) => environment.name), ['production', 'preview'])
  })

  it('reads latest Vercel deployments for preview and custom environments by target', async () => {
    const requests: string[] = []
    const fetcher: ServiceProviderFetch = async (url) => {
      const requestUrl = String(url)
      requests.push(requestUrl)

      if (requestUrl.includes('/v9/projects') && !requestUrl.includes('/domains') && !requestUrl.includes('/custom-environments')) {
        return createJsonResponse({ projects: [{ id: 'prj_1', name: 'web' }] })
      }

      if (requestUrl.includes('/domains')) {
        return createJsonResponse({ domains: [] })
      }

      if (requestUrl.includes('/custom-environments')) {
        return createJsonResponse({ environments: [{ id: 'env_develop', slug: 'develop' }] })
      }

      if (requestUrl.includes('target=preview')) {
        return createJsonResponse({
          deployments: [{ uid: 'dep_preview', target: 'preview', state: 'READY', url: 'preview-web.vercel.app', meta: { githubCommitSha: 'preview-sha' } }]
        })
      }

      if (requestUrl.includes('target=develop')) {
        return createJsonResponse({
          deployments: [
            {
              uid: 'dep_develop',
              target: 'preview',
              customEnvironment: { id: 'env_develop', slug: 'develop' },
              state: 'READY',
              url: 'develop-web.vercel.app',
              meta: { githubCommitSha: 'develop-sha' }
            }
          ]
        })
      }

      return createJsonResponse({
        deployments: [{ uid: 'dep_production', target: 'production', state: 'READY', url: 'web.vercel.app', meta: { githubCommitSha: 'production-sha' } }]
      })
    }

    const [service] = await syncVercelProviderServices({ token: 'vercel-token' }, fetcher)

    const environments = new Map(service.environments.map((environment) => [environment.name, environment]))
    assert.equal(environments.get('production')?.latestDeploymentId, 'dep_production')
    assert.equal(environments.get('preview')?.latestDeploymentId, 'dep_preview')
    assert.equal(environments.get('develop')?.latestDeploymentId, 'dep_develop')
    assert.equal(environments.get('develop')?.latestCommit, 'develop-sha')
    assert.equal(requests.some((request) => request.includes('target=preview')), true)
    assert.equal(requests.some((request) => request.includes('target=develop')), true)
  })

  it('runs Vercel deployment actions with bearer auth and team scope', async () => {
    const requests: Array<{ url: string; method: string; body: string; authorization: string }> = []
    const fetcher: ServiceProviderFetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: String(init?.method ?? 'GET'),
        body: String(init?.body ?? ''),
        authorization: String((init?.headers as Record<string, string>).Authorization)
      })

      return createJsonResponse({ id: 'dep_new', uid: 'dep_new', state: 'BUILDING', url: 'web.vercel.app' })
    }

    const connection = { token: 'vercel-token', teamId: 'team_123' }

    await redeployVercelDeployment(connection, 'dep_old', fetcher)
    await cancelVercelDeployment(connection, 'dep_old', fetcher)
    await promoteVercelDeployment(connection, 'prj_1', 'dep_old', fetcher)
    await rollbackVercelDeployment(connection, 'prj_1', 'dep_old', 'rollback to stable', fetcher)

    assert.deepEqual(
      requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
      [
        'POST /v13/deployments',
        'PATCH /v12/deployments/dep_old/cancel',
        'POST /v10/projects/prj_1/promote/dep_old',
        'POST /v1/projects/prj_1/rollback/dep_old'
      ]
    )
    assert.equal(JSON.parse(requests[0].body).deploymentId, 'dep_old')
    assert.equal(new URL(requests[3].url).searchParams.get('description'), 'rollback to stable')
    assert.equal(requests.every((request) => request.authorization === 'Bearer vercel-token'), true)
    assert.equal(requests.every((request) => request.url.includes('teamId=team_123')), true)
  })

  it('lists and normalizes Vercel deployment history', async () => {
    const fetcher: ServiceProviderFetch = async (url, init) => {
      assert.equal(String((init?.headers as Record<string, string>).Authorization), 'Bearer vercel-token')
      assert.equal(new URL(String(url)).searchParams.get('projectId'), 'prj_1')
      assert.equal(new URL(String(url)).searchParams.get('target'), 'production')

      return createJsonResponse({
        deployments: [
          {
            uid: 'dep_1',
            url: 'web.vercel.app',
            target: 'production',
            state: 'READY',
            createdAt: 1782172800000,
            ready: 1782172900000,
            creator: { username: 'stone' },
            meta: { githubCommitSha: 'abc123' }
          }
        ]
      })
    }

    const deployments = await listVercelDeployments({ token: 'vercel-token' }, 'prj_1', { target: 'production', limit: 5 }, fetcher)

    assert.deepEqual(deployments, [
      {
        id: 'dep_1',
        url: 'web.vercel.app',
        target: 'production',
        state: 'READY',
        createdAt: '2026-06-23T00:00:00.000Z',
        readyAt: '2026-06-23T00:01:40.000Z',
        creator: 'stone',
        meta: { githubCommitSha: 'abc123' },
        commitSha: 'abc123'
      }
    ])
  })

  it('manages Vercel project environment variables without decrypting list values', async () => {
    const requests: Array<{ url: string; method: string; body: string }> = []
    const fetcher: ServiceProviderFetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: String(init?.method ?? 'GET'),
        body: String(init?.body ?? '')
      })

      const requestUrl = String(url)

      if (requestUrl.includes('/env/env_1')) {
        return createJsonResponse({
          id: 'env_1',
          key: 'API_TOKEN',
          value: 'secret-value',
          type: 'sensitive',
          target: ['production'],
          decrypted: true,
          updatedAt: 1782172800000
        })
      }

      if (init?.method === 'POST' || init?.method === 'PATCH') {
        return createJsonResponse({ id: 'env_2', key: 'API_URL', type: 'plain', target: ['preview'], updatedAt: 1782172800000 })
      }

      if (init?.method === 'DELETE') {
        return createJsonResponse({ ok: true })
      }

      return createJsonResponse({
        envs: [
          {
            id: 'env_1',
            key: 'API_TOKEN',
            value: 'encrypted-value',
            type: 'sensitive',
            target: ['production'],
            gitBranch: '',
            comment: 'server token',
            updatedAt: 1782172800000
          }
        ]
      })
    }

    const envVars = await listVercelProjectEnvVars({ token: 'vercel-token' }, 'prj_1', fetcher)
    const revealed = await readVercelEnvVar({ token: 'vercel-token' }, 'prj_1', 'env_1', fetcher)
    await saveVercelProjectEnvVar(
      { token: 'vercel-token' },
      'prj_1',
      { id: 'env_1', key: 'API_URL', value: 'https://api.example.com', type: 'plain', target: ['preview'], comment: 'preview api' },
      fetcher
    )
    await saveVercelProjectEnvVar(
      { token: 'vercel-token' },
      'prj_1',
      { key: 'API_URL', value: 'https://api.example.com', type: 'plain', target: ['preview'] },
      fetcher
    )
    await removeVercelProjectEnvVar({ token: 'vercel-token' }, 'prj_1', 'env_1', fetcher)

    assert.equal(envVars[0].value, undefined)
    assert.equal(envVars[0].decrypted, false)
    assert.equal(revealed.value, 'secret-value')
    assert.deepEqual(
      requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
      [
        'GET /v10/projects/prj_1/env',
        'GET /v1/projects/prj_1/env/env_1',
        'PATCH /v9/projects/prj_1/env/env_1',
        'POST /v10/projects/prj_1/env',
        'DELETE /v9/projects/prj_1/env/env_1'
      ]
    )
    assert.equal(new URL(requests[0].url).searchParams.get('decrypt'), 'false')
    assert.equal(JSON.parse(requests[2].body).comment, 'preview api')
  })

  it('manages and inspects Vercel project domains', async () => {
    const requests: Array<{ url: string; method: string; body: string }> = []
    const fetcher: ServiceProviderFetch = async (url, init) => {
      requests.push({
        url: String(url),
        method: String(init?.method ?? 'GET'),
        body: String(init?.body ?? '')
      })

      if (String(url).includes('/config')) {
        return createJsonResponse({
          configuredBy: 'CNAME',
          misconfigured: false,
          acceptedChallenges: [{ type: 'dns-01', domain: 'app.example.com' }],
          recommendedRecords: [{ type: 'CNAME', name: 'app', value: 'cname.vercel-dns.com' }]
        })
      }

      return createJsonResponse({ name: 'app.example.com', verified: true })
    }

    await addVercelProjectDomain(
      { token: 'vercel-token', teamId: 'team_123' },
      'prj_1',
      { name: 'app.example.com', gitBranch: 'main', redirect: 'example.com', redirectStatusCode: 308 },
      fetcher
    )
    await verifyVercelProjectDomain({ token: 'vercel-token', teamId: 'team_123' }, 'prj_1', 'app.example.com', fetcher)
    await removeVercelProjectDomain({ token: 'vercel-token', teamId: 'team_123' }, 'prj_1', 'app.example.com', false, fetcher)
    const config = await inspectVercelDomainConfig({ token: 'vercel-token', teamId: 'team_123' }, 'prj_1', 'app.example.com', fetcher)

    assert.deepEqual(
      requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
      [
        'POST /v10/projects/prj_1/domains',
        'POST /v9/projects/prj_1/domains/app.example.com/verify',
        'DELETE /v9/projects/prj_1/domains/app.example.com',
        'GET /v6/domains/app.example.com/config'
      ]
    )
    assert.equal(JSON.parse(requests[0].body).redirectStatusCode, 308)
    assert.equal(JSON.parse(requests[2].body).removeRedirects, false)
    assert.equal(new URL(requests[3].url).searchParams.get('projectIdOrName'), 'prj_1')
    assert.equal(config.configured, true)
    assert.equal(config.misconfigured, false)
    assert.deepEqual(config.recommendedRecords, [{ type: 'CNAME', name: 'app', value: 'cname.vercel-dns.com' }])
  })

  it('parses Vercel runtime logs from ndjson text', async () => {
    const fetcher: ServiceProviderFetch = async (url) => {
      assert.equal(new URL(String(url)).pathname, '/v1/projects/prj_1/deployments/dep_1/runtime-logs')

      return createTextResponse(
        [
          JSON.stringify({ timestamp: 1782172800000, level: 'info', message: 'started', source: 'runtime' }),
          JSON.stringify({ createdAt: 1782172860000, proxy: { method: 'GET', path: '/api/health', statusCode: 200 } }),
          'plain runtime line'
        ].join('\n')
      )
    }

    const logs = await readVercelRuntimeLogs({ token: 'vercel-token' }, 'prj_1', 'dep_1', fetcher)

    assert.equal(logs[0].timestamp, '2026-06-23T00:00:00.000Z')
    assert.equal(logs[0].message, 'started')
    assert.equal(logs[1].message, 'GET /api/health 200')
    assert.equal(logs[2].message, 'plain runtime line')
  })

  it('reads Railway services with the project-token header and only project-token query when scoped to a project', async () => {
    let projectTokenHeader = ''
    const requests: string[] = []
    const fetcher: ServiceProviderFetch = async (_url, init) => {
      projectTokenHeader = String((init?.headers as Record<string, string>)['Project-Access-Token'])
      const { query, variables } = parseGraphqlBody(init)
      requests.push(query)

      if (query.includes('domains(')) {
        assert.equal(variables.projectId, 'railway-project')
        assert.equal(variables.serviceId, 'svc_1')
        assert.equal(variables.environmentId, 'env_1')

        return createJsonResponse({
          data: {
            domains: {
              customDomains: [{ id: 'domain_custom', domain: 'api.example.com', environmentId: 'env_1', serviceId: 'svc_1' }],
              serviceDomains: [{ id: 'domain_generated', domain: 'api-production.up.railway.app' }]
            }
          }
        })
      }

      if (query.includes('deployments(')) {
        const input = variables.input as Record<string, unknown>

        assert.equal(input.projectId, 'railway-project')
        assert.equal(input.serviceId, 'svc_1')
        assert.equal(input.environmentId, 'env_1')

        return createJsonResponse({
          data: {
            deployments: {
              edges: [
                {
                  node: {
                    id: 'dep_1',
                    status: 'SUCCESS',
                    url: 'api-production.up.railway.app',
                    createdAt: '2026-06-23T00:00:00.000Z',
                    meta: { commitSha: 'abc123' }
                  }
                }
              ],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        })
      }

      return createJsonResponse({
        data: {
          projectToken: {
            environmentId: 'env_1',
            project: {
              id: 'railway-project',
              name: 'Railway App',
              services: {
                edges: [
                  {
                    node: {
                      id: 'svc_1',
                      name: 'api'
                    }
                  }
                ]
              },
              environments: {
                edges: [
                  {
                    node: {
                      id: 'env_1',
                      name: 'production',
                      deployments: {
                        edges: [{ node: { id: 'dep_1', status: 'SUCCESS', url: 'api.up.railway.app' } }]
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      })
    }

    const services = await syncRailwayProviderServices(
      {
        token: 'railway-project-token',
        railwayTokenType: 'project'
      },
      fetcher
    )

    assert.equal(projectTokenHeader, 'railway-project-token')
    assert.equal(requests[0].includes('projectToken'), true)
    assert.equal(requests[0].includes('projects('), false)
    assert.equal(services[0].name, 'api')
    assert.equal(services[0].externalProjectId, 'railway-project')
    assert.equal(services[0].externalProjectName, 'Railway App')
    assert.equal(services[0].externalServiceId, 'svc_1')
    assert.equal(services[0].environments[0].name, 'production')
    assert.equal(services[0].environments[0].latestDeploymentId, 'dep_1')
    assert.equal(services[0].environments[0].latestCommit, 'abc123')
    assert.deepEqual(
      services[0].domains.map((domain) => `${domain.kind}:${domain.domain}`).sort(),
      ['custom:api.example.com', 'generated:api-production.up.railway.app']
    )
  })

  it('reads Railway workspace projects with bearer auth, workspace scope and pagination', async () => {
    const requests: Array<{ authorization: string; query: string; variables: Record<string, unknown> }> = []
    const fetcher: ServiceProviderFetch = async (_url, init) => {
      const body = parseGraphqlBody(init)
      requests.push({
        authorization: String((init?.headers as Record<string, string>).Authorization),
        query: body.query,
        variables: body.variables
      })

      if (body.query.includes('domains(')) {
        return createJsonResponse({ data: { domains: { customDomains: [], serviceDomains: [{ domain: 'api.up.railway.app' }] } } })
      }

      if (body.query.includes('deployments(')) {
        return createJsonResponse({
          data: {
            deployments: {
              edges: [{ node: { id: 'dep_workspace', status: 'SUCCESS', url: 'api.up.railway.app', meta: { commitSha: 'def456' } } }],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        })
      }

      if (body.variables.after === 'cursor-1') {
        return createJsonResponse({
          data: {
            projects: {
              edges: [
                {
                  node: {
                    id: 'railway-project-2',
                    name: 'Worker',
                    services: { edges: [] },
                    environments: { edges: [] }
                  }
                }
              ],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        })
      }

      return createJsonResponse({
        data: {
          projects: {
            edges: [
              {
                node: {
                  id: 'railway-project-1',
                  name: 'Railway App',
                  services: { edges: [{ node: { id: 'svc_1', name: 'api' } }] },
                  environments: { edges: [{ node: { id: 'env_1', name: 'production' } }] }
                }
              }
            ],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-1' }
          }
        }
      })
    }

    const services = await syncRailwayProviderServices(
      {
        token: 'railway-workspace-token',
        railwayTokenType: 'workspace',
        workspaceId: 'workspace_123'
      },
      fetcher
    )

    const projectRequests = requests.filter((request) => request.query.includes('projects('))
    assert.equal(projectRequests.length, 2)
    assert.equal(projectRequests.every((request) => request.authorization === 'Bearer railway-workspace-token'), true)
    assert.equal(projectRequests[0].variables.workspaceId, 'workspace_123')
    assert.equal(projectRequests[1].variables.after, 'cursor-1')
    assert.equal(services.length, 1)
    assert.equal(services[0].externalProjectId, 'railway-project-1')
    assert.equal(services[0].externalProjectName, 'Railway App')
    assert.equal(services[0].domains[0].kind, 'generated')
  })

  it('discovers Railway workspaces for account tokens without an explicit workspace id', async () => {
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = []
    const fetcher: ServiceProviderFetch = async (_url, init) => {
      const body = parseGraphqlBody(init)
      requests.push({ query: body.query, variables: body.variables })

      if (body.query.includes('apiToken')) {
        return createJsonResponse({
          data: {
            apiToken: {
              workspaces: [{ id: 'workspace_123', name: 'Team Workspace' }]
            }
          }
        })
      }

      if (body.query.includes('domains(')) {
        return createJsonResponse({ data: { domains: { customDomains: [], serviceDomains: [] } } })
      }

      if (body.query.includes('deployments(')) {
        return createJsonResponse({
          data: {
            deployments: {
              edges: [{ node: { id: 'dep_account', status: 'SUCCESS', url: 'api.up.railway.app' } }],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        })
      }

      if (body.variables.workspaceId === 'workspace_123') {
        return createJsonResponse({
          data: {
            projects: {
              edges: [
                {
                  node: {
                    id: 'railway-project-1',
                    name: 'Railway App',
                    services: { edges: [{ node: { id: 'svc_1', name: 'api' } }] },
                    environments: { edges: [{ node: { id: 'env_1', name: 'production' } }] }
                  }
                }
              ],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        })
      }

      return createJsonResponse({
        data: {
          projects: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null }
          }
        }
      })
    }

    const services = await syncRailwayProviderServices({ token: 'railway-account-token', railwayTokenType: 'account' }, fetcher)

    assert.equal(requests.some((request) => request.query.includes('apiToken')), true)
    assert.equal(requests.some((request) => request.variables.workspaceId === 'workspace_123'), true)
    assert.equal(services.length, 1)
    assert.equal(services[0].name, 'api')
    assert.equal(services[0].externalProjectId, 'railway-project-1')
    assert.equal(services[0].externalProjectName, 'Railway App')
  })

  it('explains empty Railway account syncs without workspace access', async () => {
    const fetcher: ServiceProviderFetch = async (_url, init) => {
      const body = parseGraphqlBody(init)

      if (body.query.includes('apiToken')) {
        return createJsonResponse({ data: { apiToken: { workspaces: [] } } })
      }

      return createJsonResponse({
        data: {
          projects: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null }
          }
        }
      })
    }

    await assert.rejects(
      () => syncRailwayProviderServices({ token: 'railway-account-token', railwayTokenType: 'account' }, fetcher),
      /Account Token 未填写 Workspace ID/
    )
  })

  it('requires Railway workspace tokens to include a workspace id', async () => {
    await assert.rejects(
      () => syncRailwayProviderServices({ token: 'railway-workspace-token', railwayTokenType: 'workspace' }, async () => createJsonResponse({ data: {} })),
      /Workspace Token 需要填写 Workspace ID/
    )
  })

  it('surfaces Railway GraphQL errors with context', async () => {
    const fetcher: ServiceProviderFetch = async () =>
      createJsonResponse({
        errors: [{ message: 'Cannot query field "projects" on type "Query"' }]
      })

    await assert.rejects(
      () => syncRailwayProviderServices({ token: 'railway-token', railwayTokenType: 'account' }, fetcher),
      /读取 Railway 项目失败：Cannot query field/
    )
  })

  it('lists Railway deployments, variables and logs as readonly provider data', async () => {
    const requests: string[] = []
    const fetcher: ServiceProviderFetch = async (_url, init) => {
      const { query, variables } = parseGraphqlBody(init)
      requests.push(query)

      if (query.includes('deploymentLogs(')) {
        assert.equal(variables.deploymentId, 'dep_1')
        return createJsonResponse({ data: { deploymentLogs: [{ timestamp: '2026-06-23T00:00:00.000Z', severity: 'info', message: 'build started' }] } })
      }

      if (query.includes('environmentLogs(')) {
        assert.equal(variables.environmentId, 'env_1')
        return createJsonResponse({ data: { environmentLogs: [{ timestamp: '2026-06-23T00:01:00.000Z', severity: 'warn', message: 'runtime warning' }] } })
      }

      if (query.includes('variables(')) {
        assert.equal(variables.projectId, 'railway-project')
        assert.equal(variables.serviceId, 'svc_1')
        assert.equal(variables.environmentId, 'env_1')
        return createJsonResponse({ data: { variables: { API_URL: 'https://api.example.com', SECRET_KEY: '${{shared.SECRET_KEY}}' } } })
      }

      return createJsonResponse({
        data: {
          deployments: {
            edges: [
              {
                node: {
                  id: 'dep_1',
                  status: 'SUCCESS',
                  url: 'api.up.railway.app',
                  createdAt: '2026-06-23T00:00:00.000Z',
                  statusUpdatedAt: '2026-06-23T00:02:00.000Z',
                  meta: { commitSha: 'abc123' }
                }
              }
            ],
            pageInfo: { hasNextPage: false, endCursor: null }
          }
        }
      })
    }

    const deployments = await listRailwayDeployments({ token: 'railway-token', railwayTokenType: 'account' }, 'railway-project', 'svc_1', 'env_1', {}, fetcher)
    const envVars = await listRailwayProjectEnvVars(
      { token: 'railway-token', railwayTokenType: 'account' },
      'railway-project',
      'svc_1',
      [{ name: 'production', externalEnvironmentId: 'env_1' }],
      fetcher
    )
    const buildLogs = await readRailwayDeploymentLogs({ token: 'railway-token', railwayTokenType: 'account' }, 'dep_1', fetcher)
    const runtimeLogs = await readRailwayEnvironmentLogs({ token: 'railway-token', railwayTokenType: 'account' }, 'env_1', fetcher)

    assert.equal(deployments[0].id, 'dep_1')
    assert.equal(deployments[0].commitSha, 'abc123')
    assert.deepEqual(envVars.map((envVar) => `${envVar.target[0]}:${envVar.key}`).sort(), ['production:API_URL', 'production:SECRET_KEY'])
    assert.equal(envVars[0].value, undefined)
    assert.equal(buildLogs[0].message, 'build started')
    assert.equal(runtimeLogs[0].message, 'runtime warning')
    assert.equal(requests.some((query) => query.includes('deploymentLogs(')), true)
  })
})
