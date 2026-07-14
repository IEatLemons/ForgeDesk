import type { CloudflareDnsRecord, CloudflareDnsRecordType } from './data'

export type CloudflareDnsRecordFormValues = {
  type: CloudflareDnsRecordType
  name: string
  content: string
  ttl: number
  proxied: boolean
  priority?: number
  comment?: string
}

export const cloudflareDnsRecordTypeOptions: Array<{ label: CloudflareDnsRecordType; value: CloudflareDnsRecordType }> = [
  { label: 'A', value: 'A' },
  { label: 'AAAA', value: 'AAAA' },
  { label: 'CNAME', value: 'CNAME' },
  { label: 'TXT', value: 'TXT' },
  { label: 'MX', value: 'MX' }
]

export function cloudflareRecordTypeSupportsProxy(type: CloudflareDnsRecordType): boolean {
  return type === 'A' || type === 'AAAA' || type === 'CNAME'
}

export function normalizeCloudflareDnsRecordName(name: string, domain: string): string {
  const normalizedDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/\.+$/, '').toLowerCase()
  const normalizedName = name.trim().replace(/\.+$/, '').toLowerCase()

  if (!normalizedName || normalizedName === '@') {
    return normalizedDomain
  }

  if (!normalizedDomain || normalizedName === normalizedDomain || normalizedName.endsWith(`.${normalizedDomain}`)) {
    return normalizedName
  }

  return `${normalizedName}.${normalizedDomain}`
}

export function formatCloudflareRecordNameForForm(recordName: string, domain: string): string {
  const normalizedDomain = normalizeCloudflareDnsRecordName('@', domain)
  const normalizedName = recordName.trim().replace(/\.+$/, '').toLowerCase()

  if (!normalizedDomain || !normalizedName) {
    return recordName
  }

  if (normalizedName === normalizedDomain) {
    return '@'
  }

  return normalizedName.endsWith(`.${normalizedDomain}`) ? normalizedName.slice(0, -normalizedDomain.length - 1) : normalizedName
}

export function createCloudflareDnsRecordFormValues(record?: CloudflareDnsRecord, domain = ''): CloudflareDnsRecordFormValues {
  if (!record) {
    return {
      type: 'A',
      name: '@',
      content: '',
      ttl: 1,
      proxied: false,
      priority: 10,
      comment: ''
    }
  }

  return {
    type: record.type,
    name: formatCloudflareRecordNameForForm(record.name, domain),
    content: record.content,
    ttl: record.ttl || 1,
    proxied: record.proxied,
    priority: record.priority || 10,
    comment: record.comment
  }
}

export function formatCloudflareTtl(ttl: number): string {
  return ttl === 1 ? 'Auto' : `${ttl}s`
}
