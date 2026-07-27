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

  if (
    lowerMessage.includes('repository not found') ||
    lowerMessage.includes('does not appear to be a git repository') ||
    lowerMessage.includes('repository path does not exist')
  ) {
    return {
      title: `${actionName}失败：远端仓库不存在或地址不匹配`,
      summary: 'Git 找不到当前远端地址对应的仓库。迁移 Gitea、重建仓库或保留旧远端时，经常会出现这个状态。',
      actions: [
        '打开项目设置里的远端管理，确认失败的是哪个远端，并优先单独 Fetch 新的 Gitea 远端。',
        '核对远端 URL 的域名、组织名、仓库名和大小写，确认仓库已经在新的 Gitea 上创建。',
        '如果旧 GitHub 或旧 Gitea 已经不用了，请删除对应 remote，或者把 origin 改成新的 Gitea 地址。',
        '如果当前分支还跟踪旧远端，请把 upstream 切到新的远端分支后再推送。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (lowerMessage.includes('permission denied (publickey)') || lowerMessage.includes('could not read from remote repository')) {
    return {
      title: `${actionName}失败：SSH 公钥无权限`,
      summary: '当前 SSH 公钥没有访问这个远端仓库的权限，或者远端地址对应的账号/仓库不正确。',
      actions: [
        '到全局设置里确认已有 SSH 公钥，复制到 GitHub / GitLab / Gitea / Gitee 的 SSH Keys。',
        '如果这个仓库需要指定私钥，请在全局设置里编辑 SSH config，补齐 Host 和 IdentityFile。',
        '在高级设置的远端管理里确认远端地址是否写对，尤其是组织名、仓库名和 SSH 域名。',
        '如果这是私有仓库，请确认当前账号已经加入仓库或组织，并拥有读取权限。',
        '权限修好后回到高级设置，点击对应远端的 Fetch，或点击 Fetch 全部重新同步。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (
    lowerMessage.includes('host key verification failed') ||
    lowerMessage.includes('remote host identification has changed')
  ) {
    return {
      title: `${actionName}失败：SSH 主机指纹需要确认`,
      summary: 'SSH 拒绝连接这个远端主机，通常是新 Gitea 主机第一次连接，或服务器重建后 known_hosts 里的指纹已过期。',
      actions: [
        '先在终端里对失败远端执行一次 git fetch，按提示确认新的 SSH 主机指纹。',
        '如果提示主机指纹变更，请确认服务器确实已重建，再清理 ~/.ssh/known_hosts 中对应域名的旧记录。',
        '确认后回到 ForgeDesk，重新 Fetch 对应远端。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (
    lowerMessage.includes('banner exchange') ||
    lowerMessage.includes('invalid format')
  ) {
    return {
      title: `${actionName}失败：远端 SSH 端口不可用`,
      summary: 'Git 已连到远端主机，但这个端口没有返回正常 SSH 握手。常见原因是 Gitea Web 部署在反代或 Railway 后面，但 Git SSH 端口没有单独暴露。',
      actions: [
        '优先确认 Gitea 仓库页面显示的克隆地址，如果只有 HTTPS 可用，请把 remote 改成 HTTPS 地址。',
        '使用 HTTPS 时，需要先在 Gitea 创建 Personal Access Token，并让 Git 凭据助手保存用户名和 token。',
        '如果坚持使用 SSH，请在 Gitea/服务器侧暴露真实 SSH 端口，并把 remote 改成 ssh://git@域名:端口/组织/仓库.git。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (lowerMessage.includes('执行超时') || lowerMessage.includes('timed out')) {
    return {
      title: `${actionName}失败：Git 操作超时`,
      summary: 'Git 没有在限定时间内返回，可能在等待 SSH 密码、主机指纹确认，或远端网络没有响应。',
      actions: [
        '先在终端里运行同一个 git fetch 或 git push，完成 SSH 密码、主机指纹或账号权限确认。',
        '如果使用带密码的私钥，请在 ForgeDesk 全局设置里保存对应私钥密码，或确认 ssh-agent 已加载该私钥。',
        '如果 Gitea 网页能打开但 SSH 一直超时，通常是 Git SSH 端口没有暴露；请改用 HTTPS remote + Personal Access Token，或在服务器侧开放 SSH 端口。',
        '检查 Gitea 域名和当前网络是否可访问，然后回到 ForgeDesk 重新执行。'
      ],
      rawMessage: normalizedMessage
    }
  }

  if (
    lowerMessage.includes('could not resolve hostname') ||
    lowerMessage.includes('nodename nor servname provided') ||
    lowerMessage.includes('name or service not known')
  ) {
    return {
      title: `${actionName}失败：远端域名无法解析`,
      summary: '当前网络无法解析远端地址里的主机名，可能是域名写错、DNS 未生效，或需要连接内网/VPN。',
      actions: [
        '核对远端 URL 里的域名是否正确。',
        '确认当前网络、DNS 或 VPN 能访问新的 Gitea 主机。',
        '网络恢复后重新 Fetch 或 Push。'
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
