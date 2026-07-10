import type { QuickBuildTask } from './data'

export type QuickBuildCompletionPrompt = {
  title: string
  description: string
  detail: string
  okText: string
}

export function createQuickBuildCompletionPrompt(task: Pick<QuickBuildTask, 'command' | 'cwd' | 'status'>): QuickBuildCompletionPrompt | null {
  if (task.status !== 'succeeded') {
    return null
  }

  return {
    title: '快速构建完成，请重新打开 app',
    description: '新的 macOS app 已编译完成。退出当前 ForgeDesk 后重新打开 app，才能使用刚刚生成的新版本。',
    detail: `构建命令：${task.command}\n构建目录：${task.cwd}`,
    okText: '知道了'
  }
}
