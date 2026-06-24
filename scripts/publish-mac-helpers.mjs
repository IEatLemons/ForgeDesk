export function getReleaseTagName(packageJson) {
  const version = String(packageJson.version ?? '').trim()

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`package.json version 不是有效版本号：${version || '(empty)'}`)
  }

  return `v${version}`
}

export function createPublishPlan({ version, headCommit, isDirty, localTagCommit, remoteTagCommit, allowDirtyRelease }) {
  const tagName = getReleaseTagName({ version })
  const normalizedHead = String(headCommit ?? '').trim()
  const normalizedLocalTagCommit = String(localTagCommit ?? '').trim()
  const normalizedRemoteTagCommit = String(remoteTagCommit ?? '').trim()

  if (!normalizedHead) {
    throw new Error('无法读取当前 Git 提交。')
  }

  if (isDirty && !allowDirtyRelease) {
    throw new Error('工作区还有未提交的改动。请先提交代码，再发布；临时绕过可设置 FORGEDESK_ALLOW_DIRTY_RELEASE=1。')
  }

  if (normalizedLocalTagCommit && normalizedLocalTagCommit !== normalizedHead) {
    throw new Error(`${tagName} 已存在，但不是当前提交。请确认版本号或移动 tag 后再发布。`)
  }

  if (normalizedRemoteTagCommit && normalizedRemoteTagCommit !== normalizedHead) {
    throw new Error(`远端 ${tagName} 已存在，但不是当前提交。请确认版本号后再发布。`)
  }

  return {
    tagName,
    shouldCreateLocalTag: !normalizedLocalTagCommit,
    shouldPushTag: !normalizedRemoteTagCommit
  }
}
