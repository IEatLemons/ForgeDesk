import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_PASSWORD_TOOL_ITEMS,
  createGeneratedPasswordRows,
  formatEnvironmentVariableRows,
  generateHexSecret,
  generatePassword
} from './password-generator.js'
import type { RandomBytes } from './password-generator.js'

function createSequenceRandomBytes(): RandomBytes {
  let nextByte = 0

  return (length) => {
    const bytes = new Uint8Array(length)

    for (let index = 0; index < length; index += 1) {
      bytes[index] = nextByte % 256
      nextByte += 1
    }

    return bytes
  }
}

describe('password generator', () => {
  it('generates 64 hex characters from 32 random bytes', () => {
    const secret = generateHexSecret(32, createSequenceRandomBytes())

    assert.equal(secret, '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
    assert.match(secret, /^[a-f0-9]{64}$/)
  })

  it('includes every selected character group in strong passwords', () => {
    const password = generatePassword(
      {
        length: 24,
        groups: ['uppercase', 'lowercase', 'numbers', 'symbols']
      },
      createSequenceRandomBytes()
    )

    assert.equal(password.length, 24)
    assert.match(password, /[A-Z]/)
    assert.match(password, /[a-z]/)
    assert.match(password, /[0-9]/)
    assert.match(password, /[!@#$%^&*()\-_=+]/)
  })

  it('creates distinct values for the default environment variables', () => {
    const rows = createGeneratedPasswordRows(DEFAULT_PASSWORD_TOOL_ITEMS, createSequenceRandomBytes())
    const values = rows.map((row) => row.value)

    assert.deepEqual(
      rows.map((row) => row.variableName),
      ['INGEST_API_KEY', 'ADMIN_SESSION_SECRET', 'MERCHANT_ADAPTER_API_KEY', 'ADMIN_SUPERUSER_PASSWORD']
    )
    assert.equal(new Set(values).size, values.length)
    assert.match(formatEnvironmentVariableRows(rows), /^INGEST_API_KEY=.+\nADMIN_SESSION_SECRET=.+\nMERCHANT_ADAPTER_API_KEY=.+\nADMIN_SUPERUSER_PASSWORD=.+$/)
  })

  it('requires at least one character group for text passwords', () => {
    assert.throws(
      () => generatePassword({ length: 16, groups: [] }, createSequenceRandomBytes()),
      /至少选择一种字符类型/
    )
  })
})
