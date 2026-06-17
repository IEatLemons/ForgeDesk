export type GitErrorGuidance = {
  title: string
  summary: string
  actions: string[]
  rawMessage: string
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return '操作失败，请稍后重试'
}

function normalizeRemoteError(rawMessage: string): string {
  return rawMessage
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

export function createGitErrorGuidance(error: unknown, actionName = 'Git 操作'): GitErrorGuidance {
  const rawMessage = getRawErrorMessage(error)
  const normalizedMessage = normalizeRemoteError(rawMessage)
  const lowerMessage = normalizedMessage.toLowerCase()

  if (lowerMessage.includes('permission denied (publickey)') || lowerMessage.includes('could not read from remote repository')) {
    return {
      title: `${actionName}失败：SSH 公钥无权限`,
      summary: '当前 SSH 公钥没有访问这个远端仓库的权限，或者远端地址对应的账号/仓库不正确。',
      actions: [
        '到全局设置里确认已有 SSH 公钥，复制到 GitHub / GitLab / Gitee 的 SSH Keys。',
        '如果这个仓库需要指定私钥，请在全局设置里编辑 SSH config，补齐 Host 和 IdentityFile。',
        '在高级设置的远端管理里确认远端地址是否写对，尤其是组织名、仓库名和 SSH 域名。',
        '如果这是私有仓库，请确认当前账号已经加入仓库或组织，并拥有读取权限。',
        '权限修好后回到高级设置，点击对应远端的 Fetch，或点击 Fetch 全部重新同步。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (normalizedMessage.includes('缺少') && normalizedMessage.includes('远端')) {
    return {
      title: `${actionName}失败：缺少远端配置`,
      summary: '当前仓库缺少用于同步或对齐的远端，因此无法继续检查远端状态。',
      actions: [
        '打开项目设置里的高级设置，在远端管理中点击“新增远端”。',
        '按团队约定补齐远端名称和 Fetch URL，例如 company 或 origin。',
        '保存后点击 Fetch 全部，重新拉取远端引用并刷新对齐结果。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (lowerMessage.includes('not a git repository') || normalizedMessage.includes('不是 Git 仓库')) {
    return {
      title: `${actionName}失败：仓库路径无效`,
      summary: '当前路径不是可读取的 Git 仓库，可能目录被移动、删除，或项目记录里的路径已经过期。',
      actions: ['确认本地目录仍然存在并包含 .git。', '如果项目目录变了，请重新创建项目或重新扫描正确目录。'],
      rawMessage: normalizedMessage
    }
  }

  return {
    title: `${actionName}失败`,
    summary: 'Git 返回了错误，ForgeDesk 暂时无法完成这一步。',
    actions: ['先查看下方原始错误，确认是权限、远端地址、网络还是仓库路径问题。', '修正后重新执行刚才的操作。'],
    rawMessage: normalizedMessage
  }
}
