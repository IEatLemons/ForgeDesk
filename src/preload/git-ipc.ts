export function parseGitIpcPayload<T>(channel: string, payload: unknown): T {
  if (typeof payload !== 'string') {
    throw new Error(`Git IPC ${channel} 返回格式无效`)
  }

  try {
    return JSON.parse(payload) as T
  } catch {
    throw new Error(`Git IPC ${channel} 返回数据损坏`)
  }
}
