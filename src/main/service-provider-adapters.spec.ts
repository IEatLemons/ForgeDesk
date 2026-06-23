import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { syncRailwayProviderServices, syncVercelProviderServices, type ServiceProviderFetch } from './service-provider-adapters.js'

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Failed',
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response
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

  it('reads Railway services with the project-token header when scoped to a project', async () => {
    let projectTokenHeader = ''
    let requestBody = ''
    const fetcher: ServiceProviderFetch = async (_url, init) => {
      projectTokenHeader = String((init?.headers as Record<string, string>)['Project-Access-Token'])
      requestBody = String(init?.body ?? '')

      return createJsonResponse({
        data: {
          projectToken: {
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
    assert.equal(requestBody.includes(' domains'), false)
    assert.equal(requestBody.includes('commitSha'), false)
    assert.equal(services[0].name, 'api')
    assert.equal(services[0].externalProjectId, 'railway-project')
    assert.equal(services[0].externalServiceId, 'svc_1')
    assert.equal(services[0].environments[0].name, 'production')
    assert.equal(services[0].domains[0].domain, 'api.up.railway.app')
  })
})
