import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareEnvFiles, formatVariableNames, parseEnvFileVariables } from './env-file-diff.js'

describe('env file diff', () => {
  it('parses dotenv variable names while ignoring comments and duplicates', () => {
    const result = parseEnvFileVariables(`
# local config
INGEST_API_KEY=abc
export ADMIN_SESSION_SECRET = value
INGEST_API_KEY=duplicate
// skipped
MERCHANT_ADAPTER_API_KEY: value
not a variable
`)

    assert.deepEqual(result.variableNames, ['INGEST_API_KEY', 'ADMIN_SESSION_SECRET', 'MERCHANT_ADAPTER_API_KEY'])
    assert.equal(result.ignoredLineCount, 1)
  })

  it('returns variables that target file is missing in source order', () => {
    const result = compareEnvFiles(
      `
INGEST_API_KEY=1
ADMIN_SESSION_SECRET=1
MERCHANT_ADAPTER_API_KEY=1
ADMIN_SUPERUSER_PASSWORD=1
`,
      `
INGEST_API_KEY=2
MERCHANT_ADAPTER_API_KEY=2
`
    )

    assert.deepEqual(result.missingInTarget, ['ADMIN_SESSION_SECRET', 'ADMIN_SUPERUSER_PASSWORD'])
    assert.deepEqual(result.extraInTarget, [])
    assert.equal(formatVariableNames(result.missingInTarget), 'ADMIN_SESSION_SECRET\nADMIN_SUPERUSER_PASSWORD')
  })

  it('also reports target variables that source does not have', () => {
    const result = compareEnvFiles('A=1\nB=1', 'B=2\nC=2')

    assert.deepEqual(result.missingInTarget, ['A'])
    assert.deepEqual(result.extraInTarget, ['C'])
  })
})
