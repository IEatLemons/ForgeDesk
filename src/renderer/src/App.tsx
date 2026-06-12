import {
  Alert,
  Badge,
  Button,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BranchesOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DashboardOutlined,
  DeleteOutlined,
  DiffOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GithubOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  ContributorSummary,
  GitCommit,
  GitCommitDiff,
  GitCommitFileChange,
  GitContributorIdentity,
  Project,
  ProjectGitSummary,
  ProjectPerson,
  RemoteAlignmentBranch,
  RemoteAlignmentBranchStatus,
  RemoteAlignmentStatus,
  RemoteAlignmentSummary,
  Repository
} from './data'
import { useForgeDeskStore } from './store'

type ImportForm = {
  projectName: string
  workspacePath: string
}

type GitIdentityForm = {
  userName: string
  userEmail: string
}

type SshKeyForm = {
  keyEmail: string
}

type RepositoryIdentityForm = {
  userName: string
  userEmail: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function getIdentityMode(repository: Pick<Repository, 'localUserName' | 'localUserEmail' | 'effectiveUserName' | 'effectiveUserEmail'>): {
  label: string
  color: string
} {
  if (repository.localUserName && repository.localUserEmail) {
    return { label: '本仓库', color: 'blue' }
  }

  if (repository.effectiveUserName && repository.effectiveUserEmail) {
    return { label: '继承全局', color: 'default' }
  }

  return { label: '未配置', color: 'red' }
}

function RepositoryIdentityCell({ repository }: { repository: Pick<Repository, 'localUserName' | 'localUserEmail' | 'effectiveUserName' | 'effectiveUserEmail'> }): JSX.Element {
  const mode = getIdentityMode(repository)
  const name = repository.effectiveUserName || '未配置'
  const email = repository.effectiveUserEmail || '未配置'

  return (
    <Space direction="vertical" size={2}>
      <Space size={6}>
        <Tag color={mode.color}>{mode.label}</Tag>
        <Typography.Text strong>{name}</Typography.Text>
      </Space>
      <Typography.Text type="secondary">{email}</Typography.Text>
    </Space>
  )
}

function TableText({ value }: { value: string }): JSX.Element {
  return (
    <Typography.Text className="table-text" ellipsis={{ tooltip: value }}>
      {value}
    </Typography.Text>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function getFileStatusLabel(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    A: { label: '新增', color: 'green' },
    M: { label: '修改', color: 'blue' },
    D: { label: '删除', color: 'red' },
    R: { label: '重命名', color: 'purple' },
    C: { label: '复制', color: 'cyan' }
  }

  return statusMap[status] ?? { label: status || '变更', color: 'default' }
}

function getRemoteAlignmentStatusMeta(status: RemoteAlignmentStatus | RemoteAlignmentBranchStatus | ''): {
  label: string
  color: string
  badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning'
} {
  const statusMap: Record<RemoteAlignmentStatus, { label: string; color: string; badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning' }> = {
    aligned: { label: '已对齐', color: 'green', badgeStatus: 'success' },
    diverged: { label: 'Commit 不一致', color: 'red', badgeStatus: 'error' },
    'missing-remote': { label: '缺远端', color: 'red', badgeStatus: 'error' },
    'missing-branch': { label: '缺分支', color: 'orange', badgeStatus: 'warning' },
    unknown: { label: '待同步', color: 'default', badgeStatus: 'default' }
  }

  return status ? statusMap[status] : { label: '未检测', color: 'default', badgeStatus: 'default' }
}

function formatShortCommit(commitHash: string): string {
  return commitHash ? commitHash.slice(0, 7) : '-'
}

function getRemoteAlignmentDetail(alignment: RemoteAlignmentSummary): string {
  if (alignment.errorMessage) {
    return alignment.errorMessage
  }

  if (alignment.branchCount === 0) {
    return '没有本地远端引用'
  }

  return `${alignment.alignedBranchCount}/${alignment.branchCount} 个分支对齐`
}

function RemoteAlignmentBadge({ alignment }: { alignment: RemoteAlignmentSummary }): JSX.Element {
  const meta = getRemoteAlignmentStatusMeta(alignment.status)

  return (
    <Space direction="vertical" size={2}>
      <Badge status={meta.badgeStatus} text={<Typography.Text>{meta.label}</Typography.Text>} />
      <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: getRemoteAlignmentDetail(alignment) }}>
        company ↔ GitHub · {getRemoteAlignmentDetail(alignment)}
      </Typography.Text>
    </Space>
  )
}

function getProjectRemoteAlignmentStats(repositories: Repository[]): {
  aligned: number
  notAligned: number
  missing: number
  unknown: number
} {
  return repositories.reduce(
    (stats, repository) => {
      if (repository.remoteAlignment.status === 'aligned') {
        stats.aligned += 1
      } else if (repository.remoteAlignment.status === 'missing-remote') {
        stats.missing += 1
      } else if (repository.remoteAlignment.status === 'unknown') {
        stats.unknown += 1
      } else {
        stats.notAligned += 1
      }

      return stats
    },
    { aligned: 0, notAligned: 0, missing: 0, unknown: 0 }
  )
}

type GitGraphRow = GitCommit & {
  graphLanes: string[]
  graphLaneIndex: number
  graphParentLaneIndexes: number[]
}

function createGraphRows(commits: GitCommit[]): GitGraphRow[] {
  const rows: GitGraphRow[] = []
  const lanes: string[] = []

  for (const commit of commits) {
    let laneIndex = lanes.indexOf(commit.hash)

    if (laneIndex === -1) {
      laneIndex = lanes.length
      lanes.push(commit.hash)
    }

    const currentLanes = [...lanes]
    const parentLaneIndexes = commit.parentHashes.map((parentHash, parentIndex) => {
      if (parentIndex === 0) {
        return laneIndex
      }

      const existingLane = lanes.indexOf(parentHash)

      if (existingLane >= 0) {
        return existingLane
      }

      lanes.push(parentHash)
      currentLanes.push(parentHash)
      return lanes.length - 1
    })

    rows.push({
      ...commit,
      graphLanes: currentLanes,
      graphLaneIndex: laneIndex,
      graphParentLaneIndexes: parentLaneIndexes
    })

    if (commit.parentHashes.length === 0) {
      lanes.splice(laneIndex, 1)
    } else {
      lanes[laneIndex] = commit.parentHashes[0]
    }

    for (const parentHash of commit.parentHashes.slice(1)) {
      const parentLane = lanes.indexOf(parentHash)

      if (parentLane >= 0 && parentLane !== laneIndex) {
        lanes.splice(parentLane, 1)
      }
    }
  }

  return rows
}

function CommitGraphCell({ commit }: { commit: GitGraphRow }): JSX.Element {
  const isMerge = commit.parentHashes.length > 1
  const laneCount = Math.max(commit.graphLanes.length, commit.graphLaneIndex + 1, 1)
  const minLane = Math.min(commit.graphLaneIndex, ...commit.graphParentLaneIndexes)
  const maxLane = Math.max(commit.graphLaneIndex, ...commit.graphParentLaneIndexes)

  return (
    <div className="commit-graph-cell" style={{ gridTemplateColumns: `repeat(${laneCount}, 18px)` }}>
      {commit.graphLanes.map((laneHash, index) => (
        <span key={`${laneHash}-${index}`} className="commit-rail" style={{ gridColumn: index + 1 }} />
      ))}
      {isMerge && <span className="commit-connector" style={{ gridColumn: `${minLane + 1} / ${maxLane + 2}` }} />}
      <span className={isMerge ? 'commit-dot merge' : 'commit-dot'} style={{ gridColumn: commit.graphLaneIndex + 1 }} />
      {isMerge && <BranchesOutlined className="commit-merge-icon" style={{ gridColumn: maxLane + 1 }} />}
    </div>
  )
}

function DiffViewer({ diff, mode }: { diff: GitCommitDiff | null; mode: 'side-by-side' | 'inline' }): JSX.Element {
  if (!diff) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择文件后查看对比" />
  }

  if (diff.binary) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="二进制文件无法预览文本差异" />
  }

  if (mode === 'inline') {
    return <pre className="diff-pre inline">{diff.patch || '这个文件没有文本差异'}</pre>
  }

  return (
    <div className="diff-split">
      <pre className="diff-pre">{diff.oldContent}</pre>
      <pre className="diff-pre">{diff.newContent}</pre>
    </div>
  )
}

function createEmptySummary(projectId: string): ProjectGitSummary {
  return {
    projectId,
    status: 'not-analyzed',
    lastAnalyzedAt: '',
    errorMessage: '',
    totalCommits: 0,
    contributorCount: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    activeDays: 0,
    dailyMetrics: [],
    contributors: [],
    repositories: []
  }
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function createPresetRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1)
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end)
  }
}

function parseIdentityLines(value: string): Array<{ name: string; email: string }> {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*<(.+?)>$/)
      return match ? { name: match[1].trim(), email: match[2].trim() } : { name: line, email: '' }
    })
}

function formatIdentity(identity: { name: string; email: string }): string {
  return `${identity.name || '未命名'} <${identity.email || '未配置邮箱'}>`
}

function ChartPanel({ title, empty, option }: { title: string; empty: boolean; option: object }): JSX.Element {
  return (
    <div className="chart-panel">
      <Typography.Title level={4}>{title}</Typography.Title>
      {empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Git 分析数据" /> : <ReactECharts option={option} style={{ height: 260 }} />}
    </div>
  )
}

function RepositoryIdentityModal({
  repository,
  open,
  saving,
  onCancel,
  onSave,
  onClear
}: {
  repository: Pick<Repository, 'name' | 'localPath' | 'localUserName' | 'localUserEmail' | 'effectiveUserName' | 'effectiveUserEmail'> | null
  open: boolean
  saving: boolean
  onCancel: () => void
  onSave: (values: RepositoryIdentityForm) => void
  onClear: () => void
}): JSX.Element {
  const [form] = Form.useForm<RepositoryIdentityForm>()

  useEffect(() => {
    if (repository && open) {
      form.setFieldsValue({
        userName: repository.localUserName || repository.effectiveUserName,
        userEmail: repository.localUserEmail || repository.effectiveUserEmail
      })
    }
  }, [form, open, repository])

  return (
    <Modal
      title={repository ? `设置仓库身份：${repository.name}` : '设置仓库身份'}
      open={open}
      confirmLoading={saving}
      okText="保存到本仓库"
      cancelText="取消"
      onOk={() => form.validateFields().then(onSave)}
      onCancel={onCancel}
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space className="modal-footer">
          <Button danger disabled={!repository?.localUserName && !repository?.localUserEmail} onClick={onClear}>
            清除本仓库设置
          </Button>
          <Space>
            <CancelBtn />
            <OkBtn />
          </Space>
        </Space>
      )}
    >
      {repository && (
        <Space direction="vertical" className="repository-identity-modal" size={14}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="本地路径">{repository.localPath}</Descriptions.Item>
            <Descriptions.Item label="当前生效">
              {repository.effectiveUserName || '未配置'} / {repository.effectiveUserEmail || '未配置'}
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="info"
            showIcon
            message="这里会写入该仓库的 .git/config，等同于在仓库目录执行 git config user.name / user.email。"
          />
          <Form form={form} layout="vertical">
            <Form.Item name="userName" label="本仓库提交用户名" rules={[{ required: true, message: '请输入本仓库提交用户名' }]}>
              <Input placeholder="例如 Stone" />
            </Form.Item>
            <Form.Item
              name="userEmail"
              label="本仓库提交邮箱"
              rules={[
                { required: true, message: '请输入本仓库提交邮箱' },
                { type: 'email', message: '请输入有效邮箱' }
              ]}
            >
              <Input placeholder="you@example.com" />
            </Form.Item>
          </Form>
        </Space>
      )}
    </Modal>
  )
}

function SettingsPanel({ onCreateProject }: { onCreateProject: () => void }): JSX.Element {
  const [gitIdentityForm] = Form.useForm<GitIdentityForm>()
  const [sshKeyForm] = Form.useForm<SshKeyForm>()
  const [gitStatus, setGitStatus] = useState<GitSetupStatus | null>(null)
  const [loadingGit, setLoadingGit] = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [generatingSsh, setGeneratingSsh] = useState(false)
  const [copyingKeyPath, setCopyingKeyPath] = useState<string | null>(null)

  async function refreshGitStatus(): Promise<void> {
    if (!window.forgeDesk) {
      setGitStatus({
        gitAvailable: false,
        gitVersion: '',
        userName: '',
        userEmail: '',
        sshPublicKeys: []
      })
      return
    }

    setLoadingGit(true)

    try {
      const status = await window.forgeDesk.getGitSetupStatus()
      setGitStatus(status)
      gitIdentityForm.setFieldsValue({
        userName: status.userName,
        userEmail: status.userEmail
      })
      sshKeyForm.setFieldValue('keyEmail', status.userEmail)
    } finally {
      setLoadingGit(false)
    }
  }

  useEffect(() => {
    refreshGitStatus()
  }, [])

  const gitReady = Boolean(gitStatus?.gitAvailable && gitStatus.userName && gitStatus.userEmail)
  const sshReady = Boolean(gitStatus?.sshPublicKeys.length)

  async function saveGitIdentity(): Promise<void> {
    const values = await gitIdentityForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中配置 Git 身份')
      return
    }

    setSavingIdentity(true)

    try {
      const status = await window.forgeDesk.configureGitIdentity(values)
      setGitStatus(status)
      sshKeyForm.setFieldValue('keyEmail', status.userEmail)
      message.success('Git 身份已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingIdentity(false)
    }
  }

  async function generateSshKey(): Promise<void> {
    const values = await sshKeyForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中生成 SSH 公钥')
      return
    }

    setGeneratingSsh(true)

    try {
      const key = await window.forgeDesk.generateSshKey(values.keyEmail)
      await refreshGitStatus()
      message.success(`SSH 公钥已生成：${key.fileName}`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setGeneratingSsh(false)
    }
  }

  async function copyPublicKey(publicKeyPath: string): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中复制公钥')
      return
    }

    setCopyingKeyPath(publicKeyPath)

    try {
      await window.forgeDesk.copySshPublicKey(publicKeyPath)
      message.success('公钥内容已复制，可以粘贴到 GitHub / GitLab / Gitee')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCopyingKeyPath(null)
    }
  }

  async function openSshDirectory(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中打开 .ssh 目录')
      return
    }

    await window.forgeDesk.openSshDirectory()
  }

  async function openGitDownload(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中打开 Git 下载页')
      return
    }

    await window.forgeDesk.openGitDownload()
  }

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>设置</Typography.Title>
          <Typography.Text type="secondary">管理全局 Git / SSH 能力；项目创建和仓库扫描在项目页完成。</Typography.Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={onCreateProject}>
            去创建项目
          </Button>
          <Button icon={<ReloadOutlined />} loading={loadingGit} onClick={refreshGitStatus}>
            重新检测
          </Button>
        </Space>
      </div>

      <Steps
        className="setup-steps"
        current={gitReady ? (sshReady ? 1 : 1) : 0}
        items={[
          { title: 'Git 配置', icon: <SettingOutlined /> },
          { title: 'SSH 确认', icon: <KeyOutlined /> }
        ]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <div className="panel">
            <div className="panel-title">
              <Typography.Title level={4}>Git 账户</Typography.Title>
              <Tag color={gitReady ? 'green' : 'red'}>{gitReady ? '已配置' : '需要配置'}</Tag>
            </div>
            <Descriptions column={1} size="small" className="setup-description">
              <Descriptions.Item label="Git">{gitStatus?.gitVersion || '未检测到 git 命令'}</Descriptions.Item>
              <Descriptions.Item label="user.name">{gitStatus?.userName || '未配置'}</Descriptions.Item>
              <Descriptions.Item label="user.email">{gitStatus?.userEmail || '未配置'}</Descriptions.Item>
            </Descriptions>
            {!gitReady && (
              <div className="setup-action">
                <Alert
                  type={gitStatus?.gitAvailable ? 'warning' : 'error'}
                  showIcon
                  message={gitStatus?.gitAvailable ? '填写并保存 Git 全局身份' : '本机还没有可用的 Git'}
                  description={
                    gitStatus?.gitAvailable
                      ? 'ForgeDesk 会用这个身份做提交统计和人员映射基础。'
                      : '先安装 Git，然后回到这里重新检测。'
                  }
                />
                {gitStatus?.gitAvailable ? (
                  <Form form={gitIdentityForm} layout="vertical" className="inline-setup-form">
                    <Form.Item name="userName" label="提交用户名" rules={[{ required: true, message: '请输入提交用户名' }]}>
                      <Input placeholder="例如 Stone" />
                    </Form.Item>
                    <Form.Item
                      name="userEmail"
                      label="提交邮箱"
                      rules={[
                        { required: true, message: '请输入提交邮箱' },
                        { type: 'email', message: '请输入有效邮箱' }
                      ]}
                    >
                      <Input placeholder="you@example.com" />
                    </Form.Item>
                    <Button type="primary" icon={<SaveOutlined />} loading={savingIdentity} onClick={saveGitIdentity}>
                      保存 Git 身份
                    </Button>
                  </Form>
                ) : (
                  <Button icon={<DownloadOutlined />} onClick={openGitDownload}>
                    打开 Git 下载页
                  </Button>
                )}
              </div>
            )}
          </div>
        </Col>

        <Col xs={24} xl={12}>
          <div className="panel">
            <div className="panel-title">
              <Typography.Title level={4}>SSH 公钥</Typography.Title>
              <Tag color={sshReady ? 'green' : 'gold'}>{sshReady ? '已发现' : '未发现'}</Tag>
            </div>
            {sshReady ? (
              <List
                size="small"
                dataSource={gitStatus?.sshPublicKeys}
                renderItem={(key) => (
                  <List.Item
                    actions={[
                      <Button key="copy" size="small" icon={<CopyOutlined />} loading={copyingKeyPath === key.path} onClick={() => copyPublicKey(key.path)}>
                        复制公钥
                      </Button>
                    ]}
                  >
                    <List.Item.Meta title={key.fileName} description={key.fingerprint} />
                  </List.Item>
                )}
              />
            ) : (
              <div className="setup-action">
                <Alert type="warning" showIcon message="没有发现 ~/.ssh/*.pub" description="可以直接生成一个新的公钥，再复制到 GitHub / GitLab / Gitee 的 SSH Keys 设置里。" />
                <Form form={sshKeyForm} layout="vertical" className="inline-setup-form">
                  <Form.Item
                    name="keyEmail"
                    label="公钥备注邮箱"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效邮箱' }
                    ]}
                  >
                    <Input placeholder="you@example.com" disabled={!gitReady} />
                  </Form.Item>
                  <Space wrap>
                    <Button type="primary" icon={<KeyOutlined />} loading={generatingSsh} disabled={!gitReady} onClick={generateSshKey}>
                      生成 SSH 公钥
                    </Button>
                    <Button icon={<FolderOpenOutlined />} onClick={openSshDirectory}>
                      打开 .ssh 目录
                    </Button>
                  </Space>
                </Form>
                {!gitReady && <Typography.Text type="secondary">先保存 Git 身份后，再生成 SSH 公钥。</Typography.Text>}
              </div>
            )}
          </div>
        </Col>
      </Row>
    </section>
  )
}

function ProjectCard({
  project,
  selected,
  repositories,
  onSelect
}: {
  project: Project
  selected: boolean
  repositories: Repository[]
  onSelect: () => void
}): JSX.Element {
  const changedRepositories = repositories.filter((repository) => repository.hasChanges).length
  const aheadRepositories = repositories.filter((repository) => repository.ahead > 0).length
  const remoteCount = repositories.reduce((sum, repository) => sum + (repository.remoteCount || repository.remotes?.length || (repository.remoteUrl ? 1 : 0)), 0)
  const remoteAlignmentStats = getProjectRemoteAlignmentStats(repositories)

  return (
    <button className={`project-card${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      <div className="project-card-heading">
        <Typography.Title level={4}>{project.name}</Typography.Title>
        <Tag color={selected ? 'blue' : 'default'}>{selected ? '当前项目' : '项目'}</Tag>
      </div>
      <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: project.workspacePath }}>
        {project.workspacePath}
      </Typography.Text>
      <div className="project-card-metrics">
        <span>{repositories.length} 个仓库</span>
        <span>{remoteCount} 个远端</span>
        <span>{changedRepositories} 个有改动</span>
        <span>{aheadRepositories} 个未推送</span>
        <span>{remoteAlignmentStats.aligned} 个远端对齐</span>
      </div>
    </button>
  )
}

function CreateProjectModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const { createProject } = useForgeDeskStore()
  const [form] = Form.useForm<ImportForm>()
  const [gitStatus, setGitStatus] = useState<GitSetupStatus | null>(null)
  const [scannedRepositories, setScannedRepositories] = useState<ScannedRepository[]>([])
  const [loadingGit, setLoadingGit] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedRepository, setSelectedRepository] = useState<ScannedRepository | null>(null)
  const [savingRepositoryIdentity, setSavingRepositoryIdentity] = useState(false)

  async function refreshGitStatus(): Promise<void> {
    if (!window.forgeDesk) {
      setGitStatus({
        gitAvailable: false,
        gitVersion: '',
        userName: '',
        userEmail: '',
        sshPublicKeys: []
      })
      return
    }

    setLoadingGit(true)

    try {
      setGitStatus(await window.forgeDesk.getGitSetupStatus())
    } finally {
      setLoadingGit(false)
    }
  }

  useEffect(() => {
    if (open) {
      refreshGitStatus()
    }
  }, [open])

  const canScanRepositories = Boolean(gitStatus?.gitAvailable)

  async function chooseDirectory(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中选择目录')
      return
    }

    const path = await window.forgeDesk.selectDirectory()

    if (path) {
      form.setFieldValue('workspacePath', path)
    }
  }

  async function scanWorkspace(): Promise<void> {
    const values = await form.validateFields(['workspacePath'])

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中扫描仓库')
      return
    }

    if (!canScanRepositories) {
      message.warning('请先安装 Git 后再扫描仓库')
      return
    }

    setScanning(true)

    try {
      const repositories = await window.forgeDesk.scanWorkspace(values.workspacePath)
      setScannedRepositories(repositories)

      if (repositories.length === 0) {
        message.warning('没有在该目录下找到 Git 仓库')
      }
    } finally {
      setScanning(false)
    }
  }

  async function createProjectFromForm(): Promise<void> {
    const values = await form.validateFields()
    setCreating(true)

    try {
      await createProject(values.projectName, values.workspacePath, scannedRepositories)
      message.success(scannedRepositories.length > 0 ? '项目已创建并导入仓库' : '项目已创建，稍后可以扫描仓库')
      form.resetFields()
      setScannedRepositories([])
      onCreated()
      onClose()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCreating(false)
    }
  }

  async function saveRepositoryIdentity(values: RepositoryIdentityForm): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setSavingRepositoryIdentity(true)

    try {
      const repository = await window.forgeDesk.configureRepositoryIdentity(selectedRepository.localPath, values)
      setScannedRepositories((current) => current.map((item) => (item.id === repository.id ? repository : item)))
      setSelectedRepository(repository)
      message.success('本仓库 Git 身份已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingRepositoryIdentity(false)
    }
  }

  async function clearRepositoryIdentity(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setSavingRepositoryIdentity(true)

    try {
      const repository = await window.forgeDesk.clearRepositoryIdentity(selectedRepository.localPath)
      setScannedRepositories((current) => current.map((item) => (item.id === repository.id ? repository : item)))
      setSelectedRepository(repository)
      message.success('已清除本仓库设置，将继续继承全局配置')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingRepositoryIdentity(false)
    }
  }

  const repositoryColumns: ColumnsType<ScannedRepository> = [
    { title: '仓库', dataIndex: 'name', key: 'name', width: 160, render: (name) => <Typography.Text strong>{name}</Typography.Text> },
    { title: '本地路径', dataIndex: 'localPath', key: 'localPath', width: 260, render: (value) => <TableText value={value} /> },
    { title: '当前分支', dataIndex: 'currentBranch', key: 'currentBranch', width: 120 },
    { title: 'Git 身份', key: 'identity', width: 220, render: (_, repository) => <RepositoryIdentityCell repository={repository} /> },
    { title: '远程地址', dataIndex: 'remoteUrl', key: 'remoteUrl', width: 260, render: (value) => (value ? <TableText value={value} /> : <Typography.Text type="secondary">未配置</Typography.Text>) },
    { title: '双远端对齐', key: 'remoteAlignment', width: 190, render: (_, repository) => <RemoteAlignmentBadge alignment={repository.remoteAlignment} /> },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, repository) => <Badge status={repository.hasChanges ? 'warning' : 'success'} text={repository.hasChanges ? '有本地改动' : '干净'} />
    },
    {
      title: '设置',
      key: 'actions',
      width: 130,
      render: (_, repository) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => setSelectedRepository(repository)}>
          仓库身份
        </Button>
      )
    }
  ]

  return (
    <>
      <Modal
        title="创建项目"
        open={open}
        width="min(1120px, calc(100vw - 72px))"
        className="create-project-modal"
        okText="创建项目"
        cancelText="取消"
        confirmLoading={creating}
        onOk={createProjectFromForm}
        onCancel={onClose}
      >
        <Space direction="vertical" className="create-project-content" size={16}>
          <Alert
            type="info"
            showIcon
            message="项目可以先创建；Git 可用后再扫描目录下的仓库，SSH 只影响私有仓库远程访问。"
            action={
              <Button size="small" loading={loadingGit} onClick={refreshGitStatus}>
                检测 Git
              </Button>
            }
          />
          {!canScanRepositories && <Alert type="warning" showIcon message="当前未检测到 Git，仍可创建项目，但暂不能扫描仓库。" />}
          <Form form={form} layout="vertical" className="create-project-form" initialValues={{ projectName: '', workspacePath: '' }}>
            <Row gutter={[16, 14]}>
              <Col xs={24} lg={8}>
                <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                  <Input placeholder="例如 Cardpie" />
                </Form.Item>
              </Col>
              <Col xs={24} lg={16}>
                <Form.Item label="项目目录" required>
                  <Space.Compact className="directory-input">
                    <Form.Item name="workspacePath" noStyle rules={[{ required: true, message: '请选择或输入本地目录' }]}>
                      <Input placeholder="/Users/stone/Dev/your-project" />
                    </Form.Item>
                    <Button icon={<FolderOpenOutlined />} onClick={chooseDirectory}>
                      选择
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
            </Row>
            <div className="create-project-actions">
              <Button icon={<BranchesOutlined />} loading={scanning} disabled={!canScanRepositories} onClick={scanWorkspace}>
                扫描项目目录
              </Button>
            </div>
          </Form>
          <Table
            className="repository-preview"
            rowKey="id"
            columns={repositoryColumns}
            dataSource={scannedRepositories}
            size="middle"
            scroll={{ x: 'max-content', y: 280 }}
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="扫描项目目录后，会在这里显示归属到该项目的仓库" /> }}
          />
        </Space>
      </Modal>

      <RepositoryIdentityModal
        repository={selectedRepository}
        open={Boolean(selectedRepository)}
        saving={savingRepositoryIdentity}
        onCancel={() => setSelectedRepository(null)}
        onSave={saveRepositoryIdentity}
        onClear={clearRepositoryIdentity}
      />
    </>
  )
}

function ProjectOverview({ onCreateProject, onOpenSettings }: { onCreateProject: () => void; onOpenSettings: () => void }): JSX.Element {
  const { projects, repositories, selectedProjectId, summaries, setProjectSummary, setSelectedProjectId } = useForgeDeskStore()
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)
  const [analyzingProjectId, setAnalyzingProjectId] = useState<string | null>(null)
  const [rangePreset, setRangePreset] = useState('30')
  const [range, setRange] = useState(createPresetRange(30))
  const selectedProject = projects.find((project) => project.id === detailProjectId) ?? null
  const projectRepositories = selectedProject ? repositories.filter((repository) => repository.projectId === selectedProject.id) : []
  const changedRepositories = projectRepositories.filter((repository) => repository.hasChanges).length
  const aheadRepositories = projectRepositories.filter((repository) => repository.ahead > 0).length
  const remoteCount = projectRepositories.reduce((sum, repository) => sum + (repository.remoteCount || repository.remotes?.length || (repository.remoteUrl ? 1 : 0)), 0)
  const remoteAlignmentStats = getProjectRemoteAlignmentStats(projectRepositories)
  const summary = selectedProject ? summaries[selectedProject.id] ?? createEmptySummary(selectedProject.id) : null
  const dailyDates = summary?.dailyMetrics.map((metric) => metric.date) ?? []
  const hasGitData = Boolean(summary && summary.totalCommits > 0)

  async function refreshSummary(projectId: string, nextRange = range): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setProjectSummary(await window.forgeDesk.getProjectSummary(projectId, nextRange))
  }

  useEffect(() => {
    if (!selectedProject || !window.forgeDesk) {
      return
    }

    refreshSummary(selectedProject.id).catch((error) => message.error(getErrorMessage(error)))
  }, [selectedProject?.id, range.startDate, range.endDate])

  function updateRangePreset(value: string): void {
    setRangePreset(value)

    if (value !== 'custom') {
      setRange(createPresetRange(Number(value)))
    }
  }

  async function analyzeSelectedProject(): Promise<void> {
    if (!selectedProject || !window.forgeDesk) {
      return
    }

    setAnalyzingProjectId(selectedProject.id)

    try {
      const nextSummary = await window.forgeDesk.analyzeProjectGit(selectedProject.id)

      if (nextSummary.status === 'failed') {
        setProjectSummary(nextSummary)
        message.error(nextSummary.errorMessage || 'Git 分析失败')
        return
      }

      await refreshSummary(selectedProject.id)
      message.success('Git 数据已刷新')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setAnalyzingProjectId(null)
    }
  }

  const commitTrendOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 20, top: 28, bottom: 32 },
    xAxis: { type: 'category', data: dailyDates },
    yAxis: { type: 'value' },
    series: [{ name: '提交数', type: 'line', smooth: true, areaStyle: {}, data: summary?.dailyMetrics.map((metric) => metric.commits) ?? [] }]
  }

  const lineTrendOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 50, right: 20, top: 36, bottom: 32 },
    xAxis: { type: 'category', data: dailyDates },
    yAxis: { type: 'value' },
    series: [
      { name: '新增', type: 'line', smooth: true, data: summary?.dailyMetrics.map((metric) => metric.additions) ?? [] },
      { name: '删除', type: 'line', smooth: true, data: summary?.dailyMetrics.map((metric) => metric.deletions) ?? [] }
    ]
  }

  const contributorOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 20, top: 28, bottom: 52 },
    xAxis: { type: 'category', data: summary?.contributors.slice(0, 8).map((contributor) => contributor.name || contributor.email) ?? [], axisLabel: { rotate: 25 } },
    yAxis: { type: 'value' },
    series: [{ name: '提交数', type: 'bar', data: summary?.contributors.slice(0, 8).map((contributor) => contributor.commits) ?? [] }]
  }

  const repositoryOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        name: '仓库提交',
        type: 'pie',
        radius: ['42%', '68%'],
        data: summary?.repositories.map((repository) => ({ name: repository.repositoryName, value: repository.commits })) ?? []
      }
    ]
  }

  return (
    <section className="workspace-section project-workspace">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>项目</Typography.Title>
          <Typography.Text type="secondary">从项目进入仓库、趋势和人员映射管理。</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateProject}>
          创建项目
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="panel empty-project-panel">
          <Empty description="还没有项目" />
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateProject}>
              创建第一个项目
            </Button>
            <Button icon={<SettingOutlined />} onClick={onOpenSettings}>
              检查 Git/SSH 设置
            </Button>
          </Space>
        </div>
      ) : !selectedProject ? (
        <div className="project-list-page">
          <div className="project-list-panel">
            <div className="project-list-heading">
              <Typography.Title level={4}>项目列表</Typography.Title>
              <Button size="small" icon={<PlusOutlined />} onClick={onCreateProject} />
            </div>
            <div className="project-card-grid">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  selected={project.id === selectedProjectId}
                  repositories={repositories.filter((repository) => repository.projectId === project.id)}
                  onSelect={() => {
                    setSelectedProjectId(project.id)
                    setDetailProjectId(project.id)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="project-detail-page">

          <div className="project-detail-panel">
            <div className="project-detail-heading">
              <div className="project-title-stack">
                <Button onClick={() => setDetailProjectId(null)}>返回项目列表</Button>
                <div>
                  <Typography.Title level={3}>{selectedProject.name}</Typography.Title>
                  <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: selectedProject.workspacePath }}>
                    {selectedProject.workspacePath}
                  </Typography.Text>
                </div>
              </div>
              <Space wrap>
                {summary?.lastAnalyzedAt && <Typography.Text type="secondary">上次分析：{new Date(summary.lastAnalyzedAt).toLocaleString()}</Typography.Text>}
                <Button type="primary" icon={<ReloadOutlined />} loading={analyzingProjectId === selectedProject.id} disabled={projectRepositories.length === 0} onClick={analyzeSelectedProject}>
                  刷新 Git 数据
                </Button>
              </Space>
            </div>

            {summary?.status === 'failed' && <Alert className="analysis-alert" type="error" showIcon message="Git 分析失败" description={summary.errorMessage} />}

            <Tabs
              items={[
                {
                  key: 'overview',
                  label: '概览',
                  children: (
                    <>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={6}>
                          <div className="metric-tile">
                            <Statistic title="本地仓库数" value={projectRepositories.length} prefix={<GithubOutlined />} />
                          </div>
                        </Col>
                        <Col xs={24} md={6}>
                          <div className="metric-tile">
                            <Statistic title="远端数" value={remoteCount} prefix={<GithubOutlined />} />
                          </div>
                        </Col>
                        <Col xs={24} md={6}>
                          <div className="metric-tile">
                            <Statistic title="本地有改动" value={changedRepositories} prefix={<BranchesOutlined />} />
                          </div>
                        </Col>
                        <Col xs={24} md={6}>
                          <div className="metric-tile">
                            <Statistic title="未推送仓库" value={aheadRepositories} prefix={<DashboardOutlined />} />
                          </div>
                        </Col>
                      </Row>
                      <div className="remote-health-strip">
                        <Typography.Text strong>远端对齐</Typography.Text>
                        <Space wrap>
                          <Tag color="green">已对齐 {remoteAlignmentStats.aligned}</Tag>
                          <Tag color="orange">未对齐 {remoteAlignmentStats.notAligned}</Tag>
                          <Tag color="red">缺配置 {remoteAlignmentStats.missing}</Tag>
                          <Tag>待同步 {remoteAlignmentStats.unknown}</Tag>
                        </Space>
                      </div>
                      <ContributorTable contributors={summary?.contributors ?? []} />
                    </>
                  )
                },
                {
                  key: 'repositories',
                  label: '仓库',
                  children: <RepositoryTable repositories={projectRepositories} />
                },
                {
                  key: 'trends',
                  label: '趋势',
                  children: (
                    <>
                      <Space className="trend-toolbar" wrap>
                        <Button type={rangePreset === '7' ? 'primary' : 'default'} onClick={() => updateRangePreset('7')}>7 天</Button>
                        <Button type={rangePreset === '30' ? 'primary' : 'default'} onClick={() => updateRangePreset('30')}>30 天</Button>
                        <Button type={rangePreset === '90' ? 'primary' : 'default'} onClick={() => updateRangePreset('90')}>90 天</Button>
                        <Input
                          type="date"
                          value={range.startDate}
                          onChange={(event) => {
                            setRangePreset('custom')
                            setRange((current) => ({ ...current, startDate: event.target.value }))
                          }}
                        />
                        <Input
                          type="date"
                          value={range.endDate}
                          onChange={(event) => {
                            setRangePreset('custom')
                            setRange((current) => ({ ...current, endDate: event.target.value }))
                          }}
                        />
                      </Space>
                      <Row gutter={[16, 16]} className="summary-row">
                        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="提交数" value={summary?.totalCommits ?? 0} /></div></Col>
                        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="参与人数" value={summary?.contributorCount ?? 0} /></div></Col>
                        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="新增 / 删除" value={`${formatNumber(summary?.totalAdditions ?? 0)} / ${formatNumber(summary?.totalDeletions ?? 0)}`} /></div></Col>
                        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="活跃天数" value={summary?.activeDays ?? 0} /></div></Col>
                      </Row>
                      <Row gutter={[16, 16]} className="chart-grid">
                        <Col xs={24} xl={12}><ChartPanel title="提交趋势" empty={!hasGitData} option={commitTrendOption} /></Col>
                        <Col xs={24} xl={12}><ChartPanel title="代码增删趋势" empty={!hasGitData} option={lineTrendOption} /></Col>
                        <Col xs={24} xl={12}><ChartPanel title="人员工作量" empty={!hasGitData} option={contributorOption} /></Col>
                        <Col xs={24} xl={12}><ChartPanel title="仓库提交分布" empty={!hasGitData} option={repositoryOption} /></Col>
                      </Row>
                    </>
                  )
                },
                {
                  key: 'people',
                  label: '人员映射',
                  children: <ProjectPeopleMapping project={selectedProject} contributors={summary?.contributors ?? []} onChanged={() => refreshSummary(selectedProject.id)} />
                }
              ]}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function ContributorTable({ contributors }: { contributors: ContributorSummary[] }): JSX.Element {
  const columns: ColumnsType<ContributorSummary> = [
    {
      title: '人员',
      key: 'person',
      width: 260,
      render: (_, contributor) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong className="table-text" ellipsis={{ tooltip: contributor.name || contributor.email }}>
            {contributor.name || contributor.email}
          </Typography.Text>
          <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: contributor.email }}>
            {contributor.email}
          </Typography.Text>
        </Space>
      )
    },
    { title: '提交数', dataIndex: 'commits', key: 'commits', width: 110 },
    { title: '新增行', dataIndex: 'additions', key: 'additions', width: 120, render: (value) => formatNumber(value) },
    { title: '删除行', dataIndex: 'deletions', key: 'deletions', width: 120, render: (value) => formatNumber(value) },
    { title: '变更文件', dataIndex: 'filesChanged', key: 'filesChanged', width: 120 },
    { title: '活跃天数', dataIndex: 'activeDays', key: 'activeDays', width: 120 }
  ]

  return (
    <div className="panel contributor-panel">
      <Typography.Title level={4}>人员工作量</Typography.Title>
      <Table
        rowKey={(contributor) => contributor.email || contributor.name}
        columns={columns}
        dataSource={contributors}
        scroll={{ x: 850 }}
        pagination={false}
        locale={{ emptyText: <Empty description="刷新 Git 数据后，会在这里显示人员工作量" /> }}
      />
    </div>
  )
}

function ProjectPeopleMapping({ project, contributors, onChanged }: { project: Project; contributors: ContributorSummary[]; onChanged: () => void | Promise<void> }): JSX.Element {
  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [identities, setIdentities] = useState<GitContributorIdentity[]>([])
  const [editingPerson, setEditingPerson] = useState<ProjectPerson | null>(null)
  const [identitySeed, setIdentitySeed] = useState('')
  const [selectedPersonByIdentity, setSelectedPersonByIdentity] = useState<Record<string, string>>({})
  const [personModalOpen, setPersonModalOpen] = useState(false)
  const [form] = Form.useForm<{ displayName: string; role: string; identitiesText: string }>()

  async function loadPeople(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const [nextPeople, nextIdentities] = await Promise.all([window.forgeDesk.listProjectPeople(project.id), window.forgeDesk.listProjectContributorIdentities(project.id)])
    setPeople(nextPeople)
    setIdentities(nextIdentities)
  }

  useEffect(() => {
    loadPeople().catch((error) => message.error(getErrorMessage(error)))
  }, [project.id])

  const unmappedIdentities = identities.filter((identity) => !identity.mappedPersonId)

  function getIdentityRowKey(identity: GitContributorIdentity): string {
    return `${identity.name}<${identity.email}>`
  }

  function openPersonModal(person?: ProjectPerson, identity?: GitContributorIdentity): void {
    const identitiesText = person
      ? person.identities.map(formatIdentity).join('\n')
      : identity
        ? formatIdentity({ name: identity.name, email: identity.email })
        : identitySeed

    setEditingPerson(person ?? null)
    setIdentitySeed(identitiesText)
    setPersonModalOpen(true)
    form.setFieldsValue({
      displayName: person?.displayName ?? identity?.name ?? '',
      role: person?.role ?? '',
      identitiesText
    })
  }

  async function savePerson(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await form.validateFields()
    await window.forgeDesk.saveProjectPerson({
      id: editingPerson?.id,
      projectId: project.id,
      displayName: values.displayName,
      role: values.role,
      identities: parseIdentityLines(values.identitiesText)
    })
    message.success('人员映射已保存')
    setEditingPerson(null)
    setIdentitySeed('')
    setPersonModalOpen(false)
    form.resetFields()
    await onChanged()
    await loadPeople()
  }

  async function assignIdentityToPerson(identity: GitContributorIdentity, personId: string): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const person = people.find((item) => item.id === personId)

    if (!person) {
      message.warning('请先选择真实人员')
      return
    }

    await window.forgeDesk.saveProjectPerson({
      id: person.id,
      projectId: project.id,
      displayName: person.displayName,
      role: person.role,
      identities: [...person.identities.map((item) => ({ name: item.name, email: item.email })), { name: identity.name, email: identity.email }]
    })
    message.success(`已将 ${identity.name || identity.email} 归属到 ${person.displayName}`)
    await onChanged()
    await loadPeople()
  }

  async function deletePerson(person: ProjectPerson): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    Modal.confirm({
      title: `删除 ${person.displayName} 的映射？`,
      content: '删除后提交身份会回到未映射状态。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setPeople(await window.forgeDesk.deleteProjectPerson(project.id, person.id))
        setIdentities(await window.forgeDesk.listProjectContributorIdentities(project.id))
        await onChanged()
        await loadPeople()
      }
    })
  }

  const peopleColumns: ColumnsType<ProjectPerson> = [
    { title: '真实人员', dataIndex: 'displayName', key: 'displayName', render: (value, person) => <Space direction="vertical" size={2}><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{person.role || '无备注'}</Typography.Text></Space> },
    { title: 'Git 身份', key: 'identities', render: (_, person) => <Space direction="vertical" size={2}>{person.identities.map((identity) => <Tag key={identity.id}>{formatIdentity(identity)}</Tag>)}</Space> },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, person) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openPersonModal(person)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePerson(person)} />
        </Space>
      )
    }
  ]

  const identityColumns: ColumnsType<GitContributorIdentity> = [
    {
      title: '提交身份',
      key: 'identity',
      render: (_, identity) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong className="table-text" ellipsis={{ tooltip: identity.name || identity.email }}>
            {identity.name || identity.email}
          </Typography.Text>
          <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: identity.email }}>
            {identity.email}
          </Typography.Text>
        </Space>
      )
    },
    { title: '提交数', dataIndex: 'commits', key: 'commits', width: 100 },
    { title: '映射到', dataIndex: 'mappedPersonName', key: 'mappedPersonName', width: 140, render: (value) => value || <Typography.Text type="secondary">未映射</Typography.Text> },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_, identity) => {
        if (identity.mappedPersonId) {
          return <Tag color="blue">已映射</Tag>
        }

        const rowKey = getIdentityRowKey(identity)
        const selectedPersonId = selectedPersonByIdentity[rowKey]

        return (
          <Space>
            <Select
              size="small"
              placeholder="选择真实人员"
              value={selectedPersonId}
              style={{ width: 150 }}
              options={people.map((person) => ({ label: person.displayName, value: person.id }))}
              onChange={(value) => setSelectedPersonByIdentity((current) => ({ ...current, [rowKey]: value }))}
            />
            <Button size="small" disabled={!selectedPersonId} onClick={() => selectedPersonId && assignIdentityToPerson(identity, selectedPersonId)}>
              归属
            </Button>
            <Button size="small" icon={<UserAddOutlined />} onClick={() => openPersonModal(undefined, identity)}>
              新建
            </Button>
          </Space>
        )
      }
    }
  ]

  return (
    <Space direction="vertical" size={16} className="mapping-panel">
      <div className="panel-title">
        <Typography.Title level={4}>项目人员映射</Typography.Title>
        <Space>
          <Typography.Text type="secondary">{people.length} 人 / {unmappedIdentities.length} 个身份待映射</Typography.Text>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => openPersonModal()}>
          新增人员
          </Button>
        </Space>
      </div>
      <Table rowKey="id" columns={peopleColumns} dataSource={people} pagination={false} locale={{ emptyText: <Empty description="还没有人员映射" /> }} />
      <Typography.Title level={4}>提交身份</Typography.Title>
      <Table
        rowKey={getIdentityRowKey}
        columns={identityColumns}
        dataSource={identities}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty description="刷新 Git 数据后，会在这里显示提交身份" /> }}
      />
      <Modal title={editingPerson ? '编辑人员映射' : '新增人员映射'} open={personModalOpen} okText="保存" cancelText="取消" onOk={savePerson} onCancel={() => { setEditingPerson(null); setIdentitySeed(''); setPersonModalOpen(false); form.resetFields() }}>
        <Form form={form} layout="vertical">
          <Form.Item name="displayName" label="真实人员" rules={[{ required: true, message: '请输入真实人员名称' }]}>
            <Input placeholder="例如 Stone" />
          </Form.Item>
          <Form.Item name="role" label="备注">
            <Input placeholder="可选，例如团队、职责或备注" />
          </Form.Item>
          <Form.Item name="identitiesText" label="Git 身份" rules={[{ required: true, message: '请至少填写一个 Git 身份' }]}>
            <Input.TextArea rows={5} placeholder={'每行一个身份，例如：\nStone <stone@example.com>'} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

function RemoteAlignmentPanel({ alignment, currentBranch }: { alignment: RemoteAlignmentSummary; currentBranch: string }): JSX.Element {
  const meta = getRemoteAlignmentStatusMeta(alignment.status)
  const columns: ColumnsType<RemoteAlignmentBranch> = [
    {
      title: '分支',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 180,
      render: (branchName) => (
        <Space size={6} wrap>
          <Typography.Text strong={branchName === currentBranch}>{branchName}</Typography.Text>
          {branchName === currentBranch && <Tag color="blue">当前</Tag>}
        </Space>
      )
    },
    {
      title: 'company',
      key: 'company',
      width: 220,
      render: (_, branch) => (
        <Space direction="vertical" size={2}>
          <Typography.Text type="secondary">{branch.companyRef}</Typography.Text>
          <Tag color={branch.companyCommit ? 'default' : 'red'}>{formatShortCommit(branch.companyCommit)}</Tag>
        </Space>
      )
    },
    {
      title: 'GitHub CI/CD',
      key: 'github',
      width: 220,
      render: (_, branch) => (
        <Space direction="vertical" size={2}>
          <Typography.Text type="secondary">{branch.githubRef}</Typography.Text>
          <Tag color={branch.githubCommit ? 'default' : 'red'}>{formatShortCommit(branch.githubCommit)}</Tag>
        </Space>
      )
    },
    {
      title: '独有提交',
      key: 'ahead',
      width: 160,
      render: (_, branch) =>
        branch.status === 'diverged' ? (
          <Space direction="vertical" size={2}>
            <Typography.Text>company +{formatNumber(branch.companyAhead)}</Typography.Text>
            <Typography.Text>GitHub +{formatNumber(branch.githubAhead)}</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )
    },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, branch) => {
        const branchMeta = getRemoteAlignmentStatusMeta(branch.status)
        return <Tag color={branchMeta.color}>{branchMeta.label}</Tag>
      }
    }
  ]

  return (
    <div className="remote-alignment-panel">
      <div className="remote-alignment-heading">
        <Space direction="vertical" size={2}>
          <Typography.Title level={4}>双远端对齐</Typography.Title>
          <Typography.Text type="secondary">company 内部 Gitea ↔ GitHub CI/CD</Typography.Text>
        </Space>
        <Tag color={meta.color}>{meta.label}</Tag>
      </div>
      <Descriptions column={2} size="small" className="remote-alignment-remotes">
        <Descriptions.Item label="company">
          {alignment.companyRemoteUrl ? <TableText value={alignment.companyRemoteUrl} /> : <Typography.Text type="secondary">未配置</Typography.Text>}
        </Descriptions.Item>
        <Descriptions.Item label="GitHub CI/CD">
          {alignment.githubRemoteUrl ? <TableText value={alignment.githubRemoteUrl} /> : <Typography.Text type="secondary">未配置</Typography.Text>}
        </Descriptions.Item>
      </Descriptions>
      {alignment.errorMessage && <Alert type={alignment.status === 'unknown' ? 'warning' : 'error'} showIcon message={alignment.errorMessage} />}
      <Table
        rowKey="branchName"
        size="small"
        columns={columns}
        dataSource={alignment.branches}
        pagination={false}
        rowClassName={(branch) => (branch.branchName === currentBranch ? 'current-branch-row' : '')}
        scroll={{ x: 920 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="同步远端后显示分支对齐结果" /> }}
      />
    </div>
  )
}

function RepositoryTable({ repositories }: { repositories: Repository[] }): JSX.Element {
  const { setProjectSummary, updateRepository } = useForgeDeskStore()
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [detailRepository, setDetailRepository] = useState<Repository | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitRange, setCommitRange] = useState({ startDate: '', endDate: '' })
  const [commitBranch, setCommitBranch] = useState('')
  const [commitAuthor, setCommitAuthor] = useState('')
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
  const [commitFiles, setCommitFiles] = useState<GitCommitFileChange[]>([])
  const [selectedFile, setSelectedFile] = useState<GitCommitFileChange | null>(null)
  const [commitDiff, setCommitDiff] = useState<GitCommitDiff | null>(null)
  const [diffMode, setDiffMode] = useState<'side-by-side' | 'inline'>('side-by-side')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [syncingRepositoryId, setSyncingRepositoryId] = useState<string | null>(null)
  const [savingRepositoryIdentity, setSavingRepositoryIdentity] = useState(false)

  const filteredCommits = useMemo(
    () => commits.filter((commit) => !commitAuthor || `${commit.authorName} <${commit.authorEmail}>` === commitAuthor),
    [commitAuthor, commits]
  )
  const graphRows = useMemo(() => createGraphRows(filteredCommits), [filteredCommits])
  const authorOptions = useMemo(
    () =>
      Array.from(new Set(commits.map((commit) => `${commit.authorName} <${commit.authorEmail}>`)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [commits]
  )
  const branchOptions = useMemo(
    () =>
      detailRepository
        ? [
            ...detailRepository.branches.map((branch) => ({ label: branch, value: branch })),
            ...detailRepository.remoteBranches.map((branch) => ({ label: branch, value: branch }))
          ]
        : [],
    [detailRepository]
  )

  async function openRepositoryDetail(repository: Repository): Promise<void> {
    setDetailRepository(repository)
    setCommitBranch('')
    setCommitAuthor('')
    setCommitRange({ startDate: '', endDate: '' })
    setSelectedCommit(null)
    setCommitFiles([])
    setSelectedFile(null)
    setCommitDiff(null)
    setLoadingDetail(true)

    try {
      if (window.forgeDesk) {
        const detail = await window.forgeDesk.getRepositoryDetail(repository.id)
        updateRepository(detail)
        setDetailRepository(detail)
        setCommits(await window.forgeDesk.getRepositoryCommitGraph(detail.id))
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function refreshCommits(nextRange = commitRange, nextBranch = commitBranch): Promise<void> {
    if (!detailRepository || !window.forgeDesk) {
      return
    }

    setLoadingDetail(true)
    setSelectedCommit(null)
    setCommitFiles([])
    setSelectedFile(null)
    setCommitDiff(null)

    try {
      setCommits(
        await window.forgeDesk.getRepositoryCommitGraph(detailRepository.id, {
          ...nextRange,
          branchName: nextBranch || undefined
        })
      )
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function selectCommit(commit: GitCommit): Promise<void> {
    if (!detailRepository || !window.forgeDesk) {
      return
    }

    setSelectedCommit(commit)
    setSelectedFile(null)
    setCommitDiff(null)
    setLoadingFiles(true)

    try {
      setCommitFiles(await window.forgeDesk.listRepositoryCommitFiles(detailRepository.id, commit.hash))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingFiles(false)
    }
  }

  async function selectCommitFile(file: GitCommitFileChange): Promise<void> {
    if (!detailRepository || !selectedCommit || !window.forgeDesk) {
      return
    }

    setSelectedFile(file)
    setLoadingDiff(true)

    try {
      setCommitDiff(await window.forgeDesk.getRepositoryCommitDiff(detailRepository.id, selectedCommit.hash, file.path, file.oldPath, file.status))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingDiff(false)
    }
  }

  async function syncRemote(repository: Repository): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setSyncingRepositoryId(repository.id)

    try {
      const synced = await window.forgeDesk.syncRepositoryRemote(repository.id)
      updateRepository(synced)
      setDetailRepository(synced)
      setCommitBranch('')
      setCommitAuthor('')
      const nextCommits = await window.forgeDesk.getRepositoryCommitGraph(synced.id)
      setCommits(nextCommits)
      setSelectedCommit(null)
      setCommitFiles([])
      setSelectedFile(null)
      setCommitDiff(null)
      const summary = await window.forgeDesk.analyzeProjectGit(synced.projectId)
      setProjectSummary(summary)
      message.success('远端引用已同步，Git 数据已刷新')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSyncingRepositoryId(null)
    }
  }

  async function saveRepositoryIdentity(values: RepositoryIdentityForm): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setSavingRepositoryIdentity(true)

    try {
      const repository = await window.forgeDesk.configureRepositoryIdentity(selectedRepository.localPath, values)
      updateRepository(repository)
      setSelectedRepository({ ...selectedRepository, ...repository })
      if (detailRepository?.id === repository.id) {
        setDetailRepository({ ...detailRepository, ...repository })
      }
      message.success('本仓库 Git 身份已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingRepositoryIdentity(false)
    }
  }

  async function clearRepositoryIdentity(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setSavingRepositoryIdentity(true)

    try {
      const repository = await window.forgeDesk.clearRepositoryIdentity(selectedRepository.localPath)
      updateRepository(repository)
      setSelectedRepository({ ...selectedRepository, ...repository })
      if (detailRepository?.id === repository.id) {
        setDetailRepository({ ...detailRepository, ...repository })
      }
      message.success('已清除本仓库设置，将继续继承全局配置')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingRepositoryIdentity(false)
    }
  }

  const columns: ColumnsType<Repository> = useMemo(
    () => [
      { title: '仓库', dataIndex: 'name', key: 'name', width: 150, render: (name) => <Typography.Text strong>{name}</Typography.Text> },
      { title: '本地路径', dataIndex: 'localPath', key: 'localPath', width: 260, render: (value) => <TableText value={value} /> },
      { title: '远端数', dataIndex: 'remoteCount', key: 'remoteCount', width: 90 },
      { title: '本地分支', dataIndex: 'localBranchCount', key: 'localBranchCount', width: 100 },
      { title: '远端分支', dataIndex: 'remoteBranchCount', key: 'remoteBranchCount', width: 100 },
      { title: '当前分支', dataIndex: 'currentBranch', key: 'currentBranch', width: 120 },
      { title: '最近提交', dataIndex: 'latestCommit', key: 'latestCommit', width: 260, render: (value) => <TableText value={value} /> },
      { title: 'Git 身份', key: 'identity', width: 220, render: (_, repository) => <RepositoryIdentityCell repository={repository} /> },
      { title: '默认远端', dataIndex: 'remoteUrl', key: 'remoteUrl', width: 260, render: (value) => (value ? <TableText value={value} /> : <Typography.Text type="secondary">未配置</Typography.Text>) },
      { title: '远端对齐', key: 'remoteAlignment', width: 190, render: (_, repository) => <RemoteAlignmentBadge alignment={repository.remoteAlignment} /> },
      {
        title: '状态',
        key: 'status',
        width: 120,
        render: (_, repository) => <Badge status={repository.hasChanges ? 'warning' : 'success'} text={repository.hasChanges ? '有本地改动' : '干净'} />
      },
      { title: 'Ahead', dataIndex: 'ahead', key: 'ahead', width: 90, render: (ahead) => <Tag color={ahead > 0 ? 'blue' : 'default'}>{ahead}</Tag> },
      {
        title: '操作',
        key: 'actions',
        width: 190,
        render: (_, repository) => (
          <Space>
            <Button size="small" onClick={() => openRepositoryDetail(repository)}>详情</Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => setSelectedRepository(repository)}>
              身份
            </Button>
          </Space>
        )
      }
    ],
    []
  )

  return (
    <>
      <Table
        className="content-table"
        rowKey="id"
        columns={columns}
        dataSource={repositories}
        scroll={{ x: 1910 }}
        pagination={false}
        onRow={(repository) => ({ onDoubleClick: () => openRepositoryDetail(repository) })}
        locale={{ emptyText: <Empty description="这个项目下还没有仓库" /> }}
      />
      <Drawer
        title={detailRepository ? `仓库详情：${detailRepository.name}` : '仓库详情'}
        open={Boolean(detailRepository)}
        width={1280}
        onClose={() => setDetailRepository(null)}
      >
        {detailRepository && (
          <Space direction="vertical" size={16} className="repository-detail">
            <div className="repository-browser-header">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="本地路径">{detailRepository.localPath}</Descriptions.Item>
                <Descriptions.Item label="当前分支">{detailRepository.currentBranch}</Descriptions.Item>
                <Descriptions.Item label="最近提交">{detailRepository.latestCommit}</Descriptions.Item>
                <Descriptions.Item label="提交总数">{formatNumber(commits.length)}</Descriptions.Item>
              </Descriptions>
              <Button icon={<DownloadOutlined />} loading={syncingRepositoryId === detailRepository.id} onClick={() => syncRemote(detailRepository)}>
                同步远端
              </Button>
            </div>
            <RemoteAlignmentPanel alignment={detailRepository.remoteAlignment} currentBranch={detailRepository.currentBranch} />
            <div className="branch-list">
              {detailRepository.branches.map((branch) => <Tag key={branch} color={branch === detailRepository.currentBranch ? 'blue' : 'default'}>{branch}</Tag>)}
              {detailRepository.remoteBranches.map((branch) => <Tag key={branch} color="cyan">{branch}</Tag>)}
            </div>
            <div className="git-browser">
              <div className="panel-title">
                <Typography.Title level={4}>提交图谱</Typography.Title>
                <Space wrap>
                  <Select
                    allowClear
                    placeholder="全部引用"
                    value={commitBranch}
                    className="git-filter"
                    options={branchOptions}
                    onChange={(value) => {
                      const nextBranch = value ?? ''
                      setCommitBranch(nextBranch)
                      refreshCommits(commitRange, nextBranch)
                    }}
                  />
                  <Select
                    allowClear
                    placeholder="全部作者"
                    value={commitAuthor}
                    className="git-filter"
                    options={authorOptions.map((author) => ({ label: author, value: author }))}
                    onChange={(value) => setCommitAuthor(value ?? '')}
                  />
                  <Input
                    type="date"
                    value={commitRange.startDate}
                    onChange={(event) => {
                      const nextRange = { ...commitRange, startDate: event.target.value }
                      setCommitRange(nextRange)
                      refreshCommits(nextRange)
                    }}
                  />
                  <Input
                    type="date"
                    value={commitRange.endDate}
                    onChange={(event) => {
                      const nextRange = { ...commitRange, endDate: event.target.value }
                      setCommitRange(nextRange)
                      refreshCommits(nextRange)
                    }}
                  />
                </Space>
              </div>
              <div className="git-browser-grid">
                <Table
                  rowKey="id"
                  loading={loadingDetail}
                  size="small"
                  className="commit-table"
                  rowClassName={(commit) => (commit.hash === selectedCommit?.hash ? 'selected-row' : '')}
                  onRow={(commit) => ({ onClick: () => selectCommit(commit) })}
                  columns={[
                    { title: '', key: 'graph', width: 128, render: (_, commit) => <CommitGraphCell commit={commit} /> },
                    { title: '提交', dataIndex: 'shortHash', key: 'shortHash', width: 92, render: (value) => <Tag>{value}</Tag> },
                    {
                      title: '信息',
                      dataIndex: 'message',
                      key: 'message',
                      render: (value, commit) => (
                        <Space direction="vertical" size={2} className="commit-message-cell">
                          <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>
                          <Space size={4} wrap>
                            {commit.refs.slice(0, 4).map((ref) => <Tag key={ref} color={ref.startsWith('tag:') ? 'gold' : 'geekblue'}>{ref}</Tag>)}
                          </Space>
                        </Space>
                      )
                    },
                    { title: '提交人', key: 'author', width: 160, render: (_, commit) => <Space direction="vertical" size={2}><Typography.Text>{commit.authorName}</Typography.Text><Typography.Text type="secondary">{commit.authorEmail}</Typography.Text></Space> },
                    { title: '时间', dataIndex: 'committedAt', key: 'committedAt', width: 160, render: (value) => new Date(value).toLocaleString() },
                    { title: '+/-', key: 'lines', width: 96, render: (_, commit) => `${formatNumber(commit.additions)} / ${formatNumber(commit.deletions)}` }
                  ]}
                  dataSource={graphRows}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前范围没有提交" /> }}
                />
                <div className="commit-detail-panel">
                  {selectedCommit ? (
                    <Space direction="vertical" size={14} className="commit-detail-content">
                      <div>
                        <Typography.Text strong>{selectedCommit.message}</Typography.Text>
                        <div className="commit-meta">
                          <Tag>{selectedCommit.shortHash}</Tag>
                          <Typography.Text type="secondary">{selectedCommit.authorName} · {new Date(selectedCommit.committedAt).toLocaleString()}</Typography.Text>
                        </div>
                      </div>
                      <Table
                        rowKey="id"
                        size="small"
                        loading={loadingFiles}
                        dataSource={commitFiles}
                        pagination={false}
                        rowClassName={(file) => (file.id === selectedFile?.id ? 'selected-row' : '')}
                        onRow={(file) => ({ onClick: () => selectCommitFile(file) })}
                        columns={[
                          { title: '状态', dataIndex: 'status', key: 'status', width: 82, render: (status) => {
                            const label = getFileStatusLabel(status)
                            return <Tag color={label.color}>{label.label}</Tag>
                          } },
                          { title: '文件', dataIndex: 'path', key: 'path', render: (path, file) => <Space direction="vertical" size={2}><Typography.Text ellipsis={{ tooltip: path }}><FileTextOutlined /> {path}</Typography.Text>{file.oldPath && <Typography.Text type="secondary" ellipsis={{ tooltip: file.oldPath }}>原路径：{file.oldPath}</Typography.Text>}</Space> },
                          { title: '+/-', key: 'lines', width: 88, render: (_, file) => file.binary ? '二进制' : `${formatNumber(file.additions)} / ${formatNumber(file.deletions)}` }
                        ]}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个提交没有文件变更" /> }}
                      />
                      <div className="diff-toolbar">
                        <Typography.Title level={5}><DiffOutlined /> 文件对比</Typography.Title>
                        <Select
                          value={diffMode}
                          className="diff-mode-select"
                          options={[
                            { label: '左右对比', value: 'side-by-side' },
                            { label: '内联 diff', value: 'inline' }
                          ]}
                          onChange={setDiffMode}
                        />
                      </div>
                      <Spin spinning={loadingDiff}>
                        <DiffViewer diff={commitDiff} mode={diffMode} />
                      </Spin>
                    </Space>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择提交后查看文件对比" />
                  )}
                </div>
              </div>
            </div>
          </Space>
        )}
      </Drawer>
      <RepositoryIdentityModal
        repository={selectedRepository}
        open={Boolean(selectedRepository)}
        saving={savingRepositoryIdentity}
        onCancel={() => setSelectedRepository(null)}
        onSave={saveRepositoryIdentity}
        onClear={clearRepositoryIdentity}
      />
    </>
  )
}

function RepositoriesPanel({ repositories, onCreateProject, onOpenProject }: { repositories: Repository[]; onCreateProject: () => void; onOpenProject: () => void }): JSX.Element {
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>仓库</Typography.Title>
          <Typography.Text type="secondary">这里展示所有项目下的本地 Git 仓库。</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateProject}>
          创建项目
        </Button>
      </div>
      {repositories.length === 0 ? (
        <div className="panel empty-project-panel">
          <Empty description="还没有仓库" />
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateProject}>
              创建项目并扫描目录
            </Button>
            <Button onClick={onOpenProject}>去项目页</Button>
          </Space>
        </div>
      ) : (
        <RepositoryTable repositories={repositories} />
      )}
    </section>
  )
}

function PeoplePanel({ projects, summaries, onOpenProject }: { projects: Project[]; summaries: Record<string, ProjectGitSummary>; onOpenProject: () => void }): JSX.Element {
  const { setProjectSummary } = useForgeDeskStore()

  useEffect(() => {
    if (!window.forgeDesk) {
      return
    }

    for (const project of projects) {
      if (!summaries[project.id]) {
        window.forgeDesk.getProjectSummary(project.id).then(setProjectSummary).catch((error) => message.error(getErrorMessage(error)))
      }
    }
  }, [projects, setProjectSummary, summaries])

  const rows = projects.flatMap((project) => {
    const summary = summaries[project.id]

    return (summary?.contributors ?? []).map((contributor) => ({
      ...contributor,
      rowKey: `${project.id}:${contributor.personId || contributor.email || contributor.name}`,
      projectName: project.name
    }))
  })

  const columns: ColumnsType<ContributorSummary & { rowKey: string; projectName: string }> = [
    { title: '项目', dataIndex: 'projectName', key: 'projectName', width: 160 },
    {
      title: '人员',
      key: 'person',
      width: 260,
      render: (_, contributor) => (
        <Space direction="vertical" size={2}>
          <Space size={6}>
            <Typography.Text strong className="table-text" ellipsis={{ tooltip: contributor.name || contributor.email }}>
              {contributor.name || contributor.email}
            </Typography.Text>
            {contributor.personId && <Tag color="blue">已映射</Tag>}
          </Space>
          <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: contributor.email }}>
            {contributor.email}
          </Typography.Text>
        </Space>
      )
    },
    { title: '提交数', dataIndex: 'commits', key: 'commits', width: 110 },
    { title: '新增行', dataIndex: 'additions', key: 'additions', width: 120, render: (value) => formatNumber(value) },
    { title: '删除行', dataIndex: 'deletions', key: 'deletions', width: 120, render: (value) => formatNumber(value) },
    { title: '变更文件', dataIndex: 'filesChanged', key: 'filesChanged', width: 120 },
    { title: '活跃天数', dataIndex: 'activeDays', key: 'activeDays', width: 120 }
  ]

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>人员映射</Typography.Title>
          <Typography.Text type="secondary">这里展示按项目人员映射聚合后的贡献统计；映射编辑在项目详情里完成。</Typography.Text>
        </div>
        <Button type="primary" onClick={onOpenProject}>
          去项目详情
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="panel empty-project-panel">
          <Empty description={projects.length === 0 ? '还没有项目，创建项目后可分析人员贡献' : '刷新项目 Git 数据后，会在这里生成人员贡献'} />
          <Button type="primary" onClick={onOpenProject}>
            {projects.length === 0 ? '去创建项目' : '去项目页刷新 Git 数据'}
          </Button>
        </div>
      ) : (
        <div className="panel">
          <Table
            rowKey="rowKey"
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1010 }}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="暂无人员统计" /> }}
          />
        </div>
      )}
    </section>
  )
}

function App(): JSX.Element {
  const { projects, summaries, loadingWorkspace, loadWorkspace } = useForgeDeskStore()
  const [activeKey, setActiveKey] = useState('overview')
  const [creatingProject, setCreatingProject] = useState(false)

  useEffect(() => {
    loadWorkspace().catch((error) => message.error(getErrorMessage(error)))
  }, [loadWorkspace])

  const menuItems = [
    { key: 'overview', icon: <DashboardOutlined />, label: '项目' },
    { key: 'people', icon: <TeamOutlined />, label: '人员映射' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' }
  ]

  return (
    <Layout className="app-shell">
      <Layout.Sider width={236} theme="light" className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <GithubOutlined />
          </div>
          <div>
            <Typography.Title level={4}>ForgeDesk</Typography.Title>
            <Typography.Text type="secondary">Local First Console</Typography.Text>
          </div>
        </div>
        <Menu mode="inline" selectedKeys={[activeKey]} items={menuItems} onClick={({ key }) => setActiveKey(key)} />
      </Layout.Sider>
      <Layout.Content className="content">
        {loadingWorkspace && (
          <div className="loading-panel">
            <Spin />
          </div>
        )}
        {!loadingWorkspace && activeKey === 'settings' && (
          <SettingsPanel
            onCreateProject={() => {
              setActiveKey('overview')
              setCreatingProject(true)
            }}
          />
        )}
        {!loadingWorkspace && activeKey === 'overview' && <ProjectOverview onCreateProject={() => setCreatingProject(true)} onOpenSettings={() => setActiveKey('settings')} />}
        {!loadingWorkspace && activeKey === 'people' && <PeoplePanel projects={projects} summaries={summaries} onOpenProject={() => setActiveKey('overview')} />}
        <CreateProjectModal open={creatingProject} onClose={() => setCreatingProject(false)} onCreated={() => setActiveKey('overview')} />
      </Layout.Content>
    </Layout>
  )
}

export default App
