export type GitIpcDiagnostic = {
  channel: string
  bytes: number
  recordedAt: string
}

let lastGitIpcDiagnostic: GitIpcDiagnostic | null = null

export function serializeGitIpcPayload(channel: string, value: unknown): string {
  try {
    const payload = JSON.stringify(value, (_key, currentValue: unknown) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )

    if (payload === undefined) {
      throw new Error('返回值为空')
    }

    lastGitIpcDiagnostic = {
      channel,
      bytes: Buffer.byteLength(payload, 'utf8'),
      recordedAt: new Date().toISOString()
    }

    if (process.env.FORGEDESK_DEBUG_GIT_IPC === '1') {
      console.info(`[Git IPC] ${channel} ${lastGitIpcDiagnostic.bytes} bytes`)
    }

    return payload
  } catch (error) {
    lastGitIpcDiagnostic = {
      channel,
      bytes: 0,
      recordedAt: new Date().toISOString()
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Git IPC] ${channel} serialization failed: ${message}`)
    throw new Error(`Git IPC 数据无法序列化：${message}`)
  }
}

export function getLastGitIpcDiagnostic(): GitIpcDiagnostic | null {
  return lastGitIpcDiagnostic ? { ...lastGitIpcDiagnostic } : null
}
