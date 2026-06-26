import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getErrorMessage, isAiCredentialErrorMessage } from './error-messages.js'

describe('renderer error messages', () => {
  it('strips Electron IPC wrappers from remote errors', () => {
    const message = getErrorMessage(
      new Error("Error invoking remote method 'repository:remote:fetch': Error: git fetch failed")
    )

    assert.equal(message, 'git fetch failed')
  })

  it('turns legacy AI HTTP 401 errors into API key guidance', () => {
    const message = getErrorMessage(
      new Error("Error invoking remote method 'repository:commit-message:suggest': Error: AI 请求失败：HTTP 401")
    )

    assert.equal(message, 'AI API Key 无效、已过期或没有权限，请在 AI 设置里更新 API Key 后重试。')
    assert.equal(isAiCredentialErrorMessage(message), true)
  })

  it('keeps generic non-AI HTTP 401 errors intact', () => {
    const message = getErrorMessage(
      new Error("Error invoking remote method 'service:connection:test': Error: HTTP 401")
    )

    assert.equal(message, 'HTTP 401')
  })

  it('returns the provided fallback for unknown error shapes', () => {
    assert.equal(getErrorMessage({ reason: 'nope' }, '保存失败'), '保存失败')
  })
})
