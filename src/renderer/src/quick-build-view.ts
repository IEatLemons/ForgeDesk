import type { QuickBuildTask } from './data'

export type QuickBuildCompletionPrompt = {
  title: string
  description: string
  detail: string
  restartText: string
  cancelText: string
}

export function createQuickBuildCompletionPrompt(task: Pick<QuickBuildTask, 'command' | 'cwd' | 'status'>): QuickBuildCompletionPrompt | null {
  if (task.status !== 'succeeded') {
    return null
  }

  return {
    title: '快速构建完成，可以直接重启',
    description: '新的 macOS app 已编译完成。点击“直接重启”会打开刚刚生成的新版本，并关闭当前 ForgeDesk。',
    detail: `构建命令：${task.command}\n构建目录：${task.cwd}`,
    restartText: '直接重启',
    cancelText: '稍后手动打开'
  }
}
