import {
  Alert,
  Badge,
  Button,
  Col,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
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
  UploadOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  AiSettingsView,
  AiConflictSuggestion,
  ContributorSummary,
  GitCommandResult,
  GitConflictFile,
  GitCommit,
  GitCommitDiff,
  GitCommitFileChange,
  GitContributorIdentity,
  GitOperationResult,
  GitRemote,
  GitStatusFile,
  GitWorkspaceStatus,
  Project,
  ProjectGitSummary,
  ProjectPerson,
  RemoteAlignmentBranch,
  RemoteAlignmentBranchStatus,
  RemoteAlignmentStatus,
  RemoteAlignmentSummary,
  Repository
} from './data'
import { createGitErrorGuidance, type GitErrorGuidance } from './git-error-guidance'
import { buildBranchGroups, createGraphRows, getRefTone, type GitGraphRow } from './git-log-view'
import { createEmptySshConfigEntry, parseSshConfigEntries, serializeSshConfigEntries, type SshConfigEntry } from './ssh-config-model'
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
  keyName: string
  keyEmail: string
}

type SshKeyImportForm = {
  sourcePath: string
  fileName: string
}

type SettingsModuleKey = 'overview' | 'git' | 'private' | 'public' | 'config' | 'ai'

type AiSettingsForm = {
  enabled: boolean
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

type SshConfigMode = 'guided' | 'raw'

type RepositoryIdentityForm = {
  userName: string
  userEmail: string
}

type ProjectSettingsForm = {
  name: string
  workspacePath: string
  description: string
  owner: string
}

type RepositoryRemoteForm = {
  name: string
  fetchUrl: string
  pushUrl: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function getPathFileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function getSshKeyKindLabel(kind: SshKeyKind): string {
  return kind === 'private' ? '私钥' : '公钥'
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

function GitErrorNotice({ guidance, onClose }: { guidance: GitErrorGuidance | null; onClose: () => void }): JSX.Element | null {
  if (!guidance) {
    return null
  }

  return (
    <Alert
      className="git-error-notice"
      type="error"
      showIcon
      closable
      onClose={onClose}
      message={guidance.title}
      description={
        <div className="git-error-notice-body">
          <Typography.Text>{guidance.summary}</Typography.Text>
          <div className="git-error-actions">
            <Typography.Text strong>下一步</Typography.Text>
            <ol>
              {guidance.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ol>
          </div>
          <Typography.Text className="git-error-raw" type="secondary" copyable>
            原始错误：{guidance.rawMessage}
          </Typography.Text>
        </div>
      }
    />
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

const graphLaneColors = ['#1677ff', '#13c2c2', '#722ed1', '#fa8c16', '#52c41a', '#eb2f96', '#2f54eb']
const graphLaneWidth = 16
const graphRowHeight = 46
const graphRowMiddle = graphRowHeight / 2
const graphLineOverflow = 2

function getGraphLaneColor(index: number): string {
  return graphLaneColors[index % graphLaneColors.length]
}

function CommitGraphCell({ commit }: { commit: GitGraphRow<GitCommit> }): JSX.Element {
  const isMerge = commit.parentHashes.length > 1
  const allLaneIndexes = [
    commit.graphLaneIndex,
    ...commit.graphParentLaneIndexes,
    ...commit.graphTopLaneIndexes,
    ...commit.graphBottomLaneIndexes
  ]
  const laneCount = Math.max(commit.graphLanes.length, ...allLaneIndexes.map((index) => index + 1), 1)
  const svgWidth = Math.max(42, laneCount * graphLaneWidth)
  const xForLane = (index: number): number => index * graphLaneWidth + graphLaneWidth / 2
  const connectorLaneIndexes = commit.graphParentLaneIndexes.filter((index) => index !== commit.graphLaneIndex)

  return (
    <div className="commit-graph-cell">
      <svg
        aria-hidden="true"
        className="commit-graph-svg"
        focusable="false"
        height={graphRowHeight}
        viewBox={`0 0 ${svgWidth} ${graphRowHeight}`}
        width={svgWidth}
      >
        {commit.graphTopLaneIndexes.map((laneIndex) => (
          <line
            key={`top-${laneIndex}`}
            className={laneIndex === commit.graphLaneIndex ? 'commit-graph-line is-active' : 'commit-graph-line'}
            stroke={getGraphLaneColor(laneIndex)}
            x1={xForLane(laneIndex)}
            x2={xForLane(laneIndex)}
            y1={-graphLineOverflow}
            y2={graphRowMiddle}
          />
        ))}
        {commit.graphBottomLaneIndexes.map((laneIndex) => (
          <line
            key={`bottom-${laneIndex}`}
            className={laneIndex === commit.graphLaneIndex ? 'commit-graph-line is-active' : 'commit-graph-line'}
            stroke={getGraphLaneColor(laneIndex)}
            x1={xForLane(laneIndex)}
            x2={xForLane(laneIndex)}
            y1={graphRowMiddle}
            y2={graphRowHeight + graphLineOverflow}
          />
        ))}
        {connectorLaneIndexes.map((laneIndex) => (
          <line
            key={`connector-${laneIndex}`}
            className="commit-graph-connector"
            stroke={getGraphLaneColor(laneIndex)}
            x1={xForLane(commit.graphLaneIndex)}
            x2={xForLane(laneIndex)}
            y1={graphRowMiddle}
            y2={graphRowMiddle}
          />
        ))}
        <circle
          className={isMerge ? 'commit-graph-dot merge' : 'commit-graph-dot'}
          cx={xForLane(commit.graphLaneIndex)}
          cy={graphRowMiddle}
          fill="#ffffff"
          r={isMerge ? 5.5 : 5}
          stroke={getGraphLaneColor(commit.graphLaneIndex)}
        />
      </svg>
    </div>
  )
}

function CommitAuthorCell({ commit }: { commit: GitCommit }): JSX.Element {
  const authorName = commit.authorName || '未知提交人'
  const authorText = commit.authorEmail ? `${authorName} · ${commit.authorEmail}` : authorName

  return (
    <span className="commit-author-cell" title={authorText}>
      <span className="commit-author-name">{authorName}</span>
      {commit.authorEmail && <span className="commit-author-email">{commit.authorEmail}</span>}
    </span>
  )
}

function CommitMessageCell({ commit }: { commit: GitCommit }): JSX.Element {
  return (
    <div className="source-tree-commit-message">
      <div className="source-tree-commit-line">
        <Tag className="source-tree-hash">{commit.shortHash}</Tag>
        <Typography.Text className="source-tree-message-text" ellipsis={{ tooltip: commit.message }}>
          {commit.message}
        </Typography.Text>
      </div>
      {commit.refs.length > 0 && (
        <div className="source-tree-ref-strip">
          {commit.refs.slice(0, 6).map((ref) => (
            <Tag key={ref} color={getRefTone(ref)} className="source-tree-ref">
              {ref}
            </Tag>
          ))}
          {commit.refs.length > 6 && <Tag className="source-tree-ref">+{commit.refs.length - 6}</Tag>}
        </div>
      )}
    </div>
  )
}

function CommitInlineDetail({
  commit,
  files,
  selectedFile,
  diff,
  diffMode,
  loadingFiles,
  loadingDiff,
  onSelectFile,
  onChangeDiffMode
}: {
  commit: GitCommit
  files: GitCommitFileChange[]
  selectedFile: GitCommitFileChange | null
  diff: GitCommitDiff | null
  diffMode: 'side-by-side' | 'inline'
  loadingFiles: boolean
  loadingDiff: boolean
  onSelectFile: (file: GitCommitFileChange) => void
  onChangeDiffMode: (mode: 'side-by-side' | 'inline') => void
}): JSX.Element {
  return (
    <div className="commit-inline-detail">
      <div className="commit-inline-heading">
        <div>
          <Typography.Text strong>{commit.message}</Typography.Text>
          <div className="commit-meta">
            <Tag>{commit.shortHash}</Tag>
            <Typography.Text type="secondary">
              {commit.authorName} · {new Date(commit.committedAt).toLocaleString()}
            </Typography.Text>
          </div>
        </div>
        <Select
          value={diffMode}
          className="diff-mode-select"
          options={[
            { label: '左右对比', value: 'side-by-side' },
            { label: '内联 diff', value: 'inline' }
          ]}
          onChange={onChangeDiffMode}
        />
      </div>
      <div className="commit-inline-grid">
        <Table
          rowKey="id"
          size="small"
          loading={loadingFiles}
          dataSource={files}
          pagination={false}
          rowClassName={(file) => (file.id === selectedFile?.id ? 'selected-row' : '')}
          onRow={(file) => ({ onClick: () => onSelectFile(file) })}
          columns={[
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 82,
              render: (status) => {
                const label = getFileStatusLabel(status)
                return <Tag color={label.color}>{label.label}</Tag>
              }
            },
            {
              title: '文件',
              dataIndex: 'path',
              key: 'path',
              render: (path, file) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text ellipsis={{ tooltip: path }}>
                    <FileTextOutlined /> {path}
                  </Typography.Text>
                  {file.oldPath && (
                    <Typography.Text type="secondary" ellipsis={{ tooltip: file.oldPath }}>
                      原路径：{file.oldPath}
                    </Typography.Text>
                  )}
                </Space>
              )
            },
            { title: '+/-', key: 'lines', width: 88, render: (_, file) => (file.binary ? '二进制' : `${formatNumber(file.additions)} / ${formatNumber(file.deletions)}`) }
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个提交没有文件变更" /> }}
        />
        <div className="commit-inline-diff">
          <Typography.Title level={5}>
            <DiffOutlined /> 文件对比
          </Typography.Title>
          <Spin spinning={loadingDiff}>
            <DiffViewer diff={diff} mode={diffMode} />
          </Spin>
        </div>
      </div>
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
  const [sshImportForm] = Form.useForm<SshKeyImportForm>()
  const [aiSettingsForm] = Form.useForm<AiSettingsForm>()
  const [gitStatus, setGitStatus] = useState<GitSetupStatus | null>(null)
  const [sshConfig, setSshConfig] = useState<SshConfigFile | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null)
  const [sshConfigContent, setSshConfigContent] = useState('')
  const [activeSettingsModule, setActiveSettingsModule] = useState<SettingsModuleKey>('overview')
  const [sshConfigMode, setSshConfigMode] = useState<SshConfigMode>('guided')
  const [sshConfigEntries, setSshConfigEntries] = useState<SshConfigEntry[]>([])
  const [sshImportKind, setSshImportKind] = useState<SshKeyKind>('private')
  const [sshImportModalOpen, setSshImportModalOpen] = useState(false)
  const [loadingGit, setLoadingGit] = useState(false)
  const [loadingSshConfig, setLoadingSshConfig] = useState(false)
  const [loadingAiSettings, setLoadingAiSettings] = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [savingSshConfig, setSavingSshConfig] = useState(false)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [generatingSsh, setGeneratingSsh] = useState(false)
  const [importingSshKey, setImportingSshKey] = useState(false)
  const [selectingImportFile, setSelectingImportFile] = useState(false)
  const [workingSshKeyPath, setWorkingSshKeyPath] = useState<string | null>(null)

  async function refreshGitStatus(): Promise<void> {
    if (!window.forgeDesk) {
      setGitStatus({
        gitAvailable: false,
        gitVersion: '',
        userName: '',
        userEmail: '',
        sshPublicKeys: [],
        sshPrivateKeys: []
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
      if (!sshKeyForm.getFieldValue('keyName')) {
        sshKeyForm.setFieldValue('keyName', 'github-work')
      }
    } finally {
      setLoadingGit(false)
    }
  }

  async function refreshSshConfig(): Promise<void> {
    if (!window.forgeDesk) {
      setSshConfig(null)
      setSshConfigContent('')
      return
    }

    setLoadingSshConfig(true)

    try {
      const config = await window.forgeDesk.readSshConfig()
      setSshConfig(config)
      setSshConfigContent(config.content)
      setSshConfigEntries(parseSshConfigEntries(config.content))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingSshConfig(false)
    }
  }

  async function refreshAiSettings(): Promise<void> {
    if (!window.forgeDesk) {
      setAiSettings(null)
      return
    }

    setLoadingAiSettings(true)

    try {
      const settings = await window.forgeDesk.getAiSettings()
      setAiSettings(settings)
      aiSettingsForm.setFieldsValue({
        enabled: settings.enabled,
        baseUrl: settings.baseUrl,
        apiKey: '',
        model: settings.model,
        temperature: settings.temperature
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingAiSettings(false)
    }
  }

  useEffect(() => {
    refreshGitStatus()
    refreshSshConfig()
    refreshAiSettings()
  }, [])

  const sshPrivateKeys = gitStatus?.sshPrivateKeys ?? []
  const sshPublicKeys = gitStatus?.sshPublicKeys ?? []
  const gitReady = Boolean(gitStatus?.gitAvailable && gitStatus.userName && gitStatus.userEmail)
  const aiReady = Boolean(aiSettings?.enabled && aiSettings.apiKeyConfigured && aiSettings.model)
  const sshReady = sshPrivateKeys.length + sshPublicKeys.length > 0
  const sshIssueCount =
    sshPrivateKeys.filter((key) => !key.hasPublicKey || key.needsPermissionFix).length + sshPublicKeys.filter((key) => !key.pairedPrivateKeyPath).length
  const sshIdentityFileOptions = sshPrivateKeys.map((key) => ({
    label: key.fileName,
    value: `~/.ssh/${key.fileName}`
  }))

  function updateSshConfigEntry(index: number, patch: Partial<SshConfigEntry>): void {
    setSshConfigEntries((entries) => entries.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry)))
  }

  function addSshConfigEntry(): void {
    setSshConfigEntries((entries) => [
      ...entries,
      {
        ...createEmptySshConfigEntry(),
        host: 'github-work',
        hostName: 'ssh.github.com',
        identityFile: sshIdentityFileOptions[0]?.value ?? ''
      }
    ])
  }

  function removeSshConfigEntry(index: number): void {
    setSshConfigEntries((entries) => entries.filter((_, currentIndex) => currentIndex !== index))
  }

  function changeSshConfigMode(nextMode: SshConfigMode): void {
    if (nextMode === 'guided') {
      setSshConfigEntries(parseSshConfigEntries(sshConfigContent))
    } else {
      setSshConfigContent(serializeSshConfigEntries(sshConfigEntries))
    }

    setSshConfigMode(nextMode)
  }

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

  async function saveAiSettings(): Promise<void> {
    const values = await aiSettingsForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中保存 AI 设置')
      return
    }

    setSavingAiSettings(true)

    try {
      const apiKey = values.apiKey?.trim()
      const settings = await window.forgeDesk.saveAiSettings({
        enabled: values.enabled,
        provider: 'openai-compatible',
        baseUrl: values.baseUrl,
        apiKey: apiKey || undefined,
        model: values.model,
        temperature: Number(values.temperature)
      })
      setAiSettings(settings)
      aiSettingsForm.setFieldValue('apiKey', '')
      message.success('AI 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingAiSettings(false)
    }
  }

  async function generateSshKey(): Promise<void> {
    const values = await sshKeyForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中生成 SSH 密钥')
      return
    }

    setGeneratingSsh(true)

    try {
      const key = await window.forgeDesk.generateSshKey({ keyName: values.keyName, email: values.keyEmail })
      await refreshGitStatus()
      message.success(`SSH 密钥已生成：${key.fileName}`)
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

    setWorkingSshKeyPath(publicKeyPath)

    try {
      await window.forgeDesk.copySshPublicKey(publicKeyPath)
      message.success('公钥内容已复制，可以粘贴到 GitHub / GitLab / Gitee')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingSshKeyPath(null)
    }
  }

  async function copySshKeyPath(path: string, kind: SshKeyKind): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中复制路径')
      return
    }

    setWorkingSshKeyPath(path)

    try {
      await window.forgeDesk.copySshKeyPath(path, kind)
      message.success(`${getSshKeyKindLabel(kind)}路径已复制`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingSshKeyPath(null)
    }
  }

  function openSshImportModal(kind: SshKeyKind): void {
    setSshImportKind(kind)
    setSshImportModalOpen(true)
    sshImportForm.resetFields()
  }

  async function selectSshImportFile(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中选择文件')
      return
    }

    setSelectingImportFile(true)

    try {
      const path = await window.forgeDesk.selectFile()
      if (!path) {
        return
      }

      sshImportForm.setFieldsValue({
        sourcePath: path,
        fileName: getPathFileName(path)
      })
    } finally {
      setSelectingImportFile(false)
    }
  }

  async function importSshKey(): Promise<void> {
    const values = await sshImportForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中导入 SSH 密钥')
      return
    }

    setImportingSshKey(true)

    try {
      const status = await window.forgeDesk.importSshKey({
        kind: sshImportKind,
        sourcePath: values.sourcePath,
        fileName: values.fileName
      })
      setGitStatus(status)
      setSshImportModalOpen(false)
      message.success(`${getSshKeyKindLabel(sshImportKind)}已导入`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setImportingSshKey(false)
    }
  }

  function deleteSshKey(path: string, kind: SshKeyKind): void {
    Modal.confirm({
      title: `删除 SSH ${getSshKeyKindLabel(kind)}`,
      content: `将从 ~/.ssh 中删除 ${getPathFileName(path)}，不会自动删除配对文件。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        if (!window.forgeDesk) {
          return
        }

        setWorkingSshKeyPath(path)

        try {
          const status = await window.forgeDesk.deleteSshKey(path, kind)
          setGitStatus(status)
          message.success(`${getSshKeyKindLabel(kind)}已删除`)
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setWorkingSshKeyPath(null)
        }
      }
    })
  }

  async function fixPrivateKeyPermissions(path: string): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setWorkingSshKeyPath(path)

    try {
      const status = await window.forgeDesk.fixSshPrivateKeyPermissions(path)
      setGitStatus(status)
      message.success('私钥权限已修复为 0600')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingSshKeyPath(null)
    }
  }

  async function derivePublicKey(path: string): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setWorkingSshKeyPath(path)

    try {
      const status = await window.forgeDesk.deriveSshPublicKey(path)
      setGitStatus(status)
      message.success('已从私钥生成公钥')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingSshKeyPath(null)
    }
  }

  async function saveSshConfig(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中保存 SSH config')
      return
    }

    setSavingSshConfig(true)

    try {
      const nextContent = sshConfigMode === 'guided' ? serializeSshConfigEntries(sshConfigEntries) : sshConfigContent
      const config = await window.forgeDesk.writeSshConfig(nextContent)
      setSshConfig(config)
      setSshConfigContent(config.content)
      setSshConfigEntries(parseSshConfigEntries(config.content))
      message.success('SSH config 已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingSshConfig(false)
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

  const settingsModules: Array<{
    key: Exclude<SettingsModuleKey, 'overview'>
    title: string
    description: string
    icon: JSX.Element
    meta: string
    tone: 'ok' | 'warning' | 'neutral' | 'danger'
  }> = [
    {
      key: 'git',
      title: 'Git 账户',
      description: '维护本机全局提交身份。',
      icon: <SettingOutlined />,
      meta: gitReady ? '已配置' : '需要配置',
      tone: gitReady ? 'ok' : 'danger'
    },
    {
      key: 'private',
      title: '私钥管理',
      description: '生成、导入、修复权限和生成 pub。',
      icon: <KeyOutlined />,
      meta: `${sshPrivateKeys.length} 个${sshPrivateKeys.some((key) => !key.hasPublicKey) ? ' · 缺 pub' : ''}`,
      tone: sshPrivateKeys.some((key) => !key.hasPublicKey || key.needsPermissionFix) ? 'warning' : sshPrivateKeys.length > 0 ? 'ok' : 'neutral'
    },
    {
      key: 'public',
      title: '公钥管理',
      description: '导入、复制和检查私钥配对。',
      icon: <CopyOutlined />,
      meta: `${sshPublicKeys.length} 个`,
      tone: sshPublicKeys.some((key) => !key.pairedPrivateKeyPath) ? 'warning' : sshPublicKeys.length > 0 ? 'ok' : 'neutral'
    },
    {
      key: 'config',
      title: 'SSH config',
      description: '绑定 Host、端口和 IdentityFile。',
      icon: <FileTextOutlined />,
      meta: sshConfig?.exists ? '已存在' : '未创建',
      tone: sshConfig?.exists ? 'ok' : 'neutral'
    },
    {
      key: 'ai',
      title: 'AI 助手',
      description: '配置合并冲突建议使用的模型。',
      icon: <SettingOutlined />,
      meta: aiReady ? '已启用' : aiSettings?.apiKeyConfigured ? '未启用' : '需要配置',
      tone: aiReady ? 'ok' : aiSettings?.apiKeyConfigured ? 'neutral' : 'warning'
    }
  ]

  function renderModuleHeader(title: string, description: string, actions?: JSX.Element): JSX.Element {
    return (
      <div className="settings-module-header">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </Space>
        <Space wrap>
          <Button onClick={() => setActiveSettingsModule('overview')}>返回总览</Button>
          {actions}
        </Space>
      </div>
    )
  }

  function renderGitModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          'Git 账户',
          '管理本机 Git 全局身份，仓库未单独配置时会继承这里。',
          <Button icon={<ReloadOutlined />} loading={loadingGit} onClick={refreshGitStatus}>
            重新检测
          </Button>
        )}
        <Descriptions column={1} size="small" className="setup-description">
          <Descriptions.Item label="Git">{gitStatus?.gitVersion || '未检测到 git 命令'}</Descriptions.Item>
          <Descriptions.Item label="user.name">{gitStatus?.userName || '未配置'}</Descriptions.Item>
          <Descriptions.Item label="user.email">{gitStatus?.userEmail || '未配置'}</Descriptions.Item>
        </Descriptions>
        {!gitStatus?.gitAvailable && (
          <Alert className="settings-module-alert" type="error" showIcon message="本机还没有可用的 Git" description="先安装 Git，然后回到这里重新检测。" />
        )}
        {gitStatus?.gitAvailable ? (
          <Form form={gitIdentityForm} layout="vertical" className="settings-management-form">
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
    )
  }

  function renderPrivateKeyCard(key: SshPrivateKeyRecord): JSX.Element {
    return (
      <div className={key.hasPublicKey ? 'ssh-key-card' : 'ssh-key-card ssh-key-card-warning'} key={key.path}>
        <div className="ssh-key-card-main">
          <Space direction="vertical" size={6}>
            <Space wrap>
              <Typography.Text strong>{key.fileName}</Typography.Text>
              <Tag color={key.hasPublicKey ? 'green' : 'gold'}>{key.hasPublicKey ? '已配对公钥' : '缺少 pub'}</Tag>
              <Tag color={key.needsPermissionFix ? 'orange' : 'green'}>权限 {key.mode}</Tag>
            </Space>
            <Typography.Text type="secondary" copyable className="ssh-key-path">
              {key.path}
            </Typography.Text>
            <Typography.Text type="secondary" className="ssh-key-fingerprint" ellipsis={{ tooltip: key.fingerprint }}>
              {key.fingerprint}
            </Typography.Text>
          </Space>
        </div>
        <Space wrap className="ssh-key-card-actions">
          <Button
            type={key.hasPublicKey ? 'default' : 'primary'}
            icon={<KeyOutlined />}
            loading={workingSshKeyPath === key.path}
            onClick={() => derivePublicKey(key.path)}
          >
            {key.hasPublicKey ? '更新 pub' : '生成 pub'}
          </Button>
          {key.needsPermissionFix && (
            <Button icon={<SaveOutlined />} loading={workingSshKeyPath === key.path} onClick={() => fixPrivateKeyPermissions(key.path)}>
              修复权限
            </Button>
          )}
          <Button icon={<CopyOutlined />} loading={workingSshKeyPath === key.path} onClick={() => copySshKeyPath(key.path, 'private')}>
            复制路径
          </Button>
          <Button danger icon={<DeleteOutlined />} loading={workingSshKeyPath === key.path} onClick={() => deleteSshKey(key.path, 'private')}>
            删除
          </Button>
        </Space>
      </div>
    )
  }

  function renderPublicKeyCard(key: SshPublicKeyRecord): JSX.Element {
    return (
      <div className="ssh-key-card" key={key.path}>
        <div className="ssh-key-card-main">
          <Space direction="vertical" size={6}>
            <Space wrap>
              <Typography.Text strong>{key.fileName}</Typography.Text>
              <Tag color={key.pairedPrivateKeyPath ? 'green' : 'gold'}>{key.pairedPrivateKeyPath ? '已配对私钥' : '独立公钥'}</Tag>
            </Space>
            <Typography.Text type="secondary" copyable className="ssh-key-path">
              {key.path}
            </Typography.Text>
            <Typography.Text type="secondary" className="ssh-key-fingerprint" ellipsis={{ tooltip: key.fingerprint }}>
              {key.fingerprint}
            </Typography.Text>
          </Space>
        </div>
        <Space wrap className="ssh-key-card-actions">
          <Button type="primary" icon={<CopyOutlined />} loading={workingSshKeyPath === key.path} onClick={() => copyPublicKey(key.path)}>
            复制公钥
          </Button>
          <Button icon={<CopyOutlined />} loading={workingSshKeyPath === key.path} onClick={() => copySshKeyPath(key.path, 'public')}>
            复制路径
          </Button>
          <Button danger icon={<DeleteOutlined />} loading={workingSshKeyPath === key.path} onClick={() => deleteSshKey(key.path, 'public')}>
            删除
          </Button>
        </Space>
      </div>
    )
  }

  function renderPrivateModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          '私钥管理',
          '私钥是访问远端仓库的身份凭据。缺少 pub 时可以直接从私钥生成。',
          <Button icon={<FolderOpenOutlined />} onClick={openSshDirectory}>
            打开 .ssh 目录
          </Button>
        )}
        <Form form={sshKeyForm} layout="vertical" className="settings-management-form">
          <Form.Item name="keyName" label="新密钥文件名" rules={[{ required: true, message: '请输入密钥文件名' }]}>
            <Input placeholder="github-work" />
          </Form.Item>
          <Form.Item
            name="keyEmail"
            label="公钥备注邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效邮箱' }
            ]}
          >
            <Input placeholder="you@example.com" />
          </Form.Item>
          <Space wrap>
            <Button type="primary" icon={<KeyOutlined />} loading={generatingSsh} onClick={generateSshKey}>
              生成一对密钥
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => openSshImportModal('private')}>
              导入私钥
            </Button>
          </Space>
        </Form>
        <div className="ssh-key-card-list">
          {sshPrivateKeys.length > 0 ? sshPrivateKeys.map(renderPrivateKeyCard) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无私钥" />}
        </div>
      </div>
    )
  }

  function renderPublicModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          '公钥管理',
          '公钥用于添加到 GitHub / GitLab / Gitee。它可以独立导入，也可以由私钥生成。',
          <Button icon={<UploadOutlined />} onClick={() => openSshImportModal('public')}>
            导入公钥
          </Button>
        )}
        <div className="ssh-key-card-list">
          {sshPublicKeys.length > 0 ? sshPublicKeys.map(renderPublicKeyCard) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无公钥" />}
        </div>
      </div>
    )
  }

  function renderSshConfigEntryCard(entry: SshConfigEntry, index: number): JSX.Element {
    return (
      <div className="ssh-config-entry-card" key={`${entry.host}-${index}`}>
        <div className="ssh-config-entry-heading">
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{entry.host || '未命名 Host'}</Typography.Text>
            <Typography.Text type="secondary">{entry.hostName || '未填写 HostName'}</Typography.Text>
          </Space>
          <Button danger icon={<DeleteOutlined />} onClick={() => removeSshConfigEntry(index)}>
            删除
          </Button>
        </div>

        <div className="ssh-config-entry-grid">
          <label className="ssh-config-field">
            <span>主机别名</span>
            <Input value={entry.host} placeholder="github.com 或 ssh.cardpie.pro" onChange={(event) => updateSshConfigEntry(index, { host: event.target.value })} />
          </label>
          <label className="ssh-config-field">
            <span>实际主机</span>
            <Input value={entry.hostName} placeholder="ssh.github.com" onChange={(event) => updateSshConfigEntry(index, { hostName: event.target.value })} />
          </label>
          <label className="ssh-config-field">
            <span>登录用户</span>
            <Input value={entry.user} placeholder="git" onChange={(event) => updateSshConfigEntry(index, { user: event.target.value })} />
          </label>
          <label className="ssh-config-field">
            <span>端口</span>
            <Input value={entry.port} placeholder="22" onChange={(event) => updateSshConfigEntry(index, { port: event.target.value })} />
          </label>
          <label className="ssh-config-field is-wide">
            <span>私钥文件</span>
            <Select
              allowClear
              showSearch
              value={entry.identityFile || undefined}
              placeholder="选择或输入私钥路径"
              options={sshIdentityFileOptions}
              onChange={(value) => updateSshConfigEntry(index, { identityFile: value ?? '' })}
              onSearch={(value) => updateSshConfigEntry(index, { identityFile: value })}
            />
          </label>
          <label className="ssh-config-field">
            <span>仅用指定私钥</span>
            <Select
              allowClear
              value={entry.identitiesOnly || undefined}
              options={[
                { label: 'yes', value: 'yes' },
                { label: 'no', value: 'no' }
              ]}
              onChange={(value) => updateSshConfigEntry(index, { identitiesOnly: value ?? '' })}
            />
          </label>
        </div>

        <Collapse
          className="ssh-config-entry-advanced"
          ghost
          items={[
            {
              key: 'advanced',
              label: '高级选项',
              children: (
                <div className="ssh-config-entry-grid">
                  <label className="ssh-config-field">
                    <span>认证方式</span>
                    <Input
                      value={entry.preferredAuthentications}
                      placeholder="publickey"
                      onChange={(event) => updateSshConfigEntry(index, { preferredAuthentications: event.target.value })}
                    />
                  </label>
                  <label className="ssh-config-field">
                    <span>保活间隔（秒）</span>
                    <Input value={entry.serverAliveInterval} placeholder="10" onChange={(event) => updateSshConfigEntry(index, { serverAliveInterval: event.target.value })} />
                  </label>
                  <label className="ssh-config-field">
                    <span>保活失败次数</span>
                    <Input value={entry.serverAliveCountMax} placeholder="30" onChange={(event) => updateSshConfigEntry(index, { serverAliveCountMax: event.target.value })} />
                  </label>
                  <label className="ssh-config-field">
                    <span>连接超时（秒）</span>
                    <Input value={entry.connectTimeout} placeholder="120" onChange={(event) => updateSshConfigEntry(index, { connectTimeout: event.target.value })} />
                  </label>
                  <label className="ssh-config-field">
                    <span>TCP 保活</span>
                    <Select
                      allowClear
                      value={entry.tcpKeepAlive || undefined}
                      options={[
                        { label: 'yes', value: 'yes' },
                        { label: 'no', value: 'no' }
                      ]}
                      onChange={(value) => updateSshConfigEntry(index, { tcpKeepAlive: value ?? '' })}
                    />
                  </label>
                  <label className="ssh-config-field">
                    <span>网络服务质量</span>
                    <Input value={entry.ipQoS} placeholder="lowdelay throughput" onChange={(event) => updateSshConfigEntry(index, { ipQoS: event.target.value })} />
                  </label>
                </div>
              )
            }
          ]}
        />
      </div>
    )
  }

  function renderConfigModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          'SSH config',
          sshConfig?.path || '~/.ssh/config',
          <Button icon={<FolderOpenOutlined />} onClick={openSshDirectory}>
            打开 .ssh 目录
          </Button>
        )}
        <div className="ssh-config-mode-toolbar">
          <Segmented
            value={sshConfigMode}
            options={[
              { label: '配置向导', value: 'guided' },
              { label: '直接编辑文件', value: 'raw' }
            ]}
            onChange={(value) => changeSshConfigMode(value as SshConfigMode)}
          />
          {sshConfigMode === 'guided' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={addSshConfigEntry}>
              新增 Host
            </Button>
          )}
        </div>

        {sshConfigMode === 'guided' ? (
          <div className="ssh-config-guided">
            {sshConfigEntries.length > 0 ? (
              sshConfigEntries.map(renderSshConfigEntryCard)
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Host 配置">
                <Button type="primary" icon={<PlusOutlined />} onClick={addSshConfigEntry}>
                  新增 Host
                </Button>
              </Empty>
            )}
          </div>
        ) : (
          <Input.TextArea
            className="ssh-config-editor"
            value={sshConfigContent}
            onChange={(event) => setSshConfigContent(event.target.value)}
            placeholder={[
              'Host github-work',
              '  HostName ssh.github.com',
              '  User git',
              '  Port 443',
              '  IdentityFile ~/.ssh/id_ed25519_work'
            ].join('\n')}
            autoSize={{ minRows: 12, maxRows: 24 }}
            disabled={loadingSshConfig || savingSshConfig}
          />
        )}
        <Space wrap className="ssh-config-actions">
          <Button type="primary" icon={<SaveOutlined />} loading={savingSshConfig} onClick={saveSshConfig}>
            保存 SSH config
          </Button>
          <Button icon={<ReloadOutlined />} loading={loadingSshConfig} onClick={refreshSshConfig}>
            重新读取
          </Button>
        </Space>
      </div>
    )
  }

  function renderAiModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          'AI 助手',
          '配置 OpenAI-compatible 模型，用于生成合并冲突解决建议。',
          <Button icon={<ReloadOutlined />} loading={loadingAiSettings} onClick={refreshAiSettings}>
            重新读取
          </Button>
        )}
        <Alert
          className="settings-module-alert"
          type={aiReady ? 'success' : 'info'}
          showIcon
          message={aiReady ? 'AI 冲突助手已启用' : '保存 API Key 后，项目里的 Git 工作区可以请求合并建议'}
          description={aiSettings?.apiKeyConfigured ? 'API Key 已保存，本页不会回显密钥内容。' : 'API Key 只保存在本机应用数据目录，用于请求你配置的模型服务。'}
        />
        <Form form={aiSettingsForm} layout="vertical" className="settings-management-form">
          <div className="ai-settings-grid">
            <Form.Item name="enabled" label="启用状态" rules={[{ required: true, message: '请选择启用状态' }]}>
              <Select
                options={[
                  { label: '启用', value: true },
                  { label: '停用', value: false }
                ]}
              />
            </Form.Item>
            <Form.Item name="model" label="模型" rules={[{ required: true, message: '请输入模型名称' }]}>
              <Input placeholder="gpt-4.1-mini" />
            </Form.Item>
            <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature" rules={[{ required: true, message: '请输入 Temperature' }]}>
              <InputNumber min={0} max={1} step={0.1} className="full-width-control" />
            </Form.Item>
          </div>
          <Form.Item name="apiKey" label={aiSettings?.apiKeyConfigured ? 'API Key（留空则沿用已保存密钥）' : 'API Key'}>
            <Input.Password placeholder={aiSettings?.apiKeyConfigured ? '已保存，留空不变' : 'sk-...'} />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} loading={savingAiSettings} onClick={saveAiSettings}>
            保存 AI 设置
          </Button>
        </Form>
      </div>
    )
  }

  function renderOverview(): JSX.Element {
    return (
      <div className="settings-module-grid">
        {settingsModules.map((module) => (
          <button
            className={`settings-entry-card settings-entry-card-${module.tone}`}
            key={module.key}
            type="button"
            onClick={() => setActiveSettingsModule(module.key)}
          >
            <span className="settings-entry-icon">{module.icon}</span>
            <span className="settings-entry-copy">
              <Typography.Text strong>{module.title}</Typography.Text>
              <Typography.Text type="secondary">{module.description}</Typography.Text>
            </span>
            <Tag color={module.tone === 'ok' ? 'green' : module.tone === 'warning' ? 'gold' : module.tone === 'danger' ? 'red' : 'default'}>{module.meta}</Tag>
          </button>
        ))}
      </div>
    )
  }

  function renderActiveSettingsModule(): JSX.Element {
    switch (activeSettingsModule) {
      case 'git':
        return renderGitModule()
      case 'private':
        return renderPrivateModule()
      case 'public':
        return renderPublicModule()
      case 'config':
        return renderConfigModule()
      case 'ai':
        return renderAiModule()
      default:
        return renderOverview()
    }
  }

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>设置</Typography.Title>
          <Typography.Text type="secondary">管理本机 Git / SSH 能力。</Typography.Text>
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

      {renderActiveSettingsModule()}

      <Modal
        title={`导入 SSH ${getSshKeyKindLabel(sshImportKind)}`}
        open={sshImportModalOpen}
        okText="导入"
        cancelText="取消"
        confirmLoading={importingSshKey}
        onOk={importSshKey}
        onCancel={() => setSshImportModalOpen(false)}
      >
        <Form form={sshImportForm} layout="vertical">
          <Form.Item name="sourcePath" label="来源文件" rules={[{ required: true, message: '请选择来源文件' }]}>
            <Input
              placeholder={sshImportKind === 'private' ? '/Users/you/.ssh/id_ed25519' : '/Users/you/.ssh/id_ed25519.pub'}
              addonAfter={
                <Button type="link" size="small" loading={selectingImportFile} onClick={selectSshImportFile}>
                  选择
                </Button>
              }
            />
          </Form.Item>
          <Form.Item name="fileName" label="保存为" rules={[{ required: true, message: '请输入保存文件名' }]}>
            <Input placeholder={sshImportKind === 'private' ? 'github-work' : 'github-work.pub'} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}

function RepositoryRemoteManager({ repositories }: { repositories: Repository[] }): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [editingRemote, setEditingRemote] = useState<GitRemote | null>(null)
  const [remoteModalOpen, setRemoteModalOpen] = useState(false)
  const [savingRemote, setSavingRemote] = useState(false)
  const [fetchingRemoteKey, setFetchingRemoteKey] = useState<string | null>(null)
  const [gitError, setGitError] = useState<GitErrorGuidance | null>(null)
  const [remoteForm] = Form.useForm<RepositoryRemoteForm>()
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null

  useEffect(() => {
    if (repositories.length === 0) {
      setRepositoryId('')
      return
    }

    if (!repositories.some((repository) => repository.id === repositoryId)) {
      setRepositoryId(repositories[0].id)
    }
  }, [repositories, repositoryId])

  function openRemoteModal(remote?: GitRemote): void {
    setEditingRemote(remote ?? null)
    setRemoteModalOpen(true)
    remoteForm.setFieldsValue({
      name: remote?.name ?? '',
      fetchUrl: remote?.fetchUrl ?? '',
      pushUrl: remote?.pushUrl ?? remote?.fetchUrl ?? ''
    })
  }

  async function saveRemote(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const values = await remoteForm.validateFields()
    setSavingRemote(true)

    try {
      const repository = await window.forgeDesk.saveRepositoryRemote({
        repositoryId: selectedRepository.id,
        currentName: editingRemote?.name,
        name: values.name,
        fetchUrl: values.fetchUrl,
        pushUrl: values.pushUrl || values.fetchUrl
      })
      updateRepository(repository)
      setRemoteModalOpen(false)
      setEditingRemote(null)
      setGitError(null)
      remoteForm.resetFields()
      message.success('远端配置已保存')
    } catch (error) {
      setGitError(createGitErrorGuidance(error, editingRemote ? '保存远端' : '新增远端'))
    } finally {
      setSavingRemote(false)
    }
  }

  async function fetchRemote(remoteName?: string): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const loadingKey = remoteName ? `${selectedRepository.id}:${remoteName}` : `${selectedRepository.id}:all`
    setFetchingRemoteKey(loadingKey)

    try {
      const repository = await window.forgeDesk.fetchRepositoryRemote(selectedRepository.id, remoteName)
      updateRepository(repository)
      setGitError(null)
      message.success(remoteName ? `${remoteName} 已 fetch/prune` : '全部远端已 fetch/prune')
    } catch (error) {
      setGitError(createGitErrorGuidance(error, remoteName ? `同步远端 ${remoteName}` : '同步全部远端'))
    } finally {
      setFetchingRemoteKey(null)
    }
  }

  function confirmDeleteRemote(remote: GitRemote): void {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    Modal.confirm({
      title: `删除远端 ${remote.name}？`,
      content: '删除后只会移除本仓库 remote 配置，不会删除远端仓库。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const repository = await window.forgeDesk.deleteRepositoryRemote(selectedRepository.id, remote.name)
          updateRepository(repository)
          setGitError(null)
          message.success('远端已删除')
        } catch (error) {
          setGitError(createGitErrorGuidance(error, `删除远端 ${remote.name}`))
        }
      }
    })
  }

  if (repositories.length === 0) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="这个项目下还没有仓库，无法管理远端" />
      </div>
    )
  }

  const remoteColumns: ColumnsType<GitRemote> = [
    { title: '远端', dataIndex: 'name', key: 'name', width: 140, render: (name) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'Fetch URL', dataIndex: 'fetchUrl', key: 'fetchUrl', render: (value) => <TableText value={value || '未配置'} /> },
    { title: 'Push URL', dataIndex: 'pushUrl', key: 'pushUrl', render: (value) => <TableText value={value || '未配置'} /> },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_, remote) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openRemoteModal(remote)}>
            编辑
          </Button>
          <Button size="small" icon={<DownloadOutlined />} loading={fetchingRemoteKey === `${selectedRepository?.id}:${remote.name}`} onClick={() => fetchRemote(remote.name)}>
            Fetch
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeleteRemote(remote)} />
        </Space>
      )
    }
  ]

  return (
    <div className="remote-manager">
      <div className="remote-manager-toolbar">
        <Select
          value={selectedRepository?.id}
          className="settings-repository-select"
          options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
          onChange={setRepositoryId}
        />
        <Space wrap>
          <Button icon={<DownloadOutlined />} loading={fetchingRemoteKey === `${selectedRepository?.id}:all`} onClick={() => fetchRemote()}>
            Fetch 全部
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openRemoteModal()}>
            新增远端
          </Button>
        </Space>
      </div>
      <GitErrorNotice guidance={gitError} onClose={() => setGitError(null)} />
      <Table
        rowKey="name"
        size="small"
        columns={remoteColumns}
        dataSource={selectedRepository?.remotes ?? []}
        pagination={false}
        scroll={{ x: 900 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前仓库还没有远端" /> }}
      />
      <Modal
        title={editingRemote ? `编辑远端：${editingRemote.name}` : '新增远端'}
        open={remoteModalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingRemote}
        onOk={saveRemote}
        onCancel={() => {
          setRemoteModalOpen(false)
          setEditingRemote(null)
          remoteForm.resetFields()
        }}
      >
        <Form form={remoteForm} layout="vertical">
          <Form.Item
            name="name"
            label="远端名称"
            rules={[
              { required: true, message: '请输入远端名称' },
              { pattern: /^[A-Za-z0-9._-]+$/, message: '只能包含字母、数字、点、下划线和短横线' }
            ]}
          >
            <Input placeholder="例如 origin 或 company" />
          </Form.Item>
          <Form.Item name="fetchUrl" label="Fetch URL" rules={[{ required: true, message: '请输入 Fetch URL' }]}>
            <Input placeholder="git@github.com:team/repo.git" />
          </Form.Item>
          <Form.Item name="pushUrl" label="Push URL">
            <Input placeholder="默认使用 Fetch URL" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function getWorkspaceFileStatusLabel(file: GitStatusFile): { label: string; color: string } {
  if (file.conflict) {
    return { label: '冲突', color: 'red' }
  }

  const status = `${file.indexStatus}${file.worktreeStatus}`.trim()

  if (status.includes('A')) {
    return { label: '新增', color: 'green' }
  }

  if (status.includes('D')) {
    return { label: '删除', color: 'red' }
  }

  if (status.includes('R')) {
    return { label: '重命名', color: 'purple' }
  }

  if (status.includes('M')) {
    return { label: '修改', color: 'blue' }
  }

  if (status.includes('?')) {
    return { label: '未跟踪', color: 'gold' }
  }

  return { label: status || '变更', color: 'default' }
}

function GitWorkspacePanel({ repositories }: { repositories: Repository[] }): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [status, setStatus] = useState<GitWorkspaceStatus | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [pushRemote, setPushRemote] = useState('origin')
  const [pushBranch, setPushBranch] = useState('')
  const [mergeSource, setMergeSource] = useState('')
  const [working, setWorking] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [suggestingFilePath, setSuggestingFilePath] = useState<string | null>(null)
  const [previewSuggestion, setPreviewSuggestion] = useState<AiConflictSuggestion | null>(null)
  const [applyingSuggestion, setApplyingSuggestion] = useState(false)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null

  useEffect(() => {
    if (repositories.length === 0) {
      setRepositoryId('')
      setStatus(null)
      setSelectedPaths([])
      return
    }

    if (!repositories.some((repository) => repository.id === repositoryId)) {
      setRepositoryId(repositories[0].id)
    }
  }, [repositories, repositoryId])

  async function refreshWorkspaceStatus(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setLoadingStatus(true)

    try {
      const nextStatus = await window.forgeDesk.getRepositoryWorkspaceStatus(selectedRepository.id)
      setStatus(nextStatus)
      setPushBranch((current) => current || nextStatus.branch || selectedRepository.currentBranch)
      setPushRemote((current) => current || selectedRepository.remotes[0]?.name || 'origin')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    setStatus(null)
    setSelectedPaths([])
    setCommitMessage('')
    setMergeSource('')
    setPushRemote(selectedRepository?.remotes[0]?.name || 'origin')
    setPushBranch(selectedRepository?.currentBranch || '')

    if (selectedRepository) {
      refreshWorkspaceStatus()
    }
  }, [selectedRepository?.id])

  async function runGitWrite(action: () => Promise<GitOperationResult>, successText: string): Promise<void> {
    setWorking(true)

    try {
      const result = await action()
      updateRepository(result.repository)
      setStatus(result.status)
      setSelectedPaths([])
      setPushBranch(result.status.branch || result.repository.currentBranch)

      if (result.ok) {
        message.success(successText)
      } else {
        message.warning(result.stderr || result.stdout || 'Git 操作需要处理')
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  async function suggestConflictResolution(conflict: GitConflictFile): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setSuggestingFilePath(conflict.path)

    try {
      setPreviewSuggestion(await window.forgeDesk.suggestConflictResolution(selectedRepository.id, conflict.path))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSuggestingFilePath(null)
    }
  }

  async function applyConflictResolution(): Promise<void> {
    if (!selectedRepository || !previewSuggestion || !window.forgeDesk) {
      return
    }

    setApplyingSuggestion(true)

    try {
      const result = await window.forgeDesk.applyConflictResolution(selectedRepository.id, previewSuggestion.filePath, previewSuggestion.suggestedContent)
      updateRepository(result.repository)
      setStatus(result.status)
      setPreviewSuggestion(null)
      message.success('已应用 AI 建议并暂存文件')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setApplyingSuggestion(false)
    }
  }

  if (repositories.length === 0) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="这个项目下还没有仓库，无法使用 Git 工作区" />
      </div>
    )
  }

  const fileColumns: ColumnsType<GitStatusFile> = [
    {
      title: '状态',
      key: 'status',
      width: 96,
      render: (_, file) => {
        const status = getWorkspaceFileStatusLabel(file)
        return <Tag color={status.color}>{status.label}</Tag>
      }
    },
    {
      title: '文件',
      dataIndex: 'path',
      key: 'path',
      render: (path, file) => (
        <Space direction="vertical" size={2}>
          <Typography.Text ellipsis={{ tooltip: path }}>{path}</Typography.Text>
          {file.oldPath && <Typography.Text type="secondary">原路径：{file.oldPath}</Typography.Text>}
        </Space>
      )
    },
    {
      title: 'Index / Worktree',
      key: 'rawStatus',
      width: 150,
      render: (_, file) => `${file.indexStatus || ' '}${file.worktreeStatus || ' '}`
    }
  ]

  const conflicts = status?.conflicts ?? []
  const files = status?.files ?? []
  const remoteOptions = selectedRepository?.remotes.map((remote) => ({ label: remote.name, value: remote.name })) ?? []

  return (
    <div className="git-workspace-panel">
      <div className="git-workspace-toolbar">
        <div>
          <Typography.Title level={4}>Git 工作区</Typography.Title>
          <Typography.Text type="secondary">暂存、提交、推送、合并，并在冲突时请求 AI 建议。</Typography.Text>
        </div>
        <Space wrap>
          <Select
            value={selectedRepository?.id}
            className="settings-repository-select"
            options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
            onChange={setRepositoryId}
          />
          <Button icon={<ReloadOutlined />} loading={loadingStatus} onClick={refreshWorkspaceStatus}>
            刷新工作区
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} className="git-operation-grid">
        <Col xs={24} lg={12}>
          <div className="git-operation-box">
            <Typography.Text strong>暂存</Typography.Text>
            <Space wrap>
              <Button loading={working} disabled={!selectedRepository || files.length === 0} onClick={() => selectedRepository && runGitWrite(() => window.forgeDesk.gitAdd(selectedRepository.id, { mode: 'all', paths: [] }), '已暂存全部改动')}>
                暂存全部
              </Button>
              <Button loading={working} disabled={!selectedRepository || selectedPaths.length === 0} onClick={() => selectedRepository && runGitWrite(() => window.forgeDesk.gitAdd(selectedRepository.id, { mode: 'paths', paths: selectedPaths }), '已暂存选中文件')}>
                暂存选中文件
              </Button>
            </Space>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="git-operation-box">
            <Typography.Text strong>提交</Typography.Text>
            <Space.Compact className="git-operation-compact">
              <Input value={commitMessage} placeholder="feat: update workspace" onChange={(event) => setCommitMessage(event.target.value)} />
              <Button type="primary" loading={working} disabled={!selectedRepository || !commitMessage.trim()} onClick={() => selectedRepository && runGitWrite(() => window.forgeDesk.gitCommit(selectedRepository.id, { message: commitMessage }), '提交已创建')}>
                提交
              </Button>
            </Space.Compact>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="git-operation-box">
            <Typography.Text strong>推送</Typography.Text>
            <Space.Compact className="git-operation-compact">
              <Select value={pushRemote} options={remoteOptions.length > 0 ? remoteOptions : [{ label: 'origin', value: 'origin' }]} onChange={setPushRemote} />
              <Input value={pushBranch} placeholder={status?.branch || selectedRepository?.currentBranch || 'main'} onChange={(event) => setPushBranch(event.target.value)} />
              <Button loading={working} disabled={!selectedRepository || !pushRemote || !pushBranch} onClick={() => selectedRepository && runGitWrite(() => window.forgeDesk.gitPush(selectedRepository.id, { remote: pushRemote, branch: pushBranch }), '分支已推送')}>
                推送
              </Button>
            </Space.Compact>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="git-operation-box">
            <Typography.Text strong>合并</Typography.Text>
            <Space.Compact className="git-operation-compact">
              <Input value={mergeSource} placeholder="origin/main 或 feature/name" onChange={(event) => setMergeSource(event.target.value)} />
              <Button loading={working} disabled={!selectedRepository || !mergeSource.trim()} onClick={() => selectedRepository && runGitWrite(() => window.forgeDesk.gitMerge(selectedRepository.id, { source: mergeSource }), '合并已完成')}>
                合并
              </Button>
            </Space.Compact>
          </div>
        </Col>
      </Row>

      {conflicts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`检测到 ${conflicts.length} 个冲突文件`}
          description={
            <Space direction="vertical" className="conflict-file-list">
              {conflicts.map((conflict) => (
                <div className="conflict-file-row" key={conflict.path}>
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{conflict.path}</Typography.Text>
                    <Typography.Text type="secondary">{conflict.sections.length} 个冲突片段</Typography.Text>
                  </Space>
                  <Button type="primary" loading={suggestingFilePath === conflict.path} onClick={() => suggestConflictResolution(conflict)}>
                    AI 生成合并建议
                  </Button>
                </div>
              ))}
            </Space>
          }
        />
      )}

      <Table
        rowKey="path"
        size="small"
        loading={loadingStatus}
        columns={fileColumns}
        dataSource={files}
        pagination={false}
        scroll={{ x: 720 }}
        rowSelection={{
          selectedRowKeys: selectedPaths,
          onChange: (keys) => setSelectedPaths(keys.map(String))
        }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="工作区没有未提交改动" /> }}
      />

      <Modal
        title={previewSuggestion ? `AI 合并建议：${previewSuggestion.filePath}` : 'AI 合并建议'}
        open={Boolean(previewSuggestion)}
        okText="应用建议并暂存"
        cancelText="取消"
        confirmLoading={applyingSuggestion}
        onOk={applyConflictResolution}
        onCancel={() => setPreviewSuggestion(null)}
        width="min(920px, calc(100vw - 64px))"
      >
        <Input.TextArea value={previewSuggestion?.suggestedContent ?? ''} readOnly autoSize={{ minRows: 14, maxRows: 26 }} />
      </Modal>
    </div>
  )
}

function GitCommandConsole({ repositories }: { repositories: Repository[] }): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [command, setCommand] = useState('status --short --branch')
  const [runningCommand, setRunningCommand] = useState(false)
  const [result, setResult] = useState<GitCommandResult | null>(null)
  const [gitError, setGitError] = useState<GitErrorGuidance | null>(null)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
  const commandPresets = [
    'status --short --branch',
    'remote -v',
    'branch -a',
    'log --graph --decorate --oneline --all -n 80',
    'show --stat HEAD',
    'diff --stat',
    'fetch --prune'
  ]

  useEffect(() => {
    if (repositories.length === 0) {
      setRepositoryId('')
      return
    }

    if (!repositories.some((repository) => repository.id === repositoryId)) {
      setRepositoryId(repositories[0].id)
    }
  }, [repositories, repositoryId])

  async function runCommand(nextCommand = command): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const trimmedCommand = nextCommand.trim()

    if (!trimmedCommand) {
      message.warning('请输入 Git 命令')
      return
    }

    setRunningCommand(true)
    setCommand(trimmedCommand)

    try {
      const nextResult = await window.forgeDesk.runRepositoryGitCommand({ repositoryId: selectedRepository.id, command: trimmedCommand })
      setResult(nextResult)

      if (nextResult.ok && nextResult.args[0] === 'fetch') {
        const repository = await window.forgeDesk.getRepositoryDetail(selectedRepository.id)
        updateRepository(repository)
      }

      setGitError(nextResult.ok ? null : createGitErrorGuidance(nextResult.stderr || nextResult.stdout || 'Git 命令失败', '运行 Git 命令'))
    } catch (error) {
      setResult({
        ok: false,
        command: trimmedCommand.startsWith('git ') ? trimmedCommand : `git ${trimmedCommand}`,
        args: [],
        stdout: '',
        stderr: getErrorMessage(error),
        exitCode: null
      })
      setGitError(createGitErrorGuidance(error, '运行 Git 命令'))
    } finally {
      setRunningCommand(false)
    }
  }

  if (repositories.length === 0) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="这个项目下还没有仓库，无法运行 Git 命令" />
      </div>
    )
  }

  return (
    <div className="git-command-console">
      <div className="git-command-toolbar">
        <Select
          value={selectedRepository?.id}
          className="settings-repository-select"
          options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
          onChange={setRepositoryId}
        />
        <Input.Search
          value={command}
          enterButton="运行"
          loading={runningCommand}
          onChange={(event) => setCommand(event.target.value)}
          onSearch={(value) => runCommand(value)}
        />
      </div>
      <Space wrap className="git-command-presets">
        {commandPresets.map((preset) => (
          <Button key={preset} size="small" onClick={() => runCommand(preset)}>
            git {preset}
          </Button>
        ))}
      </Space>
      <Alert
        type="info"
        showIcon
        message="只支持受控 Git 命令"
        description="这个命令台用于安全查看仓库状态；add、commit、push、merge 请使用上方 Git 工作区。"
      />
      <GitErrorNotice guidance={gitError} onClose={() => setGitError(null)} />
      <div className={`git-command-output${result?.ok ? ' is-ok' : result ? ' is-error' : ''}`}>
        <div className="git-command-output-heading">
          <Typography.Text strong>{result?.command ?? '尚未运行命令'}</Typography.Text>
          {result && <Tag color={result.ok ? 'green' : 'red'}>{result.ok ? 'exit 0' : `exit ${result.exitCode ?? '-'}`}</Tag>}
        </div>
        <pre>{result ? [result.stdout, result.stderr].filter(Boolean).join('\n') || '(no output)' : '选择常用命令或输入受控 Git 命令。'}</pre>
      </div>
    </div>
  )
}

function ProjectSettingsPanel({
  project,
  repositories,
  contributors,
  onSummaryChanged
}: {
  project: Project
  repositories: Repository[]
  contributors: ContributorSummary[]
  onSummaryChanged: () => void | Promise<void>
}): JSX.Element {
  const { updateProject } = useForgeDeskStore()
  const [form] = Form.useForm<ProjectSettingsForm>()
  const [savingProject, setSavingProject] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      name: project.name,
      workspacePath: project.workspacePath,
      description: project.description,
      owner: project.owner
    })
  }, [form, project.description, project.id, project.name, project.owner, project.workspacePath])

  async function saveProjectSettings(): Promise<void> {
    const values = await form.validateFields()
    setSavingProject(true)

    try {
      await updateProject({
        id: project.id,
        name: values.name.trim(),
        workspacePath: values.workspacePath.trim(),
        description: (values.description ?? '').trim(),
        owner: (values.owner ?? '').trim()
      })
      message.success('项目基础信息已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingProject(false)
    }
  }

  return (
    <Space direction="vertical" size={18} className="project-settings-panel">
      <div className="panel project-settings-basic">
        <div className="panel-title">
          <Typography.Title level={4}>基础信息</Typography.Title>
          <Button type="primary" icon={<SaveOutlined />} loading={savingProject} onClick={saveProjectSettings}>
            保存
          </Button>
        </div>
        <Form form={form} layout="vertical" className="project-settings-form">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="例如 CardPIE" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="owner" label="负责人">
                <Input placeholder="可选，例如 Stone" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="workspacePath" label="项目目录" rules={[{ required: true, message: '请输入项目目录' }]}>
                <Input placeholder="/Users/stone/Dev/project" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={3} placeholder="可选，记录项目用途或说明" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Alert type="info" showIcon message="修改项目目录只更新项目记录，不会自动重新扫描仓库。" />
      </div>

      <div className="project-settings-section">
        <div className="project-settings-heading">
          <Typography.Title level={4}>
            <TeamOutlined /> 人员映射
          </Typography.Title>
          <Typography.Text type="secondary">维护当前项目内真实人员和 Git 提交身份的归属关系。</Typography.Text>
        </div>
        <ProjectPeopleMapping project={project} contributors={contributors} onChanged={onSummaryChanged} />
      </div>

      <div className="project-settings-section">
        <div className="project-settings-heading">
          <Typography.Title level={4}>
            <BranchesOutlined /> Git 仓库
          </Typography.Title>
          <Typography.Text type="secondary">查看当前项目仓库状态，并配置单仓库提交身份。</Typography.Text>
        </div>
        {repositories.length > 0 ? (
          <RepositoryTable repositories={repositories} />
        ) : (
          <div className="panel empty-project-panel">
            <Empty description="这个项目下还没有仓库" />
            <Typography.Text type="secondary">创建项目时扫描到的 Git 仓库会显示在这里；修改项目目录不会自动重新扫描。</Typography.Text>
          </div>
        )}
      </div>

      <div className="project-settings-section">
        <div className="project-settings-heading">
          <Typography.Title level={4}>
            <SettingOutlined /> 高级设置
          </Typography.Title>
          <Typography.Text type="secondary">管理仓库远端，并通过受控命令查看仓库状态，不开放任意 shell。</Typography.Text>
        </div>
        <div className="advanced-settings-stack">
          <RepositoryRemoteManager repositories={repositories} />
          <GitWorkspacePanel repositories={repositories} />
          <GitCommandConsole repositories={repositories} />
        </div>
      </div>
    </Space>
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

function ProjectLogTreePanel({ repositories }: { repositories: Repository[] }): JSX.Element {
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null

  useEffect(() => {
    if (repositories.length === 0) {
      setRepositoryId('')
      return
    }

    if (!repositories.some((repository) => repository.id === repositoryId)) {
      setRepositoryId(repositories[0].id)
    }
  }, [repositories, repositoryId])

  if (repositories.length === 0) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="这个项目下还没有仓库，创建项目时扫描到的 Git 仓库会显示 Log 树" />
      </div>
    )
  }

  return (
    <Space direction="vertical" size={16} className="project-log-tree">
      <div className="project-log-toolbar">
        <div>
          <Typography.Title level={4}>Log 树</Typography.Title>
          <Typography.Text type="secondary">按仓库查看分支、提交图谱、提交文件和 diff。</Typography.Text>
        </div>
        <Select
          value={selectedRepository?.id}
          className="project-log-repository-select"
          options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
          onChange={setRepositoryId}
        />
      </div>
      <RepositoryLogTree repository={selectedRepository} emptyDescription="请选择要查看 Log 树的仓库" />
    </Space>
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
        sshPublicKeys: [],
        sshPrivateKeys: []
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
  const [projectDetailTab, setProjectDetailTab] = useState('data')
  const [analyzingProjectId, setAnalyzingProjectId] = useState<string | null>(null)
  const [analysisGitError, setAnalysisGitError] = useState<GitErrorGuidance | null>(null)
  const [rangePreset, setRangePreset] = useState('30')
  const [range, setRange] = useState(createPresetRange(30))
  const selectedProject = projects.find((project) => project.id === detailProjectId) ?? null
  const projectRepositories = selectedProject ? repositories.filter((repository) => repository.projectId === selectedProject.id) : []
  const changedRepositories = projectRepositories.filter((repository) => repository.hasChanges).length
  const aheadRepositories = projectRepositories.filter((repository) => repository.ahead > 0).length
  const remoteCount = projectRepositories.reduce((sum, repository) => sum + (repository.remoteCount || repository.remotes?.length || (repository.remoteUrl ? 1 : 0)), 0)
  const remoteAlignmentStats = getProjectRemoteAlignmentStats(projectRepositories)
  const summary = selectedProject ? summaries[selectedProject.id] ?? createEmptySummary(selectedProject.id) : null
  const summaryRange = rangePreset === 'all' ? undefined : range
  const dailyDates = summary?.dailyMetrics.map((metric) => metric.date) ?? []
  const hasGitData = Boolean(summary && summary.totalCommits > 0)

  async function refreshSummary(projectId: string, nextRange = summaryRange): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setProjectSummary(await window.forgeDesk.getProjectSummary(projectId, nextRange))
  }

  useEffect(() => {
    if (!selectedProject || !window.forgeDesk) {
      return
    }

    refreshSummary(selectedProject.id).catch((error) => setAnalysisGitError(createGitErrorGuidance(error, '读取 Git 数据')))
  }, [selectedProject?.id, rangePreset, range.startDate, range.endDate])

  useEffect(() => {
    if (summary?.status === 'failed' && summary.errorMessage) {
      setAnalysisGitError(createGitErrorGuidance(summary.errorMessage, '刷新 Git 数据'))
    }
  }, [summary?.errorMessage, summary?.status])

  function updateRangePreset(value: string): void {
    setRangePreset(value)

    if (value !== 'custom' && value !== 'all') {
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
        setAnalysisGitError(createGitErrorGuidance(nextSummary.errorMessage || 'Git 分析失败', '刷新 Git 数据'))
        return
      }

      await refreshSummary(selectedProject.id)
      setAnalysisGitError(null)
      message.success('Git 数据已刷新')
    } catch (error) {
      setAnalysisGitError(createGitErrorGuidance(error, '刷新 Git 数据'))
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
          <Typography.Text type="secondary">从项目进入 Git 数据分析。</Typography.Text>
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
                    setProjectDetailTab('data')
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="project-detail-page">
          <div className="project-back-row">
            <Button onClick={() => setDetailProjectId(null)}>返回项目列表</Button>
          </div>
          <div className="project-detail-panel">
            <div className="project-detail-heading">
              <div className="project-title-stack">
                <div>
                  <Typography.Title level={3}>{selectedProject.name}</Typography.Title>
                  <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: selectedProject.workspacePath }}>
                    {selectedProject.workspacePath}
                  </Typography.Text>
                </div>
              </div>
              <Space wrap>
                {summary?.lastAnalyzedAt && <Typography.Text type="secondary">上次分析：{new Date(summary.lastAnalyzedAt).toLocaleString()}</Typography.Text>}
                <Button icon={<SettingOutlined />} onClick={() => setProjectDetailTab('settings')}>
                  设置
                </Button>
                <Button type="primary" icon={<ReloadOutlined />} loading={analyzingProjectId === selectedProject.id} disabled={projectRepositories.length === 0} onClick={analyzeSelectedProject}>
                  刷新 Git 数据
                </Button>
              </Space>
            </div>

            <GitErrorNotice guidance={analysisGitError} onClose={() => setAnalysisGitError(null)} />

            <Tabs
              activeKey={projectDetailTab}
              onChange={setProjectDetailTab}
              items={[
                {
                  key: 'data',
                  label: '数据',
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
                      <Space className="trend-toolbar" wrap>
                        <Button type={rangePreset === 'all' ? 'primary' : 'default'} onClick={() => updateRangePreset('all')}>全部</Button>
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
                      <ContributorTable contributors={summary?.contributors ?? []} />
                    </>
                  )
                },
                {
                  key: 'log-tree',
                  label: 'Log 树',
                  children: <ProjectLogTreePanel repositories={projectRepositories} />
                },
                {
                  key: 'settings',
                  label: '设置',
                  children: (
                    <ProjectSettingsPanel
                      project={selectedProject}
                      repositories={projectRepositories}
                      contributors={summary?.contributors ?? []}
                      onSummaryChanged={() => refreshSummary(selectedProject.id)}
                    />
                  )
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

function RepositoryLogTree({ repository, emptyDescription = '请选择仓库' }: { repository: Repository | null; emptyDescription?: string }): JSX.Element {
  const { setProjectSummary, updateRepository } = useForgeDeskStore()
  const [detailRepository, setDetailRepository] = useState<Repository | null>(repository)
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
  const [gitError, setGitError] = useState<GitErrorGuidance | null>(null)
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false)

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
  useEffect(() => {
    let cancelled = false

    async function loadRepositoryDetail(): Promise<void> {
      if (!repository) {
        setDetailRepository(null)
        setCommits([])
        return
      }

      setDetailRepository(repository)
      setLoadingDetail(true)
      setCommitBranch('')
      setCommitAuthor('')
      setCommitRange({ startDate: '', endDate: '' })
      setSelectedCommit(null)
      setCommitFiles([])
      setSelectedFile(null)
      setCommitDiff(null)
      setGitError(null)

      try {
        if (window.forgeDesk) {
          const detail = await window.forgeDesk.getRepositoryDetail(repository.id)
          const nextCommits = await window.forgeDesk.getRepositoryCommitGraph(detail.id)

          if (cancelled) {
            return
          }

          updateRepository(detail)
          setDetailRepository(detail)
          setCommits(nextCommits)
          setGitError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setGitError(createGitErrorGuidance(error, '读取仓库'))
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false)
        }
      }
    }

    loadRepositoryDetail()

    return () => {
      cancelled = true
    }
  }, [repository?.id, repository?.latestCommit, repository?.remoteCount, repository?.remoteBranchCount])

  async function refreshCommits(nextRange = commitRange, nextBranch = commitBranch, targetRepository = detailRepository): Promise<void> {
    if (!targetRepository || !window.forgeDesk) {
      return
    }

    setLoadingDetail(true)
    setSelectedCommit(null)
    setCommitFiles([])
    setSelectedFile(null)
    setCommitDiff(null)

    try {
      setCommits(
        await window.forgeDesk.getRepositoryCommitGraph(targetRepository.id, {
          ...nextRange,
          branchName: nextBranch || undefined
        })
      )
      setGitError(null)
    } catch (error) {
      setGitError(createGitErrorGuidance(error, '读取提交图谱'))
    } finally {
      setLoadingDetail(false)
    }
  }

  function selectBranchFilter(nextBranch: string): void {
    setCommitBranch(nextBranch)
    setBranchDrawerOpen(false)
    refreshCommits(commitRange, nextBranch)
  }

  async function syncRemote(targetRepository: Repository): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setSyncingRepositoryId(targetRepository.id)

    try {
      const synced = await window.forgeDesk.fetchRepositoryRemote(targetRepository.id)
      updateRepository(synced)
      setDetailRepository(synced)
      setCommitBranch('')
      setCommitAuthor('')
      setCommitRange({ startDate: '', endDate: '' })
      await refreshCommits({ startDate: '', endDate: '' }, '', synced)
      const summary = await window.forgeDesk.analyzeProjectGit(synced.projectId)
      setProjectSummary(summary)
      setGitError(null)
      message.success('远端已 fetch/prune，Git 数据已刷新')
    } catch (error) {
      setGitError(createGitErrorGuidance(error, '同步远端'))
    } finally {
      setSyncingRepositoryId(null)
    }
  }

  async function selectCommit(commit: GitCommit): Promise<void> {
    if (!detailRepository || !window.forgeDesk) {
      return
    }

    if (selectedCommit?.hash === commit.hash) {
      setSelectedCommit(null)
      setCommitFiles([])
      setSelectedFile(null)
      setCommitDiff(null)
      return
    }

    setSelectedCommit(commit)
    setSelectedFile(null)
    setCommitDiff(null)
    setLoadingFiles(true)

    try {
      setCommitFiles(await window.forgeDesk.listRepositoryCommitFiles(detailRepository.id, commit.hash))
      setGitError(null)
    } catch (error) {
      setGitError(createGitErrorGuidance(error, '读取提交文件'))
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
      setGitError(null)
    } catch (error) {
      setGitError(createGitErrorGuidance(error, '读取文件对比'))
    } finally {
      setLoadingDiff(false)
    }
  }

  if (!repository) {
    return (
      <div className="panel empty-project-panel">
        <Empty description={emptyDescription} />
      </div>
    )
  }

  const activeRepository = detailRepository ?? repository
  const branchGroups = buildBranchGroups({
    branches: activeRepository.branches,
    remoteBranches: activeRepository.remoteBranches,
    currentBranch: activeRepository.currentBranch,
    activeBranch: commitBranch
  })

  return (
    <Space direction="vertical" size={16} className="repository-detail">
      <div className="repository-summary-strip">
        <div className="repository-summary-grid">
          <div className="repository-summary-item is-wide">
            <Typography.Text type="secondary">本地路径</Typography.Text>
            <Typography.Text ellipsis={{ tooltip: activeRepository.localPath }}>{activeRepository.localPath}</Typography.Text>
          </div>
          <div className="repository-summary-item">
            <Typography.Text type="secondary">当前分支</Typography.Text>
            <Typography.Text strong ellipsis={{ tooltip: activeRepository.currentBranch }}>{activeRepository.currentBranch}</Typography.Text>
          </div>
          <div className="repository-summary-item is-wide">
            <Typography.Text type="secondary">最近提交</Typography.Text>
            <Typography.Text ellipsis={{ tooltip: activeRepository.latestCommit }}>{activeRepository.latestCommit}</Typography.Text>
          </div>
          <div className="repository-summary-item">
            <Typography.Text type="secondary">提交总数</Typography.Text>
            <Typography.Text strong>{formatNumber(commits.length)}</Typography.Text>
          </div>
        </div>
        <Button icon={<DownloadOutlined />} loading={syncingRepositoryId === activeRepository.id} onClick={() => syncRemote(activeRepository)}>
          Fetch / Prune
        </Button>
      </div>
      <GitErrorNotice guidance={gitError} onClose={() => setGitError(null)} />
      <div className="git-browser">
        <div className="panel-title source-tree-toolbar">
          <Space size={8} wrap>
            <Typography.Title level={4}>提交图谱</Typography.Title>
            <Tag color={commitBranch ? 'blue' : 'default'}>{commitBranch || '全部引用'}</Tag>
          </Space>
          <Space wrap>
            <Button icon={<BranchesOutlined />} onClick={() => setBranchDrawerOpen(true)}>
              分支
            </Button>
            {commitBranch && <Button onClick={() => selectBranchFilter('')}>全部引用</Button>}
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
        <Table
          rowKey="id"
          loading={loadingDetail}
          size="small"
          className="commit-table source-tree-table"
          rowClassName={(commit) => (commit.hash === selectedCommit?.hash ? 'selected-row' : '')}
          onRow={(commit) => ({ onClick: () => selectCommit(commit) })}
          columns={[
            { title: '', key: 'graph', width: 116, render: (_, commit) => <CommitGraphCell commit={commit} /> },
            {
              title: '提交',
              dataIndex: 'message',
              key: 'message',
              render: (_, commit) => <CommitMessageCell commit={commit} />
            },
            { title: '提交人', key: 'author', width: 210, render: (_, commit) => <CommitAuthorCell commit={commit} /> },
            { title: '时间', dataIndex: 'committedAt', key: 'committedAt', width: 160, render: (value) => new Date(value).toLocaleString() },
            { title: '+/-', key: 'lines', width: 96, render: (_, commit) => `${formatNumber(commit.additions)} / ${formatNumber(commit.deletions)}` }
          ]}
          dataSource={graphRows}
          expandable={{
            expandedRowKeys: selectedCommit ? [selectedCommit.id] : [],
            showExpandColumn: false,
            expandedRowClassName: () => 'commit-expanded-row',
            expandedRowRender: (commit) => (
              <CommitInlineDetail
                commit={commit}
                files={commit.hash === selectedCommit?.hash ? commitFiles : []}
                selectedFile={commit.hash === selectedCommit?.hash ? selectedFile : null}
                diff={commit.hash === selectedCommit?.hash ? commitDiff : null}
                diffMode={diffMode}
                loadingFiles={commit.hash === selectedCommit?.hash && loadingFiles}
                loadingDiff={commit.hash === selectedCommit?.hash && loadingDiff}
                onSelectFile={(file) => {
                  selectCommitFile(file)
                }}
                onChangeDiffMode={setDiffMode}
              />
            )
          }}
          pagination={{ pageSize: 18, showSizeChanger: false }}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前范围没有提交" /> }}
        />
      </div>
      <Collapse
        className="remote-alignment-collapse"
        bordered={false}
        ghost
        items={[
          {
            key: 'remote-alignment',
            label: (
              <Space size={8} wrap>
                <Typography.Text strong>双远端对齐</Typography.Text>
                <Tag color={getRemoteAlignmentStatusMeta(activeRepository.remoteAlignment.status).color}>
                  {getRemoteAlignmentStatusMeta(activeRepository.remoteAlignment.status).label}
                </Tag>
              </Space>
            ),
            children: <RemoteAlignmentPanel alignment={activeRepository.remoteAlignment} currentBranch={activeRepository.currentBranch} />
          }
        ]}
      />
      <Drawer
        title="分支"
        open={branchDrawerOpen}
        width={380}
        onClose={() => setBranchDrawerOpen(false)}
      >
        <div className="branch-drawer">
          <Button block type={commitBranch ? 'default' : 'primary'} onClick={() => selectBranchFilter('')}>
            全部引用
          </Button>
          {branchGroups.map((group) => (
            <div key={group.key} className="branch-drawer-section">
              <div className="branch-drawer-heading">
                <Typography.Text strong>{group.title}</Typography.Text>
                <Tag>{group.items.length}</Tag>
              </div>
              <div className="branch-drawer-list">
                {group.items.length === 0 ? (
                  <Typography.Text type="secondary">暂无{group.title}</Typography.Text>
                ) : (
                  group.items.map((branch) => (
                    <button
                      key={`${group.key}:${branch.name}`}
                      className={branch.isActive ? 'branch-drawer-item is-active' : 'branch-drawer-item'}
                      onClick={() => selectBranchFilter(branch.name)}
                    >
                      <span className="branch-drawer-name">{branch.name}</span>
                      <Space size={4}>
                        {branch.isCurrent && <Tag color="blue">当前</Tag>}
                        {branch.isActive && <Tag color="green">筛选中</Tag>}
                      </Space>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </Space>
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
        <RepositoryLogTree repository={detailRepository} />
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

function App(): JSX.Element {
  const { loadingWorkspace, loadWorkspace } = useForgeDeskStore()
  const [activeKey, setActiveKey] = useState('overview')
  const [creatingProject, setCreatingProject] = useState(false)

  useEffect(() => {
    loadWorkspace().catch((error) => message.error(getErrorMessage(error)))
  }, [loadWorkspace])

  const menuItems = [
    { key: 'overview', icon: <DashboardOutlined />, label: '项目' },
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
        <CreateProjectModal open={creatingProject} onClose={() => setCreatingProject(false)} onCreated={() => setActiveKey('overview')} />
      </Layout.Content>
    </Layout>
  )
}

export default App
