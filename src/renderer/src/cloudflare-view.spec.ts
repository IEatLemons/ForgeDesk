import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cloudflareRecordTypeSupportsProxy,
  createCloudflareDnsRecordFormValues,
  formatCloudflareRecordNameForForm,
  formatCloudflareTtl,
  normalizeCloudflareDnsRecordName
} from './cloudflare-view.js'
import type { CloudflareDnsRecord } from './data.js'

describe('Cloudflare view helpers', () => {
  it('normalizes root and short DNS record names against the project domain', () => {
    assert.equal(normalizeCloudflareDnsRecordName('@', 'Example.com'), 'example.com')
    assert.equal(normalizeCloudflareDnsRecordName('www', 'example.com'), 'www.example.com')
    assert.equal(normalizeCloudflareDnsRecordName('api.example.com.', 'example.com'), 'api.example.com')
  })

  it('formats full Cloudflare record names back into compact form values', () => {
    assert.equal(formatCloudflareRecordNameForForm('example.com', 'example.com'), '@')
    assert.equal(formatCloudflareRecordNameForForm('www.example.com', 'example.com'), 'www')
    assert.equal(formatCloudflareRecordNameForForm('external.test', 'example.com'), 'external.test')
  })

  it('creates DNS form defaults and existing record values', () => {
    assert.deepEqual(createCloudflareDnsRecordFormValues(), {
      type: 'A',
      name: '@',
      content: '',
      ttl: 1,
      proxied: false,
      priority: 10,
      comment: ''
    })

    const record: CloudflareDnsRecord = {
      id: 'record-1',
      type: 'MX',
      name: 'mail.example.com',
      content: 'mx.example.com',
      ttl: 3600,
      proxied: false,
      proxiable: false,
      priority: 20,
      comment: 'mail',
      createdAt: '',
      modifiedAt: ''
    }

    assert.deepEqual(createCloudflareDnsRecordFormValues(record, 'example.com'), {
      type: 'MX',
      name: 'mail',
      content: 'mx.example.com',
      ttl: 3600,
      proxied: false,
      priority: 20,
      comment: 'mail'
    })
  })

  it('keeps proxy and TTL display rules predictable', () => {
    assert.equal(cloudflareRecordTypeSupportsProxy('A'), true)
    assert.equal(cloudflareRecordTypeSupportsProxy('TXT'), false)
    assert.equal(formatCloudflareTtl(1), 'Auto')
    assert.equal(formatCloudflareTtl(3600), '3600s')
  })
})
