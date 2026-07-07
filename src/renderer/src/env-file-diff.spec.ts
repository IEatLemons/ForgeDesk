import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  compareEnvFiles,
  createEnvFileDiffTask,
  envFileDiffActiveTaskStorageKey,
  envFileDiffTasksStorageKey,
  formatEnvVariableRows,
  formatEnvVariableValues,
  formatVariableNames,
  normalizeEnvFileDiffTasks,
  parseEnvFileVariables,
  readStoredEnvFileDiffActiveTaskId,
  readStoredEnvFileDiffTasks,
  updateEnvVariableValue,
  writeStoredEnvFileDiffActiveTaskId,
  writeStoredEnvFileDiffTasks,
  type EnvFileDiffTaskStorage
} from './env-file-diff.js'

function createMemoryTaskStorage(initialValues: Record<string, string> = {}): EnvFileDiffTaskStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initialValues))

  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    }
  }
}

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
    assert.deepEqual(result.variables.map((variable) => variable.value), ['abc', 'value', 'value'])
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
    assert.deepEqual(
      result.rows.map((row) => ({ name: row.variableName, sourceValue: row.sourceValue, targetValue: row.targetValue, status: row.status })),
      [
        { name: 'INGEST_API_KEY', sourceValue: '1', targetValue: '2', status: 'different' },
        { name: 'ADMIN_SESSION_SECRET', sourceValue: '1', targetValue: '', status: 'missing-in-target' },
        { name: 'MERCHANT_ADAPTER_API_KEY', sourceValue: '1', targetValue: '2', status: 'different' },
        { name: 'ADMIN_SUPERUSER_PASSWORD', sourceValue: '1', targetValue: '', status: 'missing-in-target' }
      ]
    )
    assert.deepEqual(result.differentValues, ['INGEST_API_KEY', 'MERCHANT_ADAPTER_API_KEY'])
    assert.equal(formatVariableNames(result.missingInTarget), 'ADMIN_SESSION_SECRET\nADMIN_SUPERUSER_PASSWORD')
  })

  it('also reports target variables that source does not have', () => {
    const result = compareEnvFiles('A=1\nB=1', 'B=2\nC=2')

    assert.deepEqual(result.missingInTarget, ['A'])
    assert.deepEqual(result.extraInTarget, ['C'])
  })

  it('parses pasted variable-name lists and tabular copies', () => {
    const result = parseEnvFileVariables(`
DATABASE_URL
export REDIS_URL
JWT_SECRET\tredacted
PAYMENT_SECRET  hidden
regular sentence with spaces
`)

    assert.deepEqual(result.variableNames, ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'PAYMENT_SECRET'])
    assert.deepEqual(result.variables.map((variable) => variable.value), ['', '', 'redacted', 'hidden'])
    assert.equal(result.ignoredLineCount, 1)
  })

  it('parses multiline quoted values as one environment variable', () => {
    const result = parseEnvFileVariables(`
UCARD_OMNIVAULT_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvPiYJicmvPB+URw6636N
v8HMsQn+ovbvELwiCpFA8s3b8dVbAcOkZbXlKqhKlSynv9pCITKonDVZh1jgtq8M
-----END PUBLIC KEY-----"
UCARD_OMNIVAULT_TIMEOUT="30"
`)

    assert.deepEqual(result.variableNames, ['UCARD_OMNIVAULT_WEBHOOK_PUBLIC_KEY', 'UCARD_OMNIVAULT_TIMEOUT'])
    assert.equal(result.ignoredLineCount, 0)
    assert.equal(
      result.variables[0].value,
      `"-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvPiYJicmvPB+URw6636N\nv8HMsQn+ovbvELwiCpFA8s3b8dVbAcOkZbXlKqhKlSynv9pCITKonDVZh1jgtq8M\n-----END PUBLIC KEY-----"`
    )
  })

  it('parses unquoted PEM blocks as one environment variable', () => {
    const result = parseEnvFileVariables(`
UNIPIE_OMNIVAULT_WEBHOOK_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestLineOne
v8HMsQn+ovbvELwiCpFA8s3b8dVbAcOkZbXlKqhKlSynv9pCITKtestTwo
8wIDAQAB
-----END PUBLIC KEY-----
UNIPIE_OMNIVAULT_TIMEOUT=10
`)

    assert.deepEqual(result.variableNames, ['UNIPIE_OMNIVAULT_WEBHOOK_PUBLIC_KEY', 'UNIPIE_OMNIVAULT_TIMEOUT'])
    assert.equal(result.ignoredLineCount, 0)
    assert.equal(
      result.variables[0].value,
      '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestLineOne\nv8HMsQn+ovbvELwiCpFA8s3b8dVbAcOkZbXlKqhKlSynv9pCITKtestTwo\n8wIDAQAB\n-----END PUBLIC KEY-----'
    )
    assert.equal(formatEnvVariableRows(result.variables), `${result.variables[0].name}=${result.variables[0].value}\nUNIPIE_OMNIVAULT_TIMEOUT=10`)
    assert.equal(formatEnvVariableValues(result.variables), `${result.variables[0].value}\n10`)
  })

  it('updates an existing variable value for table editing', () => {
    const result = updateEnvVariableValue('A=1\nexport B=2\nC: 3', 'B', '"changed"')

    assert.equal(result, 'A=1\nB="changed"\nC: 3')
  })

  it('replaces a multiline variable block for table editing', () => {
    const result = updateEnvVariableValue('A=1\nPUBLIC_KEY="line 1\nline 2"\nB=2', 'PUBLIC_KEY', '"changed"')

    assert.equal(result, 'A=1\nPUBLIC_KEY="changed"\nB=2')
  })

  it('appends a missing variable value for table editing', () => {
    const result = updateEnvVariableValue('A=1\n', 'B', '2')

    assert.equal(result, 'A=1\nB=2\n')
  })

  it('creates and persists env diff comparison tasks', () => {
    const createdAt = new Date('2026-07-06T08:00:00.000Z')
    const task = createEnvFileDiffTask(
      {
        id: 'task-1',
        sourceText: 'A=1',
        targetText: 'A=2',
        targetFile: { name: 'production.env', size: 12 },
        resultFilter: 'different'
      },
      createdAt
    )
    const storage = createMemoryTaskStorage()

    writeStoredEnvFileDiffTasks([task], storage)
    writeStoredEnvFileDiffActiveTaskId(task.id, storage)

    assert.equal(storage.values.has(envFileDiffTasksStorageKey), true)
    assert.equal(readStoredEnvFileDiffActiveTaskId(storage), 'task-1')
    assert.deepEqual(readStoredEnvFileDiffTasks(storage), [task])
  })

  it('normalizes stored env diff tasks and ignores corrupt entries', () => {
    const tasks = normalizeEnvFileDiffTasks([
      {
        id: 'older',
        title: 'Older',
        sourceText: 'A=1',
        resultFilter: 'missing',
        updatedAt: '2026-07-05T08:00:00.000Z'
      },
      {
        id: 'newer',
        title: 'Newer',
        sourceText: 42,
        sourceFile: { name: 'local.env', size: 20 },
        resultFilter: 'unknown',
        updatedAt: '2026-07-06T08:00:00.000Z'
      },
      null,
      {
        title: 'missing id'
      }
    ])

    assert.deepEqual(tasks.map((task) => task.id), ['newer', 'older'])
    assert.equal(tasks[0].sourceText, '')
    assert.deepEqual(tasks[0].sourceFile, { name: 'local.env', size: 20 })
    assert.equal(tasks[0].resultFilter, 'all')
    assert.equal(tasks[1].resultFilter, 'missing')
  })

  it('falls back safely when persisted env diff task storage is invalid', () => {
    const storage = createMemoryTaskStorage({
      [envFileDiffTasksStorageKey]: '{not json',
      [envFileDiffActiveTaskStorageKey]: 'task-1'
    })

    assert.deepEqual(readStoredEnvFileDiffTasks(storage), [])
    assert.equal(readStoredEnvFileDiffActiveTaskId(storage), 'task-1')

    writeStoredEnvFileDiffActiveTaskId('', storage)
    assert.equal(storage.values.has(envFileDiffActiveTaskStorageKey), false)
  })
})
