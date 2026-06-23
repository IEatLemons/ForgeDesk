import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getServiceProviderGuide } from './service-config-guide.js'

describe('service config guide', () => {
  it('provides quick links for Vercel tokens and API docs', () => {
    const guide = getServiceProviderGuide('vercel')

    assert.equal(guide.title, 'Vercel')
    assert.equal(guide.primaryTokenUrl, 'https://vercel.com/account/settings/tokens')
    assert.equal(guide.docsUrl, 'https://vercel.com/docs/rest-api')
    assert.equal(guide.dashboardUrl, 'https://vercel.com/dashboard')
    assert.ok(guide.steps.some((step) => step.includes('Team ID')))
  })

  it('provides quick links for Railway account and project tokens', () => {
    const guide = getServiceProviderGuide('railway')

    assert.equal(guide.title, 'Railway')
    assert.equal(guide.primaryTokenUrl, 'https://railway.com/account/tokens')
    assert.equal(guide.projectTokenDocsUrl, 'https://docs.railway.com/integrations/api#project-token')
    assert.equal(guide.docsUrl, 'https://docs.railway.com/integrations/api')
    assert.ok(guide.steps.some((step) => step.includes('Project-Access-Token')))
  })
})
