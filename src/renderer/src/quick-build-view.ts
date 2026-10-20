import type { QuickBuildTask } from './data'

export type QuickBuildLogChannel = 'log' | 'stdout' | 'stderr'
export type QuickBuildLogTask = {
  command: string
  cwd: string
  status: string
  startedAt?: string
  log?: string
  stdout?: string
  stderr?: string
}

export function getQuickBuildLogOutput(task: QuickBuildLogTask, channel: QuickBuildLogChannel): string {
  return task[channel] ?? ''
}

export function createQuickBuildLogDownload(task: QuickBuildLogTask, channel: QuickBuildLogChannel): { fileName: string; content: string } {
  const labels = { log: '全部日志', stdout: '标准输出', stderr: '错误输出' }
  const timestamp = task.startedAt?.replace(/[^\dTZ]/g, '') || 'current'
  return {
    fileName: `forgedesk-build-${timestamp}-${channel}.log`,
    content: [`ForgeDesk 编译日志 · ${labels[channel]}`, `命令：${task.command}`, `目录：${task.cwd}`, `状态：${task.status}`, ...(task.startedAt ? [`开始：${task.startedAt}`] : []), '以下为当前任务保留的缓存输出；超出缓冲上限时仅保留末尾。', '', getQuickBuildLogOutput(task, channel)].join('\n')
  }
}

export type QuickBuildCompletionPrompt = {
  title: string
  description: string
  detail: string
  restartText: string
  cancelText: string
}

export function shouldSelectQuickBuildDirectory(canQuickBuild: boolean | undefined, status: 'idle' | 'running' | 'success' | 'error' | 'cancelled'): boolean {
  return canQuickBuild === false || status === 'error'
}

export function createQuickBuildCompletionPrompt(task: Pick<QuickBuildTask, 'command' | 'cwd' | 'status'> & Partial<Pick<QuickBuildTask, 'artifactPath' | 'elapsedMs' | 'reused'>>): QuickBuildCompletionPrompt | null {
  if (task.status !== 'succeeded' || !task.artifactPath) {
    return null
  }

  return {
    title: '快速构建完成，可以直接重启',
    description: '新的 macOS app 已编译完成。点击“直接重启”会打开刚刚生成的新版本，并关闭当前 ForgeDesk。',
    detail: `构建命令：${task.command}\n构建目录：${task.cwd}\n产物：${task.artifactPath}${task.elapsedMs == null ? '' : `\n耗时：${(task.elapsedMs / 1000).toFixed(2)}s${task.reused ? '（复用成功应用）' : ''}`}`,
    restartText: '直接重启',
    cancelText: '稍后手动打开'
  }
}
