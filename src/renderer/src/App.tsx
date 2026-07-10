import {
  Alert,
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BranchesOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  DashboardOutlined,
  DeleteOutlined,
  DiffOutlined,
  DesktopOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  FolderOpenOutlined,
  GithubOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  DockerOutlined,
  MoonOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  ToolOutlined,
  UnlockOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import type { MenuProps } from 'antd'
import type { FormInstance } from 'antd/es/form'
import forgedeskLogoUrl from './assets/forgedesk-logo.svg'
import type {
  AppRuntimeInfo,
  AiSettingsView,
  AiConflictSuggestion,
  CliEnvironmentIssue,
  CliEnvironmentRepairResult,
  CliEnvironmentSnapshot,
  CodemagicApp,
  CodemagicRepositoryBinding,
  CodemagicTeam,
  CodemagicTokenView,
  ContributorSummary,
  GitCommandResult,
  GitBranchSwitchInput,
  GitConflictFile,
  GitCommit,
  GitCommitDiff,
  GitCommitFileChange,
  GitContributorIdentity,
  GitMergeAnalysis,
  GitOperationResult,
  GitPushInput,
  GitRemote,
  GitStatusFile,
  GitWorkspaceStatus,
  GithubTokenView,
  MonthlyPerformancePreview,
  MonthlyPerformanceRow,
  MonthlyPerformanceSession,
  OaDocumentList,
  OaDocumentRecord,
  OaSettingsView,
  Project,
  ProjectBranchTag,
  ProjectGitSummary,
  ProjectPerson,
  ProjectService,
  ProjectServiceDomain,
  ProjectServiceEnvironment,
  PlaneConnectionTestResult,
  PlaneCycle,
  PlaneModule,
  PlaneProject,
  PlaneProjectBinding,
  PlaneProjectContent,
  PlaneSettings,
  PlaneWorkItem,
  QuickBuildTask,
  RemoteAlignmentBranch,
  RemoteAlignmentBranchStatus,
  RemoteAlignmentStatus,
  RemoteAlignmentSummary,
  Repository,
  RepositoryReleasePreparation,
  RepositoryReleasePublishTask,
  RepositoryReleaseSuggestion,
  RepositoryReleaseTagRecommendation,
  RsaPrivateKeyRecord,
  RsaPrivateKeySize,
  ServiceConnection,
  ServiceEnvironmentLogLine,
  ServiceMonitorCheck,
  ServiceMonitorStatus,
  ServiceProviderType,
  RailwayTokenType,
  ServiceDeploymentSummary,
  ServiceEnvVarRecord,
  VercelDomainConfig,
  VercelEnvVarInput,
} from './data'
import { APP_NAVIGATION_ITEMS, type AppNavigationKey } from './app-navigation'
import { DockerPanel } from './docker-panel'
import { createAppUpdateViewModel } from './app-update-view'
import { createDiffResultLines, createSourceDiffLines, type DiffDisplayLine } from './diff-view'
import {
  compareEnvFiles,
  createEnvFileDiffTask,
  formatEnvVariableRows,
  formatEnvVariableValues,
  formatVariableNames,
  parseEnvFileVariables,
  readStoredEnvFileDiffActiveTaskId,
  readStoredEnvFileDiffTasks,
  updateEnvVariableValue,
  writeStoredEnvFileDiffActiveTaskId,
  writeStoredEnvFileDiffTasks,
  type EnvFileDiffResult,
  type EnvFileDiffRow,
  type EnvFileDiffRowFilter,
  type EnvFileDiffStatus,
  type EnvFileDiffTask,
  type EnvFileDiffTaskFile,
  type EnvFileVariables
} from './env-file-diff'
import { getErrorMessage, isAiCredentialErrorMessage } from './error-messages'
import {
  PUSH_ALL_REMOTES_VALUE,
  canCommitSelection,
  canPushSelection,
  createPushRemoteOptions,
  getCurrentBranchName,
  getPushableTargets,
  hasProjectCommittableChanges,
  hasProjectPushableTargets,
  mergeRepositoryWorkspaceStatus,
  resolveSelectedPushRemoteNames
} from './git-action-state'
import { createGitErrorGuidance, type GitErrorGuidance } from './git-error-guidance'
import {
  DEFAULT_PASSWORD_GROUP_KEYS,
  DEFAULT_PASSWORD_TOOL_ITEMS,
  PASSWORD_CHARACTER_GROUPS,
  createGeneratedPasswordRows,
  formatEnvironmentVariableRows,
  generatePasswordToolValue,
  getPasswordToolItemLengthLabel,
  type GeneratedPasswordRow,
  type PasswordCharacterGroupKey,
  type PasswordToolItem,
  type PasswordToolMode
} from './password-generator'
import {
  applyBranchColorsToGraphRows,
  buildBranchGroups,
  createGraphRows,
  currentBranchRefColor,
  defaultGitLogRefreshPreferences,
  gitLogRefreshIntervalBounds,
  gitLogRefreshPreferenceChangedEvent,
  gitLogRefreshPreferenceStorageKey,
  getWorkspaceFileChangeStatus,
  getCommitAuthorDisplay,
  getCommitAuthorFilterValue,
  getGraphCellBottomLaneIndexes,
  getGitGraphColumnWidth,
  getGraphLaneColor,
  isWorkingTreeCommit,
  getNextVisibleCommitCount,
  normalizeGitLogRefreshPreferences,
  getRefColor,
  getRepositoryDefaultPushTarget,
  prependWorkingTreeCommit,
  gitGraphLaneWidth,
  workingTreeCommitHash,
  type BranchColoredGitGraphRow,
  type GitLogRefreshPreferences
} from './git-log-view'
import {
  DEFAULT_PROJECT_DETAIL_TAB,
  createProjectDetailTabs,
  createProjectTerminalOpenRequest,
  createRepositorySummaryFields,
  getRepositoryRemoteCount,
  hasProjectRemoteAlignment,
  resolveProjectDetailTab,
  shouldShowRepositorySummary,
  type ProjectDetailTabAvailability,
  type ProjectDetailTabKey
} from './project-detail-view'
import { createQuickBuildCompletionPrompt } from './quick-build-view'
import {
  closeProjectSettingsModule,
  createInitialProjectSettingsView,
  openProjectSettingsModule,
  PROJECT_SETTINGS_MODULES,
  type ProjectSettingsModuleKey
} from './project-settings-view'
import {
  createDefaultReleaseMetadata,
  createReleasePlatformOptions,
  createReleasePublishTaskView,
  createReleasePublishViewModel,
  updateDefaultReleaseMetadataForVersionChange,
  type ReleasePublishActionKey,
  type ReleasePublishProvider
} from './release-publish-view'
import {
  canRunServiceDeploymentAction,
  createDeploymentIssueSummary,
  createDeploymentFilterOptions,
  createDeploymentRows,
  createDeploymentStatusSummary,
  createSystemLogEntry,
  createSystemLogSummary,
  defaultDeploymentAutoRefreshEnabled,
  deploymentAutoRefreshIntervalMs,
  deploymentRateLimitFallbackMs,
  filterDeploymentRows,
  getDeploymentProjectTagStyle,
  getDeploymentRateLimitRetryMs,
  getNextDeploymentVisibleCount,
  getVisibleDeploymentRows,
  initialDeploymentVisibleCount,
  isDeploymentRateLimitMessage,
  railwayDeploymentRefreshBatchSize,
  selectDeploymentRefreshServices,
  type DeploymentDashboardFilters,
  type DeploymentDashboardRow,
  type DeploymentIssueSummary,
  type DeploymentRefreshCursor,
  type DeploymentRefreshError,
  type ServiceDeploymentAction,
  type SystemLogEntry,
  type SystemLogLevel
} from './service-deployments-view'
import { getServiceProviderGuide, type ServiceProviderGuideProvider } from './service-config-guide'
import {
  createRailwayProjectEnvironmentGroups,
  createServiceDetailSummary,
  createServiceProviderOverview,
  createServiceProviderSections,
  getServiceEnvironmentLogActions,
  getMonitorableServiceDomains,
  getRailwayEnvironmentServiceTableScrollX,
  getServiceProviderCapabilities,
  getServiceProviderLabel,
  getProjectServiceStats,
  type RailwayProjectServiceGroup,
  type ServiceLogMode
} from './service-monitor-view'
import { createEmptySshConfigEntry, parseSshConfigEntries, serializeSshConfigEntries, type SshConfigEntry } from './ssh-config-model'
import { useForgeDeskStore } from './store'
import { TerminalWorkspace } from './terminal-panel'
import type { TerminalOpenRequest } from './terminal-panel-events'
import { TerminalRemoteShortcuts } from './terminal-remote-shortcuts'
import { TaskListPanel } from './task-list-panel'
import type { ResolvedTheme, ThemePreference } from './app-theme'

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

type SshPassphraseForm = {
  passphrase: string
  confirmPassphrase: string
}

type SettingsModuleKey = 'overview' | 'appearance' | 'git' | 'github' | 'codemagic' | 'private' | 'public' | 'config' | 'services' | 'plane' | 'oa' | 'ai' | 'updates' | 'log-refresh'
type SettingsOverviewModuleKey = Exclude<SettingsModuleKey, 'overview'>
type SettingsOverviewCategory = {
  title: string
  description: string
  keys: SettingsOverviewModuleKey[]
}

type AppProps = {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  onThemePreferenceChange: (preference: ThemePreference) => void
}

function getThemePreferenceLabel(preference: ThemePreference): string {
  switch (preference) {
    case 'light':
      return '白天模式'
    case 'dark':
      return '黑夜模式'
    default:
      return '跟随系统'
  }
}

function getResolvedThemeLabel(theme: ResolvedTheme): string {
  return theme === 'dark' ? '当前黑夜' : '当前白天'
}

type AiSettingsForm = {
  enabled: boolean
  provider: 'openai-compatible' | 'openrouter'
  baseUrl: string
  apiKey?: string
  model: string
  temperature: number
}

type GithubTokenForm = {
  name: string
  token?: string
}

type CodemagicTokenForm = {
  name: string
  token?: string
}

type PlaneSettingsForm = {
  apiBaseUrl: string
  webBaseUrl: string
  apiToken?: string
}

type OaSettingsForm = {
  enabled: boolean
  larkAppId: string
  larkAppSecret?: string
  docsHomeUrl: string
  enableDocumentBrowsing: boolean
  enableDocumentEditing: boolean
  enableAiDocumentDrafting: boolean
}

const AI_PROVIDER_PRESETS: Record<AiSettingsForm['provider'], { label: string; baseUrl: string; model: string; apiKeyPlaceholder: string }> = {
  'openai-compatible': {
    label: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    apiKeyPlaceholder: 'sk-...'
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: '~openai/gpt-latest',
    apiKeyPlaceholder: 'sk-or-v1-...'
  }
}

const AI_MODEL_OPTIONS: Record<AiSettingsForm['provider'], string[]> = {
  'openai-compatible': [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o3',
    'o4-mini'
  ],
  openrouter: [
    '~openai/gpt-latest',
    'openai/gpt-4.1',
    'openai/gpt-4.1-mini',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.7-sonnet',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-chat-v3-0324',
    'deepseek/deepseek-r1',
    'meta-llama/llama-4-maverick',
    'qwen/qwen3-235b-a22b'
  ]
}

const projectWorkspaceStatusRefreshIntervalMs = 5000

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

type PlaneBindingForm = {
  workspaceSlug: string
  planeProjectId: string
}

type BranchTagForm = {
  label: string
  branchName: string
  color: string
}

type RepositoryRemoteForm = {
  name: string
  fetchUrl: string
  pushUrl: string
}

type ServiceConnectionForm = {
  provider: ServiceProviderType
  name: string
  token?: string
  teamId?: string
  workspaceId?: string
  railwayTokenType: RailwayTokenType
}

type ProjectServiceForm = {
  provider: ServiceProviderType
  connectionId?: string
  repositoryId?: string
  name: string
  externalProjectId?: string
  externalServiceId?: string
  defaultEnvironment?: string
  healthPath: string
  enabled: boolean
  domainsText?: string
}

type ProjectServiceBindingForm = {
  serviceId: string
  repositoryId?: string
}

type ServiceExternalProjectAliasForm = {
  alias?: string
}

type VercelEnvVarForm = {
  key: string
  value?: string
  type: string
  target?: string[]
  gitBranch?: string
  comment?: string
}

type VercelDomainForm = {
  name: string
  environmentName?: string
  gitBranch?: string
  redirect?: string
  redirectStatusCode?: number
}

const serviceEnvVarInitialVisibleCount = 24
const serviceEnvVarLoadMoreCount = 24
const serviceEnvVarLoadMoreThreshold = 48

type SystemLogInput = Omit<SystemLogEntry, 'id' | 'time'>

type SystemLogFilter = SystemLogLevel | 'all'

type SystemLogHandler = (entry: SystemLogInput) => void

type QuickBuildStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled'

type QuickBuildState = {
  status: QuickBuildStatus
  command: string
  cwd: string
  taskId?: string
  startedAt?: string
  finishedAt?: string
  exitCode?: number
  signal?: string
  log?: string
  stdout?: string
  stderr?: string
  updatedAt?: string
  message?: string
}

const quickBuildCommand = 'pnpm package:mac:legacy'

function createInitialQuickBuildState(): QuickBuildState {
  return {
    command: quickBuildCommand,
    cwd: '',
    status: 'idle'
  }
}

function formatQuickBuildTime(value?: string): string {
  if (!value) {
    return '未开始'
  }

  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString('zh-CN', { hour12: false })
}

function getQuickBuildStatusText(status: QuickBuildStatus): string {
  switch (status) {
    case 'running':
      return '执行中'
    case 'success':
      return '已完成'
    case 'error':
      return '失败'
    case 'cancelled':
      return '已终止'
    case 'idle':
      return '未执行'
  }
}

function mapQuickBuildTaskStatus(status: QuickBuildTask['status']): QuickBuildStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'succeeded':
      return 'success'
    case 'cancelled':
      return 'cancelled'
    case 'failed':
      return 'error'
  }
}

function createQuickBuildStateFromTask(task: QuickBuildTask | null, fallbackCwd = ''): QuickBuildState {
  if (!task) {
    return {
      ...createInitialQuickBuildState(),
      cwd: fallbackCwd
    }
  }

  return {
    command: task.command,
    cwd: task.cwd,
    exitCode: task.exitCode ?? undefined,
    finishedAt: task.finishedAt,
    log: task.log,
    message: task.error || task.hint || task.phase,
    signal: task.signal,
    startedAt: task.startedAt,
    status: mapQuickBuildTaskStatus(task.status),
    stderr: task.stderr,
    stdout: task.stdout,
    taskId: task.id,
    updatedAt: task.updatedAt
  }
}

function formatQuickBuildLastOutput(log?: string): string {
  const lines = (log ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  const latest = lines.at(-1)

  if (!latest) {
    return '暂无输出'
  }

  return latest.length > 180 ? `${latest.slice(0, 180)}...` : latest
}

function getQuickBuildTaskResultTitle(task: QuickBuildTask): string {
  if (task.status === 'succeeded') {
    return '快速构建完成'
  }

  if (task.status === 'cancelled') {
    return '快速构建已终止'
  }

  return `快速构建失败（退出码 ${task.exitCode ?? '-'}${task.signal ? `，信号 ${task.signal}` : ''}）`
}

function formatQuickBuildTaskLogMessage(task: QuickBuildTask): string {
  const summary = [
    `命令：${task.command}`,
    `目录：${task.cwd}`,
    `开始：${formatQuickBuildTime(task.startedAt)}`,
    `结束：${formatQuickBuildTime(task.finishedAt)}`,
    `退出码：${task.exitCode ?? '-'}`,
    task.error ? `错误：${task.error}` : ''
  ].filter(Boolean)

  return [summary.join('\n'), task.log].filter(Boolean).join('\n\n')
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function readStoredGitLogRefreshPreferences(): GitLogRefreshPreferences {
  if (typeof window === 'undefined') {
    return defaultGitLogRefreshPreferences
  }

  try {
    const rawValue = window.localStorage.getItem(gitLogRefreshPreferenceStorageKey)
    return normalizeGitLogRefreshPreferences(rawValue ? JSON.parse(rawValue) : null)
  } catch {
    return defaultGitLogRefreshPreferences
  }
}

function writeStoredGitLogRefreshPreferences(input: unknown): GitLogRefreshPreferences {
  const preferences = normalizeGitLogRefreshPreferences(input)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(gitLogRefreshPreferenceStorageKey, JSON.stringify(preferences))
      window.dispatchEvent(new Event(gitLogRefreshPreferenceChangedEvent))
    } catch {
      // The setting is non-critical; keep the in-memory value even if storage is unavailable.
    }
  }

  return preferences
}

function useGitLogRefreshPreferences(): [GitLogRefreshPreferences, (input: unknown) => void] {
  const [preferences, setPreferences] = useState(readStoredGitLogRefreshPreferences)

  useEffect(() => {
    function syncPreferences(): void {
      setPreferences(readStoredGitLogRefreshPreferences())
    }

    window.addEventListener('storage', syncPreferences)
    window.addEventListener(gitLogRefreshPreferenceChangedEvent, syncPreferences)

    return () => {
      window.removeEventListener('storage', syncPreferences)
      window.removeEventListener(gitLogRefreshPreferenceChangedEvent, syncPreferences)
    }
  }, [])

  function savePreferences(input: unknown): void {
    setPreferences(writeStoredGitLogRefreshPreferences(input))
  }

  return [preferences, savePreferences]
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

function omitRecordKeys<T>(record: Record<string, T>, keys: Set<string>): Record<string, T> {
  if (keys.size === 0 || !Object.keys(record).some((key) => keys.has(key))) {
    return record
  }

  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key))) as Record<string, T>
}

function getFileStatusLabel(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    A: { label: '新增', color: 'green' },
    M: { label: '修改', color: 'blue' },
    D: { label: '删除', color: 'red' },
    R: { label: '重命名', color: 'purple' },
    C: { label: '复制', color: 'cyan' },
    U: { label: '冲突', color: 'red' },
    '?': { label: '未跟踪', color: 'default' }
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

function getServiceMonitorStatusMeta(status: ServiceMonitorStatus): {
  label: string
  color: string
  badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning'
} {
  const statusMap: Record<ServiceMonitorStatus, { label: string; color: string; badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning' }> = {
    online: { label: '在线', color: 'green', badgeStatus: 'success' },
    degraded: { label: '异常', color: 'orange', badgeStatus: 'warning' },
    offline: { label: '离线', color: 'red', badgeStatus: 'error' },
    unknown: { label: '未检查', color: 'default', badgeStatus: 'default' }
  }

  return statusMap[status] ?? statusMap.unknown
}

function parseServiceDomainsText(value = ''): Array<{ domain: string; enabled: boolean; kind: 'manual' }> {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((domain) => ({ domain, enabled: true, kind: 'manual' }))
}

function formatServiceDomainsText(domains: ProjectServiceDomain[]): string {
  return domains.map((domain) => domain.domain).join('\n')
}

function ServiceProviderGuidePanel({ provider }: { provider: ServiceProviderGuideProvider }): JSX.Element {
  const guide = getServiceProviderGuide(provider)

  return (
    <div className="service-guide-box">
      <div className="service-guide-heading">
        <Space direction="vertical" size={2}>
          <Space size={6} wrap>
            <Tag>{guide.title}</Tag>
            <Typography.Text strong>{guide.title} 配置入口</Typography.Text>
          </Space>
          <Typography.Text type="secondary">Token 保存后只显示已配置，不会展示明文。</Typography.Text>
        </Space>
        <Space wrap size={8} className="service-guide-actions">
          <Button size="small" icon={<LinkOutlined />} href={guide.primaryTokenUrl} target="_blank" rel="noreferrer">
            Token 页面
          </Button>
          {guide.projectTokenDocsUrl ? (
            <Button size="small" href={guide.projectTokenDocsUrl} target="_blank" rel="noreferrer">
              Project Token
            </Button>
          ) : null}
          <Button size="small" href={guide.dashboardUrl} target="_blank" rel="noreferrer">
            控制台
          </Button>
          <Button size="small" href={guide.docsUrl} target="_blank" rel="noreferrer">
            API 文档
          </Button>
        </Space>
      </div>
      <ol className="service-guide-steps">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

function formatShortCommit(commitHash: string): string {
  return commitHash ? commitHash.slice(0, 7) : '-'
}

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return '-'
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

function getAvatarLabel(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return '?'
  }

  return trimmed.slice(0, 1).toUpperCase()
}

function getSystemLogLevelMeta(level: SystemLogLevel): {
  label: string
  color: string
  badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning'
} {
  const levelMap: Record<SystemLogLevel, { label: string; color: string; badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning' }> = {
    success: { label: '成功', color: 'green', badgeStatus: 'success' },
    info: { label: '信息', color: 'blue', badgeStatus: 'processing' },
    warning: { label: '警告', color: 'gold', badgeStatus: 'warning' },
    error: { label: '错误', color: 'red', badgeStatus: 'error' }
  }

  return levelMap[level]
}

function formatSystemLogCopyText(log: SystemLogEntry): string {
  return [`${formatDateTime(log.time)} [${getSystemLogLevelMeta(log.level).label}] ${log.source} / ${log.title}`, log.message].join('\n')
}

function SystemLogDrawer({
  open,
  logs,
  filter,
  onFilterChange,
  onClose,
  onClear
}: {
  open: boolean
  logs: SystemLogEntry[]
  filter: SystemLogFilter
  onFilterChange: (filter: SystemLogFilter) => void
  onClose: () => void
  onClear: () => void
}): JSX.Element {
  const visibleLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter)

  return (
    <Drawer
      title="系统日志"
      open={open}
      width="min(860px, calc(100vw - 48px))"
      onClose={onClose}
      extra={
        <Button size="small" disabled={logs.length === 0} onClick={onClear}>
          清空
        </Button>
      }
    >
      <Space direction="vertical" size={12} className="system-log-drawer">
        <Segmented
          size="small"
          value={filter}
          onChange={(value) => onFilterChange(value as SystemLogFilter)}
          options={[
            { label: '全部', value: 'all' },
            { label: '错误', value: 'error' },
            { label: '警告', value: 'warning' },
            { label: '信息', value: 'info' },
            { label: '成功', value: 'success' }
          ]}
        />
        <div className="system-log-list">
          {visibleLogs.length > 0 ? (
            visibleLogs.map((log) => {
              const meta = getSystemLogLevelMeta(log.level)

              return (
                <div key={log.id} className={`system-log-item system-log-item-${log.level}`}>
                  <div className="system-log-item-meta">
                    <Badge status={meta.badgeStatus} />
                    <Tag color={meta.color}>{meta.label}</Tag>
                    <Typography.Text type="secondary">{formatDateTime(log.time)}</Typography.Text>
                    <Typography.Text type="secondary">{log.source}</Typography.Text>
                  </div>
                  <div className="system-log-item-body">
                    <Typography.Text strong>{log.title}</Typography.Text>
                    <Typography.Text className="system-log-message" copyable={{ text: formatSystemLogCopyText(log) }}>
                      {log.message}
                    </Typography.Text>
                  </div>
                </div>
              )
            })
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
          )}
        </div>
      </Space>
    </Drawer>
  )
}

function AppStatusBar({
  summary,
  refreshing,
  showQuickBuildButton,
  quickBuildState,
  quickBuildTooltip,
  versionLabel,
  onQuickBuild,
  onOpenLogs
}: {
  summary: ReturnType<typeof createSystemLogSummary>
  refreshing: boolean
  showQuickBuildButton: boolean
  quickBuildState: QuickBuildState
  quickBuildTooltip: JSX.Element
  versionLabel: string
  onQuickBuild: () => void
  onOpenLogs: () => void
}): JSX.Element {
  const latest = summary.latest
  const level = summary.error > 0 ? 'error' : summary.warning > 0 ? 'warning' : latest?.level ?? 'success'
  const levelMeta = getSystemLogLevelMeta(level)
  const issueLabel = summary.issueCount > 0 ? `${summary.issueCount} 异常` : '无异常'
  const latestLabel = latest ? `${latest.title} · ${formatRelativeTime(latest.time)}` : '系统正常'

  return (
    <div className={`app-status-bar app-status-bar-${level}`}>
      <button type="button" className="app-status-bar-item app-status-bar-primary" onClick={onOpenLogs}>
        <Badge status={refreshing ? 'processing' : levelMeta.badgeStatus} />
        <span>{refreshing ? '部署刷新中' : latestLabel}</span>
      </button>
      <button type="button" className="app-status-bar-item" onClick={onOpenLogs}>
        <FileTextOutlined />
        <span>系统日志 {summary.total}</span>
      </button>
      <button type="button" className="app-status-bar-item" onClick={onOpenLogs}>
        <span>{issueLabel}</span>
      </button>
      <span className="app-status-bar-spacer" />
      {showQuickBuildButton ? (
        <Tooltip title={quickBuildTooltip} placement="topRight">
          <button type="button" className={`app-status-bar-item app-status-bar-quick-build is-${quickBuildState.status}`} onClick={onQuickBuild}>
            <ThunderboltOutlined />
            <span>快速构建</span>
            <span className={`quick-build-status-dot is-${quickBuildState.status}`} />
          </button>
        </Tooltip>
      ) : null}
      <span className="app-status-bar-item app-status-bar-static">Ready</span>
      {versionLabel ? <span className="app-status-bar-item app-status-bar-static app-status-bar-version">{versionLabel}</span> : null}
    </div>
  )
}

function getRemoteAlignmentDetail(alignment: RemoteAlignmentSummary): string {
  if (alignment.errorMessage) {
    return alignment.errorMessage
  }

  if (alignment.remoteCount < 2) {
    return '至少需要 2 个远端'
  }

  if (alignment.branchCount === 0) {
    return '没有本地远端引用'
  }

  return `${alignment.alignedBranchCount}/${alignment.branchCount} 个分支对齐`
}

function RemoteAlignmentBadge({ alignment }: { alignment: RemoteAlignmentSummary }): JSX.Element {
  const meta = getRemoteAlignmentStatusMeta(alignment.status)
  const remoteNames = alignment.remotes.map((remote) => remote.name).filter(Boolean).join(' ↔ ')

  return (
    <Space direction="vertical" size={2}>
      <Badge status={meta.badgeStatus} text={<Typography.Text>{meta.label}</Typography.Text>} />
      <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: getRemoteAlignmentDetail(alignment) }}>
        {remoteNames || `${formatNumber(alignment.remoteCount)} 个远端`} · {getRemoteAlignmentDetail(alignment)}
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

const graphRowHeight = 46
const graphRowMiddle = graphRowHeight / 2
const graphLineOverflow = 2
const graphCurveOffset = 12
const commitGraphBatchSize = 60

type RepositoryLogCommit = GitCommit & {
  isWorkingTreeCommit?: boolean
  worktreeFiles?: GitCommitFileChange[]
}

function createGraphParentPath({
  fromX,
  toX
}: {
  fromX: number
  toX: number
}): string {
  if (fromX === toX) {
    return `M ${fromX} ${graphRowMiddle} L ${toX} ${graphRowHeight + graphLineOverflow}`
  }

  return [
    `M ${fromX} ${graphRowMiddle}`,
    `C ${fromX} ${graphRowMiddle + graphCurveOffset}`,
    `${toX} ${graphRowHeight - graphCurveOffset}`,
    `${toX} ${graphRowHeight + graphLineOverflow}`
  ].join(' ')
}

function CommitGraphCell({ commit }: { commit: BranchColoredGitGraphRow<RepositoryLogCommit> }): JSX.Element {
  const isMerge = commit.parentHashes.length > 1
  const isWorkingTree = isWorkingTreeCommit(commit)
  const graphCellBottomLaneIndexes = getGraphCellBottomLaneIndexes(commit)
  const graphCellBottomLaneIndexSet = new Set(graphCellBottomLaneIndexes)
  const graphCellSideContinuationLaneIndexes = commit.graphBottomLaneIndexes.filter((laneIndex) => !graphCellBottomLaneIndexSet.has(laneIndex))
  const allLaneIndexes = [
    commit.graphLaneIndex,
    ...commit.graphParentLaneIndexes,
    ...commit.graphTopLaneIndexes,
    ...commit.graphBottomLaneIndexes
  ]
  const laneCount = Math.max(commit.graphLanes.length, ...allLaneIndexes.map((index) => index + 1), 1)
  const svgWidth = Math.max(42, laneCount * gitGraphLaneWidth)
  const xForLane = (index: number): number => index * gitGraphLaneWidth + gitGraphLaneWidth / 2
  const parentEdges = commit.graphParentEdges.filter((edge) => edge.fromLaneIndex !== edge.toLaneIndex)
  const getLaneColor = (laneIndex: number): string => (isWorkingTree ? '#98a2b3' : commit.graphLaneColors[laneIndex] ?? getGraphLaneColor(laneIndex))

  return (
    <div className={isWorkingTree ? 'commit-graph-cell is-working-tree' : 'commit-graph-cell'}>
      <svg
        aria-hidden="true"
        className="commit-graph-svg"
        focusable="false"
        height="100%"
        width={svgWidth}
      >
        {commit.graphTopLaneIndexes.map((laneIndex) => (
          <line
            key={`top-${laneIndex}`}
            className={laneIndex === commit.graphLaneIndex ? 'commit-graph-line is-active' : 'commit-graph-line'}
            stroke={getLaneColor(laneIndex)}
            x1={xForLane(laneIndex)}
            x2={xForLane(laneIndex)}
            y1={-graphLineOverflow}
            y2={graphRowMiddle}
          />
        ))}
        {graphCellBottomLaneIndexes.map((laneIndex) => (
          <line
            key={`bottom-${laneIndex}`}
            className={laneIndex === commit.graphLaneIndex ? 'commit-graph-line is-active' : 'commit-graph-line'}
            stroke={getLaneColor(laneIndex)}
            x1={xForLane(laneIndex)}
            x2={xForLane(laneIndex)}
            y1={graphRowMiddle}
            y2="100%"
          />
        ))}
        {graphCellSideContinuationLaneIndexes.map((laneIndex) => (
          <line
            key={`side-continuation-${laneIndex}`}
            className={laneIndex === commit.graphLaneIndex ? 'commit-graph-line is-active' : 'commit-graph-line'}
            stroke={getLaneColor(laneIndex)}
            x1={xForLane(laneIndex)}
            x2={xForLane(laneIndex)}
            y1={graphRowHeight - graphLineOverflow}
            y2="100%"
          />
        ))}
        {parentEdges.map((edge) => (
          <path
            key={`parent-edge-${edge.fromLaneIndex}-${edge.toLaneIndex}`}
            className="commit-graph-parent-edge"
            d={createGraphParentPath({
              fromX: xForLane(edge.fromLaneIndex),
              toX: xForLane(edge.toLaneIndex)
            })}
            stroke={getLaneColor(edge.toLaneIndex)}
          />
        ))}
        <circle
          className={isMerge ? 'commit-graph-dot merge' : 'commit-graph-dot'}
          cx={xForLane(commit.graphLaneIndex)}
          cy={graphRowMiddle}
          fill={getLaneColor(commit.graphLaneIndex)}
          r={isMerge ? 4.5 : 3.8}
          stroke="#ffffff"
        />
      </svg>
    </div>
  )
}

function CommitGraphContinuation({
  commit,
  columnWidth
}: {
  commit: BranchColoredGitGraphRow<RepositoryLogCommit>
  columnWidth: number
}): JSX.Element {
  const isWorkingTree = isWorkingTreeCommit(commit)
  const allLaneIndexes = [...commit.graphBottomLaneIndexes, ...commit.graphParentEdges.map((edge) => edge.toLaneIndex)]
  const laneCount = Math.max(commit.graphLanes.length, ...allLaneIndexes.map((index) => index + 1), 1)
  const svgWidth = Math.max(42, laneCount * gitGraphLaneWidth)
  const xForLane = (index: number): number => index * gitGraphLaneWidth + gitGraphLaneWidth / 2

  return (
    <div className={isWorkingTree ? 'commit-expanded-graph-cell is-working-tree' : 'commit-expanded-graph-cell'} style={{ width: columnWidth }}>
      <svg
        aria-hidden="true"
        className="commit-expanded-graph-svg"
        focusable="false"
        height="100%"
        width={svgWidth}
      >
        {commit.graphBottomLaneIndexes.map((laneIndex) => (
          <line
            key={`expanded-bottom-${laneIndex}`}
            className={laneIndex === commit.graphLaneIndex ? 'commit-graph-line is-active' : 'commit-graph-line'}
            stroke={isWorkingTree ? '#98a2b3' : commit.graphLaneColors[laneIndex] ?? getGraphLaneColor(laneIndex)}
            x1={xForLane(laneIndex)}
            x2={xForLane(laneIndex)}
            y1={-graphLineOverflow}
            y2="100%"
          />
        ))}
      </svg>
    </div>
  )
}

function CommitAuthorCell({ commit }: { commit: RepositoryLogCommit }): JSX.Element {
  const author = getCommitAuthorDisplay(commit)

  return (
    <span className="commit-author-cell" title={author.title}>
      <span className="commit-author-name">{author.name}</span>
      {author.email && <span className="commit-author-email">{author.email}</span>}
    </span>
  )
}

function CommitMessageCell({ commit, branchTags, currentBranch }: { commit: RepositoryLogCommit; branchTags: ProjectBranchTag[]; currentBranch: string }): JSX.Element {
  const isWorkingTree = isWorkingTreeCommit(commit)

  return (
    <div className={isWorkingTree ? 'source-tree-commit-message is-working-tree' : 'source-tree-commit-message'}>
      <div className="source-tree-commit-line">
        <Tag className={isWorkingTree ? 'source-tree-hash source-tree-worktree-hash' : 'source-tree-hash'}>{commit.shortHash}</Tag>
        <Typography.Text className="source-tree-message-text" ellipsis={{ tooltip: commit.message }}>
          {commit.message}
        </Typography.Text>
      </div>
      {isWorkingTree ? (
        <div className="source-tree-ref-strip">
          <Tag className="source-tree-ref source-tree-worktree-ref">工作区</Tag>
        </div>
      ) : commit.refs.length > 0 && (
        <div className="source-tree-ref-strip">
          {commit.refs.slice(0, 6).map((ref) => (
            <Tag key={ref} color={getRefColor(ref, branchTags, currentBranch)} className="source-tree-ref">
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
  loadingFiles,
  onSelectFile,
  graphColumnWidth,
  branchTags,
  currentBranch,
  canOpenDiff
}: {
  commit: BranchColoredGitGraphRow<RepositoryLogCommit>
  files: GitCommitFileChange[]
  selectedFile: GitCommitFileChange | null
  loadingFiles: boolean
  onSelectFile: (file: GitCommitFileChange) => void
  graphColumnWidth: number
  branchTags: ProjectBranchTag[]
  currentBranch: string
  canOpenDiff: boolean
}): JSX.Element {
  const author = getCommitAuthorDisplay(commit)
  const isWorkingTree = isWorkingTreeCommit(commit)

  return (
    <div className="commit-expanded-detail-row">
      <CommitGraphContinuation commit={commit} columnWidth={graphColumnWidth} />
      <div className="commit-inline-detail">
        <div className="commit-inline-heading">
          <div>
            <Typography.Text strong>{commit.message}</Typography.Text>
            <div className="commit-meta">
              <Tag className="commit-hash-full">{isWorkingTree ? '未提交' : commit.hash}</Tag>
              {isWorkingTree ? (
                <Tag className="source-tree-ref source-tree-worktree-ref">工作区</Tag>
              ) : (
                commit.refs.map((ref) => (
                  <Tag key={ref} color={getRefColor(ref, branchTags, currentBranch)} className="source-tree-ref">
                    {ref}
                  </Tag>
                ))
              )}
              <Typography.Text type="secondary">
                {isWorkingTree ? '当前工作区' : `${author.email ? `${author.name} · ${author.email}` : author.name} · ${new Date(commit.committedAt).toLocaleString()}`}
              </Typography.Text>
            </div>
          </div>
          <Tag>{formatNumber(files.length)} 个文件</Tag>
        </div>
        <Table
          rowKey="id"
          size="small"
          loading={loadingFiles}
          dataSource={files}
          pagination={false}
          rowClassName={(file) => (file.id === selectedFile?.id ? 'selected-row' : '')}
          onRow={(file) => (canOpenDiff ? { onClick: () => onSelectFile(file) } : {})}
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
            { title: '+/-', key: 'lines', width: 104, render: (_, file) => (file.binary ? '二进制' : `${formatNumber(file.additions)} / ${formatNumber(file.deletions)}`) },
            {
              title: '对比',
              key: 'diff',
              width: 92,
              render: (_, file) =>
                canOpenDiff ? (
                  <Button size="small" icon={<DiffOutlined />} onClick={(event) => {
                    event.stopPropagation()
                    onSelectFile(file)
                  }}>
                    查看
                  </Button>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                )
            }
          ]}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个提交没有文件变更" /> }}
        />
      </div>
    </div>
  )
}

function DiffLineRow({ line, side }: { line: DiffDisplayLine; side: 'source' | 'result' }): JSX.Element {
  const lineNumber = side === 'source' ? line.oldLineNumber : line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
  const marker = side === 'result' && line.type === 'add' ? '+' : side === 'result' && line.type === 'delete' ? '-' : ''

  return (
    <div className={side === 'result' ? `diff-line ${line.type}` : 'diff-line source'}>
      <span className="diff-line-marker">{marker}</span>
      <span className="diff-line-number">{lineNumber ?? ''}</span>
      <span className="diff-line-content">{line.text || ' '}</span>
    </div>
  )
}

function DiffPane({
  title,
  lines,
  side,
  emptyText
}: {
  title: string
  lines: DiffDisplayLine[]
  side: 'source' | 'result'
  emptyText: string
}): JSX.Element {
  return (
    <div className="diff-pane">
      <div className="diff-pane-title">{title}</div>
      {lines.length > 0 ? (
        <div className="diff-lines">
          {lines.map((line) => (
            <DiffLineRow key={line.id} line={line} side={side} />
          ))}
        </div>
      ) : (
        <div className="diff-empty">{emptyText}</div>
      )}
    </div>
  )
}

function DiffViewer({ diff }: { diff: GitCommitDiff | null }): JSX.Element {
  if (!diff) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择文件后查看对比" />
  }

  if (diff.binary) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="二进制文件无法预览文本差异" />
  }

  const sourceLines = createSourceDiffLines(diff.oldContent)
  const resultLines = createDiffResultLines(diff)

  return (
    <div className="diff-merged">
      <DiffPane title="上一版（源文件）" lines={sourceLines} side="source" emptyText="上一版为空" />
      <DiffPane title="Diff 结果" lines={resultLines} side="result" emptyText="这个文件没有文本差异" />
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

function isAiSettingsReady(settings: AiSettingsView | null): boolean {
  return Boolean(settings?.enabled && settings.apiKeyConfigured && settings.model)
}

function populateAiSettingsForm(form: FormInstance<AiSettingsForm>, settings: AiSettingsView): void {
  form.setFieldsValue({
    enabled: settings.enabled,
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    temperature: settings.temperature
  })
}

function getGithubTokenTypeLabel(token: GithubTokenView): string {
  if (token.tokenType === 'classic') {
    return 'Classic PAT'
  }

  if (token.tokenType === 'fine-grained-or-app') {
    return 'Fine-grained / App'
  }

  return '未识别类型'
}

function formatGithubTokenCheckedAt(token: GithubTokenView): string {
  if (!token.lastCheckedAt) {
    return '未校验'
  }

  return new Date(token.lastCheckedAt).toLocaleString()
}

function renderGithubTokenScopes(token: GithubTokenView): JSX.Element {
  if (token.scopes.length === 0) {
    return <Tag color="default">{token.permissionSummary}</Tag>
  }

  return (
    <>
      {token.scopes.map((scope) => (
        <Tag key={scope} color={scope.includes('repo') || scope.includes('workflow') ? 'blue' : 'default'}>
          {scope}
        </Tag>
      ))}
    </>
  )
}

type AiSettingsSectionProps = {
  form: FormInstance<AiSettingsForm>
  settings: AiSettingsView | null
  loading: boolean
  saving: boolean
  onRefresh: () => void | Promise<unknown>
  onSave: () => void | Promise<void>
  onBack?: () => void
}

function AiSettingsSection({ form, settings, loading, saving, onRefresh, onSave, onBack }: AiSettingsSectionProps): JSX.Element {
  const aiReady = isAiSettingsReady(settings)
  const provider = Form.useWatch('provider', form) ?? settings?.provider ?? 'openai-compatible'
  const providerPreset = AI_PROVIDER_PRESETS[provider]
  const modelOptions = AI_MODEL_OPTIONS[provider].map((model) => ({ label: model, value: model }))

  return (
    <div className="panel settings-module-panel">
      <div className="settings-module-header">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>AI 助手</Typography.Title>
          <Typography.Text type="secondary">配置 OpenAI-compatible 模型，用于生成合并冲突建议和提交信息。</Typography.Text>
        </Space>
        <Space wrap>
          {onBack && <Button onClick={onBack}>返回总览</Button>}
          <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            重新读取
          </Button>
        </Space>
      </div>
      <Alert
        className="settings-module-alert"
        type={aiReady ? 'success' : 'info'}
        showIcon
        message={aiReady ? 'AI 助手已启用' : '保存 API Key 后，可以请求合并建议和提交信息'}
        description={settings?.apiKeyConfigured ? 'API Key 已保存，可以在下方输入框通过显示按钮查看。' : 'API Key 只保存在本机应用数据目录，用于请求你配置的模型服务。'}
      />
      <Form form={form} layout="vertical" className="settings-management-form">
        <div className="ai-settings-grid">
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择 AI 提供商' }]}>
            <Select
              options={[
                { label: AI_PROVIDER_PRESETS['openai-compatible'].label, value: 'openai-compatible' },
                { label: AI_PROVIDER_PRESETS.openrouter.label, value: 'openrouter' }
              ]}
              onChange={(value: AiSettingsForm['provider']) => {
                const preset = AI_PROVIDER_PRESETS[value]
                form.setFieldsValue({
                  baseUrl: preset.baseUrl,
                  model: preset.model
                })
              }}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" rules={[{ required: true, message: '请选择启用状态' }]}>
            <Select
              options={[
                { label: '启用', value: true },
                { label: '停用', value: false }
              ]}
            />
          </Form.Item>
          <Form.Item name="model" label="模型" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Select
              showSearch
              allowClear
              options={modelOptions}
              placeholder={providerPreset.model}
              optionFilterProp="label"
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              onSearch={(value) => {
                if (value) {
                  form.setFieldValue('model', value)
                }
              }}
              onInputKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const value = (event.target as HTMLInputElement).value.trim()

                  if (value) {
                    form.setFieldValue('model', value)
                  }
                }
              }}
            />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder={providerPreset.baseUrl} />
          </Form.Item>
          <Form.Item name="temperature" label="Temperature" rules={[{ required: true, message: '请输入 Temperature' }]}>
            <InputNumber min={0} max={1} step={0.1} className="full-width-control" />
          </Form.Item>
        </div>
        <Form.Item name="apiKey" label="API Key">
          <Input.Password placeholder={settings?.apiKeyConfigured ? '已保存，留空不变' : providerPreset.apiKeyPlaceholder} />
        </Form.Item>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          保存 AI 设置
        </Button>
      </Form>
    </div>
  )
}

function isPlaneSettingsReady(settings: PlaneSettings | null): boolean {
  return Boolean(settings?.apiBaseUrl && settings.webBaseUrl && settings.tokenConfigured)
}

function populatePlaneSettingsForm(form: FormInstance<PlaneSettingsForm>, settings: PlaneSettings): void {
  form.setFieldsValue({
    apiBaseUrl: settings.apiBaseUrl,
    webBaseUrl: settings.webBaseUrl,
    apiToken: ''
  })
}

type PlaneSettingsSectionProps = {
  form: FormInstance<PlaneSettingsForm>
  settings: PlaneSettings | null
  loading: boolean
  saving: boolean
  testing: boolean
  testResult: PlaneConnectionTestResult | null
  onRefresh: () => void | Promise<unknown>
  onSave: () => void | Promise<void>
  onTest: () => void | Promise<void>
  onOpen: () => void | Promise<void>
  onBack?: () => void
}

function PlaneSettingsSection({ form, settings, loading, saving, testing, testResult, onRefresh, onSave, onTest, onOpen, onBack }: PlaneSettingsSectionProps): JSX.Element {
  const planeReady = isPlaneSettingsReady(settings)

  return (
    <div className="panel settings-module-panel">
      <div className="settings-module-header">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>Plane 集成</Typography.Title>
          <Typography.Text type="secondary">配置 Plane API / Web 地址和 API Token，用于在 ForgeDesk 中只读查看 Plane 内容。</Typography.Text>
        </Space>
        <Space wrap>
          {onBack && <Button onClick={onBack}>返回总览</Button>}
          <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            重新读取
          </Button>
          <Button icon={<LinkOutlined />} onClick={onOpen}>
            打开 Plane
          </Button>
        </Space>
      </div>
      <Alert
        className="settings-module-alert"
        type={testResult ? (testResult.ok ? 'success' : 'error') : planeReady ? 'success' : 'info'}
        showIcon
        message={testResult?.message ?? (planeReady ? 'Plane 已配置' : '保存 API Token 后，可以绑定项目并读取 Plane 内容')}
        description={settings?.tokenConfigured ? 'API Token 已保存在本机，界面不会回显明文。' : '在 Plane 个人设置的 API tokens 页面生成 token 后粘贴到这里。'}
      />
      <Form form={form} layout="vertical" className="settings-management-form">
        <div className="ai-settings-grid">
          <Form.Item name="apiBaseUrl" label="API Base URL" rules={[{ required: true, message: '请输入 Plane API 地址' }]}>
            <Input placeholder="http://localhost:8000" />
          </Form.Item>
          <Form.Item name="webBaseUrl" label="Web Base URL" rules={[{ required: true, message: '请输入 Plane Web 地址' }]}>
            <Input placeholder="http://localhost:3000" />
          </Form.Item>
        </div>
        <Form.Item name="apiToken" label="API Token">
          <Input.Password placeholder={settings?.tokenConfigured ? '已保存，留空不变' : 'plane_api_...'} />
        </Form.Item>
        <Space wrap>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            保存 Plane 设置
          </Button>
          <Button icon={<CheckCircleOutlined />} loading={testing} onClick={onTest}>
            测试连接
          </Button>
        </Space>
      </Form>
    </div>
  )
}

function isOaSettingsReady(settings: OaSettingsView | null): boolean {
  return Boolean(settings?.enabled && settings.larkAppId && settings.larkAppSecretConfigured && settings.docsHomeUrl)
}

function populateOaSettingsForm(form: FormInstance<OaSettingsForm>, settings: OaSettingsView): void {
  form.setFieldsValue({
    enabled: settings.enabled,
    larkAppId: settings.larkAppId,
    larkAppSecret: '',
    docsHomeUrl: settings.docsHomeUrl,
    enableDocumentBrowsing: settings.enableDocumentBrowsing,
    enableDocumentEditing: settings.enableDocumentEditing,
    enableAiDocumentDrafting: settings.enableAiDocumentDrafting
  })
}

const feishuDeveloperConsoleUrl = 'https://open.feishu.cn/app'
const feishuDeveloperDocsUrl = 'https://open.feishu.cn/document/home/index'

const oaSetupSteps = [
  {
    title: '打开开发者后台',
    description: '进入 Lark / 飞书开放平台，创建或选择一个企业自建应用。'
  },
  {
    title: '复制应用凭证',
    description: '在应用的凭证与基础信息里复制 App ID 和 App Secret，稍后填到下方表单。'
  },
  {
    title: '申请文档权限',
    description: '在权限管理里申请云文档读取、编辑和创建相关权限；只浏览文档时可以先关闭编辑和 AI 开关。'
  },
  {
    title: '发布到企业',
    description: '在版本管理与发布里创建版本并发布，确保当前企业成员可以使用这个应用。'
  },
  {
    title: '回到 ForgeDesk 保存',
    description: '粘贴 Lark 云盘、文件夹或文档入口链接、App ID 和 App Secret，打开启用开关后保存 OA 设置。'
  }
] as const

type OaSettingsSectionProps = {
  form: FormInstance<OaSettingsForm>
  settings: OaSettingsView | null
  loading: boolean
  saving: boolean
  onRefresh: () => void | Promise<unknown>
  onSave: () => void | Promise<void>
  onOpenDocs: () => void | Promise<void>
  onBack?: () => void
}

function OaSettingsSection({ form, settings, loading, saving, onRefresh, onSave, onOpenDocs, onBack }: OaSettingsSectionProps): JSX.Element {
  const oaReady = isOaSettingsReady(settings)
  const capabilityItems: Array<{ name: keyof OaSettingsForm; title: string; description: string; icon: JSX.Element }> = [
    {
      name: 'enableDocumentBrowsing',
      title: '快速浏览文档',
      description: '在 ForgeDesk 中保留 Lark 文档入口和浏览能力。',
      icon: <FileTextOutlined />
    },
    {
      name: 'enableDocumentEditing',
      title: '编辑文档',
      description: '允许后续文档工作流使用 Lark 编辑权限。',
      icon: <EditOutlined />
    },
    {
      name: 'enableAiDocumentDrafting',
      title: 'AI 协助产出文档',
      description: '把 AI 草稿、总结和结构化内容产出接入文档流。',
      icon: <ThunderboltOutlined />
    }
  ]

  return (
    <div className="panel settings-module-panel">
      <div className="settings-module-header">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>OA / Lark 文档</Typography.Title>
          <Typography.Text type="secondary">接入 Lark / 飞书文档，用于快速浏览、编辑和 AI 协助产出文档。</Typography.Text>
        </Space>
        <Space wrap>
          {onBack && <Button onClick={onBack}>返回总览</Button>}
          <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            重新读取
          </Button>
          <Button icon={<LinkOutlined />} onClick={onOpenDocs}>
            打开文档
          </Button>
        </Space>
      </div>
      <Alert
        className="settings-module-alert"
        type={oaReady ? 'success' : 'info'}
        showIcon
        message={oaReady ? 'Lark 文档已接入' : '保存 Lark App ID 和 App Secret 后启用 OA 文档能力'}
        description={settings?.larkAppSecretConfigured ? 'App Secret 已保存在本机，界面不会回显明文。' : '需要在 Lark / 飞书开放平台创建应用，并授予文档读取、编辑和创建相关权限。'}
      />
      <div className="oa-guide-panel">
        <div className="oa-guide-header">
          <Space direction="vertical" size={2}>
            <Typography.Title level={4}>Lark 接入教程</Typography.Title>
            <Typography.Text type="secondary">按顺序完成下面几步，再把应用信息保存到这里。</Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<LinkOutlined />} href={feishuDeveloperConsoleUrl} target="_blank" rel="noreferrer">
              打开开发者后台
            </Button>
            <Button href={feishuDeveloperDocsUrl} target="_blank" rel="noreferrer">
              开放平台文档
            </Button>
          </Space>
        </div>
        <ol className="oa-guide-steps">
          {oaSetupSteps.map((step, index) => (
            <li className="oa-guide-step" key={step.title}>
              <span className="oa-guide-step-index">{index + 1}</span>
              <span className="oa-guide-step-copy">
                <Typography.Text strong>{step.title}</Typography.Text>
                <Typography.Text type="secondary">{step.description}</Typography.Text>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <Form form={form} layout="vertical" className="settings-management-form oa-settings-form">
        <div className="ai-settings-grid">
          <Form.Item name="enabled" label="启用 Lark 集成" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item name="docsHomeUrl" label="Lark 云盘、文件夹或文档入口链接" rules={[{ required: true, message: '请输入 Lark 云盘、文件夹或文档入口链接' }]}>
            <Input placeholder="https://docs.feishu.cn/drive/me/、/drive/folder/... 或 /docx/..." />
          </Form.Item>
          <Form.Item name="larkAppId" label="Lark App ID" rules={[{ required: true, message: '请输入 Lark App ID' }]}>
            <Input placeholder="cli_aabbcc..." />
          </Form.Item>
          <Form.Item name="larkAppSecret" label="Lark App Secret">
            <Input.Password placeholder={settings?.larkAppSecretConfigured ? '已保存，留空不变' : 'app secret'} />
          </Form.Item>
        </div>
        <div className="oa-capability-grid">
          {capabilityItems.map((item) => (
            <div className="oa-capability-row" key={item.name}>
              <span className="oa-capability-icon">{item.icon}</span>
              <span className="oa-capability-copy">
                <Typography.Text strong>{item.title}</Typography.Text>
                <Typography.Text type="secondary">{item.description}</Typography.Text>
              </span>
              <Form.Item name={item.name} valuePropName="checked" className="oa-capability-switch">
                <Switch />
              </Form.Item>
            </div>
          ))}
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          保存 OA 设置
        </Button>
      </Form>
    </div>
  )
}

type OaDocsPanelProps = {
  onOpenSettings: () => void
}

function OaDocsPanel({ onOpenSettings }: OaDocsPanelProps): JSX.Element {
  const [settings, setSettings] = useState<OaSettingsView | null>(null)
  const [documentList, setDocumentList] = useState<OaDocumentList | null>(null)
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState(false)
  const oaReady = isOaSettingsReady(settings)
  const browsingReady = Boolean(oaReady && settings?.enableDocumentBrowsing)
  const documents = documentList?.documents ?? []
  const capabilityItems = [
    { key: 'enableDocumentBrowsing', title: '快速浏览文档', enabled: Boolean(settings?.enableDocumentBrowsing), icon: <FileTextOutlined /> },
    { key: 'enableDocumentEditing', title: '编辑文档', enabled: Boolean(settings?.enableDocumentEditing), icon: <EditOutlined /> },
    { key: 'enableAiDocumentDrafting', title: 'AI 协助产出', enabled: Boolean(settings?.enableAiDocumentDrafting), icon: <ThunderboltOutlined /> }
  ]
  const documentColumns: ColumnsType<OaDocumentRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, document) => (
        <Space size={8} wrap>
          <FileTextOutlined />
          <Typography.Text strong>{document.name}</Typography.Text>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>
    },
    {
      title: '更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, document) => (
        <Button size="small" icon={<LinkOutlined />} href={document.url} target="_blank" rel="noreferrer">
          打开
        </Button>
      )
    }
  ]

  async function refreshSettings(): Promise<void> {
    if (!window.forgeDesk) {
      setSettings(null)
      setDocumentList(null)
      return
    }

    setLoading(true)

    try {
      const nextSettings = await window.forgeDesk.getOaSettings()

      setSettings(nextSettings)

      if (isOaSettingsReady(nextSettings) && nextSettings.enableDocumentBrowsing) {
        setDocumentList(await window.forgeDesk.listOaDocuments())
      } else {
        setDocumentList(null)
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function openDocs(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中打开文档')
      return
    }

    if (!browsingReady) {
      message.warning('请先在 OA 设置里启用 Lark 文档浏览')
      return
    }

    setOpening(true)

    try {
      await window.forgeDesk.openOaDocs()
    } catch (error) {
      message.error(getErrorMessage(error, '打开 Lark 文档失败'))
    } finally {
      setOpening(false)
    }
  }

  useEffect(() => {
    refreshSettings()
  }, [])

  return (
    <section className="workspace-section oa-docs-workspace">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>文档</Typography.Title>
          <Typography.Text type="secondary">Lark / 飞书云盘文件夹和文档的日常入口。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={refreshSettings}>
            重新读取
          </Button>
          <Button icon={<SettingOutlined />} onClick={onOpenSettings}>
            设置集成
          </Button>
          <Button type="primary" icon={<LinkOutlined />} loading={opening} disabled={!browsingReady} onClick={openDocs}>
            打开文档
          </Button>
        </Space>
      </div>
      <div className="panel oa-docs-panel">
        <Alert
          className="settings-module-alert"
          type={browsingReady ? 'success' : oaReady ? 'info' : 'warning'}
          showIcon
          message={browsingReady ? 'Lark 文档入口已可用' : oaReady ? 'Lark 已接入，浏览入口未启用' : '还没有可用的 Lark 文档入口'}
          description={documentList?.unsupportedReason || (browsingReady ? '已读取当前入口下可展示的文件夹和文档。' : '打开 OA / Lark 文档设置，保存云盘根目录、文件夹或单篇文档链接、App ID 和 App Secret 后启用浏览。')}
        />
        {settings?.docsHomeUrl && (
          <Descriptions column={1} size="small" className="setup-description">
            <Descriptions.Item label="入口链接">
              <Typography.Text copyable>{settings.docsHomeUrl}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="App ID">{settings.larkAppId || '未填写'}</Descriptions.Item>
          </Descriptions>
        )}
        <div className="oa-docs-capability-list">
          {capabilityItems.map((item) => (
            <div className={`oa-docs-capability-item ${item.enabled ? 'is-enabled' : 'is-disabled'}`} key={item.key}>
              <span className="oa-docs-capability-icon">{item.icon}</span>
              <Typography.Text strong>{item.title}</Typography.Text>
              <Tag color={item.enabled ? 'green' : 'default'}>{item.enabled ? '已启用' : '未启用'}</Tag>
            </div>
          ))}
        </div>
        {documents.length > 0 && (
          <Table
            className="oa-docs-table"
            columns={documentColumns}
            dataSource={documents}
            pagination={false}
            rowKey="id"
            size="middle"
          />
        )}
        {browsingReady && documents.length === 0 && !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={documentList?.unsupportedReason || '当前入口下没有读取到文件夹或文档'}
          >
            <Button icon={<SettingOutlined />} onClick={onOpenSettings}>
              更换入口链接
            </Button>
          </Empty>
        )}
        {!oaReady && !loading && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="需要先完成 OA / Lark 文档设置">
            <Button type="primary" icon={<SettingOutlined />} onClick={onOpenSettings}>
              去设置
            </Button>
          </Empty>
        )}
      </div>
    </section>
  )
}

function SettingsPanel({
  onCreateProject,
  initialModule = 'overview',
  themePreference,
  resolvedTheme,
  onThemePreferenceChange,
  onSystemLog,
  onDeploymentRefreshActiveChange,
  onOpenSystemLog
}: {
  onCreateProject: () => void
  initialModule?: SettingsModuleKey
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  onThemePreferenceChange: (preference: ThemePreference) => void
  onSystemLog?: SystemLogHandler
  onDeploymentRefreshActiveChange?: (active: boolean) => void
  onOpenSystemLog?: () => void
}): JSX.Element {
  const [gitIdentityForm] = Form.useForm<GitIdentityForm>()
  const [sshKeyForm] = Form.useForm<SshKeyForm>()
  const [sshImportForm] = Form.useForm<SshKeyImportForm>()
  const [sshPassphraseForm] = Form.useForm<SshPassphraseForm>()
  const [aiSettingsForm] = Form.useForm<AiSettingsForm>()
  const [githubTokenForm] = Form.useForm<GithubTokenForm>()
  const [codemagicTokenForm] = Form.useForm<CodemagicTokenForm>()
  const [planeSettingsForm] = Form.useForm<PlaneSettingsForm>()
  const [oaSettingsForm] = Form.useForm<OaSettingsForm>()
  const [gitLogRefreshPreferences, setGitLogRefreshPreferences] = useGitLogRefreshPreferences()
  const [gitStatus, setGitStatus] = useState<GitSetupStatus | null>(null)
  const [sshConfig, setSshConfig] = useState<SshConfigFile | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null)
  const [githubTokens, setGithubTokens] = useState<GithubTokenView[]>([])
  const [editingGithubToken, setEditingGithubToken] = useState<GithubTokenView | null>(null)
  const [codemagicTokens, setCodemagicTokens] = useState<CodemagicTokenView[]>([])
  const [editingCodemagicToken, setEditingCodemagicToken] = useState<CodemagicTokenView | null>(null)
  const [planeSettings, setPlaneSettings] = useState<PlaneSettings | null>(null)
  const [planeTestResult, setPlaneTestResult] = useState<PlaneConnectionTestResult | null>(null)
  const [oaSettings, setOaSettings] = useState<OaSettingsView | null>(null)
  const [sshConfigContent, setSshConfigContent] = useState('')
  const [activeSettingsModule, setActiveSettingsModule] = useState<SettingsModuleKey>(initialModule)
  const [sshConfigMode, setSshConfigMode] = useState<SshConfigMode>('guided')
  const [sshConfigEntries, setSshConfigEntries] = useState<SshConfigEntry[]>([])
  const [sshImportKind, setSshImportKind] = useState<SshKeyKind>('private')
  const [sshImportModalOpen, setSshImportModalOpen] = useState(false)
  const [sshPassphraseKey, setSshPassphraseKey] = useState<SshPrivateKeyRecord | null>(null)
  const [loadingGit, setLoadingGit] = useState(false)
  const [loadingSshConfig, setLoadingSshConfig] = useState(false)
  const [loadingAiSettings, setLoadingAiSettings] = useState(false)
  const [loadingGithubTokens, setLoadingGithubTokens] = useState(false)
  const [loadingCodemagicTokens, setLoadingCodemagicTokens] = useState(false)
  const [loadingPlaneSettings, setLoadingPlaneSettings] = useState(false)
  const [loadingOaSettings, setLoadingOaSettings] = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [savingSshConfig, setSavingSshConfig] = useState(false)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [savingGithubToken, setSavingGithubToken] = useState(false)
  const [checkingGithubTokenId, setCheckingGithubTokenId] = useState<string | null>(null)
  const [savingCodemagicToken, setSavingCodemagicToken] = useState(false)
  const [checkingCodemagicTokenId, setCheckingCodemagicTokenId] = useState<string | null>(null)
  const [savingPlaneSettings, setSavingPlaneSettings] = useState(false)
  const [testingPlaneSettings, setTestingPlaneSettings] = useState(false)
  const [savingOaSettings, setSavingOaSettings] = useState(false)
  const [generatingSsh, setGeneratingSsh] = useState(false)
  const [importingSshKey, setImportingSshKey] = useState(false)
  const [savingSshPassphrase, setSavingSshPassphrase] = useState(false)
  const [selectingImportFile, setSelectingImportFile] = useState(false)
  const [workingSshKeyPath, setWorkingSshKeyPath] = useState<string | null>(null)
  const [appUpdateState, setAppUpdateState] = useState<AppUpdateState>({
    status: 'idle',
    currentVersion: ''
  })
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false)
  const [installingAppUpdate, setInstallingAppUpdate] = useState(false)

  useEffect(() => {
    setActiveSettingsModule(initialModule)
  }, [initialModule])

  useEffect(() => {
    if (!window.forgeDesk) {
      return undefined
    }

    let mounted = true

    window.forgeDesk
      .getAppUpdateState()
      .then((state) => {
        if (mounted) {
          setAppUpdateState(state)
        }
      })
      .catch((error) => message.error(getErrorMessage(error)))

    const unsubscribe = window.forgeDesk.onAppUpdateState((state) => setAppUpdateState(state))

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

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
      populateAiSettingsForm(aiSettingsForm, settings)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingAiSettings(false)
    }
  }

  async function refreshGithubTokens(): Promise<void> {
    if (!window.forgeDesk) {
      setGithubTokens([])
      return
    }

    setLoadingGithubTokens(true)

    try {
      setGithubTokens(await window.forgeDesk.listGithubTokens())
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingGithubTokens(false)
    }
  }

  async function refreshCodemagicTokens(): Promise<void> {
    if (!window.forgeDesk) {
      setCodemagicTokens([])
      return
    }

    setLoadingCodemagicTokens(true)

    try {
      setCodemagicTokens(await window.forgeDesk.listCodemagicTokens())
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingCodemagicTokens(false)
    }
  }

  async function refreshPlaneSettings(): Promise<void> {
    if (!window.forgeDesk) {
      setPlaneSettings(null)
      return
    }

    setLoadingPlaneSettings(true)

    try {
      const settings = await window.forgeDesk.getPlaneSettings()
      setPlaneSettings(settings)
      populatePlaneSettingsForm(planeSettingsForm, settings)
      setPlaneTestResult(null)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingPlaneSettings(false)
    }
  }

  async function refreshOaSettings(): Promise<void> {
    if (!window.forgeDesk) {
      setOaSettings(null)
      return
    }

    setLoadingOaSettings(true)

    try {
      const settings = await window.forgeDesk.getOaSettings()
      setOaSettings(settings)
      populateOaSettingsForm(oaSettingsForm, settings)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingOaSettings(false)
    }
  }

  useEffect(() => {
    refreshGitStatus()
    refreshSshConfig()
    refreshAiSettings()
    refreshGithubTokens()
    refreshCodemagicTokens()
    refreshPlaneSettings()
    refreshOaSettings()
  }, [])

  const sshPrivateKeys = gitStatus?.sshPrivateKeys ?? []
  const sshPublicKeys = gitStatus?.sshPublicKeys ?? []
  const gitReady = Boolean(gitStatus?.gitAvailable && gitStatus.userName && gitStatus.userEmail)
  const aiReady = isAiSettingsReady(aiSettings)
  const githubTokenReady = githubTokens.length > 0
  const codemagicTokenReady = codemagicTokens.length > 0
  const planeReady = isPlaneSettingsReady(planeSettings)
  const oaReady = isOaSettingsReady(oaSettings)
  const sshReady = sshPrivateKeys.length + sshPublicKeys.length > 0
  const sshPassphraseCount = sshPrivateKeys.filter((key) => key.hasPassphrase).length
  const sshIssueCount =
    sshPrivateKeys.filter((key) => !key.hasPublicKey || key.needsPermissionFix).length + sshPublicKeys.filter((key) => !key.pairedPrivateKeyPath).length
  const sshIdentityFileOptions = sshPrivateKeys.map((key) => ({
    label: key.fileName,
    value: `~/.ssh/${key.fileName}`
  }))

  function saveGitLogRefreshPreferencePatch(patch: Partial<GitLogRefreshPreferences>): void {
    setGitLogRefreshPreferences({
      ...gitLogRefreshPreferences,
      ...patch
    })
  }

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
        provider: values.provider,
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

  async function saveGithubToken(): Promise<void> {
    const values = await githubTokenForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中保存 GitHub Token')
      return
    }

    const token = values.token?.trim()

    if (!token && !editingGithubToken) {
      message.warning('请填写 GitHub Token')
      return
    }

    setSavingGithubToken(true)

    try {
      const tokens = await window.forgeDesk.saveGithubToken({
        id: editingGithubToken?.id,
        name: values.name.trim(),
        token: token || undefined
      })
      setGithubTokens(tokens)
      setEditingGithubToken(null)
      githubTokenForm.resetFields()
      message.success(token ? 'GitHub Token 已保存，权限范围已更新' : 'GitHub Token 已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingGithubToken(false)
    }
  }

  async function saveCodemagicToken(): Promise<void> {
    const values = await codemagicTokenForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中保存 Codemagic Token')
      return
    }

    const token = values.token?.trim()

    if (!token && !editingCodemagicToken) {
      message.warning('请填写 Codemagic API Token')
      return
    }

    setSavingCodemagicToken(true)

    try {
      const tokens = await window.forgeDesk.saveCodemagicToken({
        id: editingCodemagicToken?.id,
        name: values.name.trim(),
        token: token || undefined
      })
      setCodemagicTokens(tokens)
      setEditingCodemagicToken(null)
      codemagicTokenForm.resetFields()
      message.success(token ? 'Codemagic Token 已保存，账号信息已更新' : 'Codemagic Token 已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingCodemagicToken(false)
    }
  }

  function editGithubToken(token: GithubTokenView): void {
    setEditingGithubToken(token)
    githubTokenForm.setFieldsValue({
      name: token.name,
      token: ''
    })
  }

  function cancelGithubTokenEdit(): void {
    setEditingGithubToken(null)
    githubTokenForm.resetFields()
  }

  function editCodemagicToken(token: CodemagicTokenView): void {
    setEditingCodemagicToken(token)
    codemagicTokenForm.setFieldsValue({
      name: token.name,
      token: ''
    })
  }

  function cancelCodemagicTokenEdit(): void {
    setEditingCodemagicToken(null)
    codemagicTokenForm.resetFields()
  }

  async function refreshGithubTokenScopes(tokenId: string): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中刷新 GitHub Token')
      return
    }

    setCheckingGithubTokenId(tokenId)

    try {
      setGithubTokens(await window.forgeDesk.refreshGithubToken(tokenId))
      message.success('GitHub Token 权限范围已更新')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCheckingGithubTokenId(null)
    }
  }

  async function refreshCodemagicTokenInfo(tokenId: string): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中刷新 Codemagic Token')
      return
    }

    setCheckingCodemagicTokenId(tokenId)

    try {
      setCodemagicTokens(await window.forgeDesk.refreshCodemagicToken(tokenId))
      message.success('Codemagic Token 信息已更新')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCheckingCodemagicTokenId(null)
    }
  }

  async function deleteGithubToken(tokenId: string): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中删除 GitHub Token')
      return
    }

    try {
      const tokens = await window.forgeDesk.deleteGithubToken(tokenId)
      setGithubTokens(tokens)

      if (editingGithubToken?.id === tokenId) {
        cancelGithubTokenEdit()
      }

      message.success('GitHub Token 已删除')
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  async function deleteCodemagicToken(tokenId: string): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中删除 Codemagic Token')
      return
    }

    try {
      const tokens = await window.forgeDesk.deleteCodemagicToken(tokenId)
      setCodemagicTokens(tokens)

      if (editingCodemagicToken?.id === tokenId) {
        cancelCodemagicTokenEdit()
      }

      message.success('Codemagic Token 已删除')
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  async function savePlaneSettings(): Promise<void> {
    const values = await planeSettingsForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中保存 Plane 设置')
      return
    }

    setSavingPlaneSettings(true)

    try {
      const apiToken = values.apiToken?.trim()
      const settings = await window.forgeDesk.savePlaneSettings({
        apiBaseUrl: values.apiBaseUrl,
        webBaseUrl: values.webBaseUrl,
        apiToken: apiToken || undefined
      })
      setPlaneSettings(settings)
      setPlaneTestResult(null)
      planeSettingsForm.setFieldValue('apiToken', '')
      message.success('Plane 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingPlaneSettings(false)
    }
  }

  async function testPlaneSettings(): Promise<void> {
    const values = await planeSettingsForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中测试 Plane 连接')
      return
    }

    setTestingPlaneSettings(true)

    try {
      const apiToken = values.apiToken?.trim()
      const result = await window.forgeDesk.testPlaneSettings({
        apiBaseUrl: values.apiBaseUrl,
        webBaseUrl: values.webBaseUrl,
        apiToken: apiToken || undefined
      })
      setPlaneTestResult(result)

      if (result.ok) {
        message.success(result.message)
      } else {
        message.error(result.message)
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setTestingPlaneSettings(false)
    }
  }

  async function openPlaneHome(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    await window.forgeDesk.openPlane()
  }

  async function saveOaSettings(): Promise<void> {
    const values = await oaSettingsForm.validateFields()

    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中保存 OA 设置')
      return
    }

    const larkAppSecret = values.larkAppSecret?.trim()

    if (values.enabled && !larkAppSecret && !oaSettings?.larkAppSecretConfigured) {
      message.warning('请填写 Lark App Secret')
      return
    }

    setSavingOaSettings(true)

    try {
      const settings = await window.forgeDesk.saveOaSettings({
        enabled: values.enabled,
        provider: 'lark',
        larkAppId: values.larkAppId,
        larkAppSecret: larkAppSecret || undefined,
        docsHomeUrl: values.docsHomeUrl,
        enableDocumentBrowsing: values.enableDocumentBrowsing,
        enableDocumentEditing: values.enableDocumentEditing,
        enableAiDocumentDrafting: values.enableAiDocumentDrafting
      })
      setOaSettings(settings)
      oaSettingsForm.setFieldValue('larkAppSecret', '')
      message.success('OA 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingOaSettings(false)
    }
  }

  async function openOaDocs(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    await window.forgeDesk.openOaDocs()
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

  function openSshPassphraseModal(key: SshPrivateKeyRecord): void {
    setSshPassphraseKey(key)
    sshPassphraseForm.resetFields()
  }

  function closeSshPassphraseModal(): void {
    setSshPassphraseKey(null)
    sshPassphraseForm.resetFields()
  }

  async function savePrivateKeyPassphrase(): Promise<void> {
    if (!sshPassphraseKey || !window.forgeDesk) {
      return
    }

    const values = await sshPassphraseForm.validateFields()

    if (values.passphrase !== values.confirmPassphrase) {
      sshPassphraseForm.setFields([{ name: 'confirmPassphrase', errors: ['两次输入不一致'] }])
      return
    }

    setSavingSshPassphrase(true)
    setWorkingSshKeyPath(sshPassphraseKey.path)

    try {
      const status = await window.forgeDesk.saveSshPrivateKeyPassphrase(sshPassphraseKey.path, values.passphrase)
      setGitStatus(status)
      closeSshPassphraseModal()
      message.success('私钥密码已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingSshPassphrase(false)
      setWorkingSshKeyPath(null)
    }
  }

  function clearPrivateKeyPassphrase(path: string): void {
    Modal.confirm({
      title: '清除私钥密码',
      content: `将删除 ${getPathFileName(path)} 在 ForgeDesk 中保存的密码，不会修改私钥文件。`,
      okText: '清除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        if (!window.forgeDesk) {
          return
        }

        setWorkingSshKeyPath(path)

        try {
          const status = await window.forgeDesk.clearSshPrivateKeyPassphrase(path)
          setGitStatus(status)
          message.success('私钥密码已清除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setWorkingSshKeyPath(null)
        }
      }
    })
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

  async function checkAppUpdate(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中检查更新')
      return
    }

    setCheckingAppUpdate(true)

    try {
      const state = await window.forgeDesk.checkAppUpdate()
      setAppUpdateState(state)

      if (state.status === 'not-available') {
        message.success('ForgeDesk 已经是最新版本')
      } else if (state.status === 'error') {
        message.error(state.error || '更新检查失败')
      }
    } finally {
      setCheckingAppUpdate(false)
    }
  }

  async function installAppUpdate(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中安装更新')
      return
    }

    setInstallingAppUpdate(true)

    try {
      const state = await window.forgeDesk.installAppUpdate()
      setAppUpdateState(state)

      if (state.status === 'error') {
        message.error(state.error || '新版还没有下载完成')
      }
    } finally {
      setInstallingAppUpdate(false)
    }
  }

  async function openAppReleases(): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中打开发布页')
      return
    }

    await window.forgeDesk.openAppReleases()
  }

  const settingsModules: Array<{
    key: SettingsOverviewModuleKey
    title: string
    description: string
    icon: JSX.Element
    meta: string
    tone: 'ok' | 'warning' | 'neutral' | 'danger'
  }> = [
    {
      key: 'appearance',
      title: '外观',
      description: '切换白天、黑夜，或自动跟随系统。',
      icon: <DesktopOutlined />,
      meta: themePreference === 'system' ? getResolvedThemeLabel(resolvedTheme) : getThemePreferenceLabel(themePreference),
      tone: 'neutral'
    },
    {
      key: 'git',
      title: 'Git 账户',
      description: '维护本机全局提交身份。',
      icon: <SettingOutlined />,
      meta: gitReady ? '已配置' : '需要配置',
      tone: gitReady ? 'ok' : 'danger'
    },
    {
      key: 'log-refresh',
      title: 'Log 树刷新',
      description: '设置 Log 树自动重读本地 Git 数据的频率。',
      icon: <ReloadOutlined />,
      meta: gitLogRefreshPreferences.autoRefreshEnabled ? `${gitLogRefreshPreferences.intervalSeconds} 秒` : '手动',
      tone: gitLogRefreshPreferences.autoRefreshEnabled ? 'ok' : 'neutral'
    },
    {
      key: 'github',
      title: 'GitHub Token',
      description: '保存发布用 Token，并读取 GitHub 返回的权限范围。',
      icon: <GithubOutlined />,
      meta: githubTokenReady ? `${githubTokens.length} 个` : '需要配置',
      tone: githubTokenReady ? 'ok' : 'warning'
    },
    {
      key: 'codemagic',
      title: 'Codemagic Token',
      description: '保存移动端远程构建和包同步使用的 API Token。',
      icon: <UploadOutlined />,
      meta: codemagicTokenReady ? `${codemagicTokens.length} 个` : '需要配置',
      tone: codemagicTokenReady ? 'ok' : 'warning'
    },
    {
      key: 'private',
      title: '私钥管理',
      description: '生成、导入、修复权限、设置密码和生成 pub。',
      icon: <KeyOutlined />,
      meta: `${sshPrivateKeys.length} 个${sshPassphraseCount > 0 ? ` · ${sshPassphraseCount} 个有密码` : ''}${
        sshPrivateKeys.some((key) => !key.hasPublicKey) ? ' · 缺 pub' : ''
      }`,
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
      key: 'services',
      title: '服务中心',
      description: '维护 Vercel / Railway 连接、同步服务和自定义域名。',
      icon: <ThunderboltOutlined />,
      meta: '全局',
      tone: 'neutral'
    },
    {
      key: 'plane',
      title: 'Plane 集成',
      description: '配置 Plane URL、API Token 和项目内容读取能力。',
      icon: <LinkOutlined />,
      meta: planeReady ? '已配置' : '需要配置',
      tone: planeReady ? 'ok' : 'warning'
    },
    {
      key: 'oa',
      title: 'OA / Lark 文档',
      description: '连接 Lark / 飞书文档，支持浏览、编辑和 AI 产出。',
      icon: <TeamOutlined />,
      meta: oaReady ? '已接入' : oaSettings?.larkAppSecretConfigured ? '未启用' : '需要配置',
      tone: oaReady ? 'ok' : oaSettings?.larkAppSecretConfigured ? 'neutral' : 'warning'
    },
    {
      key: 'updates',
      title: '应用更新',
      description: '通过 GitHub Releases 检查和安装新版。',
      icon: <DownloadOutlined />,
      meta: appUpdateState.status === 'downloaded' ? '待安装' : appUpdateState.status === 'downloading' ? '下载中' : appUpdateState.currentVersion || '当前版本',
      tone: appUpdateState.status === 'downloaded' ? 'warning' : appUpdateState.status === 'error' ? 'danger' : 'neutral'
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
  const settingsModuleByKey = new Map(settingsModules.map((module) => [module.key, module]))
  const settingsOverviewCategories: SettingsOverviewCategory[] = [
    {
      title: '个性化',
      description: '控制界面外观和日常视图刷新。',
      keys: ['appearance', 'log-refresh']
    },
    {
      title: 'Git 与 SSH',
      description: '管理提交身份、密钥和 SSH 连接配置。',
      keys: ['git', 'private', 'public', 'config']
    },
    {
      title: '集成与服务',
      description: '配置外部账号、服务平台、Plane 和 AI 能力。',
      keys: ['github', 'codemagic', 'services', 'plane', 'oa', 'ai']
    },
    {
      title: '应用维护',
      description: '检查、下载并安装 ForgeDesk 新版本。',
      keys: ['updates']
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

  function renderAppearanceModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader('外观', '选择 ForgeDesk 使用白天模式、黑夜模式，或跟随系统自动切换。')}
        <Alert
          className="settings-module-alert"
          type="info"
          showIcon
          message={`当前使用：${themePreference === 'system' ? `${getThemePreferenceLabel(themePreference)} · ${getResolvedThemeLabel(resolvedTheme)}` : getThemePreferenceLabel(themePreference)}`}
          description="偏好会保存在本机；选择跟随系统时，会随操作系统外观变化自动切换。"
        />
        <div className="settings-management-form appearance-settings-form">
          <Segmented
            block
            value={themePreference}
            options={[
              {
                label: (
                  <span className="appearance-option-label">
                    <DesktopOutlined />
                    跟随系统
                  </span>
                ),
                value: 'system'
              },
              {
                label: (
                  <span className="appearance-option-label">
                    <SunOutlined />
                    白天模式
                  </span>
                ),
                value: 'light'
              },
              {
                label: (
                  <span className="appearance-option-label">
                    <MoonOutlined />
                    黑夜模式
                  </span>
                ),
                value: 'dark'
              }
            ]}
            onChange={(value) => onThemePreferenceChange(value as ThemePreference)}
          />
        </div>
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

  function renderLogRefreshModule(): JSX.Element {
    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader('Log 树刷新', '控制 Log 树重读本地 Git 数据的频率。')}
        <Alert
          className="settings-module-alert"
          type={gitLogRefreshPreferences.autoRefreshEnabled ? 'success' : 'info'}
          showIcon
          message={gitLogRefreshPreferences.autoRefreshEnabled ? `已开启，每 ${gitLogRefreshPreferences.intervalSeconds} 秒刷新` : '自动刷新未开启'}
          description="自动刷新只重读本地仓库详情、提交图谱和工作区状态，不会自动 Fetch 远端。"
        />
        <div className="settings-management-form log-refresh-settings-form">
          <label className="log-refresh-setting-field">
            <span>自动刷新</span>
            <Switch
              checked={gitLogRefreshPreferences.autoRefreshEnabled}
              onChange={(checked) => saveGitLogRefreshPreferencePatch({ autoRefreshEnabled: checked })}
            />
          </label>
          <label className="log-refresh-setting-field">
            <span>刷新频率（秒）</span>
            <InputNumber
              min={gitLogRefreshIntervalBounds.minSeconds}
              max={gitLogRefreshIntervalBounds.maxSeconds}
              step={5}
              value={gitLogRefreshPreferences.intervalSeconds}
              disabled={!gitLogRefreshPreferences.autoRefreshEnabled}
              className="full-width-control"
              onChange={(value) => saveGitLogRefreshPreferencePatch({ intervalSeconds: Number(value ?? defaultGitLogRefreshPreferences.intervalSeconds) })}
            />
          </label>
          <Button icon={<ReloadOutlined />} onClick={() => setGitLogRefreshPreferences(defaultGitLogRefreshPreferences)}>
            恢复默认
          </Button>
        </div>
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
              <Tag color={key.hasPassphrase ? 'blue' : 'default'}>{key.hasPassphrase ? '已保存密码' : '未设密码'}</Tag>
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
          <Button icon={<KeyOutlined />} loading={workingSshKeyPath === key.path} onClick={() => openSshPassphraseModal(key)}>
            {key.hasPassphrase ? '更新密码' : '设置密码'}
          </Button>
          {key.hasPassphrase && (
            <Button danger icon={<DeleteOutlined />} loading={workingSshKeyPath === key.path} onClick={() => clearPrivateKeyPassphrase(key.path)}>
              清除密码
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

  function renderGithubTokensModule(): JSX.Element {
    const githubTokenColumns: ColumnsType<GithubTokenView> = [
      {
        title: '名称',
        key: 'name',
        render: (_, token) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{token.name}</Typography.Text>
            <Typography.Text type="secondary">
              {token.githubLogin ? `@${token.githubLogin}` : '未读取账号'} · ****{token.tokenLastFour || '----'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: '权限范围',
        key: 'scopes',
        render: (_, token) => <Space wrap size={[4, 4]}>{renderGithubTokenScopes(token)}</Space>
      },
      {
        title: '类型',
        key: 'type',
        width: 150,
        render: (_, token) => <Tag color={token.tokenType === 'classic' ? 'blue' : 'default'}>{getGithubTokenTypeLabel(token)}</Tag>
      },
      {
        title: '校验时间',
        key: 'checkedAt',
        width: 190,
        render: (_, token) => <Typography.Text type="secondary">{formatGithubTokenCheckedAt(token)}</Typography.Text>
      },
      {
        title: '操作',
        key: 'actions',
        width: 250,
        render: (_, token) => (
          <Space wrap>
            <Button size="small" icon={<EditOutlined />} onClick={() => editGithubToken(token)}>
              编辑
            </Button>
            <Button size="small" icon={<ReloadOutlined />} loading={checkingGithubTokenId === token.id} onClick={() => refreshGithubTokenScopes(token.id)}>
              刷新权限
            </Button>
            <Popconfirm title="删除这个 GitHub Token？" okText="删除" cancelText="取消" onConfirm={() => deleteGithubToken(token.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ]

    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          'GitHub Token',
          '保存发布 GitHub Releases 使用的 Token，并在保存后读取 GitHub 返回的权限范围。',
          <Button icon={<ReloadOutlined />} loading={loadingGithubTokens} onClick={refreshGithubTokens}>
            重新读取
          </Button>
        )}
        <Alert
          className="settings-module-alert"
          type={githubTokenReady ? 'success' : 'info'}
          showIcon
          message={githubTokenReady ? `已保存 ${githubTokens.length} 个 GitHub Token` : '保存 Token 后可以在发布时直接选择'}
          description="Classic PAT 会显示 GitHub 返回的 OAuth scopes；fine-grained PAT 可能不会公开完整权限，请确保发布 Token 至少拥有 Contents: Read and write。"
        />
        <Form form={githubTokenForm} layout="vertical" className="settings-management-form github-token-form">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 Token 名称' }]}>
            <Input placeholder="例如 ForgeDesk 发布 Token" />
          </Form.Item>
          <Form.Item name="token" label="GitHub Token">
            <Input.Password placeholder={editingGithubToken ? '留空只更新名称' : 'github_pat_...'} />
          </Form.Item>
          <Space wrap>
            <Button type="primary" icon={<SaveOutlined />} loading={savingGithubToken} onClick={saveGithubToken}>
              {editingGithubToken ? '保存修改' : '保存 Token'}
            </Button>
            {editingGithubToken ? <Button onClick={cancelGithubTokenEdit}>取消编辑</Button> : null}
          </Space>
        </Form>
        <Table
          rowKey="id"
          size="small"
          className="github-token-table"
          loading={loadingGithubTokens}
          columns={githubTokenColumns}
          dataSource={githubTokens}
          pagination={false}
          scroll={{ x: 860 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 GitHub Token" /> }}
        />
      </div>
    )
  }

  function renderCodemagicTokensModule(): JSX.Element {
    const codemagicTokenColumns: ColumnsType<CodemagicTokenView> = [
      {
        title: '名称',
        key: 'name',
        render: (_, token) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{token.name}</Typography.Text>
            <Typography.Text type="secondary">
              {token.userId ? `User ${token.userId}` : '未读取账号'} · ****{token.tokenLastFour || '----'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: '可见资源',
        key: 'resources',
        render: (_, token) => (
          <Space wrap size={[4, 4]}>
            <Tag color="blue">{token.teamCount} 个团队</Tag>
            <Tag color="green">{token.appCount} 个应用</Tag>
            <Typography.Text type="secondary">{token.permissionSummary}</Typography.Text>
          </Space>
        )
      },
      {
        title: '校验时间',
        key: 'checkedAt',
        width: 190,
        render: (_, token) => <Typography.Text type="secondary">{token.lastCheckedAt ? new Date(token.lastCheckedAt).toLocaleString() : '未校验'}</Typography.Text>
      },
      {
        title: '操作',
        key: 'actions',
        width: 250,
        render: (_, token) => (
          <Space wrap>
            <Button size="small" icon={<EditOutlined />} onClick={() => editCodemagicToken(token)}>
              编辑
            </Button>
            <Button size="small" icon={<ReloadOutlined />} loading={checkingCodemagicTokenId === token.id} onClick={() => refreshCodemagicTokenInfo(token.id)}>
              刷新信息
            </Button>
            <Popconfirm title="删除这个 Codemagic Token？" okText="删除" cancelText="取消" onConfirm={() => deleteCodemagicToken(token.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ]

    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          'Codemagic Token',
          '保存触发 Codemagic workflow、读取构建状态和同步构建包使用的 API Token。',
          <Button icon={<ReloadOutlined />} loading={loadingCodemagicTokens} onClick={refreshCodemagicTokens}>
            重新读取
          </Button>
        )}
        <Alert
          className="settings-module-alert"
          type={codemagicTokenReady ? 'success' : 'info'}
          showIcon
          message={codemagicTokenReady ? `已保存 ${codemagicTokens.length} 个 Codemagic Token` : '保存 Token 后可以在发布时绑定 Codemagic App'}
          description="Codemagic API Token 可在 Codemagic 的 Teams / Personal Account / Integrations / Codemagic API 页面查看。ForgeDesk 只在本机保存密钥。"
        />
        <Form form={codemagicTokenForm} layout="vertical" className="settings-management-form github-token-form">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 Token 名称' }]}>
            <Input placeholder="例如 移动端构建 Token" />
          </Form.Item>
          <Form.Item name="token" label="Codemagic API Token">
            <Input.Password placeholder={editingCodemagicToken ? '留空只更新名称' : 'Codemagic API Token'} />
          </Form.Item>
          <Space wrap>
            <Button type="primary" icon={<SaveOutlined />} loading={savingCodemagicToken} onClick={saveCodemagicToken}>
              {editingCodemagicToken ? '保存修改' : '保存 Token'}
            </Button>
            {editingCodemagicToken ? <Button onClick={cancelCodemagicTokenEdit}>取消编辑</Button> : null}
          </Space>
        </Form>
        <Table
          rowKey="id"
          size="small"
          className="github-token-table"
          loading={loadingCodemagicTokens}
          columns={codemagicTokenColumns}
          dataSource={codemagicTokens}
          pagination={false}
          scroll={{ x: 860 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Codemagic Token" /> }}
        />
      </div>
    )
  }

  function renderAiModule(): JSX.Element {
    return (
      <AiSettingsSection
        form={aiSettingsForm}
        settings={aiSettings}
        loading={loadingAiSettings}
        saving={savingAiSettings}
        onRefresh={refreshAiSettings}
        onSave={saveAiSettings}
        onBack={() => setActiveSettingsModule('overview')}
      />
    )
  }

  function renderServicesModule(): JSX.Element {
    return (
      <GlobalServiceCenterPanel
        onBack={() => setActiveSettingsModule('overview')}
        onSystemLog={onSystemLog}
        onDeploymentRefreshActiveChange={onDeploymentRefreshActiveChange}
        onOpenSystemLog={onOpenSystemLog}
      />
    )
  }

  function renderPlaneModule(): JSX.Element {
    return (
      <PlaneSettingsSection
        form={planeSettingsForm}
        settings={planeSettings}
        loading={loadingPlaneSettings}
        saving={savingPlaneSettings}
        testing={testingPlaneSettings}
        testResult={planeTestResult}
        onRefresh={refreshPlaneSettings}
        onSave={savePlaneSettings}
        onTest={testPlaneSettings}
        onOpen={openPlaneHome}
        onBack={() => setActiveSettingsModule('overview')}
      />
    )
  }

  function renderOaModule(): JSX.Element {
    return (
      <OaSettingsSection
        form={oaSettingsForm}
        settings={oaSettings}
        loading={loadingOaSettings}
        saving={savingOaSettings}
        onRefresh={refreshOaSettings}
        onSave={saveOaSettings}
        onOpenDocs={openOaDocs}
        onBack={() => setActiveSettingsModule('overview')}
      />
    )
  }

  function renderUpdatesModule(): JSX.Element {
    const view = createAppUpdateViewModel(appUpdateState)
    const isBusy = view.primaryAction === 'busy' || checkingAppUpdate || installingAppUpdate
    const primaryAction = view.primaryAction === 'install' ? installAppUpdate : checkAppUpdate

    return (
      <div className="panel settings-module-panel">
        {renderModuleHeader(
          '应用更新',
          'ForgeDesk 会从 GitHub Releases 检查、下载并安装新版本。',
          <Button icon={<GithubOutlined />} onClick={openAppReleases}>
            打开 Releases
          </Button>
        )}
        <Descriptions column={1} size="small" className="setup-description">
          <Descriptions.Item label="当前版本">{appUpdateState.currentVersion || '未知'}</Descriptions.Item>
          <Descriptions.Item label="发布源">GitHub Releases / IEatLemons/ForgeDesk</Descriptions.Item>
          <Descriptions.Item label="新版">{appUpdateState.availableVersion || '暂无'}</Descriptions.Item>
        </Descriptions>
        <Alert
          className="settings-module-alert"
          type={appUpdateState.status === 'error' ? 'error' : appUpdateState.status === 'downloaded' ? 'success' : 'info'}
          showIcon
          message={view.title}
          description={view.description}
        />
        <Space wrap>
          <Button
            type="primary"
            icon={view.primaryAction === 'install' ? <ReloadOutlined /> : <DownloadOutlined />}
            loading={isBusy}
            disabled={view.primaryAction === 'busy'}
            onClick={primaryAction}
          >
            {view.primaryLabel}
          </Button>
          {appUpdateState.status === 'downloading' && <Tag color="blue">{Math.round(appUpdateState.percent ?? 0)}%</Tag>}
        </Space>
      </div>
    )
  }

  function renderOverview(): JSX.Element {
    return (
      <div className="settings-category-list">
        {settingsOverviewCategories.map((category) => (
          <section className="settings-category-section" key={category.title}>
            <div className="settings-category-heading">
              <Typography.Title className="settings-category-title" level={3}>
                {category.title}
              </Typography.Title>
              <Typography.Text type="secondary">{category.description}</Typography.Text>
            </div>
            <div className="settings-module-grid">
              {category.keys.map((key) => {
                const module = settingsModuleByKey.get(key)

                if (!module) {
                  return null
                }

                return (
                  <button
                    className={`settings-entry-card settings-entry-card-${module.tone}`}
                    key={module.key}
                    type="button"
                    onClick={() => setActiveSettingsModule(module.key)}
                  >
                    <span className="settings-entry-icon">{module.icon}</span>
                    <span className="settings-entry-copy">
                      <span className="settings-entry-title-row">
                        <Typography.Text strong className="settings-entry-title">
                          {module.title}
                        </Typography.Text>
                        <Tag
                          className="settings-entry-meta"
                          color={module.tone === 'ok' ? 'green' : module.tone === 'warning' ? 'gold' : module.tone === 'danger' ? 'red' : 'default'}
                        >
                          {module.meta}
                        </Tag>
                      </span>
                      <Typography.Text className="settings-entry-description" type="secondary">
                        {module.description}
                      </Typography.Text>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    )
  }

  function renderActiveSettingsModule(): JSX.Element {
    switch (activeSettingsModule) {
      case 'appearance':
        return renderAppearanceModule()
      case 'git':
        return renderGitModule()
      case 'log-refresh':
        return renderLogRefreshModule()
      case 'github':
        return renderGithubTokensModule()
      case 'codemagic':
        return renderCodemagicTokensModule()
      case 'private':
        return renderPrivateModule()
      case 'public':
        return renderPublicModule()
      case 'config':
        return renderConfigModule()
      case 'services':
        return renderServicesModule()
      case 'plane':
        return renderPlaneModule()
      case 'oa':
        return renderOaModule()
      case 'ai':
        return renderAiModule()
      case 'updates':
        return renderUpdatesModule()
      default:
        return renderOverview()
    }
  }

  return (
    <section className="workspace-section settings-workspace">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>设置</Typography.Title>
          <Typography.Text type="secondary">管理本机 Git / SSH、AI、OA 和服务集成。</Typography.Text>
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

      <Modal
        title={sshPassphraseKey ? `设置私钥密码：${sshPassphraseKey.fileName}` : '设置私钥密码'}
        open={Boolean(sshPassphraseKey)}
        okText="保存密码"
        cancelText="取消"
        confirmLoading={savingSshPassphrase}
        onOk={savePrivateKeyPassphrase}
        onCancel={closeSshPassphraseModal}
      >
        <Form form={sshPassphraseForm} layout="vertical">
          <Form.Item name="passphrase" label="私钥密码" rules={[{ required: true, message: '请输入私钥密码' }]}>
            <Input.Password autoFocus autoComplete="new-password" placeholder="输入私钥密码" />
          </Form.Item>
          <Form.Item name="confirmPassphrase" label="再次输入" rules={[{ required: true, message: '请再次输入私钥密码' }]}>
            <Input.Password autoComplete="new-password" placeholder="再次输入私钥密码" />
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
      message.success(remoteName ? `${remoteName} 已 Fetch` : '全部远端已 Fetch')
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

function ProjectServiceSettings({ project, repositories = [] }: { project?: Project; repositories?: Repository[] }): JSX.Element {
  const [connections, setConnections] = useState<ServiceConnection[]>([])
  const [services, setServices] = useState<ProjectService[]>([])
  const [allServices, setAllServices] = useState<ProjectService[]>([])
  const [loading, setLoading] = useState(false)
  const [workingConnectionId, setWorkingConnectionId] = useState<string | null>(null)
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null)
  const [editingConnection, setEditingConnection] = useState<ServiceConnection | null>(null)
  const [editingService, setEditingService] = useState<ProjectService | null>(null)
  const [editingRailwayProjectGroup, setEditingRailwayProjectGroup] = useState<RailwayProjectServiceGroup | null>(null)
  const [serviceLogDrawer, setServiceLogDrawer] = useState<{
    service: ProjectService
    environment: ProjectServiceEnvironment
    mode: ServiceLogMode
  } | null>(null)
  const [serviceLogLines, setServiceLogLines] = useState<ServiceEnvironmentLogLine[]>([])
  const [serviceLogLoading, setServiceLogLoading] = useState(false)
  const [serviceLogError, setServiceLogError] = useState('')
  const [detailServiceId, setDetailServiceId] = useState<string | null>(null)
  const [bindingProvider, setBindingProvider] = useState<ServiceProviderType | null>(null)
  const [selectedServiceProvider, setSelectedServiceProvider] = useState<ServiceProviderType | null>(null)
  const [connectionModalOpen, setConnectionModalOpen] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [bindingModalOpen, setBindingModalOpen] = useState(false)
  const [savingConnection, setSavingConnection] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [savingRailwayProjectAlias, setSavingRailwayProjectAlias] = useState(false)
  const [savingBinding, setSavingBinding] = useState(false)
  const [connectionForm] = Form.useForm<ServiceConnectionForm>()
  const [serviceForm] = Form.useForm<ProjectServiceForm>()
  const [bindingForm] = Form.useForm<ProjectServiceBindingForm>()
  const [railwayProjectAliasForm] = Form.useForm<ServiceExternalProjectAliasForm>()
  const isProjectMode = Boolean(project)

  async function loadServiceSettings(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoading(true)

    try {
      const [nextConnections, nextServices, nextAllServices] = await Promise.all([
        window.forgeDesk.listServiceConnections(),
        project ? window.forgeDesk.listProjectServices(project.id) : window.forgeDesk.listAllProjectServices(),
        window.forgeDesk.listAllProjectServices()
      ])
      setConnections(nextConnections)
      setServices(nextServices)
      setAllServices(nextAllServices)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServiceSettings().catch((error) => message.error(getErrorMessage(error)))
  }, [project?.id])

  function openConnectionModal(connection?: ServiceConnection, provider?: ServiceProviderType): void {
    setEditingConnection(connection ?? null)
    connectionForm.setFieldsValue({
      provider: connection?.provider ?? provider ?? 'vercel',
      name: connection?.name ?? '',
      token: '',
      teamId: connection?.teamId ?? '',
      workspaceId: connection?.workspaceId ?? '',
      railwayTokenType: connection?.railwayTokenType ?? 'workspace'
    })
    setConnectionModalOpen(true)
  }

  async function saveConnection(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await connectionForm.validateFields()
    const token = values.token?.trim()
    setSavingConnection(true)

    try {
      await window.forgeDesk.saveServiceConnection({
        id: editingConnection?.id,
        provider: values.provider,
        name: values.name.trim() || getServiceProviderLabel(values.provider),
        token: token || undefined,
        teamId: values.teamId,
        workspaceId: values.workspaceId,
        railwayTokenType: values.railwayTokenType
      })
      setConnectionModalOpen(false)
      setEditingConnection(null)
      connectionForm.resetFields()
      await loadServiceSettings()
      message.success('服务连接已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingConnection(false)
    }
  }

  async function syncConnection(connection?: ServiceConnection): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const loadingKey = connection?.id ?? 'all'
    setSyncingConnectionId(loadingKey)

    try {
      const nextServices = await window.forgeDesk.syncProjectServices(connection?.id)
      setAllServices(nextServices)
      setServices(project ? await window.forgeDesk.listProjectServices(project.id) : nextServices)
      setConnections(await window.forgeDesk.listServiceConnections())
      message.success(connection ? `${connection.name} 已同步` : '服务已同步')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSyncingConnectionId(null)
    }
  }

  async function testConnection(connection: ServiceConnection): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setWorkingConnectionId(connection.id)

    try {
      const result = await window.forgeDesk.testServiceConnection(connection.id)
      setAllServices(await window.forgeDesk.listAllProjectServices())
      if (project) {
        setServices(await window.forgeDesk.listProjectServices(project.id))
      } else {
        setServices(await window.forgeDesk.listAllProjectServices())
      }
      message.success(result.message)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingConnectionId(null)
    }
  }

  function confirmDeleteConnection(connection: ServiceConnection): void {
    Modal.confirm({
      title: `删除平台连接 ${connection.name}？`,
      content: '会删除 ForgeDesk 中保存的 Token，以及通过这个连接同步出来的服务；不会删除 Vercel / Railway 上的真实项目。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        if (!window.forgeDesk) {
          return
        }

        setDeletingConnectionId(connection.id)

        try {
          await window.forgeDesk.deleteServiceConnection(connection.id)
          setDetailServiceId(null)
          await loadServiceSettings()
          message.success('平台连接已删除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setDeletingConnectionId(null)
        }
      }
    })
  }

  function openBindingModal(provider?: ServiceProviderType): void {
    bindingForm.resetFields()
    setBindingProvider(provider ?? null)
    setBindingModalOpen(true)
  }

  async function saveServiceBinding(): Promise<void> {
    if (!window.forgeDesk || !project) {
      return
    }

    const values = await bindingForm.validateFields()
    setSavingBinding(true)

    try {
      setServices(
        await window.forgeDesk.bindProjectService({
          projectId: project.id,
          serviceId: values.serviceId,
          repositoryId: values.repositoryId
        })
      )
      setBindingModalOpen(false)
      setBindingProvider(null)
      bindingForm.resetFields()
      message.success('服务已绑定到当前项目')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingBinding(false)
    }
  }

  function openServiceModal(service?: ProjectService, provider?: ServiceProviderType): void {
    setEditingService(service ?? null)
    serviceForm.setFieldsValue({
      provider: service?.provider ?? provider ?? 'vercel',
      connectionId: service?.connectionId || undefined,
      repositoryId: service?.repositoryId || undefined,
      name: service?.name ?? '',
      externalProjectId: service?.externalProjectId ?? '',
      externalServiceId: service?.externalServiceId ?? '',
      defaultEnvironment: service?.defaultEnvironment ?? '',
      healthPath: service?.healthPath ?? '/',
      enabled: service?.enabled ?? true,
      domainsText: service ? formatServiceDomainsText(getMonitorableServiceDomains(service)) : ''
    })
    setServiceModalOpen(true)
  }

  function openServiceDetail(service: ProjectService): void {
    setDetailServiceId(service.id)
  }

  async function openServiceEnvironmentLogs(service: ProjectService, environmentName: string, mode: ServiceLogMode): Promise<void> {
    const environment = service.environments.find((item) => item.name === environmentName)

    if (!environment) {
      message.warning('这个环境还没有同步到日志所需信息')
      return
    }

    setServiceLogDrawer({ service, environment, mode })
    setServiceLogLines([])
    setServiceLogError('')

    if (!window.forgeDesk) {
      return
    }

    setServiceLogLoading(true)

    try {
      const lines =
        mode === 'runtime'
          ? await window.forgeDesk.listServiceRuntimeLogs(service.id, environment.name)
          : await window.forgeDesk.listServiceEnvironmentLogs(service.id, environment.name)
      setServiceLogLines(lines)
    } catch (error) {
      setServiceLogError(getErrorMessage(error))
    } finally {
      setServiceLogLoading(false)
    }
  }

  function openRailwayProjectAliasModal(projectGroup: RailwayProjectServiceGroup): void {
    setEditingRailwayProjectGroup(projectGroup)
    railwayProjectAliasForm.setFieldsValue({
      alias: projectGroup.alias || projectGroup.externalProjectName || projectGroup.externalProjectId
    })
  }

  async function saveRailwayProjectAlias(): Promise<void> {
    if (!window.forgeDesk || !editingRailwayProjectGroup) {
      return
    }

    const values = await railwayProjectAliasForm.validateFields()
    setSavingRailwayProjectAlias(true)

    try {
      const nextAllServices = await window.forgeDesk.saveServiceExternalProjectAlias({
        provider: 'railway',
        externalProjectId: editingRailwayProjectGroup.externalProjectId,
        alias: values.alias
      })
      setAllServices(nextAllServices)
      setServices(project ? await window.forgeDesk.listProjectServices(project.id) : nextAllServices)
      setEditingRailwayProjectGroup(null)
      railwayProjectAliasForm.resetFields()
      message.success('Railway 项目显示名已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingRailwayProjectAlias(false)
    }
  }

  function updateServiceState(nextService: ProjectService): void {
    setAllServices((currentServices) => currentServices.map((service) => (service.id === nextService.id ? nextService : service)))
    setServices((currentServices) => currentServices.map((service) => (service.id === nextService.id ? nextService : service)))
  }

  async function saveService(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await serviceForm.validateFields()
    setSavingService(true)

    try {
      const service = await window.forgeDesk.saveProjectService({
        id: editingService?.id,
        projectId: project?.id,
        provider: values.provider,
        connectionId: values.connectionId,
        repositoryId: values.repositoryId,
        name: values.name.trim(),
        externalProjectId: values.externalProjectId,
        externalProjectName: editingService?.externalProjectName,
        externalProjectAlias: editingService?.externalProjectAlias,
        externalServiceId: values.externalServiceId,
        defaultEnvironment: values.defaultEnvironment,
        healthPath: values.healthPath || '/',
        enabled: values.enabled,
        environments: editingService?.environments.map((environment) => ({
          name: environment.name,
          externalEnvironmentId: environment.externalEnvironmentId,
          status: environment.status,
          deploymentStatus: environment.deploymentStatus,
          latestDeploymentId: environment.latestDeploymentId,
          latestDeploymentUrl: environment.latestDeploymentUrl,
          latestCommit: environment.latestCommit
        })),
        domains: parseServiceDomainsText(values.domainsText)
      })
      setServices((current) => {
        const existing = current.some((item) => item.id === service.id)
        return existing ? current.map((item) => (item.id === service.id ? service : item)) : [...current, service]
      })
      setAllServices(await window.forgeDesk.listAllProjectServices())
      setServiceModalOpen(false)
      setEditingService(null)
      serviceForm.resetFields()
      message.success('服务配置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingService(false)
    }
  }

  const connectionColumns: ColumnsType<ServiceConnection> = [
    { title: '平台', dataIndex: 'provider', key: 'provider', width: 110, render: (provider) => <Tag>{getServiceProviderLabel(provider)}</Tag> },
    { title: '连接', dataIndex: 'name', key: 'name', render: (name) => <Typography.Text strong>{name}</Typography.Text> },
    {
      title: 'Token',
      key: 'token',
      width: 110,
      render: (_, connection) => <Tag color={connection.tokenConfigured ? 'green' : 'red'}>{connection.tokenConfigured ? '已配置' : '未配置'}</Tag>
    },
    {
      title: '范围',
      key: 'scope',
      width: 190,
      render: (_, connection) =>
        connection.provider === 'vercel' ? (
          <TableText value={connection.teamId || 'Personal'} />
        ) : (
          <TableText value={connection.railwayTokenType === 'project' ? 'Project Token' : connection.workspaceId || connection.railwayTokenType} />
        )
    },
    {
      title: '操作',
      key: 'actions',
      width: 330,
      render: (_, connection) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openConnectionModal(connection)}>
            编辑
          </Button>
          <Button size="small" loading={workingConnectionId === connection.id} onClick={() => testConnection(connection)}>
            测试
          </Button>
          <Button size="small" icon={<ReloadOutlined />} loading={syncingConnectionId === connection.id} onClick={() => syncConnection(connection)}>
            同步
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} loading={deletingConnectionId === connection.id} onClick={() => confirmDeleteConnection(connection)}>
            删除
          </Button>
        </Space>
      )
    }
  ]

  const serviceColumns: ColumnsType<ProjectService> = [
    {
      title: '服务',
      key: 'service',
      width: 220,
      render: (_, service) => (
        <Space direction="vertical" size={2}>
          <Space size={6}>
            <Tag>{getServiceProviderLabel(service.provider)}</Tag>
            <Button
              type="link"
              className="table-link-button"
              onClick={(event) => {
                event.stopPropagation()
                openServiceDetail(service)
              }}
            >
              {service.name}
            </Button>
          </Space>
          <Typography.Text type="secondary">{service.enabled ? '启用' : '停用'}</Typography.Text>
        </Space>
      )
    },
    {
      title: '环境',
      key: 'environments',
      render: (_, service) => (
        <Space wrap>
          {service.environments.length > 0 ? (
            service.environments.map((environment) => (
              <Tag key={environment.id} color={environment.deploymentStatus === 'SUCCESS' || environment.deploymentStatus === 'READY' ? 'green' : 'default'}>
                {environment.name}
                {environment.deploymentStatus ? ` · ${environment.deploymentStatus}` : ''}
              </Tag>
            ))
          ) : (
            <Typography.Text type="secondary">未同步</Typography.Text>
          )}
        </Space>
      )
    },
    {
      title: '域名',
      key: 'domains',
      render: (_, service) => (
        <Space direction="vertical" size={2}>
          {getMonitorableServiceDomains(service).length > 0 ? (
            getMonitorableServiceDomains(service).map((domain) => <TableText key={domain.id} value={domain.domain} />)
          ) : (
            <Typography.Text type="secondary">暂无自定义域名</Typography.Text>
          )}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, service) => (
        <Space>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={(event) => {
              event.stopPropagation()
              openServiceDetail(service)
            }}
          >
            详情
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={(event) => {
              event.stopPropagation()
              openServiceModal(service)
            }}
          >
            编辑
          </Button>
        </Space>
      )
    }
  ]

  const railwayEnvironmentServiceColumns = (environmentName: string): ColumnsType<ProjectService> => [
    {
      title: '服务',
      key: 'service',
      width: 240,
      render: (_, service) => {
        const environment = service.environments.find((item) => item.name === environmentName)

        return (
          <Space direction="vertical" size={2}>
            <Space size={6}>
              <Button
                type="link"
                className="table-link-button"
                onClick={(event) => {
                  event.stopPropagation()
                  openServiceDetail(service)
                }}
              >
                {service.name}
              </Button>
              <Tag color={service.enabled ? 'green' : 'default'}>{service.enabled ? '启用' : '停用'}</Tag>
            </Space>
            <Typography.Text type="secondary">{environment?.deploymentStatus || '未同步部署'}</Typography.Text>
          </Space>
        )
      }
    },
    {
      title: '部署',
      key: 'deployment',
      render: (_, service) => {
        const environment = service.environments.find((item) => item.name === environmentName)

        return environment?.latestDeploymentUrl ? <TableText value={environment.latestDeploymentUrl} /> : <Typography.Text type="secondary">-</Typography.Text>
      }
    },
    {
      title: '域名',
      key: 'domains',
      render: (_, service) => {
        const domains = getMonitorableServiceDomains(service).filter((domain) => !domain.environmentName || domain.environmentName === environmentName)

        return (
          <Space direction="vertical" size={2}>
            {domains.length > 0 ? domains.map((domain) => <TableText key={domain.id} value={domain.domain} />) : <Typography.Text type="secondary">暂无域名</Typography.Text>}
          </Space>
        )
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_, service) => {
        const logActions = getServiceEnvironmentLogActions(service, environmentName)

        return (
          <Space wrap size={6}>
            {logActions.map((action) => (
              <Button
                key={action.mode}
                size="small"
                icon={<FileTextOutlined />}
                aria-label={action.label}
                title={action.label}
                disabled={action.disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  void openServiceEnvironmentLogs(service, environmentName, action.mode)
                }}
              >
                {action.compactLabel}
              </Button>
            ))}
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openServiceDetail(service)
              }}
            >
              详情
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                openServiceModal(service)
              }}
            >
              编辑
            </Button>
          </Space>
        )
      }
    }
  ]

  const connectionProvider = Form.useWatch('provider', connectionForm) ?? editingConnection?.provider ?? 'vercel'
  const connectionRailwayTokenType = Form.useWatch('railwayTokenType', connectionForm) ?? editingConnection?.railwayTokenType ?? 'workspace'
  const connectionGuide = getServiceProviderGuide(connectionProvider)
  const serviceProvider = Form.useWatch('provider', serviceForm) ?? editingService?.provider ?? 'vercel'
  const serviceGuide = getServiceProviderGuide(serviceProvider)
  const boundServiceIds = new Set(services.map((service) => service.id))
  const connectionSections = createServiceProviderSections(connections)
  const serviceSections = createServiceProviderSections(services)
  const providerOverview = createServiceProviderOverview(connections, services)
  const visibleConnectionSections = selectedServiceProvider
    ? connectionSections.filter((section) => section.provider === selectedServiceProvider)
    : connectionSections
  const visibleServiceSections = selectedServiceProvider
    ? serviceSections.filter((section) => section.provider === selectedServiceProvider)
    : serviceSections
  const selectedServiceProviderLabel = selectedServiceProvider ? getServiceProviderLabel(selectedServiceProvider) : ''
  const detailService = detailServiceId
    ? services.find((service) => service.id === detailServiceId) ?? allServices.find((service) => service.id === detailServiceId) ?? null
    : null
  const bindableServices = allServices.filter((service) => !boundServiceIds.has(service.id))
  const bindableServiceOptions = bindableServices
    .filter((service) => !bindingProvider || service.provider === bindingProvider)
    .map((service) => ({
      label: `${getServiceProviderLabel(service.provider)} · ${service.name}`,
      value: service.id
    }))

  return (
    <Space direction="vertical" size={16} className="project-service-settings">
      {!isProjectMode && !selectedServiceProvider ? (
        <div className="service-provider-entry-grid">
          {providerOverview.map((entry) => (
            <button key={entry.provider} type="button" className="service-provider-entry-card" onClick={() => setSelectedServiceProvider(entry.provider)}>
              <div className="service-provider-entry-heading">
                <Tag>{entry.label}</Tag>
                <Typography.Title level={4}>{entry.label}</Typography.Title>
              </div>
              <div className="service-provider-entry-stats">
                <Statistic title="平台连接" value={entry.connectionCount} />
                <Statistic title="服务" value={entry.serviceCount} />
              </div>
              <span className="service-provider-entry-action">
                进入 <ArrowRightOutlined />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {isProjectMode ? (
            <Alert
              type="info"
              showIcon
              message="项目只绑定服务，不保存平台 Token"
              description="Vercel / Railway Token 和同步出来的服务在“设置 / 服务中心”维护；这里只选择哪些服务属于当前项目。"
            />
          ) : (
            <>
              <div className="service-provider-detail-heading">
                <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedServiceProvider(null)}>
                  平台入口
                </Button>
                <Space direction="vertical" size={2}>
                  <Space size={8} wrap>
                    <Tag>{selectedServiceProviderLabel}</Tag>
                    <Typography.Title level={4}>{selectedServiceProviderLabel} 服务详情</Typography.Title>
                  </Space>
                  <Typography.Text type="secondary">配置说明、平台连接和同步服务都在这里维护。</Typography.Text>
                </Space>
              </div>

              <div className="service-guide-grid service-guide-grid-single">
                {selectedServiceProvider ? <ServiceProviderGuidePanel provider={selectedServiceProvider} /> : null}
              </div>

              <div className="remote-manager-toolbar service-settings-toolbar">
                <Typography.Title level={4}>平台连接</Typography.Title>
                <Space wrap>
                  <Button icon={<ReloadOutlined />} loading={syncingConnectionId === 'all'} disabled={connections.length === 0} onClick={() => syncConnection()}>
                    同步全部
                  </Button>
                </Space>
              </div>
              <div className="service-provider-section-list">
                {visibleConnectionSections.map((section) => (
                  <div key={section.provider} className="service-provider-section">
                    <div className="service-provider-section-heading">
                      <Space size={8} wrap>
                        <Tag>{section.label}</Tag>
                        <Typography.Text strong>{section.label} 平台连接</Typography.Text>
                        <Typography.Text type="secondary">{section.items.length} 个连接</Typography.Text>
                      </Space>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openConnectionModal(undefined, section.provider)}>
                        新增 {section.label} 连接
                      </Button>
                    </div>
                    <Table
                      rowKey="id"
                      size="small"
                      loading={loading}
                      columns={connectionColumns}
                      dataSource={section.items}
                      pagination={false}
                      scroll={{ x: 920 }}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无 ${section.label} 连接`} /> }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="remote-manager-toolbar service-settings-toolbar">
            <Typography.Title level={4}>{isProjectMode ? '已绑定服务' : `${selectedServiceProviderLabel} 服务`}</Typography.Title>
          </div>
          <div className="service-provider-section-list">
            {visibleServiceSections.map((section) => {
              const bindableCount = bindableServices.filter((service) => service.provider === section.provider).length
              const railwayGroups = section.provider === 'railway' ? createRailwayProjectEnvironmentGroups(section.items) : []

              return (
                <div key={section.provider} className="service-provider-section">
                  <div className="service-provider-section-heading">
                    <Space size={8} wrap>
                      <Tag>{section.label}</Tag>
                      <Typography.Text strong>{section.label} 服务</Typography.Text>
                      <Typography.Text type="secondary">{section.items.length} 个服务</Typography.Text>
                    </Space>
                    <Space wrap>
                      {isProjectMode ? (
                        <Button icon={<LinkOutlined />} disabled={bindableCount === 0} onClick={() => openBindingModal(section.provider)}>
                          绑定已有服务
                        </Button>
                      ) : null}
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openServiceModal(undefined, section.provider)}>
                        {isProjectMode ? '新增并绑定' : `新增 ${section.label} 服务`}
                      </Button>
                    </Space>
                  </div>
                  {section.provider === 'railway' ? (
                    railwayGroups.length > 0 ? (
                      <Collapse
                        className="railway-project-service-tree"
                        items={railwayGroups.map((projectGroup) => ({
                          key: projectGroup.id,
                          label: (
                            <Space size={8} wrap>
                              <Typography.Text strong>{projectGroup.name}</Typography.Text>
                              {projectGroup.alias ? <Tag color="purple">自定义</Tag> : null}
                              <Tag>{projectGroup.environments.length} 环境</Tag>
                              <Typography.Text type="secondary">{projectGroup.serviceCount} 个服务</Typography.Text>
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openRailwayProjectAliasModal(projectGroup)
                                }}
                              >
                                重命名
                              </Button>
                            </Space>
                          ),
                          children: (
                            <Collapse
                              ghost
                              className="railway-environment-service-tree"
                              items={projectGroup.environments.map((environmentGroup) => ({
                                key: `${projectGroup.id}:${environmentGroup.id}`,
                                label: (
                                  <Space size={8} wrap>
                                    <Tag color="blue">{environmentGroup.name}</Tag>
                                    <Typography.Text type="secondary">{environmentGroup.services.length} 个服务</Typography.Text>
                                  </Space>
                                ),
                                children: (
                                  <Table
                                    rowKey="id"
                                    size="small"
                                    loading={loading}
                                    columns={railwayEnvironmentServiceColumns(environmentGroup.name)}
                                    dataSource={environmentGroup.services}
                                    pagination={false}
                                    onRow={(service) => ({
                                      className: 'clickable-table-row',
                                      onClick: () => openServiceDetail(service)
                                    })}
                                    scroll={{ x: getRailwayEnvironmentServiceTableScrollX() }}
                                  />
                                )
                              }))}
                            />
                          )
                        }))}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isProjectMode ? '当前项目还没有绑定 Railway 服务' : '暂无 Railway 服务配置'} />
                    )
                  ) : (
                    <Table
                      rowKey="id"
                      size="small"
                      loading={loading}
                      columns={serviceColumns}
                      dataSource={section.items}
                      pagination={false}
                      onRow={(service) => ({
                        className: 'clickable-table-row',
                        onClick: () => openServiceDetail(service)
                      })}
                      scroll={{ x: 980 }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={isProjectMode ? `当前项目还没有绑定 ${section.label} 服务` : `暂无 ${section.label} 服务配置`}
                          />
                        )
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {!isProjectMode && !selectedServiceProvider ? null : (
        <>
          <ServiceDetailDrawer
            service={detailService}
            open={Boolean(detailService)}
            onClose={() => setDetailServiceId(null)}
            onServiceChange={updateServiceState}
            onEdit={(service) => {
              setDetailServiceId(null)
              openServiceModal(service)
            }}
          />

          <Drawer
            title={
              serviceLogDrawer
                ? `${serviceLogDrawer.service.name} / ${serviceLogDrawer.environment.name} ${serviceLogDrawer.mode === 'runtime' ? '运行日志' : '构建日志'}`
                : '服务日志'
            }
            open={Boolean(serviceLogDrawer)}
            width={760}
            onClose={() => {
              setServiceLogDrawer(null)
              setServiceLogLines([])
              setServiceLogError('')
            }}
          >
            <Spin spinning={serviceLogLoading}>
              {serviceLogError ? <Alert type="warning" showIcon message="日志暂不可用" description={serviceLogError} /> : null}
              {!serviceLogError && serviceLogLines.length === 0 && !serviceLogLoading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" /> : null}
              <Space direction="vertical" size={8} className="service-log-lines">
                {serviceLogLines.map((line, index) => (
                  <div key={`${line.timestamp}-${index}`} className="service-log-line">
                    <Typography.Text type="secondary">{formatDateTime(line.timestamp)}</Typography.Text>
                    <Tag>{line.level || 'log'}</Tag>
                    <Typography.Text>{line.message || '-'}</Typography.Text>
                  </div>
                ))}
              </Space>
            </Spin>
          </Drawer>

          <Modal
            title={editingRailwayProjectGroup ? `重命名 Railway 项目：${editingRailwayProjectGroup.externalProjectName || editingRailwayProjectGroup.externalProjectId}` : '重命名 Railway 项目'}
            open={Boolean(editingRailwayProjectGroup)}
            okText="保存"
            cancelText="取消"
            confirmLoading={savingRailwayProjectAlias}
            onOk={saveRailwayProjectAlias}
            onCancel={() => {
              setEditingRailwayProjectGroup(null)
              railwayProjectAliasForm.resetFields()
            }}
          >
            <Form form={railwayProjectAliasForm} layout="vertical">
              <Form.Item name="alias" label="本地显示名" extra="只影响 ForgeDesk 里的显示，不会修改 Railway 项目名称；留空会恢复同步名称或 Project ID。">
                <Input placeholder={editingRailwayProjectGroup?.externalProjectName || editingRailwayProjectGroup?.externalProjectId || '例如 数据中心'} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            title={bindingProvider ? `绑定 ${getServiceProviderLabel(bindingProvider)} 服务` : '绑定已有服务'}
            open={bindingModalOpen}
            okText="绑定"
            cancelText="取消"
            confirmLoading={savingBinding}
            onOk={saveServiceBinding}
            onCancel={() => {
              setBindingModalOpen(false)
              setBindingProvider(null)
              bindingForm.resetFields()
            }}
          >
            <Form form={bindingForm} layout="vertical">
              <Form.Item name="serviceId" label="服务" rules={[{ required: true, message: '请选择服务' }]}>
                <Select
                  showSearch
                  placeholder="选择服务中心里的服务"
                  options={bindableServiceOptions}
                  optionFilterProp="label"
                  notFoundContent={bindingProvider ? `没有可绑定的 ${getServiceProviderLabel(bindingProvider)} 服务` : '没有可绑定的服务'}
                />
              </Form.Item>
              <Form.Item name="repositoryId" label="关联仓库">
                <Select allowClear options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            title={editingConnection ? `编辑连接：${editingConnection.name}` : '新增服务连接'}
            open={connectionModalOpen}
            okText="保存"
            cancelText="取消"
            confirmLoading={savingConnection}
            onOk={saveConnection}
            onCancel={() => {
              setConnectionModalOpen(false)
              setEditingConnection(null)
              connectionForm.resetFields()
            }}
          >
            <Form form={connectionForm} layout="vertical">
              <Row gutter={[12, 0]}>
                <Col span={12}>
                  <Form.Item name="provider" label="平台" rules={[{ required: true, message: '请选择平台' }]}>
                    <Select
                      options={[
                        { label: 'Vercel', value: 'vercel' },
                        { label: 'Railway', value: 'railway' }
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }]}>
                    <Input placeholder="Production" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="token" label="Token">
                <Input.Password placeholder={editingConnection?.tokenConfigured ? '已保存，留空不变' : '平台 API Token'} />
              </Form.Item>
              <Alert
                className="service-guide-alert"
                type="info"
                showIcon
                message={`${connectionGuide.title} 配置提示`}
                description={
                  <Space direction="vertical" size={8}>
                    {connectionGuide.steps.slice(0, connectionProvider === 'railway' ? 2 : 1).map((step) => (
                      <Typography.Text key={step}>{step}</Typography.Text>
                    ))}
                    <Space wrap>
                      <Button size="small" icon={<LinkOutlined />} href={connectionGuide.primaryTokenUrl} target="_blank" rel="noreferrer">
                        打开 Token 页面
                      </Button>
                      <Button size="small" href={connectionGuide.docsUrl} target="_blank" rel="noreferrer">
                        打开 API 文档
                      </Button>
                    </Space>
                  </Space>
                }
              />
              {connectionProvider === 'vercel' ? (
                <Form.Item name="teamId" label="Vercel Team ID">
                  <Input placeholder="团队项目填写 team_xxx，个人项目可留空" />
                </Form.Item>
              ) : (
                <Row gutter={[12, 0]}>
                  <Col span={12}>
                    <Form.Item name="railwayTokenType" label="Railway Token 类型">
                      <Select
                        options={[
                          { label: 'Workspace', value: 'workspace' },
                          { label: 'Account', value: 'account' },
                          { label: 'Project', value: 'project' }
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="workspaceId"
                      label="Workspace ID"
                      rules={
                        connectionProvider === 'railway' && connectionRailwayTokenType === 'workspace'
                          ? [{ required: true, message: 'Workspace Token 需要填写 Workspace ID' }]
                          : []
                      }
                      extra={
                        connectionRailwayTokenType === 'account'
                          ? '不填时会同步个人项目并尝试发现 Workspace；如果同步不到服务，请填写目标 Workspace ID。'
                          : undefined
                      }
                    >
                      <Input
                        placeholder={
                          connectionRailwayTokenType === 'workspace'
                            ? 'Workspace Token 必填'
                            : connectionRailwayTokenType === 'account'
                              ? '个人项目可留空，Workspace 项目建议填写'
                              : 'Project Token 可留空'
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </Form>
          </Modal>

          <Modal
            title={editingService ? `编辑服务：${editingService.name}` : '新增服务'}
            open={serviceModalOpen}
            okText="保存"
            cancelText="取消"
            confirmLoading={savingService}
            onOk={saveService}
            onCancel={() => {
              setServiceModalOpen(false)
              setEditingService(null)
              serviceForm.resetFields()
            }}
          >
            <Form form={serviceForm} layout="vertical">
              <Row gutter={[12, 0]}>
                <Col span={12}>
                  <Form.Item name="provider" label="平台" rules={[{ required: true, message: '请选择平台' }]}>
                    <Select
                      options={[
                        { label: 'Vercel', value: 'vercel' },
                        { label: 'Railway', value: 'railway' }
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
                    <Input placeholder="web" />
                  </Form.Item>
                </Col>
              </Row>
              <Alert
                className="service-guide-alert"
                type="info"
                showIcon
                message={`${serviceGuide.title} 服务配置提示`}
                description={
                  <Space direction="vertical" size={8}>
                    <Typography.Text>
                      {serviceProvider === 'railway'
                        ? 'Railway 项目里可用 Cmd/Ctrl+K 复制 Project、Service 或 Environment ID；Project Token 也在项目设置的 Tokens 页面创建。'
                        : 'Vercel 通常同步后会自动带出项目和域名；团队项目请先在连接里填写 Team ID。'}
                    </Typography.Text>
                    <Space wrap>
                      <Button size="small" href={serviceGuide.dashboardUrl} target="_blank" rel="noreferrer">
                        打开控制台
                      </Button>
                      {serviceGuide.projectTokenDocsUrl ? (
                        <Button size="small" href={serviceGuide.projectTokenDocsUrl} target="_blank" rel="noreferrer">
                          Project Token
                        </Button>
                      ) : null}
                      <Button size="small" href={serviceGuide.docsUrl} target="_blank" rel="noreferrer">
                        API 文档
                      </Button>
                    </Space>
                  </Space>
                }
              />
              <Row gutter={[12, 0]}>
                <Col span={isProjectMode ? 12 : 24}>
                  <Form.Item name="connectionId" label="平台连接">
                    <Select
                      allowClear
                      options={connections
                        .filter((connection) => connection.provider === serviceProvider)
                        .map((connection) => ({ label: connection.name, value: connection.id }))}
                    />
                  </Form.Item>
                </Col>
                {isProjectMode ? (
                  <Col span={12}>
                    <Form.Item name="repositoryId" label="关联仓库">
                      <Select allowClear options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))} />
                    </Form.Item>
                  </Col>
                ) : null}
              </Row>
          <Row gutter={[12, 0]}>
            <Col span={12}>
              <Form.Item name="externalProjectId" label="平台项目 ID">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="externalServiceId" label="平台服务 ID">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[12, 0]}>
            <Col span={12}>
              <Form.Item name="defaultEnvironment" label="默认环境">
                <Input placeholder="production" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="healthPath" label="Health Path" rules={[{ required: true, message: '请输入检查路径' }]}>
                <Input placeholder="/" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="enabled" valuePropName="checked">
            <Checkbox>启用监控</Checkbox>
          </Form.Item>
          <Form.Item name="domainsText" label="域名">
            <Input.TextArea rows={4} placeholder="app.example.com" />
          </Form.Item>
        </Form>
      </Modal>
        </>
      )}
    </Space>
  )
}

const serviceDeploymentActionLabels: Record<ServiceDeploymentAction, string> = {
  deploy: '部署',
  redeploy: '重新部署',
  restart: '重启部署',
  stop: '停止部署',
  cancel: '取消部署',
  promote: '提升为生产',
  rollback: '回滚到此部署'
}

function isDangerousDeploymentAction(action: ServiceDeploymentAction): boolean {
  return ['cancel', 'promote', 'rollback', 'stop'].includes(action)
}

function getDeploymentActionConfirmContent(provider: ServiceProviderType, action: ServiceDeploymentAction): string {
  if (provider === 'railway') {
    if (action === 'deploy') {
      return '这个操作会在 Railway 环境中触发一次新部署。'
    }

    if (action === 'restart') {
      return '这个操作会重启正在运行的 Railway 部署，不会重新构建。'
    }

    if (action === 'stop') {
      return '这个操作会停止当前正在运行的 Railway 部署。'
    }

    if (action === 'cancel') {
      return '这个操作会取消正在构建、部署、等待或排队中的 Railway 部署。'
    }

    if (action === 'rollback') {
      return '这个操作会把 Railway 环境回滚到该部署。'
    }

    return '这个操作会提交到 Railway。'
  }

  return action === 'promote' || action === 'rollback' ? '这个操作会改变生产流量指向。' : '操作会提交到 Vercel。'
}

function ServiceDetailDrawer({
  service,
  open,
  onClose,
  onServiceChange,
  onEdit
}: {
  service: ProjectService | null
  open: boolean
  onClose: () => void
  onServiceChange: (service: ProjectService) => void
  onEdit: (service: ProjectService) => void
}): JSX.Element {
  const [liveService, setLiveService] = useState<ProjectService | null>(null)
  const activeService = liveService ?? service
  const [logEnvironment, setLogEnvironment] = useState<ProjectServiceEnvironment | null>(null)
  const [logMode, setLogMode] = useState<'build' | 'runtime'>('build')
  const [logLines, setLogLines] = useState<ServiceEnvironmentLogLine[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState('')
  const [activeTab, setActiveTab] = useState('environments')
  const [deployments, setDeployments] = useState<ServiceDeploymentSummary[]>([])
  const [deploymentsLoading, setDeploymentsLoading] = useState(false)
  const [deploymentsError, setDeploymentsError] = useState('')
  const [envVars, setEnvVars] = useState<ServiceEnvVarRecord[]>([])
  const [envVarsLoading, setEnvVarsLoading] = useState(false)
  const [envVarsError, setEnvVarsError] = useState('')
  const [envModalOpen, setEnvModalOpen] = useState(false)
  const [editingEnvVar, setEditingEnvVar] = useState<ServiceEnvVarRecord | null>(null)
  const [savingEnvVar, setSavingEnvVar] = useState(false)
  const [revealedEnvValues, setRevealedEnvValues] = useState<Record<string, string>>({})
  const [workingEnvVarId, setWorkingEnvVarId] = useState<string | null>(null)
  const [copyingEnvVarId, setCopyingEnvVarId] = useState<string | null>(null)
  const [copyingAllEnvVars, setCopyingAllEnvVars] = useState(false)
  const [envVarVisibleCount, setEnvVarVisibleCount] = useState(serviceEnvVarInitialVisibleCount)
  const [domainModalOpen, setDomainModalOpen] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)
  const [workingDomain, setWorkingDomain] = useState<string | null>(null)
  const [domainConfig, setDomainConfig] = useState<{ domain: string; config: VercelDomainConfig } | null>(null)
  const [envForm] = Form.useForm<VercelEnvVarForm>()
  const [domainForm] = Form.useForm<VercelDomainForm>()

  function applyServiceUpdate(nextService: ProjectService): void {
    setLiveService(nextService)
    onServiceChange(nextService)
  }

  useEffect(() => {
    setLiveService(service)
    setActiveTab('environments')
    setLogEnvironment(null)
    setLogMode('build')
    setLogLines([])
    setLogError('')
    setDeployments([])
    setDeploymentsError('')
    setEnvVars([])
    setEnvVarsError('')
    setEnvModalOpen(false)
    setEditingEnvVar(null)
    setRevealedEnvValues({})
    setCopyingEnvVarId(null)
    setCopyingAllEnvVars(false)
    setEnvVarVisibleCount(serviceEnvVarInitialVisibleCount)
    setDomainModalOpen(false)
    setDomainConfig(null)
  }, [service?.id, open])

  async function loadDeployments(): Promise<void> {
    if (!activeService || !window.forgeDesk || !getServiceProviderCapabilities(activeService.provider).canListDeployments) {
      return
    }

    setDeploymentsLoading(true)
    setDeploymentsError('')

    try {
      const cachedDeployments = await window.forgeDesk.listCachedServiceDeployments(activeService.id, { limit: 20 })

      if (cachedDeployments.length > 0) {
        setDeployments(cachedDeployments)
      }

      setDeployments(await window.forgeDesk.listServiceDeployments(activeService.id, { limit: 20 }))
    } catch (error) {
      setDeploymentsError(getErrorMessage(error))
    } finally {
      setDeploymentsLoading(false)
    }
  }

  async function loadEnvironmentLogs(environment: ProjectServiceEnvironment, mode: 'build' | 'runtime'): Promise<void> {
    if (!activeService || !window.forgeDesk) {
      return
    }

    setLogEnvironment(environment)
    setLogMode(mode)
    setLogLines([])
    setLogError('')
    setLogLoading(true)

    try {
      setLogLines(
        mode === 'runtime'
          ? await window.forgeDesk.listServiceRuntimeLogs(activeService.id, environment.name)
          : await window.forgeDesk.listServiceEnvironmentLogs(activeService.id, environment.name)
      )
    } catch (error) {
      setLogError(getErrorMessage(error))
    } finally {
      setLogLoading(false)
    }
  }

  function runDeploymentAction(deployment: ServiceDeploymentSummary, action: ServiceDeploymentAction): void {
    if (!activeService || !window.forgeDesk) {
      return
    }

    const actionLabel = serviceDeploymentActionLabels[action]
    const dangerous = isDangerousDeploymentAction(action)

    Modal.confirm({
      title: `${actionLabel} ${deployment.id}？`,
      content: getDeploymentActionConfirmContent(activeService.provider, action),
      okText: actionLabel,
      cancelText: '取消',
      okButtonProps: { danger: dangerous },
      onOk: async () => {
        try {
          const nextService = await window.forgeDesk.runServiceDeploymentAction(activeService.id, {
            action,
            deploymentId: deployment.id,
            description: action === 'rollback' ? `Rollback from ForgeDesk to ${deployment.id}` : undefined
          })
          applyServiceUpdate(nextService)
          await loadDeployments()
          message.success(`${actionLabel}已提交`)
        } catch (error) {
          message.error(getErrorMessage(error))
        }
      }
    })
  }

  function runEnvironmentDeployment(environment: ProjectServiceEnvironment): void {
    if (!activeService || !window.forgeDesk || activeService.provider !== 'railway') {
      return
    }

    Modal.confirm({
      title: `部署 ${environment.name}？`,
      content: getDeploymentActionConfirmContent(activeService.provider, 'deploy'),
      okText: serviceDeploymentActionLabels.deploy,
      cancelText: '取消',
      onOk: async () => {
        try {
          const nextService = await window.forgeDesk.runServiceDeploymentAction(activeService.id, {
            action: 'deploy',
            environmentId: environment.externalEnvironmentId
          })
          applyServiceUpdate(nextService)
          await loadDeployments()
          message.success('部署已提交')
        } catch (error) {
          message.error(getErrorMessage(error))
        }
      }
    })
  }

  async function loadEnvVars(): Promise<void> {
    if (!activeService || !window.forgeDesk || !getServiceProviderCapabilities(activeService.provider).canReadEnvVars) {
      return
    }

    setEnvVarsLoading(true)
    setEnvVarsError('')

    try {
      setEnvVarVisibleCount(serviceEnvVarInitialVisibleCount)
      setEnvVars(await window.forgeDesk.listServiceEnvVars(activeService.id))
    } catch (error) {
      setEnvVarsError(getErrorMessage(error))
    } finally {
      setEnvVarsLoading(false)
    }
  }

  function openEnvModal(envVar?: ServiceEnvVarRecord): void {
    setEditingEnvVar(envVar ?? null)
    envForm.setFieldsValue({
      key: envVar?.key ?? '',
      value: '',
      type: envVar?.type || 'sensitive',
      target: envVar?.target.length ? envVar.target : ['production'],
      gitBranch: envVar?.gitBranch ?? '',
      comment: envVar?.comment ?? ''
    })
    setEnvModalOpen(true)
  }

  async function saveEnvVar(): Promise<void> {
    if (!activeService || !window.forgeDesk) {
      return
    }

    const values = await envForm.validateFields()
    const target = values.target?.filter(Boolean)
    const input: VercelEnvVarInput = {
      id: editingEnvVar?.id,
      key: values.key.trim(),
      value: values.value?.trim() || undefined,
      type: values.type,
      target: target?.length ? target : ['production'],
      gitBranch: values.gitBranch?.trim() || undefined,
      comment: values.comment?.trim() || undefined
    }

    setSavingEnvVar(true)

    try {
      await window.forgeDesk.saveServiceEnvVar(activeService.id, input)
      setEnvModalOpen(false)
      setEditingEnvVar(null)
      envForm.resetFields()
      await loadEnvVars()
      message.success('环境变量已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingEnvVar(false)
    }
  }

  async function revealEnvVar(envVar: ServiceEnvVarRecord): Promise<void> {
    if (!activeService || !window.forgeDesk) {
      return
    }

    setWorkingEnvVarId(envVar.id)

    try {
      const revealed = await window.forgeDesk.revealServiceEnvVar(activeService.id, envVar.id)
      setRevealedEnvValues((values) => ({ ...values, [envVar.id]: revealed.value ?? '' }))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingEnvVarId(null)
    }
  }

  function confirmDeleteEnvVar(envVar: ServiceEnvVarRecord): void {
    if (!activeService || !window.forgeDesk) {
      return
    }

    Modal.confirm({
      title: `删除环境变量 ${envVar.key}？`,
      content: '这个操作会从 Vercel 项目中删除该变量。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setWorkingEnvVarId(envVar.id)

        try {
          await window.forgeDesk.deleteServiceEnvVar(activeService.id, envVar.id)
          await loadEnvVars()
          message.success('环境变量已删除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setWorkingEnvVarId(null)
        }
      }
    })
  }

  function openDomainModal(): void {
    domainForm.setFieldsValue({
      name: '',
      environmentName: undefined,
      gitBranch: '',
      redirect: '',
      redirectStatusCode: undefined
    })
    setDomainModalOpen(true)
  }

  async function saveDomain(): Promise<void> {
    if (!activeService || !window.forgeDesk) {
      return
    }

    const values = await domainForm.validateFields()
    setSavingDomain(true)

    try {
      const nextService = await window.forgeDesk.addServiceDomain(activeService.id, {
        name: values.name.trim(),
        environmentName: values.environmentName,
        gitBranch: values.gitBranch?.trim() || undefined,
        redirect: values.redirect?.trim() || undefined,
        redirectStatusCode: values.redirectStatusCode
      })
      applyServiceUpdate(nextService)
      setDomainModalOpen(false)
      domainForm.resetFields()
      message.success('域名已添加')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingDomain(false)
    }
  }

  function confirmRemoveDomain(domain: ProjectServiceDomain): void {
    if (!activeService || !window.forgeDesk) {
      return
    }

    Modal.confirm({
      title: `从 Vercel 移除 ${domain.domain}？`,
      content: '这个操作不会删除 DNS 服务商里的记录。',
      okText: '移除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setWorkingDomain(domain.domain)

        try {
          const nextService = await window.forgeDesk.removeServiceDomain(activeService.id, domain.domain, false)
          applyServiceUpdate(nextService)
          message.success('域名已移除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setWorkingDomain(null)
        }
      }
    })
  }

  async function verifyDomain(domain: ProjectServiceDomain): Promise<void> {
    if (!activeService || !window.forgeDesk) {
      return
    }

    setWorkingDomain(domain.domain)

    try {
      const nextService = await window.forgeDesk.verifyServiceDomain(activeService.id, domain.domain)
      applyServiceUpdate(nextService)
      message.success('域名验证已提交')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingDomain(null)
    }
  }

  async function inspectDomainConfig(domain: ProjectServiceDomain): Promise<void> {
    if (!activeService || !window.forgeDesk) {
      return
    }

    setWorkingDomain(domain.domain)

    try {
      setDomainConfig({ domain: domain.domain, config: await window.forgeDesk.inspectServiceDomainConfig(activeService.id, domain.domain) })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorkingDomain(null)
    }
  }

  const summary = activeService ? createServiceDetailSummary(activeService) : null
  const monitorableDomains = activeService ? getMonitorableServiceDomains(activeService) : []
  const serviceCapabilities = activeService ? getServiceProviderCapabilities(activeService.provider) : null
  const isVercel = activeService?.provider === 'vercel'
  const visibleEnvVarTotal = Math.min(envVarVisibleCount, envVars.length)
  const visibleEnvVars = envVars.slice(0, visibleEnvVarTotal)
  const hasMoreEnvVars = visibleEnvVarTotal < envVars.length

  function hasRevealedEnvValue(envVar: ServiceEnvVarRecord): boolean {
    return Object.prototype.hasOwnProperty.call(revealedEnvValues, envVar.id)
  }

  function getEnvVarKnownValue(envVar: ServiceEnvVarRecord): string | undefined {
    return hasRevealedEnvValue(envVar) ? revealedEnvValues[envVar.id] : envVar.value
  }

  async function resolveEnvVarCopyValue(envVar: ServiceEnvVarRecord): Promise<string> {
    const knownValue = getEnvVarKnownValue(envVar)

    if (knownValue !== undefined) {
      return knownValue
    }

    if (!activeService || !window.forgeDesk || !serviceCapabilities?.canManageEnvVars) {
      throw new Error('当前平台未返回环境变量值')
    }

    const revealed = await window.forgeDesk.revealServiceEnvVar(activeService.id, envVar.id)
    return revealed.value ?? ''
  }

  async function copyEnvVarValue(envVar: ServiceEnvVarRecord): Promise<void> {
    setCopyingEnvVarId(envVar.id)

    try {
      const value = await resolveEnvVarCopyValue(envVar)
      await copyText(value, `${envVar.key} 值已复制`, `${envVar.key} 值为空`, { allowEmpty: true })
    } catch (error) {
      message.error(getErrorMessage(error, '复制失败'))
    } finally {
      setCopyingEnvVarId(null)
    }
  }

  async function copyAllEnvVars(): Promise<void> {
    if (envVars.length === 0) {
      message.warning('暂无环境变量')
      return
    }

    setCopyingAllEnvVars(true)

    try {
      const lines: string[] = []

      for (const envVar of envVars) {
        const value = await resolveEnvVarCopyValue(envVar)
        lines.push(`${envVar.key}=${value}`)
      }

      await copyText(lines.join('\n'), '环境变量已复制')
    } catch (error) {
      message.error(getErrorMessage(error, '复制失败'))
    } finally {
      setCopyingAllEnvVars(false)
    }
  }

  function handleEnvVarsTableScroll(event: UIEvent<HTMLDivElement>): void {
    if (!hasMoreEnvVars) {
      return
    }

    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget

    if (scrollHeight - scrollTop - clientHeight > serviceEnvVarLoadMoreThreshold) {
      return
    }

    setEnvVarVisibleCount((current) => Math.min(envVars.length, current + serviceEnvVarLoadMoreCount))
  }

  const environmentColumns: ColumnsType<ProjectServiceEnvironment> = [
    {
      title: '环境',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name, environment) => (
        <Space direction="vertical" size={2}>
          <Tag color={environment.deploymentStatus === 'SUCCESS' || environment.deploymentStatus === 'READY' ? 'green' : 'default'}>{name}</Tag>
          <Typography.Text type="secondary">{environment.deploymentStatus || '未同步部署'}</Typography.Text>
        </Space>
      )
    },
    { title: '最新提交', key: 'commit', width: 120, render: (_, environment) => formatShortCommit(environment.latestCommit) },
    {
      title: '部署 ID',
      key: 'deploymentId',
      width: 180,
      render: (_, environment) => <TableText value={environment.latestDeploymentId || '-'} />
    },
    {
      title: '部署 URL',
      key: 'deploymentUrl',
      render: (_, environment) => <TableText value={environment.latestDeploymentUrl || '-'} />
    },
    { title: '更新时间', key: 'updatedAt', width: 180, render: (_, environment) => formatDateTime(environment.updatedAt) },
    {
      title: '操作',
      key: 'actions',
      width: activeService?.provider === 'railway' ? 260 : 190,
      render: (_, environment) => (
        <Space wrap size={6}>
          {activeService?.provider === 'railway' ? (
            <Button size="small" icon={<UploadOutlined />} disabled={!environment.externalEnvironmentId} onClick={() => runEnvironmentDeployment(environment)}>
              部署
            </Button>
          ) : null}
          <Button size="small" icon={<FileTextOutlined />} disabled={!environment.latestDeploymentId} onClick={() => loadEnvironmentLogs(environment, 'build')}>
            构建
          </Button>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            disabled={!serviceCapabilities?.canReadRuntimeLogs || (isVercel ? !environment.latestDeploymentId : !environment.externalEnvironmentId)}
            onClick={() => loadEnvironmentLogs(environment, 'runtime')}
          >
            运行
          </Button>
        </Space>
      )
    }
  ]
  function renderServiceDeploymentActions(deployment: ServiceDeploymentSummary): JSX.Element | null {
    if (!activeService) {
      return null
    }

    if (activeService.provider === 'railway') {
      const railwayActions: Array<{ action: ServiceDeploymentAction; icon?: JSX.Element; danger?: boolean; tooltip: string }> = [
        { action: 'redeploy', icon: <ReloadOutlined />, tooltip: 'Redeploy' },
        { action: 'restart', icon: <ThunderboltOutlined />, tooltip: 'Restart deployment' },
        { action: 'rollback', icon: <ArrowLeftOutlined />, danger: true, tooltip: 'Rollback to this deployment' },
        { action: 'stop', icon: <CloseCircleOutlined />, danger: true, tooltip: 'Stop running deployment' },
        { action: 'cancel', icon: <CloseCircleOutlined />, danger: true, tooltip: 'Cancel queued or building deployment' }
      ]

      return (
        <Space wrap size={6}>
          {railwayActions.map(({ action, icon, danger, tooltip }) => {
            const enabled = canRunServiceDeploymentAction(activeService.provider, deployment, action)

            return (
              <Tooltip key={action} title={enabled ? tooltip : `${serviceDeploymentActionLabels[action]} 当前不可用`}>
                <Button size="small" danger={danger} disabled={!enabled} icon={icon} onClick={() => runDeploymentAction(deployment, action)}>
                  {serviceDeploymentActionLabels[action]}
                </Button>
              </Tooltip>
            )
          })}
        </Space>
      )
    }

    return (
      <Space wrap size={6}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => runDeploymentAction(deployment, 'redeploy')}>
          Redeploy
        </Button>
        <Button size="small" danger disabled={!canRunServiceDeploymentAction(activeService.provider, deployment, 'cancel')} onClick={() => runDeploymentAction(deployment, 'cancel')}>
          Cancel
        </Button>
        <Button size="small" onClick={() => runDeploymentAction(deployment, 'promote')}>
          Promote
        </Button>
        <Button size="small" danger onClick={() => runDeploymentAction(deployment, 'rollback')}>
          Rollback
        </Button>
      </Space>
    )
  }

  const deploymentColumns: ColumnsType<ServiceDeploymentSummary> = [
    { title: '部署', key: 'id', width: 170, render: (_, deployment) => <TableText value={deployment.id || '-'} /> },
    {
      title: '状态',
      key: 'state',
      width: 150,
      render: (_, deployment) => (
        <Space direction="vertical" size={2}>
          <Tag color={deployment.state === 'READY' ? 'green' : deployment.state === 'ERROR' ? 'red' : 'default'}>{deployment.state || '-'}</Tag>
          <Typography.Text type="secondary">{deployment.target || '-'}</Typography.Text>
        </Space>
      )
    },
    { title: '提交', key: 'commit', width: 120, render: (_, deployment) => formatShortCommit(deployment.commitSha) },
    { title: 'URL', key: 'url', render: (_, deployment) => <TableText value={deployment.url || '-'} /> },
    { title: '创建时间', key: 'createdAt', width: 170, render: (_, deployment) => formatDateTime(deployment.createdAt) },
    ...(serviceCapabilities?.canRunDeploymentActions
      ? [
          {
            title: '操作',
            key: 'actions',
            width: activeService?.provider === 'railway' ? 520 : 300,
            render: (_: unknown, deployment: ServiceDeploymentSummary) => renderServiceDeploymentActions(deployment)
          }
        ]
      : [])
  ]
  const envColumns: ColumnsType<ServiceEnvVarRecord> = [
    {
      title: 'Key',
      key: 'key',
      width: 260,
      render: (_, envVar) => (
        <div className="service-env-key-cell">
          <TableText value={envVar.key} />
          <Tooltip title="复制 Key">
            <Button
              aria-label={`复制 ${envVar.key} Key`}
              size="small"
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyText(envVar.key, `${envVar.key} Key 已复制`)}
            />
          </Tooltip>
        </div>
      )
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120, render: (type) => <Tag>{type}</Tag> },
    {
      title: '环境',
      key: 'target',
      width: 160,
      render: (_, envVar) => (envVar.target.length ? envVar.target.join(', ') : envVar.customEnvironmentIds.join(', ') || '-')
    },
    { title: '分支', key: 'gitBranch', width: 130, render: (_, envVar) => envVar.gitBranch || '-' },
    {
      title: '值',
      key: 'value',
      width: 340,
      render: (_, envVar) => {
        const hasRevealedValue = hasRevealedEnvValue(envVar)
        const knownValue = getEnvVarKnownValue(envVar)
        const canCopyValue = knownValue !== undefined || Boolean(serviceCapabilities?.canManageEnvVars)
        const shouldShowValue = hasRevealedValue || (envVar.decrypted && knownValue !== undefined)
        const displayValue = shouldShowValue ? knownValue || '(空值)' : canCopyValue ? '••••••••' : '未返回'

        return (
          <div className="service-env-value-cell">
            <Typography.Text
              className={shouldShowValue ? 'service-env-value revealed' : 'service-env-value'}
              code={shouldShowValue}
              type={shouldShowValue ? undefined : 'secondary'}
              ellipsis={{ tooltip: displayValue }}
            >
              {displayValue}
            </Typography.Text>
            <Tooltip title="复制值">
              <Button
                aria-label={`复制 ${envVar.key} 值`}
                size="small"
                type="text"
                icon={<CopyOutlined />}
                disabled={!canCopyValue}
                loading={copyingEnvVarId === envVar.id}
                onClick={() => copyEnvVarValue(envVar)}
              />
            </Tooltip>
          </div>
        )
      }
    },
    { title: '更新时间', key: 'updatedAt', width: 170, render: (_, envVar) => formatDateTime(envVar.updatedAt) },
    ...(serviceCapabilities?.canManageEnvVars
      ? [
          {
            title: '操作',
            key: 'actions',
            width: 230,
            render: (_: unknown, envVar: ServiceEnvVarRecord) => (
              <Space wrap size={6}>
                <Button size="small" loading={workingEnvVarId === envVar.id} onClick={() => revealEnvVar(envVar)}>
                  查看值
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEnvModal(envVar)}>
                  编辑
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeleteEnvVar(envVar)}>
                  删除
                </Button>
              </Space>
            )
          }
        ]
      : [])
  ]
  const domainColumns: ColumnsType<ProjectServiceDomain> = [
    {
      title: '域名',
      key: 'domain',
      render: (_, domain) => (
        <Space direction="vertical" size={2}>
          <TableText value={domain.domain} />
          <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: domain.url }}>
            {domain.url}
          </Typography.Text>
        </Space>
      )
    },
    { title: '环境', key: 'environmentName', width: 120, render: (_, domain) => domain.environmentName || '-' },
    { title: '来源', key: 'kind', width: 100, render: (_, domain) => <Tag>{domain.kind}</Tag> },
    {
      title: '状态',
      key: 'status',
      width: 130,
      render: (_, domain) => {
        const meta = getServiceMonitorStatusMeta(domain.lastStatus)
        return <Badge status={meta.badgeStatus} text={meta.label} />
      }
    },
    { title: 'HTTP', key: 'statusCode', width: 90, render: (_, domain) => domain.lastStatusCode || '-' },
    { title: '响应时间', key: 'responseMs', width: 110, render: (_, domain) => (domain.lastResponseMs ? `${domain.lastResponseMs} ms` : '-') },
    { title: '最后检查', key: 'lastCheckedAt', width: 180, render: (_, domain) => formatDateTime(domain.lastCheckedAt) },
    {
      title: '错误',
      key: 'lastError',
      width: 180,
      render: (_, domain) =>
        domain.lastError ? (
          <Typography.Text type="danger" className="table-text" ellipsis={{ tooltip: domain.lastError }}>
            {domain.lastError}
          </Typography.Text>
        ) : (
          '-'
        )
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, domain) =>
        serviceCapabilities?.canManageDomains ? (
          <Space wrap size={6}>
            <Button size="small" loading={workingDomain === domain.domain} onClick={() => verifyDomain(domain)}>
              验证
            </Button>
            <Button size="small" loading={workingDomain === domain.domain} onClick={() => inspectDomainConfig(domain)}>
              DNS
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} loading={workingDomain === domain.domain} onClick={() => confirmRemoveDomain(domain)}>
              移除
            </Button>
          </Space>
        ) : (
          '-'
        )
    }
  ]

  return (
    <Drawer
      title={activeService ? `${activeService.name} 详情` : '服务详情'}
      open={open}
      width={980}
      onClose={onClose}
      extra={activeService ? (
        <Button icon={<EditOutlined />} onClick={() => onEdit(activeService)}>
          编辑
        </Button>
      ) : null}
    >
      {activeService && summary ? (
        <Space direction="vertical" size={16} className="service-detail-drawer">
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><div className="metric-tile"><Statistic title="环境" value={summary.environmentCount} /></div></Col>
            <Col xs={12} md={6}><div className="metric-tile"><Statistic title="可监控域名" value={summary.monitorableDomainCount} /></div></Col>
            <Col xs={12} md={6}><div className="metric-tile"><Statistic title="在线" value={summary.online} /></div></Col>
            <Col xs={12} md={6}><div className="metric-tile"><Statistic title="异常 / 离线" value={`${summary.degraded} / ${summary.offline}`} /></div></Col>
          </Row>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="平台">{getServiceProviderLabel(activeService.provider)}</Descriptions.Item>
            <Descriptions.Item label="状态">{activeService.enabled ? '启用' : '停用'}</Descriptions.Item>
            <Descriptions.Item label="平台项目 ID">{activeService.externalProjectId || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台服务 ID">{activeService.externalServiceId || '-'}</Descriptions.Item>
            <Descriptions.Item label="默认环境">{activeService.defaultEnvironment || '-'}</Descriptions.Item>
            <Descriptions.Item label="Health Path">{activeService.healthPath || '/'}</Descriptions.Item>
            <Descriptions.Item label="上次同步">{formatDateTime(activeService.lastSyncedAt)}</Descriptions.Item>
            <Descriptions.Item label="生成域名">
              {summary.generatedDomainCount > 0 ? `${summary.generatedDomainCount} 个${activeService.provider === 'railway' ? '可监控' : '已隐藏'}` : '-'}
            </Descriptions.Item>
          </Descriptions>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key)

              if (key === 'env' && envVars.length === 0) {
                void loadEnvVars()
              }
            }}
            items={[
              {
                key: 'environments',
                label: '环境部署',
                children: (
                  <Space direction="vertical" size={12} className="service-detail-tab">
                    <Table
                      rowKey="id"
                      size="small"
                      columns={environmentColumns}
                      dataSource={activeService.environments}
                      pagination={false}
                      scroll={{ x: 920 }}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无环境数据" /> }}
                    />
                    {serviceCapabilities?.canListDeployments ? (
                      <div className="service-detail-log-panel">
                        <div className="service-detail-toolbar">
                          <Typography.Title level={5}>部署历史</Typography.Title>
                          <Button icon={<ReloadOutlined />} loading={deploymentsLoading} onClick={loadDeployments}>
                            刷新历史
                          </Button>
                        </div>
                        {deploymentsError ? <Alert type="warning" showIcon message="部署历史暂不可用" description={deploymentsError} /> : null}
                        <Table
                          rowKey="id"
                          size="small"
                          columns={deploymentColumns}
                          dataSource={deployments}
                          loading={deploymentsLoading}
                          pagination={{ pageSize: 5 }}
                          scroll={{ x: 1040 }}
                          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无部署历史" /> }}
                        />
                      </div>
                    ) : null}
                    {logEnvironment ? (
                      <div className="service-detail-log-panel">
                        <Typography.Title level={5}>{logEnvironment.name} {logMode === 'runtime' ? '运行日志' : '构建日志'}</Typography.Title>
                        <Spin spinning={logLoading}>
                          {logError ? <Alert type="warning" showIcon message="日志暂不可用" description={logError} /> : null}
                          {!logError && logLines.length === 0 && !logLoading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" /> : null}
                          <Space direction="vertical" size={8} className="service-log-lines">
                            {logLines.map((line, index) => (
                              <div key={`${line.timestamp}-${index}`} className="service-log-line">
                                <Typography.Text type="secondary">{formatDateTime(line.timestamp)}</Typography.Text>
                                <Tag>{line.level || 'log'}</Tag>
                                <Typography.Text>{line.message || '-'}</Typography.Text>
                              </div>
                            ))}
                          </Space>
                        </Spin>
                      </div>
                    ) : null}
                  </Space>
                )
              },
              {
                key: 'env',
                label: '环境变量',
                children: serviceCapabilities?.canReadEnvVars ? (
                  <Space direction="vertical" size={12} className="service-detail-tab">
                    <div className="service-detail-toolbar">
                      <Typography.Title level={5}>环境变量</Typography.Title>
                      <Space>
                        <Button icon={<ReloadOutlined />} loading={envVarsLoading} onClick={loadEnvVars}>
                          刷新
                        </Button>
                        <Button icon={<CopyOutlined />} loading={copyingAllEnvVars} disabled={envVars.length === 0} onClick={copyAllEnvVars}>
                          复制全部
                        </Button>
                        {serviceCapabilities.canManageEnvVars ? (
                          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEnvModal()}>
                            新增变量
                          </Button>
                        ) : null}
                      </Space>
                    </div>
                    {!serviceCapabilities.canManageEnvVars ? <Alert type="info" showIcon message="Railway 环境变量为只读列表" /> : null}
                    {envVarsError ? <Alert type="warning" showIcon message="环境变量暂不可用" description={envVarsError} /> : null}
                    <Table
                      rowKey="id"
                      size="small"
                      columns={envColumns}
                      dataSource={visibleEnvVars}
                      loading={envVarsLoading}
                      pagination={false}
                      scroll={{ x: 1350, y: 520 }}
                      onScroll={handleEnvVarsTableScroll}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无环境变量" /> }}
                    />
                  </Space>
                ) : (
                  <Alert type="info" showIcon message="当前平台暂不支持环境变量读取" />
                )
              },
              {
                key: 'domains',
                label: '域名监控',
                children: (
                  <Space direction="vertical" size={12} className="service-detail-tab">
                    {serviceCapabilities?.canManageDomains ? (
                      <div className="service-detail-toolbar">
                        <Typography.Title level={5}>项目域名</Typography.Title>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openDomainModal}>
                          新增域名
                        </Button>
                      </div>
                    ) : null}
                    <Table
                      rowKey="id"
                      size="small"
                      columns={domainColumns}
                      dataSource={monitorableDomains}
                      pagination={false}
                      scroll={{ x: 1120 }}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无自定义域名" /> }}
                    />
                  </Space>
                )
              }
            ]}
          />
          <Modal
            title={editingEnvVar ? `编辑变量：${editingEnvVar.key}` : '新增环境变量'}
            open={envModalOpen}
            okText="保存"
            cancelText="取消"
            confirmLoading={savingEnvVar}
            onOk={saveEnvVar}
            onCancel={() => {
              setEnvModalOpen(false)
              setEditingEnvVar(null)
              envForm.resetFields()
            }}
          >
            <Form form={envForm} layout="vertical">
              <Form.Item name="key" label="Key" rules={[{ required: true, message: '请输入 Key' }]}>
                <Input placeholder="API_TOKEN" />
              </Form.Item>
              <Form.Item
                name="value"
                label={editingEnvVar ? 'Value（留空不修改）' : 'Value'}
                rules={editingEnvVar ? [] : [{ required: true, message: '请输入 Value' }]}
              >
                <Input.Password placeholder={editingEnvVar ? '留空保持原值' : '变量值'} />
              </Form.Item>
              <Row gutter={[12, 0]}>
                <Col span={12}>
                  <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                    <Select
                      options={[
                        { label: 'sensitive', value: 'sensitive' },
                        { label: 'encrypted', value: 'encrypted' },
                        { label: 'plain', value: 'plain' }
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="target" label="环境" rules={[{ required: true, message: '请选择环境' }]}>
                    <Select
                      mode="multiple"
                      options={[
                        { label: 'production', value: 'production' },
                        { label: 'preview', value: 'preview' },
                        { label: 'development', value: 'development' }
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="gitBranch" label="Git Branch">
                <Input placeholder="preview 分支可填" />
              </Form.Item>
              <Form.Item name="comment" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </Modal>
          <Modal
            title="新增 Vercel 域名"
            open={domainModalOpen}
            okText="添加"
            cancelText="取消"
            confirmLoading={savingDomain}
            onOk={saveDomain}
            onCancel={() => {
              setDomainModalOpen(false)
              domainForm.resetFields()
            }}
          >
            <Form form={domainForm} layout="vertical">
              <Form.Item name="name" label="域名" rules={[{ required: true, message: '请输入域名' }]}>
                <Input placeholder="app.example.com" />
              </Form.Item>
              <Form.Item name="environmentName" label="绑定环境">
                <Select
                  allowClear
                  options={activeService.environments.map((environment) => ({ label: environment.name, value: environment.name }))}
                />
              </Form.Item>
              <Form.Item name="gitBranch" label="Git Branch">
                <Input placeholder="可选" />
              </Form.Item>
              <Row gutter={[12, 0]}>
                <Col span={14}>
                  <Form.Item name="redirect" label="跳转目标">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="redirectStatusCode" label="状态码">
                    <Select
                      allowClear
                      options={[
                        { label: '301', value: 301 },
                        { label: '302', value: 302 },
                        { label: '307', value: 307 },
                        { label: '308', value: 308 }
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>
          <Modal
            title={domainConfig ? `${domainConfig.domain} DNS 配置` : 'DNS 配置'}
            open={Boolean(domainConfig)}
            footer={<Button onClick={() => setDomainConfig(null)}>关闭</Button>}
            onCancel={() => setDomainConfig(null)}
          >
            {domainConfig ? (
              <Space direction="vertical" size={12} className="full-width-control">
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Configured">{domainConfig.config.configured ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="Misconfigured">{domainConfig.config.misconfigured ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="Recommended Records">{domainConfig.config.recommendedRecords.length}</Descriptions.Item>
                </Descriptions>
                <pre className="service-domain-config-json">{JSON.stringify(domainConfig.config.raw, null, 2)}</pre>
              </Space>
            ) : null}
          </Modal>
        </Space>
      ) : null}
    </Drawer>
  )
}

type ServiceCenterView = 'deployments' | 'services'

function GlobalServiceCenterPanel({
  onBack,
  onSystemLog,
  onDeploymentRefreshActiveChange,
  onOpenSystemLog
}: {
  onBack?: () => void
  onSystemLog?: SystemLogHandler
  onDeploymentRefreshActiveChange?: (active: boolean) => void
  onOpenSystemLog?: () => void
}): JSX.Element {
  const [centerView, setCenterView] = useState<ServiceCenterView>(onBack ? 'services' : 'deployments')
  const [services, setServices] = useState<ProjectService[]>([])
  const [deploymentsByServiceId, setDeploymentsByServiceId] = useState<Record<string, ServiceDeploymentSummary[]>>({})
  const [deploymentFilters, setDeploymentFilters] = useState<DeploymentDashboardFilters>({})
  const [deploymentsLoading, setDeploymentsLoading] = useState(false)
  const [deploymentIssueSummary, setDeploymentIssueSummary] = useState<DeploymentIssueSummary | null>(null)
  const [lastDeploymentRefreshAt, setLastDeploymentRefreshAt] = useState('')
  const [autoRefreshDeployments, setAutoRefreshDeployments] = useState(defaultDeploymentAutoRefreshEnabled)
  const [deploymentDatePickerKey, setDeploymentDatePickerKey] = useState(0)
  const [visibleDeploymentCount, setVisibleDeploymentCount] = useState(initialDeploymentVisibleCount)
  const deploymentRefreshInFlightRef = useRef(false)
  const deploymentRefreshCursorRef = useRef<DeploymentRefreshCursor>({})
  const deploymentProviderBackoffUntilRef = useRef<Partial<Record<ServiceProviderType, number>>>({})
  const deploymentRows = useMemo(() => createDeploymentRows(services, deploymentsByServiceId), [deploymentsByServiceId, services])
  const filteredDeploymentRows = useMemo(() => filterDeploymentRows(deploymentRows, deploymentFilters), [deploymentFilters, deploymentRows])
  const visibleDeploymentRows = useMemo(
    () => getVisibleDeploymentRows(filteredDeploymentRows, visibleDeploymentCount),
    [filteredDeploymentRows, visibleDeploymentCount]
  )
  const deploymentFilterOptions = useMemo(() => createDeploymentFilterOptions(deploymentRows), [deploymentRows])
  const deploymentSummary = useMemo(() => createDeploymentStatusSummary(deploymentRows), [deploymentRows])
  const selectedStatusSummary = useMemo(() => createDeploymentStatusSummary(filteredDeploymentRows), [filteredDeploymentRows])
  const hiddenDeploymentRowCount = Math.max(0, selectedStatusSummary.total - visibleDeploymentRows.length)
  const hasDeploymentFilters = Boolean(
    deploymentFilters.query?.trim() ||
      deploymentFilters.dateRange ||
      deploymentFilters.authors?.length ||
      deploymentFilters.environments?.length ||
      deploymentFilters.repositories?.length ||
      deploymentFilters.branches?.length ||
      deploymentFilters.statuses?.length
  )

  function updateDeploymentFilters(patch: DeploymentDashboardFilters): void {
    setVisibleDeploymentCount(initialDeploymentVisibleCount)
    setDeploymentFilters((current) => ({ ...current, ...patch }))
  }

  function writeDeploymentSystemLog(entry: Omit<SystemLogInput, 'source'>): void {
    onSystemLog?.({
      source: '服务中心',
      ...entry
    })
  }

  async function loadDeploymentCenter(options: { silent?: boolean } = {}): Promise<void> {
    if (!window.forgeDesk || deploymentRefreshInFlightRef.current) {
      return
    }

    deploymentRefreshInFlightRef.current = true
    onDeploymentRefreshActiveChange?.(true)

    if (!options.silent) {
      setDeploymentsLoading(true)
      writeDeploymentSystemLog({
        level: 'info',
        title: '开始刷新部署',
        message: '正在读取服务列表、缓存和平台部署历史。'
      })
    }

    try {
      const nextServices = await window.forgeDesk.listAllProjectServices()
      const deployableServices = nextServices.filter((service) => getServiceProviderCapabilities(service.provider).canListDeployments)
      const refreshErrors: DeploymentRefreshError[] = []
      const providerServiceCounts = deployableServices.reduce<Partial<Record<ServiceProviderType, number>>>((counts, service) => {
        counts[service.provider] = (counts[service.provider] ?? 0) + 1
        return counts
      }, {})
      const cachedEntries = await Promise.all(
        deployableServices.map(async (service) => {
          try {
            return [service.id, await window.forgeDesk.listCachedServiceDeployments(service.id, { limit: 20 })] as const
          } catch {
            return [service.id, []] as const
          }
        })
      )
      const cachedDeploymentsByServiceId = Object.fromEntries(cachedEntries)

      if (!options.silent && cachedEntries.some(([, deployments]) => deployments.length > 0)) {
        setServices(nextServices)
        setDeploymentsByServiceId(cachedDeploymentsByServiceId)
        writeDeploymentSystemLog({
          level: 'info',
          title: '已加载部署缓存',
          message: `${cachedEntries.filter(([, deployments]) => deployments.length > 0).length} 个服务先使用本地缓存展示。`
        })
      }

      const now = Date.now()
      const skippedBackoffProviders = new Set<ServiceProviderType>()
      const refreshableServices = deployableServices.filter((service) => {
        const backoffUntil = deploymentProviderBackoffUntilRef.current[service.provider] ?? 0

        if (backoffUntil > now) {
          skippedBackoffProviders.add(service.provider)
          return false
        }

        return true
      })
      const refreshPlan = selectDeploymentRefreshServices(refreshableServices, deploymentRefreshCursorRef.current, {
        railway: railwayDeploymentRefreshBatchSize
      })
      const nextDeploymentsByServiceId = { ...cachedDeploymentsByServiceId }
      const providerBackedOffThisRun = new Set<ServiceProviderType>()

      deploymentRefreshCursorRef.current = {
        ...deploymentRefreshCursorRef.current,
        ...refreshPlan.nextCursorByProvider
      }

      for (const provider of skippedBackoffProviders) {
        const backoffUntil = deploymentProviderBackoffUntilRef.current[provider] ?? 0
        const retrySeconds = Math.max(1, Math.ceil((backoffUntil - now) / 1000))

        refreshErrors.push({
          provider,
          serviceName: provider,
          message: `Rate limit exceeded, please try again in ${retrySeconds} seconds.`
        })
      }

      for (const service of refreshPlan.services) {
        if (providerBackedOffThisRun.has(service.provider)) {
          continue
        }

        try {
          nextDeploymentsByServiceId[service.id] = await window.forgeDesk.listServiceDeployments(service.id, { limit: 20 })
        } catch (error) {
          const errorMessage = getErrorMessage(error)

          refreshErrors.push({ provider: service.provider, serviceName: service.name, message: errorMessage })

          if (isDeploymentRateLimitMessage(errorMessage)) {
            const retryMs = getDeploymentRateLimitRetryMs(errorMessage) || deploymentRateLimitFallbackMs

            deploymentProviderBackoffUntilRef.current = {
              ...deploymentProviderBackoffUntilRef.current,
              [service.provider]: Date.now() + retryMs
            }
            providerBackedOffThisRun.add(service.provider)
          }
        }
      }

      setServices(nextServices)
      setDeploymentsByServiceId(nextDeploymentsByServiceId)
      const issueSummary = createDeploymentIssueSummary(refreshErrors, providerServiceCounts)

      setDeploymentIssueSummary(issueSummary.issueCount > 0 ? issueSummary : null)

      if (issueSummary.issueCount > 0) {
        writeDeploymentSystemLog({
          level: issueSummary.level,
          title: issueSummary.title,
          message: issueSummary.detail,
          meta: {
            compactMessage: issueSummary.message,
            issueCount: issueSummary.issueCount
          }
        })
      } else if (!options.silent) {
        writeDeploymentSystemLog({
          level: 'success',
          title: '部署中心已刷新',
          message: `已刷新 ${refreshPlan.services.length} 个服务，当前展示 ${Object.values(nextDeploymentsByServiceId).flat().length} 条部署记录。`
        })
      }

      setLastDeploymentRefreshAt(new Date().toISOString())
    } catch (error) {
      const errorMessage = getErrorMessage(error)

      setDeploymentIssueSummary({
        issueCount: 1,
        level: 'error',
        title: '部署中心刷新失败',
        message: errorMessage,
        detail: errorMessage
      })
      writeDeploymentSystemLog({
        level: 'error',
        title: '部署中心刷新失败',
        message: errorMessage
      })
    } finally {
      deploymentRefreshInFlightRef.current = false
      onDeploymentRefreshActiveChange?.(false)

      if (!options.silent) {
        setDeploymentsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (centerView === 'deployments') {
      loadDeploymentCenter().catch((error) => message.error(getErrorMessage(error)))
    }
  }, [centerView])

  useEffect(() => {
    if (centerView !== 'deployments' || !autoRefreshDeployments) {
      return
    }

    const timer = window.setInterval(() => {
      loadDeploymentCenter({ silent: true }).catch((error) => message.error(getErrorMessage(error)))
    }, deploymentAutoRefreshIntervalMs)

    return () => window.clearInterval(timer)
  }, [autoRefreshDeployments, centerView])

  useEffect(() => {
    setVisibleDeploymentCount(initialDeploymentVisibleCount)
  }, [deploymentFilters])

  function clearDeploymentFilters(): void {
    setVisibleDeploymentCount(initialDeploymentVisibleCount)
    setDeploymentFilters({})
    setDeploymentDatePickerKey((current) => current + 1)
  }

  function getDeploymentUrl(row: DeploymentDashboardRow): string {
    if (!row.deploymentUrl) {
      return ''
    }

    return /^https?:\/\//i.test(row.deploymentUrl) ? row.deploymentUrl : `https://${row.deploymentUrl}`
  }

  function runDeploymentAction(row: DeploymentDashboardRow, action: ServiceDeploymentAction): void {
    if (!window.forgeDesk) {
      return
    }

    const actionLabel = serviceDeploymentActionLabels[action]
    const dangerous = isDangerousDeploymentAction(action)

    Modal.confirm({
      title: `${actionLabel} ${row.deploymentId}？`,
      content: getDeploymentActionConfirmContent(row.provider, action),
      okText: actionLabel,
      cancelText: '取消',
      okButtonProps: { danger: dangerous },
      onOk: async () => {
        try {
          await window.forgeDesk.runServiceDeploymentAction(row.serviceId, {
            action,
            deploymentId: row.deploymentId,
            description: action === 'rollback' ? `Rollback from ForgeDesk to ${row.deploymentId}` : undefined
          })
          await loadDeploymentCenter()
          writeDeploymentSystemLog({
            level: 'success',
            title: '部署操作已提交',
            message: `${actionLabel} ${row.serviceName} / ${row.deploymentId}`
          })
          message.success(`${actionLabel}已提交`)
        } catch (error) {
          const errorMessage = getErrorMessage(error)

          writeDeploymentSystemLog({
            level: 'error',
            title: '部署操作失败',
            message: `${actionLabel} ${row.serviceName} / ${row.deploymentId}：${errorMessage}`
          })
          message.error(errorMessage)
        }
      }
    })
  }

  function renderDeploymentActionButtons(row: DeploymentDashboardRow): JSX.Element | null {
    if (row.provider !== 'vercel' && row.provider !== 'railway') {
      return null
    }

    const actions: Array<{ action: ServiceDeploymentAction; icon: JSX.Element; danger?: boolean; tooltip: string }> =
      row.provider === 'railway'
        ? [
            { action: 'redeploy', icon: <ReloadOutlined />, tooltip: 'Redeploy' },
            { action: 'restart', icon: <ThunderboltOutlined />, tooltip: 'Restart deployment' },
            { action: 'rollback', icon: <ArrowLeftOutlined />, danger: true, tooltip: 'Rollback to this deployment' },
            { action: 'stop', icon: <CloseCircleOutlined />, danger: true, tooltip: 'Stop running deployment' },
            { action: 'cancel', icon: <CloseCircleOutlined />, danger: true, tooltip: 'Cancel queued or building deployment' }
          ]
        : [
            { action: 'redeploy', icon: <ReloadOutlined />, tooltip: 'Redeploy' },
            { action: 'promote', icon: <UploadOutlined />, tooltip: 'Promote to production' },
            { action: 'rollback', icon: <ArrowLeftOutlined />, tooltip: 'Rollback to this deployment' },
            { action: 'cancel', icon: <CloseCircleOutlined />, danger: true, tooltip: 'Cancel deployment' }
          ]

    return (
      <Space size={2} className="deployment-row-actions">
        {actions.map(({ action, icon, danger, tooltip }) => {
          const enabled = canRunServiceDeploymentAction(row.provider, row.sourceDeployment, action)

          return (
            <Tooltip key={action} title={enabled ? tooltip : `${serviceDeploymentActionLabels[action]} 当前不可用`}>
              <Button
                type="text"
                size="small"
                danger={danger}
                disabled={!enabled}
                aria-label={`${serviceDeploymentActionLabels[action]} ${row.deploymentId}`}
                icon={icon}
                onClick={(event) => {
                  event.stopPropagation()
                  runDeploymentAction(row, action)
                }}
              />
            </Tooltip>
          )
        })}
      </Space>
    )
  }

  function renderDeploymentRow(row: DeploymentDashboardRow): JSX.Element {
    const deploymentUrl = getDeploymentUrl(row)

    return (
      <div key={row.key} className="deployment-row">
        <div className="deployment-row-message">
          <Typography.Text strong ellipsis={{ tooltip: row.commitMessage }}>
            {row.commitMessage}
          </Typography.Text>
          <Space size={8} wrap className="deployment-row-submeta">
            <Typography.Text type="secondary">{row.deploymentId}</Typography.Text>
            {deploymentUrl ? (
              <Button type="link" className="deployment-url-button" href={deploymentUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                {row.deploymentUrl}
              </Button>
            ) : null}
          </Space>
        </div>
        <div className="deployment-row-status">
          <Badge status={row.statusMeta.badgeStatus} />
          <Typography.Text>{row.statusMeta.label}</Typography.Text>
          {row.readyDurationLabel ? <Typography.Text type="secondary">{row.readyDurationLabel}</Typography.Text> : null}
        </div>
        <Tag className="deployment-environment-tag" color={row.environmentName === 'production' ? 'blue' : 'default'}>
          {row.environmentName}
        </Tag>
        <div className="deployment-row-project">
          <Typography.Text strong ellipsis={{ tooltip: row.projectName }}>
            {row.projectName}
          </Typography.Text>
          <span className="deployment-project-tag" style={getDeploymentProjectTagStyle(row.repositoryName)} title={row.repositoryName}>
            {row.repositoryName || '-'}
          </span>
        </div>
        <div className="deployment-row-git">
          <Typography.Text code>{row.shortCommit || '-'}</Typography.Text>
          <Typography.Text type="secondary">{row.branchName || '-'}</Typography.Text>
        </div>
        <Typography.Text className="deployment-row-time" type="secondary" title={formatDateTime(row.createdAt)}>
          {formatRelativeTime(row.createdAt)}
        </Typography.Text>
        <div className="deployment-row-author">
          <Avatar size={24}>{getAvatarLabel(row.authorName || row.creator)}</Avatar>
          <Typography.Text type="secondary" ellipsis={{ tooltip: row.authorName || row.creator || 'Unknown' }}>
            {row.authorName || row.creator || 'Unknown'}
          </Typography.Text>
        </div>
        {renderDeploymentActionButtons(row)}
      </div>
    )
  }

  const selectFilterOptions = {
    authors: deploymentFilterOptions.authors.map((value) => ({ label: value, value })),
    environments: deploymentFilterOptions.environments.map((value) => ({ label: value, value })),
    repositories: deploymentFilterOptions.repositories.map((value) => ({ label: value, value })),
    branches: deploymentFilterOptions.branches.map((value) => ({ label: value, value })),
    statuses: deploymentFilterOptions.statuses.map((value) => ({ label: value, value }))
  }

  return (
    <div className="panel settings-module-panel">
      <div className="settings-module-header">
        <Space direction="vertical" size={2}>
          <Typography.Title level={3}>服务中心</Typography.Title>
          <Typography.Text type="secondary">实时查看部署状态，维护 Vercel / Railway Token、同步服务和自定义域名。</Typography.Text>
        </Space>
        <Space wrap>
          <Segmented
            value={centerView}
            onChange={(value) => setCenterView(value as ServiceCenterView)}
            options={[
              { label: 'Deployments', value: 'deployments' },
              { label: '服务配置', value: 'services' }
            ]}
          />
          {onBack ? <Button onClick={onBack}>返回总览</Button> : null}
        </Space>
      </div>
      {centerView === 'deployments' ? (
        <Space direction="vertical" size={14} className="deployment-center">
          <div className="deployment-center-toolbar">
            <Space size={10} wrap>
              <Tag color="green">Ready {deploymentSummary.ready}</Tag>
              <Tag color="blue">Building {deploymentSummary.building}</Tag>
              <Tag color="red">Error {deploymentSummary.error}</Tag>
              <Typography.Text type="secondary">
                Showing {visibleDeploymentRows.length} / {deploymentSummary.total}
              </Typography.Text>
            </Space>
            <Space wrap>
              <Space size={6}>
                <Typography.Text type="secondary">实时刷新</Typography.Text>
                <Switch size="small" checked={autoRefreshDeployments} onChange={setAutoRefreshDeployments} />
              </Space>
              <Typography.Text type="secondary">上次刷新：{formatDateTime(lastDeploymentRefreshAt)}</Typography.Text>
              <Button icon={<ReloadOutlined />} loading={deploymentsLoading} onClick={() => loadDeploymentCenter()}>
                刷新
              </Button>
            </Space>
          </div>
          <div className="deployment-filter-bar">
            <DatePicker.RangePicker
              key={deploymentDatePickerKey}
              className="deployment-date-range"
              placeholder={['开始日期', '结束日期']}
              onChange={(_, dateStrings) =>
                updateDeploymentFilters({
                  dateRange: dateStrings[0] && dateStrings[1] ? [`${dateStrings[0]}T00:00:00.000Z`, `${dateStrings[1]}T23:59:59.999Z`] : null
                })
              }
            />
            <Input
              allowClear
              className="deployment-search"
              prefix={<SearchOutlined />}
              placeholder="Search deployments..."
              value={deploymentFilters.query}
              onChange={(event) => updateDeploymentFilters({ query: event.target.value })}
            />
            <Select
              mode="multiple"
              maxTagCount={1}
              maxTagTextLength={18}
              className="deployment-filter-select"
              placeholder="All Authors..."
              options={selectFilterOptions.authors}
              value={deploymentFilters.authors ?? []}
              onChange={(authors) => updateDeploymentFilters({ authors })}
            />
            <Select
              mode="multiple"
              maxTagCount={1}
              maxTagTextLength={18}
              className="deployment-filter-select"
              placeholder="All Environments"
              options={selectFilterOptions.environments}
              value={deploymentFilters.environments ?? []}
              onChange={(environments) => updateDeploymentFilters({ environments })}
            />
            <Select
              mode="multiple"
              maxTagCount={1}
              maxTagTextLength={18}
              className="deployment-filter-select"
              placeholder="All Repositories"
              options={selectFilterOptions.repositories}
              value={deploymentFilters.repositories ?? []}
              onChange={(repositories) => updateDeploymentFilters({ repositories })}
            />
            <Select
              mode="multiple"
              maxTagCount={1}
              maxTagTextLength={18}
              className="deployment-filter-select"
              placeholder="All Branches..."
              options={selectFilterOptions.branches}
              value={deploymentFilters.branches ?? []}
              onChange={(branches) => updateDeploymentFilters({ branches })}
            />
            <Select
              mode="multiple"
              maxTagCount={1}
              maxTagTextLength={18}
              className="deployment-status-filter"
              placeholder={`Status ${deploymentSummary.ready}/${deploymentSummary.total}`}
              options={selectFilterOptions.statuses}
              value={deploymentFilters.statuses ?? []}
              onChange={(statuses) => updateDeploymentFilters({ statuses })}
            />
            <Button disabled={!hasDeploymentFilters} onClick={clearDeploymentFilters}>
              重置
            </Button>
          </div>
          {deploymentIssueSummary ? (
            <Alert
              className="deployment-compact-alert"
              type={deploymentIssueSummary.level === 'error' ? 'error' : 'warning'}
              showIcon
              message={
                <Space size={8} wrap>
                  <Typography.Text strong>{deploymentIssueSummary.message}</Typography.Text>
                  <Typography.Text type="secondary">{deploymentIssueSummary.issueCount} 项异常</Typography.Text>
                </Space>
              }
              action={
                onOpenSystemLog ? (
                  <Button size="small" type="text" onClick={onOpenSystemLog}>
                    查看日志
                  </Button>
                ) : null
              }
            />
          ) : null}
          <Spin spinning={deploymentsLoading && deploymentRows.length === 0}>
            <div className="deployment-list">
              {filteredDeploymentRows.length > 0 ? (
                <>
                  {visibleDeploymentRows.map((row) => renderDeploymentRow(row))}
                  {hiddenDeploymentRowCount > 0 ? (
                    <div className="deployment-list-footer">
                      <Button onClick={() => setVisibleDeploymentCount((current) => getNextDeploymentVisibleCount(current, selectedStatusSummary.total))}>
                        Load More ({hiddenDeploymentRowCount})
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={deploymentsLoading ? '正在加载部署' : '暂无部署记录'} />
              )}
            </div>
          </Spin>
        </Space>
      ) : (
        <ProjectServiceSettings />
      )}
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

function createReleaseTagOptions(recommendation: RepositoryReleaseTagRecommendation | null): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  const seen = new Set<string>()
  const suggestedTagName = recommendation?.suggestedTagName

  if (suggestedTagName) {
    options.push({ value: suggestedTagName, label: `推荐 ${suggestedTagName}` })
    seen.add(suggestedTagName)
  }

  for (const tag of recommendation?.historicalTags ?? []) {
    if (!seen.has(tag.tagName)) {
      options.push({ value: tag.tagName, label: `历史 ${tag.tagName}` })
      seen.add(tag.tagName)
    }
  }

  return options
}

function filterReleaseTagOption(inputValue: string, option?: { value?: string; label?: string }): boolean {
  const keyword = inputValue.trim().toLowerCase()

  if (!keyword) {
    return true
  }

  return `${option?.value ?? ''} ${option?.label ?? ''}`.toLowerCase().includes(keyword)
}

function getReleaseTagPlaceholder(loading: boolean, recommendation: RepositoryReleaseTagRecommendation | null): string {
  if (loading) {
    return '正在读取历史版本...'
  }

  if (recommendation?.suggestedTagName) {
    return `推荐 ${recommendation.suggestedTagName}，也可手动输入`
  }

  return '可选，例如 v1.2.3'
}

function ReleaseTagPicker({
  value,
  recommendation,
  loading,
  className = '',
  onChange
}: {
  value: string
  recommendation: RepositoryReleaseTagRecommendation | null
  loading: boolean
  className?: string
  onChange: (value: string) => void
}): JSX.Element {
  const options = useMemo(() => createReleaseTagOptions(recommendation), [recommendation])
  const suggestedTagName = recommendation?.suggestedTagName ?? ''
  const historicalTags = recommendation?.historicalTags.slice(0, 5) ?? []

  return (
    <div className={['release-tag-picker', className].filter(Boolean).join(' ')}>
      <AutoComplete
        value={value}
        options={options}
        className="release-tag-picker-control"
        filterOption={filterReleaseTagOption}
        onChange={onChange}
      >
        <Input addonBefore="版本 Tag" placeholder={getReleaseTagPlaceholder(loading, recommendation)} allowClear />
      </AutoComplete>
      <div className="release-tag-suggestions">
        {loading ? <Typography.Text type="secondary">读取历史版本...</Typography.Text> : null}
        {!loading && suggestedTagName ? (
          <Button size="small" type={value === suggestedTagName ? 'primary' : 'default'} onClick={() => onChange(suggestedTagName)}>
            推荐 {suggestedTagName}
          </Button>
        ) : null}
        {!loading
          ? historicalTags.map((tag) => (
              <Button key={tag.tagName} size="small" type={value === tag.tagName ? 'primary' : 'default'} onClick={() => onChange(tag.tagName)}>
                历史 {tag.tagName}
              </Button>
            ))
          : null}
        {!loading && !suggestedTagName && historicalTags.length === 0 ? <Typography.Text type="secondary">暂无历史版本</Typography.Text> : null}
      </div>
    </div>
  )
}

type GitActionModalProps = {
  open: boolean
  repositories: Repository[]
  onClose: () => void
  onChanged: (repository?: Repository) => void | Promise<void>
}

function createBranchOptions(branches: string[]): Array<{ label: string; value: string }> {
  return Array.from(new Set(branches.filter(Boolean))).map((branch) => ({ label: branch, value: branch }))
}

function getPreferredPushTarget(repository: Repository | null, status: GitWorkspaceStatus | null = null): { remote: string; branch: string } {
  const pushableTarget = getPushableTargets(status?.pushTargets ?? repository?.pushTargets ?? [])[0]

  if (pushableTarget) {
    return {
      remote: pushableTarget.remote,
      branch: pushableTarget.branch
    }
  }

  return getRepositoryDefaultPushTarget(repository, status?.branch)
}

function createGitPushInput(remoteNames: string[], branch: string): GitPushInput {
  return remoteNames.length > 1 ? { remotes: remoteNames, branch } : { remote: remoteNames[0], branch }
}

function GitCommitModal({
  open,
  repositories,
  initialRepositoryId,
  onClose,
  onChanged
}: GitActionModalProps & { initialRepositoryId?: string }): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [aiSettingsForm] = Form.useForm<AiSettingsForm>()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const commitModalWasOpenRef = useRef(false)
  const [status, setStatus] = useState<GitWorkspaceStatus | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [commitTag, setCommitTag] = useState('')
  const [tagRecommendation, setTagRecommendation] = useState<RepositoryReleaseTagRecommendation | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null)
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingTagRecommendation, setLoadingTagRecommendation] = useState(false)
  const [loadingAiSettings, setLoadingAiSettings] = useState(false)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [working, setWorking] = useState(false)
  const [generatingCommitMessage, setGeneratingCommitMessage] = useState(false)
  const [releaseModalOpen, setReleaseModalOpen] = useState(false)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
  const files = status?.files ?? []
  const currentBranch = getCurrentBranchName(selectedRepository, status)
  const commitReady = canCommitSelection(files, selectedPaths, commitMessage)

  useEffect(() => {
    const wasOpen = commitModalWasOpenRef.current
    commitModalWasOpenRef.current = open

    if (!open) {
      return
    }

    if (repositories.length === 0) {
      setRepositoryId('')
      setStatus(null)
      setSelectedPaths([])
      setCommitTag('')
      setTagRecommendation(null)
      return
    }

    const preferredRepositoryId = initialRepositoryId && repositories.some((repository) => repository.id === initialRepositoryId) ? initialRepositoryId : ''

    setRepositoryId((current) => {
      if (!wasOpen && preferredRepositoryId) {
        return preferredRepositoryId
      }

      if (repositories.some((repository) => repository.id === current)) {
        return current
      }

      return preferredRepositoryId || repositories[0].id
    })
  }, [initialRepositoryId, open, repositories])

  async function refreshWorkspaceStatus(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setLoadingStatus(true)

    try {
      const nextStatus = await window.forgeDesk.getRepositoryWorkspaceStatus(selectedRepository.id)
      setStatus(nextStatus)
      setSelectedPaths((paths) => paths.filter((path) => nextStatus.files.some((file) => file.path === path)))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingStatus(false)
    }
  }

  async function refreshReleaseTagRecommendation(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      setTagRecommendation(null)
      return
    }

    setLoadingTagRecommendation(true)

    try {
      setTagRecommendation(await window.forgeDesk.recommendRepositoryReleaseTag(selectedRepository.id))
    } catch (error) {
      setTagRecommendation(null)
      message.warning(getErrorMessage(error))
    } finally {
      setLoadingTagRecommendation(false)
    }
  }

  async function refreshCommitAiSettings(): Promise<AiSettingsView | null> {
    if (!window.forgeDesk) {
      setAiSettings(null)
      return null
    }

    setLoadingAiSettings(true)

    try {
      const settings = await window.forgeDesk.getAiSettings()
      setAiSettings(settings)
      populateAiSettingsForm(aiSettingsForm, settings)
      return settings
    } catch (error) {
      message.error(getErrorMessage(error))
      return null
    } finally {
      setLoadingAiSettings(false)
    }
  }

  async function saveCommitAiSettings(): Promise<void> {
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
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: apiKey || undefined,
        model: values.model,
        temperature: Number(values.temperature)
      })
      setAiSettings(settings)
      aiSettingsForm.setFieldValue('apiKey', '')

      if (isAiSettingsReady(settings)) {
        setAiSettingsModalOpen(false)
      }

      message.success('AI 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingAiSettings(false)
    }
  }

  async function fillCommitMessageWithAi(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const settings = await refreshCommitAiSettings()

    if (!isAiSettingsReady(settings)) {
      message.info('请先填写并启用 AI API Key')
      setAiSettingsModalOpen(true)
      return
    }

    if (selectedPaths.length === 0) {
      message.warning('请选择要生成提交信息的文件')
      return
    }

    setGeneratingCommitMessage(true)

    try {
      const suggestion = await window.forgeDesk.suggestCommitMessage(selectedRepository.id, { paths: selectedPaths })
      setCommitMessage(suggestion.message)
      message.success('已填写提交信息')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error(errorMessage)

      if (isAiCredentialErrorMessage(errorMessage)) {
        setAiSettingsModalOpen(true)
      }
    } finally {
      setGeneratingCommitMessage(false)
    }
  }

  useEffect(() => {
    if (!open || !selectedRepository) {
      return
    }

    setStatus(null)
    setSelectedPaths([])
    setCommitMessage('')
    setTagRecommendation(null)
    refreshWorkspaceStatus()
    refreshReleaseTagRecommendation()
  }, [open, selectedRepository?.id])

  async function stageSelectedFiles(): Promise<GitOperationResult | null> {
    if (!selectedRepository || selectedPaths.length === 0 || !window.forgeDesk) {
      message.warning('请选择要处理的文件')
      return null
    }

    const result = await window.forgeDesk.gitAdd(selectedRepository.id, { mode: 'paths', paths: selectedPaths })
    updateRepository(result.repository)
    setStatus(result.status)

    if (!result.ok) {
      message.warning(result.stderr || result.stdout || '暂存失败，请检查文件状态')
      return result
    }

    return result
  }

  async function stageOnly(): Promise<void> {
    setWorking(true)

    try {
      const result = await stageSelectedFiles()

      if (result?.ok) {
        setSelectedPaths([])
        message.success('已暂存选中文件')
        await onChanged(result.repository)
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  async function commitSelectedFilesAfterConfirm(trimmedMessage: string, trimmedTag: string): Promise<void> {
    setWorking(true)

    try {
      const stageResult = await stageSelectedFiles()

      if (!stageResult?.ok) {
        return
      }

      const result = await window.forgeDesk.gitCommit(selectedRepository.id, { message: trimmedMessage, tagName: trimmedTag || undefined })
      updateRepository(result.repository)
      setStatus(result.status)

      if (!result.ok) {
        message.warning(result.stderr || result.stdout || '提交失败，请检查文件状态')
        return
      }

      message.success(trimmedTag ? `提交已创建，Tag ${trimmedTag} 已设置` : '提交已创建')
      setCommitMessage('')
      setCommitTag('')
      setSelectedPaths([])
      await onChanged(result.repository)
      onClose()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  async function commitSelectedFiles(): Promise<void> {
    if (!selectedRepository || selectedPaths.length === 0 || !window.forgeDesk) {
      message.warning('请选择要提交的文件')
      return
    }

    const trimmedMessage = commitMessage.trim()
    const trimmedTag = commitTag.trim()

    if (!trimmedMessage) {
      message.warning('请输入提交信息')
      return
    }

    const selectedPathSet = new Set(selectedPaths)
    const selectedFiles = files.filter((file) => selectedPathSet.has(file.path))
    const needsAutoStage = selectedFiles.some((file) => file.worktreeStatus.trim() || file.indexStatus === '?')
    const unselectedStagedFiles = files.filter((file) => !selectedPathSet.has(file.path) && file.indexStatus.trim() && file.indexStatus !== '?')

    if (needsAutoStage || unselectedStagedFiles.length > 0) {
      Modal.confirm({
        title: '确认提交选中文件？',
        content: (
          <Space direction="vertical" size={6}>
            {needsAutoStage && <Typography.Text>将先自动暂存当前勾选的 {selectedPaths.length} 个文件，然后创建提交。</Typography.Text>}
            {trimmedTag && <Typography.Text>提交成功后会创建 Tag：{trimmedTag}</Typography.Text>}
            {unselectedStagedFiles.length > 0 && (
              <Typography.Text type="warning">
                另有 {unselectedStagedFiles.length} 个已暂存但未勾选的文件。Git 会把已暂存内容一起提交。
              </Typography.Text>
            )}
          </Space>
        ),
        okText: '确认暂存并提交',
        cancelText: '取消',
        onOk: () => commitSelectedFilesAfterConfirm(trimmedMessage, trimmedTag)
      })
      return
    }

    await commitSelectedFilesAfterConfirm(trimmedMessage, trimmedTag)
  }

  const fileColumns: ColumnsType<GitStatusFile> = [
    {
      title: '状态',
      key: 'status',
      width: 96,
      render: (_, file) => {
        const statusLabel = getWorkspaceFileStatusLabel(file)
        return <Tag color={statusLabel.color}>{statusLabel.label}</Tag>
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

  return (
    <Modal
      title="提交改动"
      open={open}
      width="min(960px, calc(100vw - 48px))"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="refresh" icon={<ReloadOutlined />} loading={loadingStatus} onClick={refreshWorkspaceStatus}>
          刷新改动
        </Button>,
        <Button key="stage" loading={working} disabled={selectedPaths.length === 0} onClick={stageOnly}>
          仅暂存
        </Button>,
        <Button key="release" icon={<UploadOutlined />} disabled={!selectedRepository} onClick={() => setReleaseModalOpen(true)}>
          发布版本
        </Button>,
        <Button key="commit" type="primary" loading={working} disabled={!commitReady} onClick={commitSelectedFiles}>
          提交选中文件
        </Button>
      ]}
    >
      <Space direction="vertical" size={14} className="git-action-modal">
        <Space wrap className="git-action-modal-toolbar">
          <Select
            value={selectedRepository?.id}
            className="git-action-repository-select"
            options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
            onChange={setRepositoryId}
          />
          <Button disabled={files.length === 0} onClick={() => setSelectedPaths(files.map((file) => file.path))}>
            全选
          </Button>
          <Button disabled={selectedPaths.length === 0} onClick={() => setSelectedPaths([])}>
            清空
          </Button>
          <Typography.Text type="secondary">已选择 {selectedPaths.length} 个文件</Typography.Text>
          <Tag color={currentBranch ? 'blue' : 'default'}>当前分支：{currentBranch || '未检测'}</Tag>
        </Space>

        <Input
          value={commitMessage}
          placeholder="提交信息，例如 feat: update workspace"
          suffix={
            <Button
              className="commit-message-ai-button"
              type="text"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={generatingCommitMessage}
              onClick={fillCommitMessageWithAi}
            >
              AI
            </Button>
          }
          onChange={(event) => setCommitMessage(event.target.value)}
        />

        <ReleaseTagPicker
          value={commitTag}
          recommendation={tagRecommendation}
          loading={loadingTagRecommendation}
          onChange={setCommitTag}
        />

        <Table
          rowKey="path"
          size="small"
          loading={loadingStatus}
          columns={fileColumns}
          dataSource={files}
          pagination={false}
          scroll={{ x: 720, y: 360 }}
          rowSelection={{
            selectedRowKeys: selectedPaths,
            onChange: (keys) => setSelectedPaths(keys.map(String))
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有可提交的改动" /> }}
        />
      </Space>
      <Modal
        title="AI 设置"
        open={aiSettingsModalOpen}
        footer={null}
        width="min(760px, calc(100vw - 48px))"
        onCancel={() => setAiSettingsModalOpen(false)}
      >
        <AiSettingsSection
          form={aiSettingsForm}
          settings={aiSettings}
          loading={loadingAiSettings}
          saving={savingAiSettings}
          onRefresh={refreshCommitAiSettings}
          onSave={saveCommitAiSettings}
        />
      </Modal>
      <RepositoryReleaseModal
        open={releaseModalOpen}
        repositories={repositories}
        initialRepositoryId={selectedRepository?.id}
        onClose={() => setReleaseModalOpen(false)}
        onChanged={async (repository) => {
          if (repository) {
            updateRepository(repository)
          }
          await refreshWorkspaceStatus()
          await onChanged(repository)
        }}
      />
    </Modal>
  )
}

type RepositoryReleaseModalProps = GitActionModalProps & {
  initialRepositoryId?: string
}

function createTagNameFromVersion(version: string): string {
  const trimmed = version.trim()
  return /^\d+\.\d+\.\d+$/.test(trimmed) ? `v${trimmed}` : ''
}

function createDefaultNextjsPm2AppName(repositoryName: string): string {
  return repositoryName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'nextjs-app'
}

function getReleaseScriptLabel(scriptName: string): string {
  if (scriptName === 'publish:mac') {
    return '发布到 GitHub Releases'
  }

  if (scriptName === 'package:mac') {
    return '本地打包 macOS 应用'
  }

  if (scriptName === 'build') {
    return '运行项目 build'
  }

  return '未配置'
}

function RepositoryReleaseModal({ open, repositories, initialRepositoryId, onClose, onChanged }: RepositoryReleaseModalProps): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [aiSettingsForm] = Form.useForm<AiSettingsForm>()
  const [repositoryId, setRepositoryId] = useState(initialRepositoryId || repositories[0]?.id || '')
  const [preparation, setPreparation] = useState<RepositoryReleasePreparation | null>(null)
  const [targetVersion, setTargetVersion] = useState('')
  const [tagName, setTagName] = useState('')
  const [releaseTitle, setReleaseTitle] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [releaseCommitMessage, setReleaseCommitMessage] = useState('')
  const [releaseProvider, setReleaseProvider] = useState<ReleasePublishProvider>('github')
  const [githubToken, setGithubToken] = useState('')
  const [githubTokens, setGithubTokens] = useState<GithubTokenView[]>([])
  const [selectedGithubTokenId, setSelectedGithubTokenId] = useState('')
  const [codemagicTokens, setCodemagicTokens] = useState<CodemagicTokenView[]>([])
  const [codemagicTeams, setCodemagicTeams] = useState<CodemagicTeam[]>([])
  const [codemagicApps, setCodemagicApps] = useState<CodemagicApp[]>([])
  const [codemagicBinding, setCodemagicBinding] = useState<CodemagicRepositoryBinding | null>(null)
  const [selectedCodemagicTokenId, setSelectedCodemagicTokenId] = useState('')
  const [selectedCodemagicTeamId, setSelectedCodemagicTeamId] = useState('')
  const [codemagicAppId, setCodemagicAppId] = useState('')
  const [codemagicAppName, setCodemagicAppName] = useState('')
  const [codemagicWorkflowId, setCodemagicWorkflowId] = useState('')
  const [codemagicWorkflowName, setCodemagicWorkflowName] = useState('')
  const [codemagicDefaultBranch, setCodemagicDefaultBranch] = useState('')
  const [codemagicLabelsText, setCodemagicLabelsText] = useState('forgedesk')
  const [saveCodemagicBinding, setSaveCodemagicBinding] = useState(true)
  const [nextjsPm2SshHost, setNextjsPm2SshHost] = useState('')
  const [nextjsPm2RemotePath, setNextjsPm2RemotePath] = useState('')
  const [nextjsPm2UploadPath, setNextjsPm2UploadPath] = useState('/tmp/forgedesk-releases')
  const [nextjsPm2AppName, setNextjsPm2AppName] = useState('')
  const [nextjsPm2Port, setNextjsPm2Port] = useState('3000')
  const [nextjsPm2StartCommand, setNextjsPm2StartCommand] = useState('')
  const [selectedReleaseActions, setSelectedReleaseActions] = useState<ReleasePublishActionKey[]>([])
  const [activePublishTaskId, setActivePublishTaskId] = useState('')
  const [activePublishTask, setActivePublishTask] = useState<RepositoryReleasePublishTask | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null)
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false)
  const [loadingPreparation, setLoadingPreparation] = useState(false)
  const [generatingRelease, setGeneratingRelease] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loadingAiSettings, setLoadingAiSettings] = useState(false)
  const [loadingGithubTokens, setLoadingGithubTokens] = useState(false)
  const [loadingCodemagicTokens, setLoadingCodemagicTokens] = useState(false)
  const [loadingCodemagicTeams, setLoadingCodemagicTeams] = useState(false)
  const [loadingCodemagicApps, setLoadingCodemagicApps] = useState(false)
  const [loadingCodemagicBinding, setLoadingCodemagicBinding] = useState(false)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [cancellingPublishTask, setCancellingPublishTask] = useState(false)
  const handledActivePublishTaskIdsRef = useRef<Set<string>>(new Set())
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
  const selectedGithubToken = githubTokens.find((token) => token.id === selectedGithubTokenId) ?? null
  const selectedCodemagicToken = codemagicTokens.find((token) => token.id === selectedCodemagicTokenId) ?? null
  const codemagicReady = Boolean(selectedCodemagicTokenId && codemagicAppId.trim() && codemagicWorkflowId.trim())
  const nextjsPm2Ready = Boolean(nextjsPm2SshHost.trim() && nextjsPm2RemotePath.trim() && nextjsPm2AppName.trim())
  const releaseView = useMemo(
    () => createReleasePublishViewModel({
      plan: preparation?.plan ?? null,
      githubToken: selectedGithubTokenId || githubToken,
      provider: releaseProvider,
      codemagicReady,
      nextjsPm2Ready,
      selectedActions: selectedReleaseActions
    }),
    [codemagicReady, githubToken, nextjsPm2Ready, preparation, releaseProvider, selectedGithubTokenId, selectedReleaseActions]
  )
  const releasePlatformOptions = useMemo(
    () => createReleasePlatformOptions({ plan: preparation?.plan ?? null, codemagicBound: Boolean(codemagicBinding) }),
    [codemagicBinding, preparation]
  )
  const activePublishTaskView = useMemo(
    () => createReleasePublishTaskView({ task: activePublishTask }),
    [activePublishTask]
  )
  const activePublishTaskRunning = activePublishTask?.status === 'running'
  const githubTokenOptions = useMemo(
    () => githubTokens.map((token) => ({
      label: `${token.name}${token.githubLogin ? ` · @${token.githubLogin}` : ''} · ****${token.tokenLastFour || '----'}`,
      value: token.id
    })),
    [githubTokens]
  )
  const codemagicTokenOptions = useMemo(
    () => codemagicTokens.map((token) => ({
      label: `${token.name}${token.userId ? ` · ${token.userId}` : ''} · ****${token.tokenLastFour || '----'}`,
      value: token.id
    })),
    [codemagicTokens]
  )
  const codemagicTeamOptions = useMemo(
    () => codemagicTeams.map((team) => ({ label: team.name || team.id, value: team.id })),
    [codemagicTeams]
  )
  const codemagicAppOptions = useMemo(
    () => codemagicApps.map((appItem) => ({ label: `${appItem.name}${appItem.archived ? ' · archived' : ''}`, value: appItem.id })),
    [codemagicApps]
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const nextRepositoryId = initialRepositoryId && repositories.some((repository) => repository.id === initialRepositoryId)
      ? initialRepositoryId
      : repositories[0]?.id ?? ''

    setRepositoryId(nextRepositoryId)
  }, [open, initialRepositoryId, repositories])

  function applyReleasePreparation(nextPreparation: RepositoryReleasePreparation, preserveTextFields: boolean): void {
    const nextVersion = nextPreparation.plan.suggestedVersion
    const nextTagName = nextPreparation.plan.suggestedTagName || createTagNameFromVersion(nextVersion)

    setPreparation(nextPreparation)
    setTargetVersion(nextVersion)
    setTagName(nextTagName)
    setSelectedReleaseActions((current) => {
      const availableActionKeys = new Set(nextPreparation.plan.availableActions.map((action) => action.key))
      return current.filter((action) => availableActionKeys.has(action))
    })

    if (!preserveTextFields) {
      const metadata = createDefaultReleaseMetadata({
        repositoryName: nextPreparation.plan.repositoryName,
        version: nextVersion,
        tagName: nextTagName
      })

      setReleaseTitle(metadata.releaseTitle)
      setReleaseNotes(metadata.releaseNotes)
      setReleaseCommitMessage(metadata.commitMessage)
    }
  }

  async function loadReleasePreparation(targetVersionOverride?: string, preserveTextFields = false): Promise<RepositoryReleasePreparation | null> {
    if (!selectedRepository || !window.forgeDesk) {
      setPreparation(null)
      return null
    }

    setLoadingPreparation(true)

    try {
      const firstPreparation = await window.forgeDesk.prepareRepositoryRelease(
        selectedRepository.id,
        targetVersionOverride?.trim()
          ? { targetVersion: targetVersionOverride.trim(), provider: releaseProvider }
          : { provider: releaseProvider }
      )
      const shouldRecheckSuggestedVersion =
        !targetVersionOverride &&
        firstPreparation.plan.needsVersionBump &&
        firstPreparation.plan.suggestedVersion &&
        firstPreparation.plan.suggestedVersion !== firstPreparation.plan.currentVersion
      const nextPreparation = shouldRecheckSuggestedVersion
        ? await window.forgeDesk.prepareRepositoryRelease(selectedRepository.id, { targetVersion: firstPreparation.plan.suggestedVersion, provider: releaseProvider })
        : firstPreparation

      applyReleasePreparation(nextPreparation, preserveTextFields)
      return nextPreparation
    } catch (error) {
      message.error(getErrorMessage(error))
      setPreparation(null)
      return null
    } finally {
      setLoadingPreparation(false)
    }
  }

  async function refreshReleaseGithubTokens(): Promise<void> {
    if (!window.forgeDesk) {
      setGithubTokens([])
      setSelectedGithubTokenId('')
      return
    }

    setLoadingGithubTokens(true)

    try {
      const tokens = await window.forgeDesk.listGithubTokens()
      setGithubTokens(tokens)
      setSelectedGithubTokenId((current) => {
        if (current && tokens.some((token) => token.id === current)) {
          return current
        }

        return tokens[0]?.id ?? ''
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingGithubTokens(false)
    }
  }

  function applyCodemagicBinding(binding: CodemagicRepositoryBinding | null): void {
    setCodemagicBinding(binding)

    if (!binding) {
      setCodemagicAppId('')
      setCodemagicAppName('')
      setCodemagicWorkflowId('')
      setCodemagicWorkflowName('')
      setCodemagicDefaultBranch(selectedRepository?.currentBranch || selectedRepository?.defaultBranch || '')
      setCodemagicLabelsText('forgedesk')
      return
    }

    setSelectedCodemagicTokenId((current) => current || binding.tokenId)
    setSelectedCodemagicTeamId(binding.teamId)
    setCodemagicAppId(binding.appId)
    setCodemagicAppName(binding.appName)
    setCodemagicWorkflowId(binding.workflowId)
    setCodemagicWorkflowName(binding.workflowName)
    setCodemagicDefaultBranch(binding.defaultBranch || selectedRepository?.currentBranch || selectedRepository?.defaultBranch || '')
    setCodemagicLabelsText(binding.labels.length ? binding.labels.join(', ') : 'forgedesk')
  }

  async function refreshReleaseCodemagicTokens(binding?: CodemagicRepositoryBinding | null): Promise<void> {
    if (!window.forgeDesk) {
      setCodemagicTokens([])
      setSelectedCodemagicTokenId('')
      return
    }

    setLoadingCodemagicTokens(true)

    try {
      const tokens = await window.forgeDesk.listCodemagicTokens()
      setCodemagicTokens(tokens)
      setSelectedCodemagicTokenId((current) => {
        if (current && tokens.some((token) => token.id === current)) {
          return current
        }

        if (binding?.tokenId && tokens.some((token) => token.id === binding.tokenId)) {
          return binding.tokenId
        }

        return tokens[0]?.id ?? ''
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingCodemagicTokens(false)
    }
  }

  async function refreshReleaseCodemagicBinding(): Promise<CodemagicRepositoryBinding | null> {
    if (!selectedRepository || !window.forgeDesk) {
      applyCodemagicBinding(null)
      return null
    }

    setLoadingCodemagicBinding(true)

    try {
      const binding = await window.forgeDesk.getRepositoryCodemagicBinding(selectedRepository.id)
      applyCodemagicBinding(binding)
      return binding
    } catch (error) {
      message.error(getErrorMessage(error))
      applyCodemagicBinding(null)
      return null
    } finally {
      setLoadingCodemagicBinding(false)
    }
  }

  async function refreshReleaseCodemagicTeams(tokenId = selectedCodemagicTokenId): Promise<void> {
    if (!window.forgeDesk || !tokenId) {
      setCodemagicTeams([])
      return
    }

    setLoadingCodemagicTeams(true)

    try {
      setCodemagicTeams(await window.forgeDesk.listCodemagicTeams(tokenId))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingCodemagicTeams(false)
    }
  }

  async function refreshReleaseCodemagicApps(tokenId = selectedCodemagicTokenId, teamId = selectedCodemagicTeamId): Promise<void> {
    if (!window.forgeDesk || !tokenId) {
      setCodemagicApps([])
      return
    }

    setLoadingCodemagicApps(true)

    try {
      setCodemagicApps(await window.forgeDesk.listCodemagicApps({ tokenId, teamId: teamId || undefined }))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingCodemagicApps(false)
    }
  }

  useEffect(() => {
    if (!open || !selectedRepository) {
      return
    }

    setPreparation(null)
    setReleaseTitle('')
    setReleaseNotes('')
    setReleaseCommitMessage('')
    setReleaseProvider('github')
    setGithubToken('')
    setCodemagicTeams([])
    setCodemagicApps([])
    setCodemagicBinding(null)
    setSelectedCodemagicTokenId('')
    setSelectedCodemagicTeamId('')
    setCodemagicAppId('')
    setCodemagicAppName('')
    setCodemagicWorkflowId('')
    setCodemagicWorkflowName('')
    setCodemagicDefaultBranch(selectedRepository.currentBranch || selectedRepository.defaultBranch || '')
    setCodemagicLabelsText('forgedesk')
    setSaveCodemagicBinding(true)
    const nextjsAppName = createDefaultNextjsPm2AppName(selectedRepository.name)
    setNextjsPm2SshHost('')
    setNextjsPm2RemotePath(`/var/www/${nextjsAppName}`)
    setNextjsPm2UploadPath('/tmp/forgedesk-releases')
    setNextjsPm2AppName(nextjsAppName)
    setNextjsPm2Port('3000')
    setNextjsPm2StartCommand('')
    setSelectedReleaseActions([])
    setActivePublishTaskId('')
    setActivePublishTask(null)
    loadReleasePreparation()
    refreshReleaseGithubTokens()
    refreshReleaseCodemagicBinding()
      .then((binding) => refreshReleaseCodemagicTokens(binding))
      .catch((error) => message.error(getErrorMessage(error)))
  }, [open, selectedRepository?.id])

  useEffect(() => {
    if (!open || !selectedRepository) {
      return
    }

    loadReleasePreparation(targetVersion, true)
  }, [releaseProvider])

  useEffect(() => {
    if (!open || !selectedCodemagicTokenId) {
      setCodemagicTeams([])
      setCodemagicApps([])
      return
    }

    refreshReleaseCodemagicTeams(selectedCodemagicTokenId)
    refreshReleaseCodemagicApps(selectedCodemagicTokenId, selectedCodemagicTeamId)
  }, [open, selectedCodemagicTokenId])

  useEffect(() => {
    if (!open || !selectedCodemagicTokenId) {
      setCodemagicApps([])
      return
    }

    refreshReleaseCodemagicApps(selectedCodemagicTokenId, selectedCodemagicTeamId)
  }, [open, selectedCodemagicTeamId])

  useEffect(() => {
    if (!activePublishTaskId || !window.forgeDesk) {
      return
    }

    let cancelled = false

    async function refreshActivePublishTask(): Promise<void> {
      const task = await window.forgeDesk.getRepositoryReleasePublishTask(activePublishTaskId)

      if (!cancelled) {
        setActivePublishTask(task)
      }
    }

    refreshActivePublishTask().catch((error) => message.error(getErrorMessage(error)))
    const intervalId = window.setInterval(() => {
      refreshActivePublishTask().catch((error) => message.error(getErrorMessage(error)))
    }, activePublishTaskRunning ? 1500 : 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activePublishTaskId, activePublishTaskRunning])

  useEffect(() => {
    if (!activePublishTask || activePublishTask.status === 'running' || !activePublishTask.repository || handledActivePublishTaskIdsRef.current.has(activePublishTask.id)) {
      return
    }

    handledActivePublishTaskIdsRef.current.add(activePublishTask.id)
    updateRepository(activePublishTask.repository)
    Promise.resolve(onChanged(activePublishTask.repository)).catch((error) => message.error(getErrorMessage(error)))
  }, [activePublishTask, onChanged, updateRepository])

  async function refreshReleaseAiSettings(): Promise<AiSettingsView | null> {
    if (!window.forgeDesk) {
      setAiSettings(null)
      return null
    }

    setLoadingAiSettings(true)

    try {
      const settings = await window.forgeDesk.getAiSettings()
      setAiSettings(settings)
      populateAiSettingsForm(aiSettingsForm, settings)
      return settings
    } catch (error) {
      message.error(getErrorMessage(error))
      return null
    } finally {
      setLoadingAiSettings(false)
    }
  }

  async function saveReleaseAiSettings(): Promise<void> {
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
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: apiKey || undefined,
        model: values.model,
        temperature: Number(values.temperature)
      })
      setAiSettings(settings)
      aiSettingsForm.setFieldValue('apiKey', '')

      if (isAiSettingsReady(settings)) {
        setAiSettingsModalOpen(false)
      }

      message.success('AI 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingAiSettings(false)
    }
  }

  async function fillReleaseWithAi(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const settings = await refreshReleaseAiSettings()

    if (!isAiSettingsReady(settings)) {
      message.info('请先填写并启用 AI API Key')
      setAiSettingsModalOpen(true)
      return
    }

    setGeneratingRelease(true)

    try {
      const checkedPreparation = await loadReleasePreparation(targetVersion, true)
      const suggestion: RepositoryReleaseSuggestion = await window.forgeDesk.suggestRepositoryRelease(selectedRepository.id, {
        targetVersion: checkedPreparation?.plan.suggestedVersion || targetVersion
      })

      setTargetVersion(suggestion.version)
      setTagName(suggestion.tagName)
      setReleaseTitle(suggestion.releaseTitle)
      setReleaseNotes(suggestion.releaseNotes)
      setReleaseCommitMessage(suggestion.commitMessage)
      message.success('AI 已填写发布信息')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error(errorMessage)

      if (isAiCredentialErrorMessage(errorMessage)) {
        setAiSettingsModalOpen(true)
      }
    } finally {
      setGeneratingRelease(false)
    }
  }

  function onTargetVersionChange(value: string): void {
    const previousVersion = targetVersion
    const previousTagName = tagName
    const nextTagName = createTagNameFromVersion(value)

    setTargetVersion(value)

    if (nextTagName) {
      setTagName(nextTagName)

      const metadata = updateDefaultReleaseMetadataForVersionChange({
        repositoryName: preparation?.plan.repositoryName ?? selectedRepository?.name ?? '',
        previousVersion,
        previousTagName,
        nextVersion: value,
        nextTagName,
        releaseTitle,
        releaseNotes,
        commitMessage: releaseCommitMessage
      })

      setReleaseTitle(metadata.releaseTitle)
      setReleaseNotes(metadata.releaseNotes)
      setReleaseCommitMessage(metadata.commitMessage)
    }
  }

  async function publishReleaseAfterConfirm(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const version = targetVersion.trim()
    const releaseTagName = tagName.trim()
    const title = releaseTitle.trim()
    const notes = releaseNotes.trim()
    const commitMessage = releaseCommitMessage.trim()

    if (!version || !releaseTagName || !title || !notes || !commitMessage) {
      message.warning('请补全版本、Tag、标题、说明和版本提交信息')
      return
    }

    if (releaseProvider === 'codemagic' && !codemagicReady) {
      message.warning('请先选择 Codemagic Token，并填写 App ID 和 Workflow ID')
      return
    }

    if (releaseProvider === 'nextjs-pm2' && !nextjsPm2Ready) {
      message.warning('请填写 SSH 目标、部署目录和 PM2 应用名')
      return
    }

    setPublishing(true)

    try {
      const task = await window.forgeDesk.startRepositoryReleasePublishTask(selectedRepository.id, {
        provider: releaseProvider,
        version,
        tagName: releaseTagName,
        releaseTitle: title,
        releaseNotes: notes,
        commitMessage,
        githubTokenId: releaseProvider === 'github' ? selectedGithubTokenId || undefined : undefined,
        githubToken: releaseProvider === 'github' && !selectedGithubTokenId ? githubToken.trim() || undefined : undefined,
        codemagicTokenId: releaseProvider === 'codemagic' ? selectedCodemagicTokenId || undefined : undefined,
        codemagicTeamId: releaseProvider === 'codemagic' ? selectedCodemagicTeamId || undefined : undefined,
        codemagicAppId: releaseProvider === 'codemagic' ? codemagicAppId.trim() || undefined : undefined,
        codemagicAppName: releaseProvider === 'codemagic' ? codemagicAppName.trim() || undefined : undefined,
        codemagicWorkflowId: releaseProvider === 'codemagic' ? codemagicWorkflowId.trim() || undefined : undefined,
        codemagicWorkflowName: releaseProvider === 'codemagic' ? codemagicWorkflowName.trim() || undefined : undefined,
        codemagicDefaultBranch: releaseProvider === 'codemagic' ? codemagicDefaultBranch.trim() || undefined : undefined,
        codemagicLabels: releaseProvider === 'codemagic'
          ? codemagicLabelsText.split(',').map((label) => label.trim()).filter(Boolean)
          : undefined,
        saveCodemagicBinding: releaseProvider === 'codemagic' ? saveCodemagicBinding : undefined,
        nextjsPm2SshHost: releaseProvider === 'nextjs-pm2' ? nextjsPm2SshHost.trim() : undefined,
        nextjsPm2RemotePath: releaseProvider === 'nextjs-pm2' ? nextjsPm2RemotePath.trim() : undefined,
        nextjsPm2UploadPath: releaseProvider === 'nextjs-pm2' ? nextjsPm2UploadPath.trim() : undefined,
        nextjsPm2AppName: releaseProvider === 'nextjs-pm2' ? nextjsPm2AppName.trim() : undefined,
        nextjsPm2Port: releaseProvider === 'nextjs-pm2' ? nextjsPm2Port.trim() || undefined : undefined,
        nextjsPm2StartCommand: releaseProvider === 'nextjs-pm2' ? nextjsPm2StartCommand.trim() || undefined : undefined,
        releaseActions: selectedReleaseActions
      })

      setActivePublishTaskId(task.id)
      setActivePublishTask(task)
      message.success(`${releaseTagName} 已创建后台发布任务，日志会持续更新`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setPublishing(false)
    }
  }

  async function cancelActivePublishTask(): Promise<void> {
    if (!activePublishTask || !window.forgeDesk) {
      return
    }

    setCancellingPublishTask(true)

    try {
      const task = await window.forgeDesk.cancelRepositoryReleasePublishTask(activePublishTask.id)
      setActivePublishTask(task)
      message.warning(`${task.tagName} 发布任务已请求终止`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCancellingPublishTask(false)
    }
  }

  function confirmPublishRelease(): void {
    Modal.confirm({
      title: `发布 ${tagName || targetVersion}？`,
      width: 560,
      content: (
        <Space direction="vertical" size={8}>
          <Typography.Text>
            {releaseProvider === 'codemagic'
              ? `将触发 Codemagic workflow：${codemagicWorkflowName || codemagicWorkflowId || '未命名 workflow'}。`
              : releaseProvider === 'nextjs-pm2'
                ? `将本地构建并打包 Next.js，然后部署到 ${nextjsPm2SshHost || '未填写 SSH 目标'}:${nextjsPm2RemotePath || '未填写部署目录'}，PM2 应用：${nextjsPm2AppName || '未命名'}。`
                : `将按当前仓库 package.json 中的 ${preparation?.plan.selectedScript || '发布'} 脚本执行。`}
          </Typography.Text>
          {targetVersion !== preparation?.plan.currentVersion ? (
            <Typography.Text type="warning">
              发布前会把版本从 {preparation?.plan.currentVersion} 更新到 {targetVersion}，并提交版本号改动。
            </Typography.Text>
          ) : null}
          {selectedReleaseActions.length > 0 ? (
            <Space direction="vertical" size={2}>
              <Typography.Text type="warning">发布时还会处理：</Typography.Text>
              {(preparation?.plan.availableActions ?? [])
                .filter((action) => selectedReleaseActions.includes(action.key))
                .map((action) => (
                  <Typography.Text key={action.key} type="secondary">
                    {action.label}
                  </Typography.Text>
                ))}
            </Space>
          ) : null}
          <Typography.Text type="secondary">执行过程会进入后台任务，可以关闭窗口继续操作，并随时查看发布日志和构建包。</Typography.Text>
        </Space>
      ),
      okText: releaseProvider === 'codemagic' ? '开始构建' : releaseProvider === 'nextjs-pm2' ? '开始部署' : '开始发布',
      cancelText: '取消',
      onOk: () => {
        void publishReleaseAfterConfirm()
      }
    })
  }

  const plan = preparation?.plan
  const issues = plan?.issues ?? []
  const warnings = plan?.warnings ?? []
  const availableReleaseActions = plan?.availableActions ?? []

  return (
    <Modal
      title="发布版本"
      open={open}
      width="min(900px, calc(100vw - 48px))"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          关闭
        </Button>,
        <Button key="refresh" icon={<ReloadOutlined />} loading={loadingPreparation} disabled={!selectedRepository} onClick={() => loadReleasePreparation(targetVersion, true)}>
          重新检查
        </Button>,
        <Button key="ai" icon={<ThunderboltOutlined />} loading={generatingRelease} disabled={!selectedRepository} onClick={fillReleaseWithAi}>
          AI 填写
        </Button>,
        <Button key="publish" type="primary" icon={<UploadOutlined />} loading={publishing} disabled={releaseView.primaryDisabled || publishing || activePublishTaskRunning} onClick={confirmPublishRelease}>
          {activePublishTaskRunning ? '发布中' : releaseView.primaryLabel}
        </Button>
      ]}
    >
      <Space direction="vertical" size={14} className="release-publish-modal">
        <Space wrap className="git-action-modal-toolbar">
          <Select
            value={selectedRepository?.id}
            className="git-action-repository-select"
            options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
            onChange={setRepositoryId}
          />
          {plan ? <Tag color={plan.canPublish ? 'green' : 'red'}>{plan.canPublish ? '检查通过' : `${issues.length} 个问题`}</Tag> : null}
          {plan?.selectedScript ? <Tag color="blue">{getReleaseScriptLabel(plan.selectedScript)}</Tag> : null}
          {preparation ? <Typography.Text type="secondary">{preparation.packageManager}</Typography.Text> : null}
        </Space>

        <div className="release-platform-section">
          <Space wrap className="release-platform-heading">
            <Typography.Text strong>发布平台</Typography.Text>
            <Segmented
              size="small"
              value={releaseProvider}
              options={[
                { label: 'GitHub Releases', value: 'github' },
                { label: 'Codemagic', value: 'codemagic' },
                { label: 'Next.js PM2', value: 'nextjs-pm2' }
              ]}
              onChange={(value) => setReleaseProvider(value as ReleasePublishProvider)}
            />
          </Space>
          <div className="release-platform-list">
            {releasePlatformOptions.map((platform) => (
              <div
                key={platform.key}
                role="button"
                tabIndex={0}
                className={[
                  'release-platform-card',
                  platform.disabled ? 'release-platform-card-disabled' : 'release-platform-card-active',
                  releaseProvider === platform.key ? 'release-platform-card-selected' : ''
                ].join(' ')}
                onClick={() => setReleaseProvider(platform.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setReleaseProvider(platform.key)
                  }
                }}
              >
                <span className="release-platform-icon">
                  {platform.key === 'github' ? <GithubOutlined /> : platform.key === 'nextjs-pm2' ? <CodeOutlined /> : <UploadOutlined />}
                </span>
                <span className="release-platform-body">
                  <span className="release-platform-title-row">
                    <Typography.Text strong>{platform.name}</Typography.Text>
                    <Tag color={platform.statusColor}>{platform.statusLabel}</Tag>
                  </span>
                  <Typography.Text type="secondary">{platform.description}</Typography.Text>
                  <Typography.Text type="secondary">{platform.detail}</Typography.Text>
                </span>
              </div>
            ))}
          </div>
        </div>

        {issues.length > 0 ? <Alert type="warning" showIcon message="发布前需要处理" description={issues.join('；')} /> : null}
        {availableReleaseActions.length > 0 ? (
          <Alert
            type="info"
            showIcon
            message="可在发布时处理"
            description={
              <Checkbox.Group
                className="release-action-options"
                value={selectedReleaseActions}
                onChange={(checkedValues) => setSelectedReleaseActions(checkedValues as ReleasePublishActionKey[])}
              >
                {availableReleaseActions.map((action) => (
                  <Checkbox key={action.key} value={action.key}>
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{action.label}</Typography.Text>
                      <Typography.Text type="secondary">{action.description}</Typography.Text>
                    </Space>
                  </Checkbox>
                ))}
              </Checkbox.Group>
            }
          />
        ) : null}
        {warnings.length > 0 ? <Alert type="info" showIcon message="发布提示" description={warnings.join('；')} /> : null}

        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="当前版本">{plan?.currentVersion || '-'}</Descriptions.Item>
          <Descriptions.Item label="目标 Tag">{tagName || '-'}</Descriptions.Item>
          <Descriptions.Item label="项目路径" span={2}>{preparation?.localPath || '-'}</Descriptions.Item>
          <Descriptions.Item label="文档来源" span={2}>
            {plan?.documentationSources.length ? plan.documentationSources.join('、') : '未找到 README 或 docs 文档'}
          </Descriptions.Item>
        </Descriptions>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Input value={targetVersion} addonBefore="版本" placeholder="1.0.3" onChange={(event) => onTargetVersionChange(event.target.value)} />
          </Col>
          <Col xs={24} md={12}>
            <Input value={tagName} addonBefore="Tag" placeholder="v1.0.3" onChange={(event) => setTagName(event.target.value)} />
          </Col>
          <Col xs={24}>
            <Input value={releaseTitle} addonBefore="标题" placeholder="ForgeDesk v1.0.3" onChange={(event) => setReleaseTitle(event.target.value)} />
          </Col>
          <Col xs={24}>
            <Input.TextArea value={releaseNotes} rows={5} placeholder="发布说明" onChange={(event) => setReleaseNotes(event.target.value)} />
          </Col>
          <Col xs={24}>
            <Input value={releaseCommitMessage} addonBefore="版本提交" placeholder="chore: release v1.0.3" onChange={(event) => setReleaseCommitMessage(event.target.value)} />
          </Col>
          {releaseProvider === 'github' && plan?.selectedScript === 'publish:mac' ? (
            <Col xs={24}>
              <Space direction="vertical" size={8} className="release-github-token-picker">
                <Space.Compact className="full-width-control">
                  <Select
                    allowClear
                    value={selectedGithubTokenId || undefined}
                    className="release-github-token-select"
                    loading={loadingGithubTokens}
                    placeholder={githubTokens.length > 0 ? '选择已保存的 GitHub Token' : '设置里还没有保存 GitHub Token'}
                    options={githubTokenOptions}
                    onChange={(value) => setSelectedGithubTokenId(value ?? '')}
                  />
                  <Tooltip title="重新读取已保存 Token">
                    <Button icon={<ReloadOutlined />} loading={loadingGithubTokens} onClick={refreshReleaseGithubTokens} />
                  </Tooltip>
                </Space.Compact>
                {selectedGithubToken ? (
                  <Space wrap size={[4, 4]}>
                    <Tag color="green">{getGithubTokenTypeLabel(selectedGithubToken)}</Tag>
                    {renderGithubTokenScopes(selectedGithubToken)}
                    <Typography.Text type="secondary">校验：{formatGithubTokenCheckedAt(selectedGithubToken)}</Typography.Text>
                  </Space>
                ) : null}
                <Input.Password
                  value={githubToken}
                  addonBefore="临时 Token"
                  disabled={Boolean(selectedGithubTokenId)}
                  placeholder={selectedGithubTokenId ? '正在使用已保存 Token' : '不保存，只用于本次发布'}
                  onChange={(event) => setGithubToken(event.target.value)}
                />
              </Space>
            </Col>
          ) : null}
          {releaseProvider === 'codemagic' ? (
            <Col xs={24}>
              <Space direction="vertical" size={10} className="release-github-token-picker">
                <Alert
                  type={codemagicReady ? 'success' : 'warning'}
                  showIcon
                  message={codemagicReady ? 'Codemagic 绑定已就绪' : '请完成 Codemagic 绑定'}
                  description={codemagicReady
                    ? `将用 ${codemagicAppName || codemagicAppId} / ${codemagicWorkflowName || codemagicWorkflowId} 构建 ${tagName || targetVersion}。`
                    : '选择 Token 后可以读取 App 列表；Workflow ID 需要与 codemagic.yaml 或 Codemagic UI 中的 workflow id 一致。'}
                />
                <Space.Compact className="full-width-control">
                  <Select
                    allowClear
                    value={selectedCodemagicTokenId || undefined}
                    className="release-github-token-select"
                    loading={loadingCodemagicTokens}
                    placeholder={codemagicTokens.length > 0 ? '选择已保存的 Codemagic Token' : '设置里还没有保存 Codemagic Token'}
                    options={codemagicTokenOptions}
                    onChange={(value) => {
                      setSelectedCodemagicTokenId(value ?? '')
                      setCodemagicTeams([])
                      setCodemagicApps([])
                    }}
                  />
                  <Tooltip title="重新读取已保存 Token">
                    <Button icon={<ReloadOutlined />} loading={loadingCodemagicTokens} onClick={() => refreshReleaseCodemagicTokens(codemagicBinding)} />
                  </Tooltip>
                </Space.Compact>
                {selectedCodemagicToken ? (
                  <Space wrap size={[4, 4]}>
                    <Tag color="blue">{selectedCodemagicToken.teamCount} 个团队</Tag>
                    <Tag color="green">{selectedCodemagicToken.appCount} 个应用</Tag>
                    <Typography.Text type="secondary">校验：{selectedCodemagicToken.lastCheckedAt ? new Date(selectedCodemagicToken.lastCheckedAt).toLocaleString() : '未校验'}</Typography.Text>
                  </Space>
                ) : null}
                <Row gutter={[12, 8]}>
                  <Col xs={24} md={12}>
                    <Space.Compact className="full-width-control">
                      <Select
                        allowClear
                        value={selectedCodemagicTeamId || undefined}
                        className="release-github-token-select"
                        loading={loadingCodemagicTeams}
                        placeholder="Codemagic Team（个人应用可留空）"
                        options={codemagicTeamOptions}
                        onChange={(value) => setSelectedCodemagicTeamId(value ?? '')}
                      />
                      <Tooltip title="读取团队">
                        <Button icon={<ReloadOutlined />} disabled={!selectedCodemagicTokenId} loading={loadingCodemagicTeams} onClick={() => refreshReleaseCodemagicTeams()} />
                      </Tooltip>
                    </Space.Compact>
                  </Col>
                  <Col xs={24} md={12}>
                    <Space.Compact className="full-width-control">
                      <Select
                        allowClear
                        value={codemagicApps.some((appItem) => appItem.id === codemagicAppId) ? codemagicAppId : undefined}
                        className="release-github-token-select"
                        loading={loadingCodemagicApps}
                        placeholder="从 Codemagic App 列表选择"
                        options={codemagicAppOptions}
                        onChange={(value) => {
                          const appItem = codemagicApps.find((item) => item.id === value)
                          setCodemagicAppId(value ?? '')
                          setCodemagicAppName(appItem?.name ?? '')
                        }}
                      />
                      <Tooltip title="读取 App 列表">
                        <Button icon={<ReloadOutlined />} disabled={!selectedCodemagicTokenId} loading={loadingCodemagicApps} onClick={() => refreshReleaseCodemagicApps()} />
                      </Tooltip>
                    </Space.Compact>
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={codemagicAppId} addonBefore="App ID" placeholder="60a0b1c2d3e4f56789abcdef" onChange={(event) => setCodemagicAppId(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={codemagicAppName} addonBefore="App 名称" placeholder="可选，仅用于显示" onChange={(event) => setCodemagicAppName(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={codemagicWorkflowId} addonBefore="Workflow ID" placeholder="release" onChange={(event) => setCodemagicWorkflowId(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={codemagicWorkflowName} addonBefore="Workflow 名称" placeholder="可选，仅用于显示" onChange={(event) => setCodemagicWorkflowName(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={codemagicDefaultBranch} addonBefore="默认分支" placeholder={selectedRepository?.currentBranch || 'main'} onChange={(event) => setCodemagicDefaultBranch(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={codemagicLabelsText} addonBefore="Labels" placeholder="forgedesk, production" onChange={(event) => setCodemagicLabelsText(event.target.value)} />
                  </Col>
                  <Col xs={24}>
                    <Checkbox checked={saveCodemagicBinding} onChange={(event) => setSaveCodemagicBinding(event.target.checked)}>
                      保存为当前仓库的 Codemagic 绑定
                    </Checkbox>
                    {loadingCodemagicBinding ? <Typography.Text type="secondary"> 正在读取绑定...</Typography.Text> : null}
                  </Col>
                </Row>
              </Space>
            </Col>
          ) : null}
          {releaseProvider === 'nextjs-pm2' ? (
            <Col xs={24}>
              <Space direction="vertical" size={10} className="release-github-token-picker">
                <Alert
                  type={nextjsPm2Ready ? 'success' : 'warning'}
                  showIcon
                  message={nextjsPm2Ready ? 'Next.js PM2 目标已填写' : '请填写远端部署目标'}
                  description={nextjsPm2Ready
                    ? `将部署到 ${nextjsPm2SshHost}:${nextjsPm2RemotePath}，PM2 应用 ${nextjsPm2AppName}。`
                    : 'SSH 目标可以使用 ~/.ssh/config 里的 Host 别名。'}
                />
                <Row gutter={[12, 8]}>
                  <Col xs={24} md={12}>
                    <Input value={nextjsPm2SshHost} addonBefore="SSH 目标" placeholder="deploy@example.com" onChange={(event) => setNextjsPm2SshHost(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={nextjsPm2AppName} addonBefore="PM2 应用" placeholder={selectedRepository?.name || 'nextjs-app'} onChange={(event) => setNextjsPm2AppName(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={nextjsPm2RemotePath} addonBefore="部署目录" placeholder="/var/www/app" onChange={(event) => setNextjsPm2RemotePath(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={nextjsPm2UploadPath} addonBefore="上传目录" placeholder="/tmp/forgedesk-releases" onChange={(event) => setNextjsPm2UploadPath(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={nextjsPm2Port} addonBefore="端口" placeholder="3000" onChange={(event) => setNextjsPm2Port(event.target.value)} />
                  </Col>
                  <Col xs={24} md={12}>
                    <Input value={nextjsPm2StartCommand} addonBefore="启动命令" placeholder="可选，例如 pnpm start" onChange={(event) => setNextjsPm2StartCommand(event.target.value)} />
                  </Col>
                </Row>
              </Space>
            </Col>
          ) : null}
        </Row>

        {activePublishTask ? (
          <div className="release-background-task-card">
            <div className="release-background-task-header">
              <Space wrap>
                <Typography.Text strong>后台发布任务</Typography.Text>
                <Tag color={activePublishTaskView.statusColor}>{activePublishTaskView.statusLabel}</Tag>
                <Typography.Text type="secondary">{activePublishTaskView.title}</Typography.Text>
              </Space>
              <Space>
                <Typography.Text type="secondary">更新：{new Date(activePublishTask.updatedAt).toLocaleString()}</Typography.Text>
                {activePublishTaskView.canCancel ? (
                  <Popconfirm
                    title="终止这个发布任务？"
                    description={getReleaseTaskCancelDescription(activePublishTask)}
                    okText="终止"
                    cancelText="取消"
                    onConfirm={cancelActivePublishTask}
                  >
                    <Button danger size="small" loading={cancellingPublishTask}>
                      终止
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            </div>
            <div className="release-task-progress-row">
              <Typography.Text type="secondary">当前步骤：{activePublishTaskView.phase}</Typography.Text>
              {activePublishTask.externalBuildUrl ? (
                <Button size="small" icon={<LinkOutlined />} href={activePublishTask.externalBuildUrl} target="_blank" rel="noreferrer">
                  打开 Codemagic Build
                </Button>
              ) : null}
              <Alert type={activePublishTask.status === 'failed' ? 'error' : activePublishTask.status === 'cancelled' ? 'warning' : 'info'} showIcon message={activePublishTaskView.hint} />
              <Progress percent={activePublishTaskView.progressPercent} size="small" status={activePublishTask.status === 'failed' || activePublishTask.status === 'cancelled' ? 'exception' : activePublishTask.status === 'succeeded' ? 'success' : 'active'} />
            </div>
            {activePublishTask.artifacts?.length ? (
              <div className="release-artifact-list">
                {activePublishTask.artifacts.map((artifact) => (
                  <div key={`${artifact.name}-${artifact.downloadUrl}`} className="release-artifact-item">
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{artifact.name}</Typography.Text>
                      <Typography.Text type="secondary">
                        {[artifact.type, artifact.versionName, artifact.versionCode ? `build ${artifact.versionCode}` : '', formatFileSize(artifact.sizeInBytes)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography.Text>
                    </Space>
                    {artifact.downloadUrl ? (
                      <Button size="small" icon={<DownloadOutlined />} href={artifact.downloadUrl} target="_blank" rel="noreferrer">
                        下载
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="release-publish-log">
              <Typography.Text copyable>{activePublishTaskView.log}</Typography.Text>
            </div>
          </div>
        ) : null}
      </Space>
      <Modal
        title="AI 设置"
        open={aiSettingsModalOpen}
        footer={null}
        width="min(760px, calc(100vw - 48px))"
        onCancel={() => setAiSettingsModalOpen(false)}
      >
        <AiSettingsSection
          form={aiSettingsForm}
          settings={aiSettings}
          loading={loadingAiSettings}
          saving={savingAiSettings}
          onRefresh={refreshReleaseAiSettings}
          onSave={saveReleaseAiSettings}
        />
      </Modal>
    </Modal>
  )
}

function GitPushModal({ open, repositories, onClose, onChanged }: GitActionModalProps): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [status, setStatus] = useState<GitWorkspaceStatus | null>(null)
  const [pushRemote, setPushRemote] = useState('origin')
  const [pushBranch, setPushBranch] = useState('')
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [working, setWorking] = useState(false)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
  const pushTargets = status?.pushTargets ?? selectedRepository?.pushTargets ?? []
  const pushableTargets = getPushableTargets(pushTargets)
  const remoteOptions = createPushRemoteOptions(selectedRepository?.remotes ?? [], pushTargets)
  const currentBranch = getCurrentBranchName(selectedRepository, status)
  const pushReady = Boolean(selectedRepository && pushBranch.trim() && canPushSelection(pushRemote, pushTargets))

  useEffect(() => {
    if (!open) {
      return
    }

    if (repositories.length === 0) {
      setRepositoryId('')
      setStatus(null)
      return
    }

    if (!repositories.some((repository) => repository.id === repositoryId)) {
      setRepositoryId(repositories[0].id)
    }
  }, [open, repositories, repositoryId])

  async function refreshWorkspaceStatus(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setLoadingStatus(true)

    try {
      const nextStatus = await window.forgeDesk.getRepositoryWorkspaceStatus(selectedRepository.id)
      const target = getPreferredPushTarget(selectedRepository, nextStatus)
      setStatus(nextStatus)
      setPushRemote(target.remote)
      setPushBranch(target.branch)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    if (!open || !selectedRepository) {
      return
    }

    const target = getPreferredPushTarget(selectedRepository)
    setStatus(null)
    setPushRemote(target.remote)
    setPushBranch(target.branch)
    refreshWorkspaceStatus()
  }, [open, selectedRepository?.id])

  async function pushBranchToRemote(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      message.warning('请选择要推送的仓库')
      return
    }

    const remote = pushRemote.trim()
    const branch = pushBranch.trim()

    const remoteNames = resolveSelectedPushRemoteNames(remote, selectedRepository.remotes)

    if (remoteNames.length === 0 || !branch) {
      message.warning('请选择远端并填写分支')
      return
    }

    setWorking(true)

    try {
      const result = await window.forgeDesk.gitPush(selectedRepository.id, createGitPushInput(remoteNames, branch))
      updateRepository(result.repository)
      setStatus(result.status)

      if (!result.ok) {
        message.warning(result.stderr || result.stdout || '推送失败，请检查远端权限或分支状态')
        return
      }

      message.success(remoteNames.length > 1 ? '分支已推送到所有远端' : '分支已推送')
      await onChanged(result.repository)
      onClose()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      title="推送分支"
      open={open}
      width="min(720px, calc(100vw - 48px))"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="refresh" icon={<ReloadOutlined />} loading={loadingStatus} onClick={refreshWorkspaceStatus}>
          刷新状态
        </Button>,
        <Button key="push" type="primary" icon={<UploadOutlined />} loading={working} disabled={!pushReady} onClick={pushBranchToRemote}>
          推送
        </Button>
      ]}
    >
      <Space direction="vertical" size={14} className="git-action-modal">
        <Space wrap className="git-action-modal-toolbar">
          <Select
            value={selectedRepository?.id}
            className="git-action-repository-select"
            options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
            onChange={setRepositoryId}
          />
          {selectedRepository && <Tag color={pushableTargets.length > 0 ? 'orange' : 'default'}>{pushableTargets.reduce((sum, target) => sum + target.ahead, 0)} 个未推送提交</Tag>}
          <Tag color={currentBranch ? 'blue' : 'default'}>当前分支：{currentBranch || '未检测'}</Tag>
        </Space>
        <Space.Compact className="git-operation-compact">
          <Select value={pushRemote} options={remoteOptions.length > 0 ? remoteOptions : [{ label: 'origin', value: 'origin' }]} onChange={setPushRemote} />
          <Input value={pushBranch} placeholder={currentBranch || 'main'} onChange={(event) => setPushBranch(event.target.value)} />
        </Space.Compact>
        <Alert
          type={pushReady ? 'info' : 'warning'}
          showIcon
          message={
            pushReady
              ? `将推送 ${selectedRepository?.name} 的 ${pushBranch || currentBranch} 到 ${pushRemote === PUSH_ALL_REMOTES_VALUE ? '所有远端' : pushRemote || 'origin'}`
              : '当前分支没有待推送到任一远端的提交'
          }
          description="推送会使用当前仓库配置的 Git 远端和 SSH/HTTPS 认证。"
        />
      </Space>
    </Modal>
  )
}

function GitMergeModal({
  open,
  repositories,
  onClose,
  onChanged,
  onOperationResult
}: GitActionModalProps & { onOperationResult?: (repository: Repository, result: GitOperationResult) => void }): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [aiSettingsForm] = Form.useForm<AiSettingsForm>()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [status, setStatus] = useState<GitWorkspaceStatus | null>(null)
  const [sourceBranch, setSourceBranch] = useState('')
  const [targetBranch, setTargetBranch] = useState('')
  const [analysis, setAnalysis] = useState<GitMergeAnalysis | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null)
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingAiSettings, setLoadingAiSettings] = useState(false)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [merging, setMerging] = useState(false)
  const [suggestingFilePath, setSuggestingFilePath] = useState<string | null>(null)
  const [previewSuggestion, setPreviewSuggestion] = useState<AiConflictSuggestion | null>(null)
  const [applyingSuggestion, setApplyingSuggestion] = useState(false)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
  const currentBranch = status?.branch || selectedRepository?.currentBranch || ''
  const localBranches = createBranchOptions([...(selectedRepository?.branches ?? []), currentBranch])
  const sourceBranches = createBranchOptions([...(selectedRepository?.remoteBranches ?? []), ...(selectedRepository?.branches ?? [])])
  const conflicts = status?.conflicts ?? []

  useEffect(() => {
    if (!open) {
      return
    }

    if (repositories.length === 0) {
      setRepositoryId('')
      setStatus(null)
      setSourceBranch('')
      setTargetBranch('')
      return
    }

    if (!repositories.some((repository) => repository.id === repositoryId)) {
      setRepositoryId(repositories[0].id)
    }
  }, [open, repositories, repositoryId])

  function chooseDefaultSource(repository: Repository, target: string): string {
    const defaultBranch = repository.defaultBranch || target
    return (
      repository.remoteBranches.find((branch) => branch.endsWith(`/${defaultBranch}`) && branch !== target) ??
      repository.remoteBranches.find((branch) => branch !== target) ??
      repository.branches.find((branch) => branch !== target) ??
      ''
    )
  }

  async function refreshWorkspaceStatus(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setLoadingStatus(true)

    try {
      const nextStatus = await window.forgeDesk.getRepositoryWorkspaceStatus(selectedRepository.id)
      const nextTarget = nextStatus.branch || selectedRepository.currentBranch
      setStatus(nextStatus)
      setTargetBranch((current) => current || nextTarget)
      setSourceBranch((current) => current || chooseDefaultSource(selectedRepository, nextTarget))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    if (!open || !selectedRepository) {
      return
    }

    const nextTarget = selectedRepository.currentBranch || selectedRepository.defaultBranch
    setStatus(null)
    setAnalysis(null)
    setPreviewSuggestion(null)
    setTargetBranch(nextTarget)
    setSourceBranch(chooseDefaultSource(selectedRepository, nextTarget))
    refreshWorkspaceStatus()
  }, [open, selectedRepository?.id])

  async function runMerge(nextAnalysis: GitMergeAnalysis): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    setMerging(true)

    try {
      const result = await window.forgeDesk.gitMerge(selectedRepository.id, { source: nextAnalysis.source })
      updateRepository(result.repository)
      onOperationResult?.(result.repository, result)
      setStatus(result.status)

      if (result.ok) {
        message.success('合并已完成')
        setAnalysis(null)
        await onChanged(result.repository)
        onClose()
        return
      }

      if (result.status.conflicts.length > 0) {
        message.warning('合并产生冲突，可以在弹窗里请求 AI 建议')
      } else {
        message.warning(result.stderr || result.stdout || '合并没有完成，请查看提示')
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setMerging(false)
    }
  }

  function confirmMerge(nextAnalysis: GitMergeAnalysis): void {
    Modal.confirm({
      title: '确认合并？',
      content: (
        <Space direction="vertical" size={6}>
          <Typography.Text>
            将 <Typography.Text code>{nextAnalysis.source}</Typography.Text> 合并到 <Typography.Text code>{nextAnalysis.target}</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            将引入 {nextAnalysis.incomingCommits} 个提交，{nextAnalysis.fastForward ? '可以快进合并' : '会创建一次普通合并'}。
          </Typography.Text>
        </Space>
      ),
      okText: '确认合并',
      cancelText: '再看看',
      onOk: () => runMerge(nextAnalysis)
    })
  }

  async function analyzeMerge(): Promise<void> {
    if (!selectedRepository || !sourceBranch || !targetBranch || !window.forgeDesk) {
      message.warning('请选择合并双方')
      return
    }

    setAnalyzing(true)
    setAnalysis(null)

    try {
      const nextAnalysis = await window.forgeDesk.analyzeRepositoryMerge(selectedRepository.id, {
        source: sourceBranch,
        target: targetBranch
      })
      setAnalysis(nextAnalysis)

      if (nextAnalysis.ok) {
        confirmMerge(nextAnalysis)
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setAnalyzing(false)
    }
  }

  async function refreshMergeAiSettings(): Promise<AiSettingsView | null> {
    if (!window.forgeDesk) {
      setAiSettings(null)
      return null
    }

    setLoadingAiSettings(true)

    try {
      const settings = await window.forgeDesk.getAiSettings()
      setAiSettings(settings)
      populateAiSettingsForm(aiSettingsForm, settings)
      return settings
    } catch (error) {
      message.error(getErrorMessage(error))
      return null
    } finally {
      setLoadingAiSettings(false)
    }
  }

  async function saveMergeAiSettings(): Promise<void> {
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
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: apiKey || undefined,
        model: values.model,
        temperature: Number(values.temperature)
      })
      setAiSettings(settings)
      aiSettingsForm.setFieldValue('apiKey', '')

      if (isAiSettingsReady(settings)) {
        setAiSettingsModalOpen(false)
      }

      message.success('AI 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingAiSettings(false)
    }
  }

  async function suggestConflictResolution(conflict: GitConflictFile): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const settings = await refreshMergeAiSettings()

    if (!isAiSettingsReady(settings)) {
      message.info('请先填写并启用 AI API Key')
      setAiSettingsModalOpen(true)
      return
    }

    setSuggestingFilePath(conflict.path)

    try {
      setPreviewSuggestion(await window.forgeDesk.suggestConflictResolution(selectedRepository.id, conflict.path))
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error(errorMessage)

      if (isAiCredentialErrorMessage(errorMessage)) {
        setAiSettingsModalOpen(true)
      }
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
      message.success(result.status.conflicts.length === 0 ? '已应用 AI 建议并暂存文件' : '已应用 AI 建议，请继续处理剩余冲突')
      await onChanged(result.repository)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setApplyingSuggestion(false)
    }
  }

  const analysisType = analysis?.ok ? 'success' : analysis ? 'warning' : 'info'

  return (
    <Modal
      title="合并分支"
      open={open}
      width="min(900px, calc(100vw - 48px))"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="refresh" icon={<ReloadOutlined />} loading={loadingStatus} onClick={refreshWorkspaceStatus}>
          刷新状态
        </Button>,
        <Button
          key="ai-settings"
          icon={<SettingOutlined />}
          onClick={() => {
            setAiSettingsModalOpen(true)
            void refreshMergeAiSettings()
          }}
        >
          AI 设置
        </Button>,
        <Button key="confirm" disabled={!analysis?.ok} loading={merging} onClick={() => analysis && confirmMerge(analysis)}>
          确认合并
        </Button>,
        <Button key="analyze" type="primary" loading={analyzing} disabled={!sourceBranch || !targetBranch} onClick={analyzeMerge}>
          分析
        </Button>
      ]}
    >
      <Space direction="vertical" size={14} className="git-action-modal">
        <Space wrap className="git-action-modal-toolbar">
          <Select
            value={selectedRepository?.id}
            className="git-action-repository-select"
            options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))}
            onChange={setRepositoryId}
          />
          <Select
            value={sourceBranch || undefined}
            className="git-branch-select"
            placeholder="来源分支"
            showSearch
            options={sourceBranches}
            onChange={(value) => {
              setSourceBranch(value)
              setAnalysis(null)
            }}
          />
          <Select
            value={targetBranch || undefined}
            className="git-branch-select"
            placeholder="目标分支"
            showSearch
            options={localBranches}
            onChange={(value) => {
              setTargetBranch(value)
              setAnalysis(null)
            }}
          />
        </Space>

        <div className="merge-direction-preview">
          <Typography.Text type="secondary">合并方向</Typography.Text>
          <Typography.Text strong>
            {sourceBranch || '来源分支'} → {targetBranch || '目标分支'}
          </Typography.Text>
          {currentBranch && <Tag color={targetBranch === currentBranch ? 'blue' : 'orange'}>当前分支：{currentBranch}</Tag>}
        </div>

        <Alert
          type={analysisType}
          showIcon
          message={analysis ? (analysis.ok ? '分析通过，可以二次确认后合并' : '分析发现需要先处理的问题') : '选择双方后先分析，再确认合并'}
          description={
            analysis ? (
              <Space direction="vertical" size={6} className="merge-analysis-details">
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="引入提交">{analysis.incomingCommits}</Descriptions.Item>
                  <Descriptions.Item label="本地独有">{analysis.localOnlyCommits}</Descriptions.Item>
                  <Descriptions.Item label="合并方式">{analysis.fastForward ? '快进合并' : '普通合并'}</Descriptions.Item>
                  <Descriptions.Item label="共同基线">{analysis.mergeBase ? analysis.mergeBase.slice(0, 12) : '-'}</Descriptions.Item>
                </Descriptions>
                {analysis.issues.map((issue) => (
                  <Typography.Text key={issue} type="danger">
                    {issue}
                  </Typography.Text>
                ))}
                {analysis.warnings.map((warning) => (
                  <Typography.Text key={warning} type="secondary">
                    {warning}
                  </Typography.Text>
                ))}
              </Space>
            ) : (
              '目标分支应该是当前检出的分支，避免在合并时偷偷切换工作区。'
            )
          }
        />

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
      </Space>

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
      <Modal
        title="AI 设置"
        open={aiSettingsModalOpen}
        footer={null}
        width="min(760px, calc(100vw - 48px))"
        onCancel={() => setAiSettingsModalOpen(false)}
      >
        <AiSettingsSection
          form={aiSettingsForm}
          settings={aiSettings}
          loading={loadingAiSettings}
          saving={savingAiSettings}
          onRefresh={refreshMergeAiSettings}
          onSave={saveMergeAiSettings}
        />
      </Modal>
    </Modal>
  )
}

function GitWorkspacePanel({ repositories }: { repositories: Repository[] }): JSX.Element {
  const { updateRepository } = useForgeDeskStore()
  const [aiSettingsForm] = Form.useForm<AiSettingsForm>()
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [status, setStatus] = useState<GitWorkspaceStatus | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [commitTag, setCommitTag] = useState('')
  const [tagRecommendation, setTagRecommendation] = useState<RepositoryReleaseTagRecommendation | null>(null)
  const [aiSettings, setAiSettings] = useState<AiSettingsView | null>(null)
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false)
  const [pushRemote, setPushRemote] = useState('origin')
  const [pushBranch, setPushBranch] = useState('')
  const [mergeSource, setMergeSource] = useState('')
  const [working, setWorking] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingTagRecommendation, setLoadingTagRecommendation] = useState(false)
  const [loadingAiSettings, setLoadingAiSettings] = useState(false)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [suggestingFilePath, setSuggestingFilePath] = useState<string | null>(null)
  const [previewSuggestion, setPreviewSuggestion] = useState<AiConflictSuggestion | null>(null)
  const [applyingSuggestion, setApplyingSuggestion] = useState(false)
  const [releaseModalOpen, setReleaseModalOpen] = useState(false)
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null

  useEffect(() => {
    if (repositories.length === 0) {
      setRepositoryId('')
      setStatus(null)
      setSelectedPaths([])
      setTagRecommendation(null)
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
      const target = getPreferredPushTarget(selectedRepository, nextStatus)
      setStatus(nextStatus)
      setPushBranch((current) => current || target.branch)
      setPushRemote((current) => current || target.remote)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingStatus(false)
    }
  }

  async function refreshReleaseTagRecommendation(): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      setTagRecommendation(null)
      return
    }

    setLoadingTagRecommendation(true)

    try {
      setTagRecommendation(await window.forgeDesk.recommendRepositoryReleaseTag(selectedRepository.id))
    } catch (error) {
      setTagRecommendation(null)
      message.warning(getErrorMessage(error))
    } finally {
      setLoadingTagRecommendation(false)
    }
  }

  async function refreshWorkspaceAiSettings(): Promise<AiSettingsView | null> {
    if (!window.forgeDesk) {
      setAiSettings(null)
      return null
    }

    setLoadingAiSettings(true)

    try {
      const settings = await window.forgeDesk.getAiSettings()
      setAiSettings(settings)
      populateAiSettingsForm(aiSettingsForm, settings)
      return settings
    } catch (error) {
      message.error(getErrorMessage(error))
      return null
    } finally {
      setLoadingAiSettings(false)
    }
  }

  async function saveWorkspaceAiSettings(): Promise<void> {
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
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: apiKey || undefined,
        model: values.model,
        temperature: Number(values.temperature)
      })
      setAiSettings(settings)
      aiSettingsForm.setFieldValue('apiKey', '')

      if (isAiSettingsReady(settings)) {
        setAiSettingsModalOpen(false)
      }

      message.success('AI 设置已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingAiSettings(false)
    }
  }

  useEffect(() => {
    setStatus(null)
    setSelectedPaths([])
    setCommitMessage('')
    setTagRecommendation(null)
    setMergeSource('')
    const target = getPreferredPushTarget(selectedRepository)
    setPushRemote(target.remote)
    setPushBranch(target.branch)

    if (selectedRepository) {
      refreshWorkspaceStatus()
      refreshReleaseTagRecommendation()
    }
  }, [selectedRepository?.id])

  async function runGitWrite(action: () => Promise<GitOperationResult>, successText: string): Promise<void> {
    setWorking(true)

    try {
      const result = await action()
      updateRepository(result.repository)
      setStatus(result.status)
      setSelectedPaths([])
      const target = getPreferredPushTarget(result.repository, result.status)
      setPushBranch(target.branch)
      setPushRemote(target.remote)

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

  async function pushSelectedBranch(): Promise<void> {
    if (!selectedRepository) {
      return
    }

    const remoteNames = resolveSelectedPushRemoteNames(pushRemote, selectedRepository.remotes)

    if (remoteNames.length === 0) {
      message.warning('请选择远端')
      return
    }

    await runGitWrite(
      () => window.forgeDesk.gitPush(selectedRepository.id, createGitPushInput(remoteNames, pushBranch)),
      remoteNames.length > 1 ? '分支已推送到所有远端' : '分支已推送'
    )
  }

  async function suggestConflictResolution(conflict: GitConflictFile): Promise<void> {
    if (!selectedRepository || !window.forgeDesk) {
      return
    }

    const settings = await refreshWorkspaceAiSettings()

    if (!isAiSettingsReady(settings)) {
      message.info('请先填写并启用 AI API Key')
      setAiSettingsModalOpen(true)
      return
    }

    setSuggestingFilePath(conflict.path)

    try {
      setPreviewSuggestion(await window.forgeDesk.suggestConflictResolution(selectedRepository.id, conflict.path))
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error(errorMessage)

      if (isAiCredentialErrorMessage(errorMessage)) {
        setAiSettingsModalOpen(true)
      }
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
  const pushTargets = status?.pushTargets ?? selectedRepository?.pushTargets ?? []
  const remoteOptions = createPushRemoteOptions(selectedRepository?.remotes ?? [], pushTargets)
  const currentBranch = getCurrentBranchName(selectedRepository, status)
  const commitReady = canCommitSelection(files, files.map((file) => file.path), commitMessage)
  const pushReady = Boolean(selectedRepository && pushBranch.trim() && canPushSelection(pushRemote, pushTargets))

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
          <Button
            icon={<SettingOutlined />}
            onClick={() => {
              setAiSettingsModalOpen(true)
              void refreshWorkspaceAiSettings()
            }}
          >
            AI 设置
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
            <Space wrap>
              <Space direction="vertical" size={8} className="git-operation-commit-form">
                <Tag color={currentBranch ? 'blue' : 'default'}>当前分支：{currentBranch || '未检测'}</Tag>
                <Space.Compact className="git-operation-compact">
                  <Input value={commitMessage} placeholder="feat: update workspace" onChange={(event) => setCommitMessage(event.target.value)} />
                  <Button
                    type="primary"
                    loading={working}
                    disabled={!selectedRepository || !commitReady}
                    onClick={() => {
                      const tagName = commitTag.trim()
                      return (
                        selectedRepository &&
                        runGitWrite(
                          () => window.forgeDesk.gitCommit(selectedRepository.id, { message: commitMessage, tagName: tagName || undefined }),
                          tagName ? `提交已创建，Tag ${tagName} 已设置` : '提交已创建'
                        )
                      )
                    }}
                  >
                    提交
                  </Button>
                </Space.Compact>
                <ReleaseTagPicker
                  value={commitTag}
                  recommendation={tagRecommendation}
                  loading={loadingTagRecommendation}
                  onChange={setCommitTag}
                />
              </Space>
              <Button icon={<UploadOutlined />} disabled={!selectedRepository} onClick={() => setReleaseModalOpen(true)}>
                发布版本
              </Button>
            </Space>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="git-operation-box">
            <Typography.Text strong>推送</Typography.Text>
            <Space.Compact className="git-operation-compact">
              <Select value={pushRemote} options={remoteOptions.length > 0 ? remoteOptions : [{ label: 'origin', value: 'origin' }]} onChange={setPushRemote} />
              <Input value={pushBranch} placeholder={currentBranch || 'main'} onChange={(event) => setPushBranch(event.target.value)} />
              <Button loading={working} disabled={!pushReady} onClick={pushSelectedBranch}>
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
      <Modal
        title="AI 设置"
        open={aiSettingsModalOpen}
        footer={null}
        width="min(760px, calc(100vw - 48px))"
        onCancel={() => setAiSettingsModalOpen(false)}
      >
        <AiSettingsSection
          form={aiSettingsForm}
          settings={aiSettings}
          loading={loadingAiSettings}
          saving={savingAiSettings}
          onRefresh={refreshWorkspaceAiSettings}
          onSave={saveWorkspaceAiSettings}
        />
      </Modal>
      <RepositoryReleaseModal
        open={releaseModalOpen}
        repositories={repositories}
        initialRepositoryId={selectedRepository?.id}
        onClose={() => setReleaseModalOpen(false)}
        onChanged={async (repository) => {
          if (repository) {
            updateRepository(repository)
          }
          await refreshWorkspaceStatus()
        }}
      />
    </div>
  )
}

function formatReleaseTaskTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatReleaseTaskToastError(task: RepositoryReleasePublishTask): string {
  const message = task.error || task.stderr || '请查看发布日志'
  return message.length > 160 ? `${message.slice(0, 160)}...` : message
}

function getReleaseTaskPlatformLabel(provider: ReleasePublishProvider): string {
  if (provider === 'codemagic') {
    return 'Codemagic'
  }

  if (provider === 'nextjs-pm2') {
    return 'Next.js PM2'
  }

  return 'GitHub Releases'
}

function getReleaseTaskDetailLabel(provider: ReleasePublishProvider): string {
  if (provider === 'codemagic') {
    return 'Workflow'
  }

  if (provider === 'nextjs-pm2') {
    return 'PM2 应用'
  }

  return '脚本'
}

function getReleaseTaskDetailValue(task: RepositoryReleasePublishTask): string {
  if (task.provider === 'codemagic' || task.provider === 'nextjs-pm2') {
    return task.externalWorkflow || '-'
  }

  return task.selectedScript || task.plan?.selectedScript || '-'
}

function getReleaseTaskCancelDescription(task: RepositoryReleasePublishTask): string {
  if (task.provider === 'codemagic') {
    return '可能已经创建 Tag 或远程构建产物，重试前需要检查 Codemagic。'
  }

  if (task.provider === 'nextjs-pm2') {
    return '可能已经创建 Tag、上传包或远端 release 目录，重试前需要检查服务器和 PM2。'
  }

  return '可能已经创建 Tag、Release 或上传了部分文件，重试前需要检查 GitHub Releases。'
}

function ReleasePublishTaskDock(): JSX.Element | null {
  const { updateRepository } = useForgeDeskStore()
  const [tasks, setTasks] = useState<RepositoryReleasePublishTask[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState('')
  const [cancellingTaskId, setCancellingTaskId] = useState('')
  const activeTaskIdRef = useRef('')
  const initializedRef = useRef(false)
  const notifiedTaskIdsRef = useRef<Set<string>>(new Set())
  const updatedRepositoryTaskIdsRef = useRef<Set<string>>(new Set())
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? tasks[0] ?? null
  const activeTaskView = createReleasePublishTaskView({ task: activeTask })
  const runningTaskCount = tasks.filter((task) => task.status === 'running').length

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId
  }, [activeTaskId])

  useEffect(() => {
    if (!window.forgeDesk) {
      return
    }

    let cancelled = false

    async function refreshReleaseTasks(): Promise<void> {
      const nextTasks = await window.forgeDesk.listRepositoryReleasePublishTasks()

      if (cancelled) {
        return
      }

      setTasks(nextTasks)

      if (!activeTaskIdRef.current && nextTasks[0]) {
        setActiveTaskId(nextTasks[0].id)
      }

      for (const task of nextTasks) {
        if (task.status === 'running') {
          continue
        }

        if (task.repository && !updatedRepositoryTaskIdsRef.current.has(task.id)) {
          updatedRepositoryTaskIdsRef.current.add(task.id)
          updateRepository(task.repository)
        }

        if (!initializedRef.current || notifiedTaskIdsRef.current.has(task.id)) {
          notifiedTaskIdsRef.current.add(task.id)
          continue
        }

        notifiedTaskIdsRef.current.add(task.id)

        if (task.status === 'succeeded') {
          message.success(`${task.tagName} 发布流程已完成`)
        } else if (task.status === 'cancelled') {
          message.warning(`${task.tagName} 发布任务已终止`)
        } else {
          message.error(`${task.tagName} 发布失败：${formatReleaseTaskToastError(task)}`)
        }
      }

      initializedRef.current = true
    }

    refreshReleaseTasks().catch((error) => message.error(getErrorMessage(error)))
    const intervalId = window.setInterval(() => {
      refreshReleaseTasks().catch((error) => message.error(getErrorMessage(error)))
    }, 2000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [updateRepository])

  async function cancelReleaseTask(task: RepositoryReleasePublishTask): Promise<void> {
    if (!window.forgeDesk || task.status !== 'running') {
      return
    }

    setCancellingTaskId(task.id)

    try {
      const nextTask = await window.forgeDesk.cancelRepositoryReleasePublishTask(task.id)
      setTasks((current) => current.map((item) => (item.id === nextTask.id ? nextTask : item)))
      message.warning(`${nextTask.tagName} 发布任务已请求终止`)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setCancellingTaskId('')
    }
  }

  if (tasks.length === 0) {
    return null
  }

  return (
    <>
      <div className="release-task-dock">
        <Badge count={runningTaskCount} size="small">
          <Button type={runningTaskCount > 0 ? 'primary' : 'default'} icon={<UploadOutlined />} onClick={() => setDrawerOpen(true)}>
            发布任务
          </Button>
        </Badge>
      </div>
      <Drawer
        title="发布任务"
        open={drawerOpen}
        width="min(960px, calc(100vw - 48px))"
        onClose={() => setDrawerOpen(false)}
      >
        <div className="release-task-drawer">
          <div className="release-task-list">
            {tasks.map((task) => {
              const taskView = createReleasePublishTaskView({ task })
              return (
                <button
                  type="button"
                  key={task.id}
                  className={['release-task-item', activeTask?.id === task.id ? 'is-active' : ''].join(' ')}
                  onClick={() => setActiveTaskId(task.id)}
                >
                  <span className="release-task-item-main">
                    <Typography.Text strong>{taskView.title}</Typography.Text>
                    <Typography.Text type="secondary">{formatReleaseTaskTime(task.startedAt)}</Typography.Text>
                  </span>
                  <Tag color={taskView.statusColor}>{taskView.statusLabel}</Tag>
                </button>
              )
            })}
          </div>
          <div className="release-task-detail">
            {activeTask ? (
              <>
                <div className="release-task-detail-header">
                  <Space wrap>
                    <Typography.Title level={4}>{activeTaskView.title}</Typography.Title>
                    <Tag color={activeTaskView.statusColor}>{activeTaskView.statusLabel}</Tag>
                  </Space>
                  <Space>
                    <Typography.Text type="secondary">更新：{formatReleaseTaskTime(activeTask.updatedAt)}</Typography.Text>
                    {activeTaskView.canCancel ? (
                      <Popconfirm
                        title="终止这个发布任务？"
                        description={getReleaseTaskCancelDescription(activeTask)}
                        okText="终止"
                        cancelText="取消"
                        onConfirm={() => cancelReleaseTask(activeTask)}
                      >
                        <Button danger size="small" loading={cancellingTaskId === activeTask.id}>
                          终止发布
                        </Button>
                      </Popconfirm>
                    ) : null}
                  </Space>
                </div>
                <Alert type={activeTask.status === 'failed' ? 'error' : activeTask.status === 'cancelled' ? 'warning' : 'info'} showIcon message={activeTaskView.hint} />
                <Descriptions size="small" bordered column={2}>
                  <Descriptions.Item label="仓库">{activeTask.repositoryName}</Descriptions.Item>
                  <Descriptions.Item label="Tag">{activeTask.tagName}</Descriptions.Item>
                  <Descriptions.Item label="版本">{activeTask.version}</Descriptions.Item>
                  <Descriptions.Item label="平台">{getReleaseTaskPlatformLabel(activeTask.provider)}</Descriptions.Item>
                  <Descriptions.Item label="当前步骤">{activeTaskView.phase}</Descriptions.Item>
                  <Descriptions.Item label={getReleaseTaskDetailLabel(activeTask.provider)}>{getReleaseTaskDetailValue(activeTask)}</Descriptions.Item>
                  {activeTask.externalBuildId ? <Descriptions.Item label="Build ID">{activeTask.externalBuildId}</Descriptions.Item> : null}
                  {activeTask.externalStatus ? <Descriptions.Item label="远程状态">{activeTask.externalStatus}</Descriptions.Item> : null}
                  <Descriptions.Item label="开始时间">{formatReleaseTaskTime(activeTask.startedAt)}</Descriptions.Item>
                  <Descriptions.Item label="最后输出">{formatReleaseTaskTime(activeTask.lastOutputAt)}</Descriptions.Item>
                  <Descriptions.Item label="结束时间">{formatReleaseTaskTime(activeTask.finishedAt)}</Descriptions.Item>
                  <Descriptions.Item label="退出码">{activeTask.exitCode ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="标题">{activeTask.releaseTitle || '-'}</Descriptions.Item>
                </Descriptions>
                <Progress percent={activeTaskView.progressPercent} status={activeTask.status === 'failed' || activeTask.status === 'cancelled' ? 'exception' : activeTask.status === 'succeeded' ? 'success' : 'active'} />
                {activeTask.externalBuildUrl ? (
                  <Button size="small" icon={<LinkOutlined />} href={activeTask.externalBuildUrl} target="_blank" rel="noreferrer">
                    打开 Codemagic Build
                  </Button>
                ) : null}
                {activeTask.artifacts?.length ? (
                  <div className="release-artifact-list">
                    {activeTask.artifacts.map((artifact) => (
                      <div key={`${activeTask.id}-${artifact.name}-${artifact.downloadUrl}`} className="release-artifact-item">
                        <Space direction="vertical" size={0}>
                          <Typography.Text strong>{artifact.name}</Typography.Text>
                          <Typography.Text type="secondary">
                            {[artifact.type, artifact.versionName, artifact.versionCode ? `build ${artifact.versionCode}` : '', formatFileSize(artifact.sizeInBytes)]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography.Text>
                        </Space>
                        {artifact.downloadUrl ? (
                          <Button size="small" icon={<DownloadOutlined />} href={artifact.downloadUrl} target="_blank" rel="noreferrer">
                            下载
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {activeTask.error ? <Alert type="error" showIcon message={activeTask.error} /> : null}
                <div className="release-publish-log release-task-log">
                  <Typography.Text copyable>{activeTaskView.log}</Typography.Text>
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无发布任务" />
            )}
          </div>
        </div>
      </Drawer>
    </>
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
    'diff --stat'
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
        description="这个命令台用于安全查看仓库状态；提交和合并请使用项目页右上角按钮。"
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
  onSummaryChanged,
  onBranchTagsChanged
}: {
  project: Project
  repositories: Repository[]
  contributors: ContributorSummary[]
  onSummaryChanged: () => void | Promise<void>
  onBranchTagsChanged: () => void
}): JSX.Element {
  const { updateProject } = useForgeDeskStore()
  const [form] = Form.useForm<ProjectSettingsForm>()
  const [savingProject, setSavingProject] = useState(false)
  const [branchTagRefreshToken, setBranchTagRefreshToken] = useState(0)
  const [settingsView, setSettingsView] = useState(createInitialProjectSettingsView)

  function notifyBranchTagsChanged(): void {
    setBranchTagRefreshToken((current) => current + 1)
    onBranchTagsChanged()
  }

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

  const moduleIcons: Record<ProjectSettingsModuleKey, JSX.Element> = {
    basic: <SettingOutlined />,
    people: <TeamOutlined />,
    branches: <BranchesOutlined />,
    repositories: <GithubOutlined />,
    remotes: <BranchesOutlined />,
    services: <ThunderboltOutlined />,
    plane: <LinkOutlined />,
    commands: <FileTextOutlined />
  }
  const activeModule = PROJECT_SETTINGS_MODULES.find((module) => module.key === settingsView.activeModuleKey) ?? PROJECT_SETTINGS_MODULES[0]

  function renderSettingsModuleContent(moduleKey: ProjectSettingsModuleKey): JSX.Element {
    switch (moduleKey) {
      case 'basic':
        return (
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
        )
      case 'people':
        return <ProjectPeopleMapping project={project} contributors={contributors} onChanged={onSummaryChanged} />
      case 'branches':
        return <ProjectBranchTagSettings project={project} onChanged={notifyBranchTagsChanged} />
      case 'repositories':
        return repositories.length > 0 ? (
          <RepositoryTable repositories={repositories} branchTagRefreshToken={branchTagRefreshToken} />
        ) : (
          <div className="panel empty-project-panel">
            <Empty description="这个项目下还没有仓库" />
            <Typography.Text type="secondary">创建项目时扫描到的 Git 仓库会显示在这里；修改项目目录不会自动重新扫描。</Typography.Text>
          </div>
        )
      case 'remotes':
        return <RepositoryRemoteManager repositories={repositories} />
      case 'services':
        return <ProjectServiceSettings project={project} repositories={repositories} />
      case 'plane':
        return <ProjectPlaneSettings project={project} />
      case 'commands':
        return <GitCommandConsole repositories={repositories} />
    }
  }

  if (settingsView.mode === 'list') {
    return (
      <div className="project-settings-module-list">
        {PROJECT_SETTINGS_MODULES.map((module) => (
          <button className="project-settings-entry-card" key={module.key} type="button" onClick={() => setSettingsView(openProjectSettingsModule(module.key))}>
            <span className="project-settings-entry-icon">{moduleIcons[module.key]}</span>
            <span className="project-settings-entry-copy">
              <Typography.Text strong>{module.title}</Typography.Text>
              <Typography.Text type="secondary">{module.description}</Typography.Text>
            </span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <Space direction="vertical" size={18} className="project-settings-panel">
      <div className="project-settings-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => setSettingsView(closeProjectSettingsModule())}>
          返回设置列表
        </Button>
        <Space direction="vertical" size={2}>
          <Typography.Title level={4}>
            {moduleIcons[activeModule.key]} {activeModule.title}
          </Typography.Title>
          <Typography.Text type="secondary">{activeModule.description}</Typography.Text>
        </Space>
      </div>
      <div className="project-settings-section">{renderSettingsModuleContent(activeModule.key)}</div>
    </Space>
  )
}

function ProjectPlaneSettings({ project }: { project: Project }): JSX.Element {
  const [form] = Form.useForm<PlaneBindingForm>()
  const [settings, setSettings] = useState<PlaneSettings | null>(null)
  const [binding, setBinding] = useState<PlaneProjectBinding | null>(null)
  const [planeProjects, setPlaneProjects] = useState<PlaneProject[]>([])
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [loadingBinding, setLoadingBinding] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [savingBinding, setSavingBinding] = useState(false)
  const [deletingBinding, setDeletingBinding] = useState(false)
  const workspaceSlug = Form.useWatch('workspaceSlug', form)
  const selectedPlaneProjectId = Form.useWatch('planeProjectId', form)
  const selectedPlaneProject = planeProjects.find((item) => item.id === selectedPlaneProjectId)

  async function refreshPlaneSettings(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoadingSettings(true)

    try {
      setSettings(await window.forgeDesk.getPlaneSettings())
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingSettings(false)
    }
  }

  async function refreshBinding(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoadingBinding(true)

    try {
      const nextBinding = await window.forgeDesk.getProjectPlaneBinding(project.id)
      setBinding(nextBinding)
      form.setFieldsValue({
        workspaceSlug: nextBinding?.workspaceSlug ?? '',
        planeProjectId: nextBinding?.planeProjectId ?? ''
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingBinding(false)
    }
  }

  async function loadPlaneProjects(): Promise<void> {
    const slug = String(workspaceSlug ?? '').trim()

    if (!slug) {
      form.setFields([{ name: 'workspaceSlug', errors: ['请输入 Plane workspace slug'] }])
      return
    }

    if (!window.forgeDesk) {
      return
    }

    setLoadingProjects(true)

    try {
      const projects = await window.forgeDesk.listPlaneProjects(slug)
      setPlaneProjects(projects)

      if (projects.length === 0) {
        message.info('这个 workspace 下没有可绑定的 Plane 项目')
      } else if (!projects.some((item) => item.id === form.getFieldValue('planeProjectId'))) {
        form.setFieldValue('planeProjectId', projects[0].id)
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingProjects(false)
    }
  }

  async function saveBinding(): Promise<void> {
    const values = await form.validateFields()
    const selected = planeProjects.find((item) => item.id === values.planeProjectId)
    const fallbackName = selected?.name ?? binding?.planeProjectName ?? ''
    const fallbackIdentifier = selected?.identifier ?? binding?.planeProjectIdentifier ?? ''

    if (!window.forgeDesk) {
      return
    }

    setSavingBinding(true)

    try {
      const nextBinding = await window.forgeDesk.saveProjectPlaneBinding({
        projectId: project.id,
        workspaceSlug: values.workspaceSlug.trim(),
        planeProjectId: values.planeProjectId,
        planeProjectName: fallbackName,
        planeProjectIdentifier: fallbackIdentifier
      })
      setBinding(nextBinding)
      message.success('Plane 项目绑定已保存')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingBinding(false)
    }
  }

  function confirmDeleteBinding(): void {
    Modal.confirm({
      title: '解除 Plane 绑定？',
      content: '只会删除 ForgeDesk 中的绑定记录，不会修改 Plane 项目。',
      okText: '解除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        if (!window.forgeDesk) {
          return
        }

        setDeletingBinding(true)

        try {
          await window.forgeDesk.deleteProjectPlaneBinding(project.id)
          setBinding(null)
          setPlaneProjects([])
          form.setFieldsValue({ planeProjectId: '' })
          message.success('Plane 绑定已解除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setDeletingBinding(false)
        }
      }
    })
  }

  async function openPlaneProject(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    await window.forgeDesk.openPlane(project.id)
  }

  useEffect(() => {
    refreshPlaneSettings()
    refreshBinding()
  }, [project.id])

  useEffect(() => {
    if (binding?.workspaceSlug) {
      loadPlaneProjects()
    }
  }, [binding?.workspaceSlug, binding?.planeProjectId])

  const projectOptions = planeProjects.map((item) => ({
    label: `${item.identifier ? `${item.identifier} · ` : ''}${item.name}`,
    value: item.id
  }))

  return (
    <div className="panel project-plane-settings">
      <div className="panel-title">
        <Space direction="vertical" size={2}>
          <Typography.Title level={4}>Plane 绑定</Typography.Title>
          <Typography.Text type="secondary">把当前 ForgeDesk 项目和一个 Plane 项目关联起来。</Typography.Text>
        </Space>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loadingSettings || loadingBinding} onClick={() => {
            refreshPlaneSettings()
            refreshBinding()
          }}>
            重新读取
          </Button>
          <Button icon={<LinkOutlined />} disabled={!binding} onClick={openPlaneProject}>
            打开 Plane
          </Button>
        </Space>
      </div>

      <Alert
        type={isPlaneSettingsReady(settings) ? 'info' : 'warning'}
        showIcon
        message={isPlaneSettingsReady(settings) ? '选择 workspace 和 Plane 项目后保存绑定' : '请先在全局设置里配置 Plane API Token'}
        description={
          binding
            ? `当前绑定：${binding.workspaceSlug} / ${binding.planeProjectIdentifier ? `${binding.planeProjectIdentifier} · ` : ''}${binding.planeProjectName || binding.planeProjectId}`
            : 'Plane 内容会显示在项目详情的 Plane 标签页。'
        }
      />

      <Form form={form} layout="vertical" className="project-settings-form">
        <Row gutter={[16, 0]}>
          <Col xs={24} md={10}>
            <Form.Item name="workspaceSlug" label="Workspace slug" rules={[{ required: true, message: '请输入 Plane workspace slug' }]}>
              <Input placeholder="例如 forgedesk" />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item label="项目列表">
              <Button block icon={<ReloadOutlined />} loading={loadingProjects} onClick={loadPlaneProjects}>
                拉取
              </Button>
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name="planeProjectId" label="Plane 项目" rules={[{ required: true, message: '请选择 Plane 项目' }]}>
              <Select
                showSearch
                placeholder="先拉取项目列表"
                options={projectOptions}
                optionFilterProp="label"
                loading={loadingProjects}
                notFoundContent={loadingProjects ? <Spin size="small" /> : null}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {selectedPlaneProject && (
        <Descriptions column={1} size="small" className="setup-description">
          <Descriptions.Item label="Plane 项目">{selectedPlaneProject.name}</Descriptions.Item>
          <Descriptions.Item label="Identifier">{selectedPlaneProject.identifier || '-'}</Descriptions.Item>
          <Descriptions.Item label="Cycles / Modules">
            {formatNumber(selectedPlaneProject.totalCycles)} / {formatNumber(selectedPlaneProject.totalModules)}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Space wrap>
        <Button type="primary" icon={<SaveOutlined />} loading={savingBinding} onClick={saveBinding}>
          保存绑定
        </Button>
        <Button danger icon={<DeleteOutlined />} disabled={!binding} loading={deletingBinding} onClick={confirmDeleteBinding}>
          解除绑定
        </Button>
      </Space>
    </div>
  )
}

function ProjectCard({
  project,
  selected,
  repositories,
  deleting,
  onSelect,
  onDelete
}: {
  project: Project
  selected: boolean
  repositories: Repository[]
  deleting: boolean
  onSelect: () => void
  onDelete: () => void
}): JSX.Element {
  const changedRepositories = repositories.filter((repository) => repository.hasChanges).length
  const aheadRepositories = repositories.filter((repository) => repository.ahead > 0).length
  const remoteCount = repositories.reduce((sum, repository) => sum + getRepositoryRemoteCount(repository), 0)
  const remoteAlignmentStats = getProjectRemoteAlignmentStats(repositories)

  return (
    <div
      className={`project-card${selected ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="project-card-heading">
        <Typography.Title level={4}>{project.name}</Typography.Title>
        <Space size={6}>
          <Tag color={selected ? 'blue' : 'default'}>{selected ? '当前项目' : '项目'}</Tag>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deleting}
            aria-label={`删除项目 ${project.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          />
        </Space>
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
    </div>
  )
}

type ProjectGitListAction = 'fetch' | 'push' | 'merge'
type ProjectGitTaskStatus = 'running' | 'success' | 'failed' | 'skipped'

type ProjectGitRepositoryTaskResult = {
  repositoryId: string
  repositoryName: string
  ok: boolean
  message: string
  stdout?: string
  stderr?: string
}

type ProjectGitTaskLog = {
  id: string
  projectId: string
  projectName: string
  action: ProjectGitListAction
  status: ProjectGitTaskStatus
  startedAt: string
  finishedAt?: string
  summary: string
  repositoryResults: ProjectGitRepositoryTaskResult[]
}

function getProjectGitTaskKey(projectId: string, action: ProjectGitListAction): string {
  return `${projectId}:${action}`
}

function getProjectGitActionLabel(action: ProjectGitListAction): string {
  if (action === 'fetch') {
    return 'Fetch'
  }

  if (action === 'push') {
    return '推送'
  }

  return '合并'
}

function getProjectGitTaskStatusMeta(status: ProjectGitTaskStatus): { label: string; color: string; badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning' } {
  if (status === 'running') {
    return { label: '执行中', color: 'blue', badgeStatus: 'processing' }
  }

  if (status === 'success') {
    return { label: '成功', color: 'green', badgeStatus: 'success' }
  }

  if (status === 'skipped') {
    return { label: '跳过', color: 'default', badgeStatus: 'default' }
  }

  return { label: '失败', color: 'red', badgeStatus: 'error' }
}

function formatGitTaskOutput(value?: string): string {
  const text = value?.trim() ?? ''

  if (!text) {
    return ''
  }

  return text.length > 220 ? `${text.slice(0, 220)}...` : text
}

function groupPushTargetsByBranch(pushTargets: Repository['pushTargets']): Array<{ branch: string; remotes: string[] }> {
  const grouped = new Map<string, Set<string>>()

  getPushableTargets(pushTargets).forEach((target) => {
    const branch = target.branch.trim()
    const remote = target.remote.trim()

    if (!branch || !remote) {
      return
    }

    if (!grouped.has(branch)) {
      grouped.set(branch, new Set())
    }

    grouped.get(branch)?.add(remote)
  })

  return Array.from(grouped.entries()).map(([branch, remotes]) => ({ branch, remotes: Array.from(remotes) }))
}

function createProjectGitTaskLogId(projectId: string, action: ProjectGitListAction): string {
  return `${projectId}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ProjectLogTreePanel({
  repositories,
  repositoryId,
  view,
  refreshToken,
  branchTagRefreshToken,
  onCommitCountChange,
  onRepositoryChange
}: {
  repositories: Repository[]
  repositoryId: string
  view: RepositoryLogTreeView
  refreshToken: number
  branchTagRefreshToken: number
  onCommitCountChange: (repositoryId: string, commitCount: number) => void
  onRepositoryChange: (repositoryId: string) => void
}): JSX.Element {
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
  const title = view === 'alignment' ? '多端对齐' : 'Log 树'
  const description = view === 'alignment' ? '查看当前仓库所有远端之间的分支和提交对齐状态。' : '按仓库查看分支、提交图谱和提交文件。'

  if (repositories.length === 0) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="这个项目下还没有仓库，创建项目时扫描到的 Git 仓库会显示在这里" />
      </div>
    )
  }

  return (
    <Space direction="vertical" size={16} className="project-log-tree">
      <div className="project-log-toolbar">
        <div>
          <Typography.Title level={4}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
      </div>
      <RepositoryLogTree
        repository={selectedRepository}
        repositories={repositories}
        selectedRepositoryId={selectedRepository?.id}
        view={view}
        showSummary={false}
        refreshToken={refreshToken}
        emptyDescription="请选择要查看的仓库"
        branchTagRefreshToken={branchTagRefreshToken}
        onCommitCountChange={onCommitCountChange}
        onRepositoryChange={onRepositoryChange}
      />
    </Space>
  )
}

function ProjectServiceMonitorPanel({ projectId }: { projectId: string }): JSX.Element {
  const [services, setServices] = useState<ProjectService[]>([])
  const [history, setHistory] = useState<ServiceMonitorCheck[]>([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [logDrawer, setLogDrawer] = useState<{ service: ProjectService; environment: ProjectServiceEnvironment } | null>(null)
  const [logLines, setLogLines] = useState<ServiceEnvironmentLogLine[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState('')

  async function loadMonitorData(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoading(true)

    try {
      const [nextServices, nextHistory] = await Promise.all([
        window.forgeDesk.listProjectServices(projectId),
        window.forgeDesk.listServiceMonitorHistory(projectId)
      ])
      setServices(nextServices)
      setHistory(nextHistory)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonitorData().catch((error) => message.error(getErrorMessage(error)))
  }, [projectId])

  async function checkServices(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setChecking(true)

    try {
      setServices(await window.forgeDesk.checkProjectServices(projectId))
      setHistory(await window.forgeDesk.listServiceMonitorHistory(projectId))
      message.success('服务监控已刷新')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  async function openEnvironmentLogs(service: ProjectService, environment: ProjectServiceEnvironment): Promise<void> {
    setLogDrawer({ service, environment })
    setLogLines([])
    setLogError('')

    if (!window.forgeDesk) {
      return
    }

    setLogLoading(true)

    try {
      setLogLines(await window.forgeDesk.listServiceEnvironmentLogs(service.id, environment.name))
    } catch (error) {
      setLogError(getErrorMessage(error))
    } finally {
      setLogLoading(false)
    }
  }

  const stats = getProjectServiceStats(services)
  const serviceSections = createServiceProviderSections(services)
  const monitorableDomainRows = services.flatMap((service) =>
    getMonitorableServiceDomains(service).map((domain) => ({
      key: domain.id,
      service,
      domain,
      environment: service.environments.find((item) => item.id === domain.environmentId || item.name === domain.environmentName) ?? null
    }))
  )
  const monitorableDomainIds = new Set(monitorableDomainRows.map((row) => row.domain.id))
  const historyRows = history.filter((item) => monitorableDomainIds.has(item.domainId)).reverse()
  const historyOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 20, top: 28, bottom: 42 },
    xAxis: {
      type: 'category',
      data: historyRows.map((item) => (item.checkedAt ? new Date(item.checkedAt).toLocaleString() : ''))
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '响应时间 ms',
        type: 'line',
        smooth: true,
        data: historyRows.map((item) => item.responseMs)
      }
    ]
  }
  const environmentColumns = (service: ProjectService): ColumnsType<ProjectServiceEnvironment> => [
    {
      title: '环境',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (name, environment) => (
        <Space direction="vertical" size={2}>
          <Tag color={environment.deploymentStatus === 'SUCCESS' || environment.deploymentStatus === 'READY' ? 'green' : 'default'}>{name}</Tag>
          <Typography.Text type="secondary">{environment.deploymentStatus || '未同步部署'}</Typography.Text>
        </Space>
      )
    },
    { title: '最新提交', key: 'commit', width: 120, render: (_, environment) => formatShortCommit(environment.latestCommit) },
    {
      title: '部署 URL',
      key: 'deploymentUrl',
      render: (_, environment) =>
        environment.latestDeploymentUrl ? (
          <Typography.Text className="table-text" ellipsis={{ tooltip: environment.latestDeploymentUrl }}>
            {environment.latestDeploymentUrl}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_, environment) => (
        <Button size="small" icon={<FileTextOutlined />} disabled={!environment.latestDeploymentId} onClick={() => openEnvironmentLogs(service, environment)}>
          日志
        </Button>
      )
    }
  ]
  const domainColumns: ColumnsType<ProjectServiceDomain> = [
    {
      title: '域名',
      key: 'domain',
      render: (_, domain) => (
        <Space direction="vertical" size={2}>
          <TableText value={domain.domain} />
          <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: domain.url }}>
            {domain.url}
          </Typography.Text>
        </Space>
      )
    },
    { title: '环境', key: 'environment', width: 120, render: (_, domain) => domain.environmentName || '-' },
    {
      title: '状态',
      key: 'status',
      width: 130,
      render: (_, domain) => {
        const meta = getServiceMonitorStatusMeta(domain.lastStatus)
        return <Badge status={meta.badgeStatus} text={meta.label} />
      }
    },
    { title: 'HTTP', key: 'statusCode', width: 90, render: (_, domain) => domain.lastStatusCode || '-' },
    { title: '响应时间', key: 'responseMs', width: 110, render: (_, domain) => (domain.lastResponseMs ? `${domain.lastResponseMs} ms` : '-') },
    {
      title: '最后检查',
      key: 'lastCheckedAt',
      width: 190,
      render: (_, domain) => (domain.lastCheckedAt ? new Date(domain.lastCheckedAt).toLocaleString() : '-')
    },
    {
      title: '错误',
      key: 'lastError',
      width: 180,
      render: (_, domain) =>
        domain.lastError ? (
          <Typography.Text type="danger" className="table-text" ellipsis={{ tooltip: domain.lastError }}>
            {domain.lastError}
          </Typography.Text>
        ) : (
          '-'
        )
    }
  ]

  return (
    <Space direction="vertical" size={16} className="service-monitor-panel">
      <div className="project-log-toolbar">
        <div>
          <Typography.Title level={4}>服务监控</Typography.Title>
        </div>
        <Button icon={<ReloadOutlined />} loading={checking} onClick={checkServices}>
          刷新监控
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="服务数" value={stats.serviceCount} /></div></Col>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="自定义域名" value={stats.domainCount} /></div></Col>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="在线" value={stats.online} /></div></Col>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="异常 / 离线" value={`${stats.degraded} / ${stats.offline}`} /></div></Col>
      </Row>
      {services.length > 0 ? (
        <div className="service-provider-section-list">
          {serviceSections.map((section) => (
            <div key={section.provider} className="service-provider-section">
              <div className="service-provider-section-heading">
                <Space size={8} wrap>
                  <Tag>{section.label}</Tag>
                  <Typography.Text strong>{section.label} 服务监控</Typography.Text>
                  <Typography.Text type="secondary">{section.items.length} 个服务</Typography.Text>
                </Space>
              </div>
              {section.items.length > 0 ? (
                <Collapse
                  className="service-monitor-services"
                  items={section.items.map((service) => {
                    const serviceDomains = getMonitorableServiceDomains(service)
                    const statusSummary = getProjectServiceStats([{ ...service, domains: serviceDomains }])

                    return {
                      key: service.id,
                      label: (
                        <div className="service-monitor-service-header">
                          <Space wrap size={8}>
                            <Typography.Text strong>{service.name}</Typography.Text>
                            <Tag color={service.enabled ? 'green' : 'default'}>{service.enabled ? '启用' : '停用'}</Tag>
                            <Typography.Text type="secondary">{service.environments.length} 环境</Typography.Text>
                            <Typography.Text type="secondary">{serviceDomains.length} 自定义域名</Typography.Text>
                            <Typography.Text type={statusSummary.offline || statusSummary.degraded ? 'danger' : 'secondary'}>
                              在线 {statusSummary.online} / 异常 {statusSummary.degraded} / 离线 {statusSummary.offline}
                            </Typography.Text>
                          </Space>
                        </div>
                      ),
                      children: (
                        <Space direction="vertical" size={12} className="service-monitor-service-body">
                          <Table
                            rowKey="id"
                            size="small"
                            columns={environmentColumns(service)}
                            dataSource={service.environments}
                            pagination={false}
                            scroll={{ x: 720 }}
                            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无环境数据" /> }}
                          />
                          <Table
                            rowKey="id"
                            size="small"
                            columns={domainColumns}
                            dataSource={serviceDomains}
                            pagination={false}
                            scroll={{ x: 920 }}
                            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无自定义域名" /> }}
                          />
                        </Space>
                      )
                    }
                  })}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`当前项目还没有绑定 ${section.label} 服务`} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <Spin spinning={loading}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前项目还没有绑定服务" />
        </Spin>
      )}
      <div className="chart-panel">
        <Typography.Title level={4}>30 天响应时间</Typography.Title>
        {history.length > 0 && monitorableDomainRows.length > 0 ? <ReactECharts option={historyOption} style={{ height: 280 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无监控历史" />}
      </div>
      <Drawer
        title={logDrawer ? `${logDrawer.service.name} / ${logDrawer.environment.name} 部署日志` : '部署日志'}
        open={Boolean(logDrawer)}
        width={680}
        onClose={() => {
          setLogDrawer(null)
          setLogLines([])
          setLogError('')
        }}
      >
        <Spin spinning={logLoading}>
          {logError ? <Alert type="warning" showIcon message="日志暂不可用" description={logError} /> : null}
          {!logError && logLines.length === 0 && !logLoading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" /> : null}
          <Space direction="vertical" size={8} className="service-log-lines">
            {logLines.map((line, index) => (
              <div key={`${line.timestamp}-${index}`} className="service-log-line">
                <Typography.Text type="secondary">{line.timestamp ? new Date(line.timestamp).toLocaleString() : '-'}</Typography.Text>
                <Tag>{line.level || 'log'}</Tag>
                <Typography.Text>{line.message || '-'}</Typography.Text>
              </div>
            ))}
          </Space>
        </Spin>
      </Drawer>
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
    { title: '多端对齐', key: 'remoteAlignment', width: 190, render: (_, repository) => <RemoteAlignmentBadge alignment={repository.remoteAlignment} /> },
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

function ProjectOverview({
  onCreateProject,
  onOpenSettings,
  onOpenTerminalRequest
}: {
  onCreateProject: () => void
  onOpenSettings: () => void
  onOpenTerminalRequest: (request: Omit<TerminalOpenRequest, 'requestId'>) => void
}): JSX.Element {
  const { projects, repositories, selectedProjectId, summaries, deleteProject, setProjectSummary, setSelectedProjectId, updateRepository } = useForgeDeskStore()
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)
  const [projectDetailTab, setProjectDetailTab] = useState<ProjectDetailTabKey>(DEFAULT_PROJECT_DETAIL_TAB)
  const [terminalOpenRequest, setTerminalOpenRequest] = useState<TerminalOpenRequest | null>(null)
  const [analysisGitError, setAnalysisGitError] = useState<GitErrorGuidance | null>(null)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [releaseModalOpen, setReleaseModalOpen] = useState(false)
  const [projectSettingsDrawerOpen, setProjectSettingsDrawerOpen] = useState(false)
  const [projectGitRepositoryId, setProjectGitRepositoryId] = useState('')
  const [syncingProjectRepositoryId, setSyncingProjectRepositoryId] = useState<string | null>(null)
  const [switchingProjectRepositoryId, setSwitchingProjectRepositoryId] = useState<string | null>(null)
  const [projectGitRefreshToken, setProjectGitRefreshToken] = useState(0)
  const [projectRepositoryCommitCounts, setProjectRepositoryCommitCounts] = useState<Record<string, number>>({})
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [branchTagRefreshToken, setBranchTagRefreshToken] = useState(0)
  const [projectServiceCounts, setProjectServiceCounts] = useState<Record<string, number>>({})
  const [projectPlaneAvailability, setProjectPlaneAvailability] = useState<Record<string, boolean>>({})
  const [selectedProjectRowIds, setSelectedProjectRowIds] = useState<string[]>([])
  const [runningProjectGitTaskKeys, setRunningProjectGitTaskKeys] = useState<string[]>([])
  const [projectGitTaskLogs, setProjectGitTaskLogs] = useState<ProjectGitTaskLog[]>([])
  const [projectGitTaskDrawerOpen, setProjectGitTaskDrawerOpen] = useState(false)
  const [listCommitProjectId, setListCommitProjectId] = useState<string | null>(null)
  const [listMergeProjectId, setListMergeProjectId] = useState<string | null>(null)
  const [rangePreset, setRangePreset] = useState('30')
  const [range, setRange] = useState(createPresetRange(30))
  const terminalRequestSeqRef = useRef(0)
  const projectWorkspaceStatusRefreshRef = useRef(false)
  const projectRepositoriesRef = useRef<Repository[]>([])
  const selectedProject = projects.find((project) => project.id === detailProjectId) ?? null
  const selectedProjectRows = projects.filter((project) => selectedProjectRowIds.includes(project.id))
  const listCommitProject = projects.find((project) => project.id === listCommitProjectId) ?? null
  const listCommitProjectRepositories = listCommitProject ? repositories.filter((repository) => repository.projectId === listCommitProject.id) : []
  const listCommitInitialRepository = listCommitProjectRepositories.find((repository) => repository.hasChanges) ?? listCommitProjectRepositories[0] ?? null
  const listMergeProject = projects.find((project) => project.id === listMergeProjectId) ?? null
  const listMergeProjectRepositories = listMergeProject ? repositories.filter((repository) => repository.projectId === listMergeProject.id) : []
  const runningProjectTaskCount = runningProjectGitTaskKeys.length
  const projectRepositories = selectedProject ? repositories.filter((repository) => repository.projectId === selectedProject.id) : []
  const projectRepositoryIds = projectRepositories.map((repository) => repository.id).join('|')
  const hasBoundProjectServices = selectedProject ? (projectServiceCounts[selectedProject.id] ?? 0) > 0 : false
  const projectHasRemoteAlignment = hasProjectRemoteAlignment(projectRepositories)
  const hasConfiguredProjectPlane = selectedProject ? Boolean(projectPlaneAvailability[selectedProject.id]) : false
  const projectDetailTabAvailability: ProjectDetailTabAvailability = {
    hasBoundServices: hasBoundProjectServices,
    hasRemoteAlignment: projectHasRemoteAlignment,
    hasPlane: hasConfiguredProjectPlane
  }
  const projectDetailTabs = createProjectDetailTabs(projectDetailTabAvailability)
  const activeProjectDetailTab = resolveProjectDetailTab(projectDetailTab, projectDetailTabAvailability)
  const selectedProjectGitRepository = projectRepositories.find((repository) => repository.id === projectGitRepositoryId) ?? projectRepositories[0] ?? null
  const changedRepositories = projectRepositories.filter((repository) => repository.hasChanges).length
  const aheadRepositories = projectRepositories.filter((repository) => repository.ahead > 0).length
  const projectHasCommittableChanges = hasProjectCommittableChanges(projectRepositories)
  const projectHasPushableTargets = hasProjectPushableTargets(projectRepositories)
  const remoteCount = projectRepositories.reduce((sum, repository) => sum + getRepositoryRemoteCount(repository), 0)
  const remoteAlignmentStats = getProjectRemoteAlignmentStats(projectRepositories)
  const summary = selectedProject ? summaries[selectedProject.id] ?? createEmptySummary(selectedProject.id) : null
  const selectedProjectGitContribution = summary?.repositories.find((repository) => repository.repositoryId === selectedProjectGitRepository?.id)
  const selectedProjectGitCommitCount = selectedProjectGitRepository
    ? projectRepositoryCommitCounts[selectedProjectGitRepository.id] ?? selectedProjectGitContribution?.commits ?? 0
    : 0
  const showProjectRepositorySummary = shouldShowRepositorySummary(activeProjectDetailTab, Boolean(selectedProjectGitRepository))
  const summaryRange = rangePreset === 'all' ? undefined : range
  const dailyDates = summary?.dailyMetrics.map((metric) => metric.date) ?? []
  const hasGitData = Boolean(summary && summary.totalCommits > 0)
  const selectedProjectTerminalRequest = selectedProject ? createProjectTerminalOpenRequest(selectedProject) : null

  function queueTerminalOpen(request: Omit<TerminalOpenRequest, 'requestId'>): void {
    terminalRequestSeqRef.current += 1
    setTerminalOpenRequest({ ...request, requestId: terminalRequestSeqRef.current })
    onOpenTerminalRequest(request)
  }

  function openProjectTerminal(project: Project): void {
    setSelectedProjectId(project.id)
    setDetailProjectId(project.id)
    setProjectDetailTab('terminal')
    setProjectSettingsDrawerOpen(false)
    queueTerminalOpen(createProjectTerminalOpenRequest(project))
  }

  function getProjectRepositories(project: Project): Repository[] {
    return repositories.filter((repository) => repository.projectId === project.id)
  }

  function isProjectGitTaskRunning(projectId: string, action: ProjectGitListAction): boolean {
    return runningProjectGitTaskKeys.includes(getProjectGitTaskKey(projectId, action))
  }

  function setProjectGitTaskRunning(projectId: string, action: ProjectGitListAction, running: boolean): void {
    const key = getProjectGitTaskKey(projectId, action)

    setRunningProjectGitTaskKeys((current) => {
      if (running) {
        return current.includes(key) ? current : [...current, key]
      }

      return current.filter((item) => item !== key)
    })
  }

  function upsertProjectGitTaskLog(log: ProjectGitTaskLog): void {
    setProjectGitTaskLogs((current) => {
      const index = current.findIndex((item) => item.id === log.id)

      if (index === -1) {
        return [log, ...current].slice(0, 200)
      }

      const nextLogs = [...current]
      nextLogs[index] = log
      return nextLogs
    })
  }

  async function refreshProjectAfterGitTask(projectId: string): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    try {
      const nextSummary = await window.forgeDesk.analyzeProjectGit(projectId)
      setProjectSummary(nextSummary)
      setProjectGitRefreshToken((current) => current + 1)
      setAnalysisGitError(null)
    } catch (error) {
      setAnalysisGitError(createGitErrorGuidance(error, '刷新 Git 数据'))
    }
  }

  async function fetchProjectRepositories(project: Project, projectRepositories: Repository[]): Promise<ProjectGitRepositoryTaskResult[]> {
    if (!window.forgeDesk) {
      return []
    }

    return Promise.all(
      projectRepositories.map(async (repository) => {
        try {
          const syncedRepository = await window.forgeDesk.fetchRepositoryRemote(repository.id)
          updateRepository(syncedRepository)

          return {
            repositoryId: repository.id,
            repositoryName: repository.name,
            ok: true,
            message: 'Fetch 完成'
          }
        } catch (error) {
          return {
            repositoryId: repository.id,
            repositoryName: repository.name,
            ok: false,
            message: getErrorMessage(error, `${project.name} / ${repository.name} Fetch 失败`)
          }
        }
      })
    )
  }

  async function pushProjectRepositories(project: Project, projectRepositories: Repository[]): Promise<ProjectGitRepositoryTaskResult[]> {
    if (!window.forgeDesk) {
      return []
    }

    const pushableRepositories = projectRepositories.filter((repository) => groupPushTargetsByBranch(repository.pushTargets).length > 0)

    return Promise.all(
      pushableRepositories.map(async (repository) => {
        const branchGroups = groupPushTargetsByBranch(repository.pushTargets)
        const outputs: string[] = []
        const errors: string[] = []

        for (const group of branchGroups) {
          try {
            const result = await window.forgeDesk.gitPush(repository.id, createGitPushInput(group.remotes, group.branch))
            updateRepository(mergeRepositoryWorkspaceStatus(result.repository, result.status))

            if (result.stdout) {
              outputs.push(result.stdout)
            }

            if (!result.ok) {
              errors.push(result.stderr || result.stdout || `${group.branch} 推送失败`)
            }
          } catch (error) {
            errors.push(getErrorMessage(error, `${project.name} / ${repository.name} 推送失败`))
          }
        }

        const ok = errors.length === 0

        return {
          repositoryId: repository.id,
          repositoryName: repository.name,
          ok,
          message: ok ? `已推送 ${branchGroups.map((group) => `${group.branch} -> ${group.remotes.join(', ')}`).join('；')}` : errors.join('\n'),
          stdout: formatGitTaskOutput(outputs.join('\n')),
          stderr: formatGitTaskOutput(errors.join('\n'))
        }
      })
    )
  }

  async function runProjectGitTask(project: Project, action: 'fetch' | 'push'): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中执行 Git 操作')
      return
    }

    const taskId = createProjectGitTaskLogId(project.id, action)
    const startedAt = new Date().toISOString()
    const actionLabel = getProjectGitActionLabel(action)
    const projectRepositories = getProjectRepositories(project)
    const runningLog: ProjectGitTaskLog = {
      id: taskId,
      projectId: project.id,
      projectName: project.name,
      action,
      status: 'running',
      startedAt,
      summary: `${actionLabel} 正在执行`,
      repositoryResults: []
    }

    upsertProjectGitTaskLog(runningLog)
    setProjectGitTaskDrawerOpen(true)
    setProjectGitTaskRunning(project.id, action, true)

    try {
      const repositoryResults =
        projectRepositories.length === 0
          ? []
          : action === 'fetch'
            ? await fetchProjectRepositories(project, projectRepositories)
            : await pushProjectRepositories(project, projectRepositories)
      const failedCount = repositoryResults.filter((result) => !result.ok).length
      const successCount = repositoryResults.length - failedCount
      const status: ProjectGitTaskStatus = repositoryResults.length === 0 ? 'skipped' : failedCount > 0 ? 'failed' : 'success'
      const summary =
        status === 'skipped'
          ? action === 'push'
            ? '没有待推送的仓库'
            : '项目下没有仓库'
          : failedCount > 0
            ? `${actionLabel} 完成 ${successCount} 个仓库，失败 ${failedCount} 个`
            : `${actionLabel} 完成 ${successCount} 个仓库`

      if (successCount > 0) {
        await refreshProjectAfterGitTask(project.id)
      }

      upsertProjectGitTaskLog({
        ...runningLog,
        status,
        finishedAt: new Date().toISOString(),
        summary,
        repositoryResults
      })

      if (status === 'success') {
        message.success(`${project.name} ${actionLabel} 已完成`)
      } else if (status === 'skipped') {
        message.info(`${project.name} ${summary}`)
      } else {
        message.warning(`${project.name} ${summary}`)
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, `${project.name} ${actionLabel} 失败`)
      upsertProjectGitTaskLog({
        ...runningLog,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        summary: errorMessage,
        repositoryResults: []
      })
      message.error(errorMessage)
    } finally {
      setProjectGitTaskRunning(project.id, action, false)
    }
  }

  async function runSelectedProjectsGitTask(action: 'fetch' | 'push'): Promise<void> {
    if (selectedProjectRows.length === 0) {
      message.warning('请选择要操作的项目')
      return
    }

    await Promise.all(selectedProjectRows.map((project) => runProjectGitTask(project, action)))
  }

  function logProjectMergeResult(project: Project, repository: Repository, result: GitOperationResult): void {
    const now = new Date().toISOString()
    const status: ProjectGitTaskStatus = result.ok ? 'success' : 'failed'
    const summary = result.ok ? `已合并 ${repository.name}` : result.stderr || result.stdout || `${repository.name} 合并未完成`

    upsertProjectGitTaskLog({
      id: createProjectGitTaskLogId(project.id, 'merge'),
      projectId: project.id,
      projectName: project.name,
      action: 'merge',
      status,
      startedAt: now,
      finishedAt: now,
      summary,
      repositoryResults: [
        {
          repositoryId: repository.id,
          repositoryName: repository.name,
          ok: result.ok,
          message: summary,
          stdout: formatGitTaskOutput(result.stdout),
          stderr: formatGitTaskOutput(result.stderr)
        }
      ]
    })
  }

  async function refreshSummary(projectId: string, nextRange = summaryRange): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setProjectSummary(await window.forgeDesk.getProjectSummary(projectId, nextRange))
  }

  async function refreshProjectServiceBindings(projectId: string): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const services = await window.forgeDesk.listProjectServices(projectId)
    setProjectServiceCounts((current) => {
      if (current[projectId] === services.length) {
        return current
      }

      return { ...current, [projectId]: services.length }
    })
  }

  async function refreshProjectWorkspaceStatuses(): Promise<void> {
    const repositoriesToRefresh = projectRepositoriesRef.current

    if (!window.forgeDesk || repositoriesToRefresh.length === 0 || projectWorkspaceStatusRefreshRef.current) {
      return
    }

    projectWorkspaceStatusRefreshRef.current = true

    try {
      await Promise.all(
        repositoriesToRefresh.map(async (repository) => {
          try {
            const status = await window.forgeDesk.getRepositoryWorkspaceStatus(repository.id)
            const nextRepository = mergeRepositoryWorkspaceStatus(repository, status)
            const pushTargetsChanged = JSON.stringify(nextRepository.pushTargets) !== JSON.stringify(repository.pushTargets)

            if (
              nextRepository.hasChanges !== repository.hasChanges ||
              nextRepository.currentBranch !== repository.currentBranch ||
              nextRepository.ahead !== repository.ahead ||
              pushTargetsChanged
            ) {
              updateRepository(nextRepository)
            }
          } catch (error) {
            console.warn(`Failed to refresh repository workspace status for ${repository.name}`, error)
          }
        })
      )
    } finally {
      projectWorkspaceStatusRefreshRef.current = false
    }
  }

  async function refreshProjectGitData(projectId: string, changedRepository?: Repository): Promise<void> {
    if (changedRepository) {
      setProjectGitRepositoryId(changedRepository.id)
    }

    await refreshSummary(projectId)
    setProjectGitRefreshToken((current) => current + 1)
  }

  useEffect(() => {
    if (!selectedProject || !window.forgeDesk) {
      return
    }

    refreshSummary(selectedProject.id).catch((error) => setAnalysisGitError(createGitErrorGuidance(error, '读取 Git 数据')))
  }, [selectedProject?.id, rangePreset, range.startDate, range.endDate])

  useEffect(() => {
    if (!selectedProject || !window.forgeDesk) {
      return
    }

    refreshProjectServiceBindings(selectedProject.id).catch((error) => message.error(getErrorMessage(error)))
  }, [selectedProject?.id, projectSettingsDrawerOpen])

  useEffect(() => {
    if (!selectedProject || !window.forgeDesk) {
      return undefined
    }

    let cancelled = false

    async function refreshProjectPlaneAvailability(): Promise<void> {
      if (!selectedProject || !window.forgeDesk) {
        return
      }

      try {
        const [settings, binding] = await Promise.all([
          window.forgeDesk.getPlaneSettings(),
          window.forgeDesk.getProjectPlaneBinding(selectedProject.id)
        ])
        const nextAvailable = isPlaneSettingsReady(settings) && Boolean(binding)

        if (!cancelled) {
          setProjectPlaneAvailability((current) =>
            current[selectedProject.id] === nextAvailable ? current : { ...current, [selectedProject.id]: nextAvailable }
          )
        }
      } catch (error) {
        console.warn(`Failed to refresh Plane availability for project ${selectedProject.name}`, error)

        if (!cancelled) {
          setProjectPlaneAvailability((current) => (current[selectedProject.id] === false ? current : { ...current, [selectedProject.id]: false }))
        }
      }
    }

    refreshProjectPlaneAvailability()

    return () => {
      cancelled = true
    }
  }, [selectedProject?.id, projectSettingsDrawerOpen])

  useEffect(() => {
    projectRepositoriesRef.current = projectRepositories
  }, [projectRepositories])

  useEffect(() => {
    setSelectedProjectRowIds((current) => {
      const existingProjectIds = new Set(projects.map((project) => project.id))
      const nextProjectIds = current.filter((projectId) => existingProjectIds.has(projectId))

      return nextProjectIds.length === current.length ? current : nextProjectIds
    })
  }, [projects])

  useEffect(() => {
    if (!selectedProject || projectRepositories.length === 0 || !window.forgeDesk) {
      return
    }

    refreshProjectWorkspaceStatuses()
    const intervalId = window.setInterval(() => {
      refreshProjectWorkspaceStatuses()
    }, projectWorkspaceStatusRefreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [selectedProject?.id, projectRepositoryIds])

  useEffect(() => {
    const nextTab = resolveProjectDetailTab(projectDetailTab, projectDetailTabAvailability)

    if (nextTab !== projectDetailTab) {
      setProjectDetailTab(nextTab)
    }
  }, [hasBoundProjectServices, hasConfiguredProjectPlane, projectDetailTab, projectHasRemoteAlignment])

  useEffect(() => {
    if (summary?.status === 'failed' && summary.errorMessage) {
      setAnalysisGitError(createGitErrorGuidance(summary.errorMessage, '刷新 Git 数据'))
    }
  }, [summary?.errorMessage, summary?.status])

  useEffect(() => {
    if (!selectedProject || projectRepositories.length === 0) {
      setProjectGitRepositoryId('')
      return
    }

    if (!projectRepositories.some((repository) => repository.id === projectGitRepositoryId)) {
      setProjectGitRepositoryId(projectRepositories[0].id)
    }
  }, [selectedProject?.id, projectRepositoryIds, projectGitRepositoryId])

  function updateRangePreset(value: string): void {
    setRangePreset(value)

    if (value !== 'custom' && value !== 'all') {
      setRange(createPresetRange(Number(value)))
    }
  }

  function recordProjectRepositoryCommitCount(repositoryId: string, commitCount: number): void {
    setProjectRepositoryCommitCounts((current) => {
      if (current[repositoryId] === commitCount) {
        return current
      }

      return { ...current, [repositoryId]: commitCount }
    })
  }

  async function syncProjectRepository(targetRepository: Repository): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setSyncingProjectRepositoryId(targetRepository.id)

    try {
      const synced = await window.forgeDesk.fetchRepositoryRemote(targetRepository.id)
      updateRepository(synced)
      setProjectGitRepositoryId(synced.id)
      setProjectGitRefreshToken((current) => current + 1)
      const nextSummary = await window.forgeDesk.analyzeProjectGit(synced.projectId)
      setProjectSummary(nextSummary)
      setAnalysisGitError(null)
      message.success('远端已 Fetch，Git 数据已刷新')
    } catch (error) {
      setAnalysisGitError(createGitErrorGuidance(error, '同步远端'))
    } finally {
      setSyncingProjectRepositoryId(null)
    }
  }

  async function switchProjectRepositoryBranch(targetRepository: Repository, input: GitBranchSwitchInput): Promise<void> {
    if (!window.forgeDesk) {
      message.warning('请在 ForgeDesk 桌面应用中切换分支')
      return
    }

    setSwitchingProjectRepositoryId(targetRepository.id)

    try {
      const repository = await window.forgeDesk.switchRepositoryBranch(targetRepository.id, input)
      updateRepository(repository)
      setProjectGitRepositoryId(repository.id)
      setProjectGitRefreshToken((current) => current + 1)
      setAnalysisGitError(null)
      message.success(input.create ? `已创建并切换到 ${repository.currentBranch}` : `已切换到 ${repository.currentBranch}`)
    } catch (error) {
      setAnalysisGitError(createGitErrorGuidance(error, input.create ? '创建分支' : '切换分支'))
      message.error(getErrorMessage(error))
      throw error
    } finally {
      setSwitchingProjectRepositoryId(null)
    }
  }

  function openProjectDetail(project: Project): void {
    setSelectedProjectId(project.id)
    setDetailProjectId(project.id)
    setProjectDetailTab(DEFAULT_PROJECT_DETAIL_TAB)
    setProjectSettingsDrawerOpen(false)
  }

  function isProjectListInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select, [role="button"], .ant-checkbox-wrapper, .ant-table-selection-column'))
  }

  function removeDeletedProjectFromLocalLists(projectId: string): void {
    const deletedRepositoryIds = new Set(repositories.filter((repository) => repository.projectId === projectId).map((repository) => repository.id))

    setSelectedProjectRowIds((current) => current.filter((item) => item !== projectId))
    setRunningProjectGitTaskKeys((current) => current.filter((item) => !item.startsWith(`${projectId}:`)))
    setProjectGitTaskLogs((current) => current.filter((log) => log.projectId !== projectId))
    setProjectRepositoryCommitCounts((current) => omitRecordKeys(current, deletedRepositoryIds))
    setProjectServiceCounts((current) => omitRecordKeys(current, new Set([projectId])))
    setProjectPlaneAvailability((current) => omitRecordKeys(current, new Set([projectId])))

    if (detailProjectId === projectId) {
      setDetailProjectId(null)
      setProjectGitRepositoryId('')
      setAnalysisGitError(null)
    }

    if (listCommitProjectId === projectId) {
      setListCommitProjectId(null)
    }

    if (listMergeProjectId === projectId) {
      setListMergeProjectId(null)
    }
  }

  function confirmDeleteProject(project: Project): void {
    Modal.confirm({
      title: `删除项目 ${project.name}？`,
      content: '会删除 ForgeDesk 中的项目记录、仓库扫描结果和 Git 分析数据；不会删除本地目录、代码仓库或远端仓库。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeletingProjectId(project.id)

        try {
          await deleteProject(project.id)
          removeDeletedProjectFromLocalLists(project.id)
          setProjectSettingsDrawerOpen(false)
          message.success('项目已删除')
        } catch (error) {
          message.error(getErrorMessage(error))
        } finally {
          setDeletingProjectId(null)
        }
      }
    })
  }

  const selectedProjectsHaveRepositories = selectedProjectRows.some((project) => getProjectRepositories(project).length > 0)
  const selectedProjectsCanPush = selectedProjectRows.some((project) => hasProjectPushableTargets(getProjectRepositories(project)))
  const selectedProjectsFetching = selectedProjectRows.some((project) => isProjectGitTaskRunning(project.id, 'fetch'))
  const selectedProjectsPushing = selectedProjectRows.some((project) => isProjectGitTaskRunning(project.id, 'push'))
  const projectListColumns: ColumnsType<Project> = [
    {
      title: '项目',
      key: 'project',
      width: 320,
      render: (_, project) => (
        <Space direction="vertical" size={2} className="project-list-name-cell">
          <Space size={8} wrap>
            <Typography.Text strong>{project.name}</Typography.Text>
            {project.id === selectedProjectId ? <Tag color="blue">当前项目</Tag> : null}
          </Space>
          <Typography.Text className="project-list-path" type="secondary" title={project.workspacePath}>
            {project.workspacePath}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: 'Git 状态',
      key: 'gitStatus',
      width: 250,
      render: (_, project) => {
        const projectRepositories = getProjectRepositories(project)
        const changedRepositories = projectRepositories.filter((repository) => repository.hasChanges).length
        const aheadRepositories = projectRepositories.filter((repository) => repository.ahead > 0).length
        const pushableRepositories = projectRepositories.filter((repository) => groupPushTargetsByBranch(repository.pushTargets).length > 0).length

        return (
          <Space size={6} wrap>
            <Tag color={changedRepositories > 0 ? 'orange' : 'green'}>{changedRepositories > 0 ? `${changedRepositories} 有改动` : '工作区干净'}</Tag>
            <Tag color={aheadRepositories > 0 ? 'blue' : 'default'}>{aheadRepositories} 未推送</Tag>
            <Tag color={pushableRepositories > 0 ? 'purple' : 'default'}>{pushableRepositories} 可推送</Tag>
          </Space>
        )
      }
    },
    {
      title: '分支',
      key: 'branches',
      width: 200,
      render: (_, project) => {
        const branches = Array.from(new Set(getProjectRepositories(project).map((repository) => repository.currentBranch).filter(Boolean)))

        return branches.length > 0 ? (
          <Space size={6} wrap>
            {branches.slice(0, 3).map((branch) => (
              <Tag key={branch} color="geekblue">
                {branch}
              </Tag>
            ))}
            {branches.length > 3 ? <Tag>+{branches.length - 3}</Tag> : null}
          </Space>
        ) : (
          <Typography.Text type="secondary">未识别</Typography.Text>
        )
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_, project) => {
        const projectRepositories = getProjectRepositories(project)
        const hasRepositories = projectRepositories.length > 0
        const canCommitProject = hasProjectCommittableChanges(projectRepositories)
        const canPushProject = hasProjectPushableTargets(projectRepositories)

        return (
          <Space size={8} wrap className="project-list-actions" onClick={(event) => event.stopPropagation()}>
            <Button size="small" icon={<DownloadOutlined />} loading={isProjectGitTaskRunning(project.id, 'fetch')} disabled={!hasRepositories} onClick={() => runProjectGitTask(project, 'fetch')}>
              Fetch
            </Button>
            <Button size="small" icon={<SaveOutlined />} disabled={!canCommitProject} onClick={() => setListCommitProjectId(project.id)}>
              提交
            </Button>
            <Button size="small" icon={<BranchesOutlined />} disabled={!hasRepositories} onClick={() => setListMergeProjectId(project.id)}>
              合并
            </Button>
            <Button size="small" icon={<UploadOutlined />} loading={isProjectGitTaskRunning(project.id, 'push')} disabled={!canPushProject} onClick={() => runProjectGitTask(project, 'push')}>
              推送
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletingProjectId === project.id}
              onClick={() => confirmDeleteProject(project)}
            />
          </Space>
        )
      }
    }
  ]

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
          <Typography.Text type="secondary">一行一个项目，直接管理 Fetch、提交、合并和推送任务。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<FileTextOutlined />} onClick={() => setProjectGitTaskDrawerOpen(true)}>
            任务日志{runningProjectTaskCount > 0 ? `（${runningProjectTaskCount}）` : ''}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreateProject}>
            创建项目
          </Button>
        </Space>
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
              <div>
                <Typography.Title level={4}>项目列表</Typography.Title>
                <Typography.Text type="secondary">选中多个项目后，可以并发 Fetch 或推送。</Typography.Text>
              </div>
              <Space wrap>
                <Button
                  icon={<DownloadOutlined />}
                  loading={selectedProjectsFetching}
                  disabled={selectedProjectRows.length === 0 || !selectedProjectsHaveRepositories}
                  onClick={() => runSelectedProjectsGitTask('fetch')}
                >
                  Fetch 所选
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  loading={selectedProjectsPushing}
                  disabled={selectedProjectRows.length === 0 || !selectedProjectsCanPush}
                  onClick={() => runSelectedProjectsGitTask('push')}
                >
                  推送所选
                </Button>
                <Button size="small" icon={<PlusOutlined />} onClick={onCreateProject} />
              </Space>
            </div>
            <Table<Project>
              className="project-list-table"
              rowKey="id"
              size="middle"
              tableLayout="fixed"
              columns={projectListColumns}
              dataSource={projects}
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedProjectRowIds,
                onChange: (keys) => setSelectedProjectRowIds(keys.map(String))
              }}
              onRow={(project) => ({
                className: 'project-list-clickable-row',
                onClick: (event) => {
                  if (isProjectListInteractiveTarget(event.target)) {
                    return
                  }

                  openProjectDetail(project)
                }
              })}
            />
            {listCommitProject && (
              <GitCommitModal
                open={Boolean(listCommitProject)}
                repositories={listCommitProjectRepositories}
                initialRepositoryId={listCommitInitialRepository?.id}
                onClose={() => setListCommitProjectId(null)}
                onChanged={() => refreshProjectAfterGitTask(listCommitProject.id)}
              />
            )}
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
                <div className="project-title-content">
                  <Typography.Title level={3}>{selectedProject.name}</Typography.Title>
                  <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: selectedProject.workspacePath }}>
                    {selectedProject.workspacePath}
                  </Typography.Text>
                  {summary?.lastAnalyzedAt && <Typography.Text type="secondary">上次分析：{new Date(summary.lastAnalyzedAt).toLocaleString()}</Typography.Text>}
                </div>
              </div>
              <Space wrap className="project-detail-actions">
                <Button danger icon={<DeleteOutlined />} loading={deletingProjectId === selectedProject.id} onClick={() => confirmDeleteProject(selectedProject)}>
                  删除项目
                </Button>
                <Button icon={<SettingOutlined />} onClick={() => setProjectSettingsDrawerOpen(true)}>
                  设置
                </Button>
                <Button icon={<SaveOutlined />} disabled={!projectHasCommittableChanges} onClick={() => setCommitModalOpen(true)}>
                  提交
                </Button>
                <Button icon={<GithubOutlined />} disabled={projectRepositories.length === 0} onClick={() => setReleaseModalOpen(true)}>
                  发布版本
                </Button>
                <Button icon={<UploadOutlined />} disabled={!projectHasPushableTargets} onClick={() => setPushModalOpen(true)}>
                  推送
                </Button>
                <Button icon={<BranchesOutlined />} disabled={projectRepositories.length === 0} onClick={() => setMergeModalOpen(true)}>
                  合并
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={Boolean(selectedProjectGitRepository && syncingProjectRepositoryId === selectedProjectGitRepository.id)}
                  disabled={!selectedProjectGitRepository}
                  onClick={() => selectedProjectGitRepository && syncProjectRepository(selectedProjectGitRepository)}
                >
                  Fetch
                </Button>
              </Space>
            </div>

            <GitCommitModal
              open={commitModalOpen}
              repositories={projectRepositories}
              onClose={() => setCommitModalOpen(false)}
              onChanged={(repository) => selectedProject && refreshProjectGitData(selectedProject.id, repository)}
            />
            <GitPushModal
              open={pushModalOpen}
              repositories={projectRepositories}
              onClose={() => setPushModalOpen(false)}
              onChanged={(repository) => selectedProject && refreshProjectGitData(selectedProject.id, repository)}
            />
            <GitMergeModal
              open={mergeModalOpen}
              repositories={projectRepositories}
              onClose={() => setMergeModalOpen(false)}
              onChanged={(repository) => selectedProject && refreshProjectGitData(selectedProject.id, repository)}
            />
            <RepositoryReleaseModal
              open={releaseModalOpen}
              repositories={projectRepositories}
              initialRepositoryId={selectedProjectGitRepository?.id}
              onClose={() => setReleaseModalOpen(false)}
              onChanged={(repository) => selectedProject && refreshProjectGitData(selectedProject.id, repository)}
            />
            <Drawer
              title={`项目设置：${selectedProject.name}`}
              open={projectSettingsDrawerOpen}
              width="min(1280px, calc(100vw - 64px))"
              onClose={() => setProjectSettingsDrawerOpen(false)}
            >
              <ProjectSettingsPanel
                key={`${selectedProject.id}:${projectSettingsDrawerOpen ? 'open' : 'closed'}`}
                project={selectedProject}
                repositories={projectRepositories}
                contributors={summary?.contributors ?? []}
                onSummaryChanged={() => refreshSummary(selectedProject.id)}
                onBranchTagsChanged={() => setBranchTagRefreshToken((current) => current + 1)}
              />
            </Drawer>

            <GitErrorNotice guidance={analysisGitError} onClose={() => setAnalysisGitError(null)} />

            {showProjectRepositorySummary && selectedProjectGitRepository && (
              <RepositorySummaryStrip
                activeRepository={selectedProjectGitRepository}
                repositories={projectRepositories}
                selectedRepositoryId={selectedProjectGitRepository.id}
                commitCount={selectedProjectGitCommitCount}
                switchingBranch={switchingProjectRepositoryId === selectedProjectGitRepository.id}
                onRepositoryChange={setProjectGitRepositoryId}
                onSwitchBranch={switchProjectRepositoryBranch}
              />
            )}

            <Tabs
              destroyOnHidden={false}
              activeKey={activeProjectDetailTab}
              onChange={(key) => {
                const nextTab = key as ProjectDetailTabKey

                setProjectDetailTab(nextTab)

                if (nextTab === 'terminal' && selectedProjectTerminalRequest) {
                  queueTerminalOpen(selectedProjectTerminalRequest)
                }
              }}
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
                      {projectHasRemoteAlignment && (
                        <div className="remote-health-strip">
                          <Typography.Text strong>远端对齐</Typography.Text>
                          <Space wrap>
                            <Tag color="green">已对齐 {remoteAlignmentStats.aligned}</Tag>
                            <Tag color="orange">未对齐 {remoteAlignmentStats.notAligned}</Tag>
                            <Tag color="red">缺配置 {remoteAlignmentStats.missing}</Tag>
                            <Tag>待同步 {remoteAlignmentStats.unknown}</Tag>
                          </Space>
                        </div>
                      )}
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
                  children: (
                    <ProjectLogTreePanel
                      repositories={projectRepositories}
                      repositoryId={projectGitRepositoryId}
                      view="log"
                      refreshToken={projectGitRefreshToken}
                      branchTagRefreshToken={branchTagRefreshToken}
                      onCommitCountChange={recordProjectRepositoryCommitCount}
                      onRepositoryChange={setProjectGitRepositoryId}
                    />
                  )
                },
                {
                  key: 'remote-alignment',
                  label: '多端对齐',
                  children: (
                    <ProjectLogTreePanel
                      repositories={projectRepositories}
                      repositoryId={projectGitRepositoryId}
                      view="alignment"
                      refreshToken={projectGitRefreshToken}
                      branchTagRefreshToken={branchTagRefreshToken}
                      onCommitCountChange={recordProjectRepositoryCommitCount}
                      onRepositoryChange={setProjectGitRepositoryId}
                    />
                  )
                },
                {
                  key: 'plane',
                  label: 'Plane',
                  children: (
                    <ProjectPlanePanel
                      project={selectedProject}
                      onOpenGlobalSettings={onOpenSettings}
                      onOpenProjectSettings={() => setProjectSettingsDrawerOpen(true)}
                    />
                  )
                },
                {
                  key: 'service-monitor',
                  label: '服务监控',
                  children: <ProjectServiceMonitorPanel projectId={selectedProject.id} />
                },
                {
                  key: 'terminal',
                  label: '终端',
                  children: (
                    <TerminalWorkspace
                      defaultCwd={selectedProjectTerminalRequest?.cwd ?? selectedProject.workspacePath}
                      defaultReuseKey={selectedProjectTerminalRequest?.reuseKey}
                      defaultTitle={selectedProjectTerminalRequest?.title ?? selectedProject.name}
                      openRequest={terminalOpenRequest}
                      projectId={selectedProject.id}
                    />
                  )
                }
              ]
                .filter((item) => projectDetailTabs.some((tab) => tab.key === item.key))
                .sort(
                  (left, right) =>
                    projectDetailTabs.findIndex((tab) => tab.key === left.key) -
                    projectDetailTabs.findIndex((tab) => tab.key === right.key)
                )}
            />
          </div>
        </div>
      )}
      <GitMergeModal
        open={Boolean(listMergeProject)}
        repositories={listMergeProjectRepositories}
        onClose={() => setListMergeProjectId(null)}
        onChanged={(repository) => (repository && listMergeProject ? refreshProjectGitData(listMergeProject.id, repository) : undefined)}
        onOperationResult={(repository, result) => {
          if (listMergeProject) {
            logProjectMergeResult(listMergeProject, repository, result)
          }
        }}
      />
      <ProjectGitTaskLogDrawer
        open={projectGitTaskDrawerOpen}
        logs={projectGitTaskLogs}
        onClose={() => setProjectGitTaskDrawerOpen(false)}
        onClear={() => setProjectGitTaskLogs([])}
      />
    </section>
  )
}

function ProjectGitTaskLogDrawer({
  open,
  logs,
  onClose,
  onClear
}: {
  open: boolean
  logs: ProjectGitTaskLog[]
  onClose: () => void
  onClear: () => void
}): JSX.Element {
  const runningCount = logs.filter((log) => log.status === 'running').length

  return (
    <Drawer
      title="项目 Git 任务"
      open={open}
      width={520}
      onClose={onClose}
      extra={
        <Button size="small" icon={<DeleteOutlined />} disabled={logs.length === 0} onClick={onClear}>
          清空
        </Button>
      }
    >
      <Space direction="vertical" size={14} className="project-git-task-drawer">
        {runningCount > 0 ? <Alert type="info" showIcon message={`${runningCount} 个任务正在执行`} /> : null}
        {logs.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有项目 Git 任务" /> : null}
        {logs.map((log) => {
          const actionLabel = getProjectGitActionLabel(log.action)
          const statusMeta = getProjectGitTaskStatusMeta(log.status)
          const repositoryCount = log.repositoryResults.length

          return (
            <div className={`project-git-task-entry project-git-task-entry-${log.status}`} key={log.id}>
              <div className="project-git-task-entry-heading">
                <Space size={6} wrap>
                  <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                  <Tag>{actionLabel}</Tag>
                  <Typography.Text strong>{log.projectName}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">{formatDateTime(log.finishedAt || log.startedAt)}</Typography.Text>
              </div>
              <Typography.Text className="project-git-task-summary">{log.summary}</Typography.Text>
              <Collapse
                ghost
                size="small"
                items={[
                  {
                    key: 'repositories',
                    label: repositoryCount > 0 ? `仓库结果 ${repositoryCount}` : '仓库结果',
                    children:
                      repositoryCount > 0 ? (
                        <div className="project-git-task-repository-list">
                          {log.repositoryResults.map((result) => (
                            <div className="project-git-task-repository" key={`${log.id}:${result.repositoryId}`}>
                              <Space size={6} wrap>
                                <Badge status={result.ok ? 'success' : 'error'} />
                                <Typography.Text strong>{result.repositoryName}</Typography.Text>
                              </Space>
                              <Typography.Text type={result.ok ? undefined : 'danger'}>{result.message}</Typography.Text>
                              {result.stdout ? <pre className="project-git-task-output">{result.stdout}</pre> : null}
                              {result.stderr ? <pre className="project-git-task-output is-error">{result.stderr}</pre> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Typography.Text type="secondary">没有仓库输出</Typography.Text>
                      )
                  }
                ]}
              />
            </div>
          )
        })}
      </Space>
    </Drawer>
  )
}

function getPlaneStateColor(group: string): string {
  const normalized = group.toLowerCase()

  if (normalized === 'completed') {
    return 'green'
  }

  if (normalized === 'cancelled') {
    return 'red'
  }

  if (normalized === 'started') {
    return 'blue'
  }

  if (normalized === 'unstarted') {
    return 'default'
  }

  return 'gold'
}

function getPlanePriorityColor(priority: string): string {
  const normalized = priority.toLowerCase()

  if (normalized === 'urgent') {
    return 'red'
  }

  if (normalized === 'high') {
    return 'orange'
  }

  if (normalized === 'medium') {
    return 'blue'
  }

  if (normalized === 'low') {
    return 'default'
  }

  return 'default'
}

function getPlaneProgressText(total: number, completed: number, cancelled: number): string {
  const activeTotal = Math.max(0, total - cancelled)

  if (activeTotal === 0) {
    return '0%'
  }

  return `${Math.round((completed / activeTotal) * 100)}%`
}

function ProjectPlanePanel({
  project,
  onOpenGlobalSettings,
  onOpenProjectSettings
}: {
  project: Project
  onOpenGlobalSettings: () => void
  onOpenProjectSettings: () => void
}): JSX.Element {
  const [settings, setSettings] = useState<PlaneSettings | null>(null)
  const [binding, setBinding] = useState<PlaneProjectBinding | null>(null)
  const [content, setContent] = useState<PlaneProjectContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refreshPlaneContent(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const [nextSettings, nextBinding] = await Promise.all([window.forgeDesk.getPlaneSettings(), window.forgeDesk.getProjectPlaneBinding(project.id)])
      setSettings(nextSettings)
      setBinding(nextBinding)

      if (!isPlaneSettingsReady(nextSettings) || !nextBinding) {
        setContent(null)
        return
      }

      setContent(await window.forgeDesk.getPlaneProjectContent(project.id))
    } catch (nextError) {
      setError(getErrorMessage(nextError))
      setContent(null)
    } finally {
      setLoading(false)
    }
  }

  async function openPlaneProject(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    await window.forgeDesk.openPlane(project.id)
  }

  useEffect(() => {
    refreshPlaneContent()
  }, [project.id])

  const workItemColumns: ColumnsType<PlaneWorkItem> = [
    {
      title: '编号',
      dataIndex: 'identifier',
      key: 'identifier',
      width: 120,
      render: (value) => value || '-'
    },
    {
      title: '标题',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (_, item) => (
        <Typography.Text className="table-text" ellipsis={{ tooltip: item.name }}>
          {item.name || '-'}
        </Typography.Text>
      )
    },
    {
      title: '状态',
      key: 'state',
      width: 130,
      render: (_, item) => <Tag color={getPlaneStateColor(item.stateGroup)}>{item.stateName || item.stateGroup || '未设置'}</Tag>
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (value) => <Tag color={getPlanePriorityColor(String(value))}>{value || 'none'}</Tag>
    },
    {
      title: '负责人',
      dataIndex: 'assigneeNames',
      key: 'assigneeNames',
      width: 180,
      render: (value: string[]) => (value.length > 0 ? value.join(', ') : '-')
    },
    { title: '截止', dataIndex: 'targetDate', key: 'targetDate', width: 120, render: (value) => value || '-' },
    { title: '更新', dataIndex: 'updatedAt', key: 'updatedAt', width: 180, render: (value) => formatDateTime(value) },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 90,
      render: (_, item) => (
        <Button size="small" icon={<LinkOutlined />} href={item.url} target="_blank" rel="noreferrer">
          打开
        </Button>
      )
    }
  ]

  const cycleColumns: ColumnsType<PlaneCycle> = [
    {
      title: 'Cycle',
      dataIndex: 'name',
      key: 'name',
      render: (_, cycle) => (
        <Typography.Text className="table-text" ellipsis={{ tooltip: cycle.name }}>
          {cycle.name || '-'}
        </Typography.Text>
      )
    },
    { title: '时间', key: 'range', width: 220, render: (_, cycle) => `${cycle.startDate || '-'} → ${cycle.endDate || '-'}` },
    { title: '工作项', dataIndex: 'totalIssues', key: 'totalIssues', width: 90, render: (value) => formatNumber(value) },
    {
      title: '完成',
      key: 'progress',
      width: 120,
      render: (_, cycle) => getPlaneProgressText(cycle.totalIssues, cycle.completedIssues, cycle.cancelledIssues)
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, cycle) => (
        <Button size="small" icon={<LinkOutlined />} href={cycle.url} target="_blank" rel="noreferrer">
          打开
        </Button>
      )
    }
  ]

  const moduleColumns: ColumnsType<PlaneModule> = [
    {
      title: 'Module',
      dataIndex: 'name',
      key: 'name',
      render: (_, module) => (
        <Typography.Text className="table-text" ellipsis={{ tooltip: module.name }}>
          {module.name || '-'}
        </Typography.Text>
      )
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (value) => value || '-' },
    { title: '目标日期', dataIndex: 'targetDate', key: 'targetDate', width: 130, render: (value) => value || '-' },
    { title: '工作项', dataIndex: 'totalIssues', key: 'totalIssues', width: 90, render: (value) => formatNumber(value) },
    {
      title: '完成',
      key: 'progress',
      width: 120,
      render: (_, module) => getPlaneProgressText(module.totalIssues, module.completedIssues, module.cancelledIssues)
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, module) => (
        <Button size="small" icon={<LinkOutlined />} href={module.url} target="_blank" rel="noreferrer">
          打开
        </Button>
      )
    }
  ]

  if (loading && !content) {
    return (
      <div className="panel loading-panel">
        <Spin />
      </div>
    )
  }

  if (!isPlaneSettingsReady(settings)) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="Plane 尚未配置" />
        <Button type="primary" icon={<SettingOutlined />} onClick={onOpenGlobalSettings}>
          配置 Plane
        </Button>
      </div>
    )
  }

  if (!binding) {
    return (
      <div className="panel empty-project-panel">
        <Empty description="当前项目还没有绑定 Plane 项目" />
        <Button type="primary" icon={<LinkOutlined />} onClick={onOpenProjectSettings}>
          绑定 Plane 项目
        </Button>
      </div>
    )
  }

  return (
    <Space direction="vertical" size={16} className="plane-project-panel">
      <div className="panel plane-project-header">
        <div className="panel-title">
          <Space direction="vertical" size={2}>
            <Typography.Title level={4}>{content?.summary.name || binding.planeProjectName || 'Plane 项目'}</Typography.Title>
            <Typography.Text type="secondary">
              {binding.workspaceSlug} / {content?.summary.identifier || binding.planeProjectIdentifier || binding.planeProjectId}
            </Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={refreshPlaneContent}>
              刷新
            </Button>
            <Button type="primary" icon={<LinkOutlined />} onClick={openPlaneProject}>
              打开 Plane
            </Button>
          </Space>
        </div>
        {error && <Alert type="error" showIcon message={error} />}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <div className="metric-tile">
              <Statistic title="工作项" value={content?.summary.counts.issues ?? 0} />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div className="metric-tile">
              <Statistic title="Cycles" value={content?.summary.counts.cycles ?? 0} />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div className="metric-tile">
              <Statistic title="Modules" value={content?.summary.counts.modules ?? 0} />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div className="metric-tile">
              <Statistic title="成员" value={content?.summary.counts.members ?? 0} />
            </div>
          </Col>
        </Row>
      </div>

      <div className="panel plane-table-panel">
        <div className="panel-title">
          <Typography.Title level={4}>工作项</Typography.Title>
          <Tag>{formatNumber(content?.workItems.length ?? 0)}</Tag>
        </div>
        <Table
          rowKey="id"
          columns={workItemColumns}
          dataSource={content?.workItems ?? []}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="暂无工作项" /> }}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <div className="panel plane-table-panel">
            <div className="panel-title">
              <Typography.Title level={4}>Cycles</Typography.Title>
              <Tag>{formatNumber(content?.cycles.length ?? 0)}</Tag>
            </div>
            <Table
              rowKey="id"
              columns={cycleColumns}
              dataSource={content?.cycles ?? []}
              loading={loading}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="暂无 Cycle" /> }}
            />
          </div>
        </Col>
        <Col xs={24} xl={12}>
          <div className="panel plane-table-panel">
            <div className="panel-title">
              <Typography.Title level={4}>Modules</Typography.Title>
              <Tag>{formatNumber(content?.modules.length ?? 0)}</Tag>
            </div>
            <Table
              rowKey="id"
              columns={moduleColumns}
              dataSource={content?.modules ?? []}
              loading={loading}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="暂无 Module" /> }}
            />
          </div>
        </Col>
      </Row>
    </Space>
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

const branchTagColorPresets = ['#f5222d', '#1d39c4', '#1677ff', '#13c2c2', '#52c41a', '#722ed1', '#eb2f96', '#fa8c16']

function ProjectBranchTagSettings({ project, onChanged }: { project: Project; onChanged: () => void }): JSX.Element {
  const [branchTags, setBranchTags] = useState<ProjectBranchTag[]>([])
  const [editingBranchTag, setEditingBranchTag] = useState<ProjectBranchTag | null>(null)
  const [branchTagModalOpen, setBranchTagModalOpen] = useState(false)
  const [loadingBranchTags, setLoadingBranchTags] = useState(false)
  const [savingBranchTag, setSavingBranchTag] = useState(false)
  const [branchTagForm] = Form.useForm<BranchTagForm>()
  const selectedColor = String(Form.useWatch('color', branchTagForm) ?? branchTagColorPresets[0])

  async function loadBranchTags(): Promise<void> {
    if (!window.forgeDesk) {
      setBranchTags([])
      return
    }

    setLoadingBranchTags(true)

    try {
      setBranchTags(await window.forgeDesk.listProjectBranchTags(project.id))
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoadingBranchTags(false)
    }
  }

  useEffect(() => {
    loadBranchTags().catch((error) => message.error(getErrorMessage(error)))
  }, [project.id])

  function openBranchTagModal(tag?: ProjectBranchTag): void {
    setEditingBranchTag(tag ?? null)
    branchTagForm.setFieldsValue({
      label: tag?.label ?? '',
      branchName: tag?.branchName ?? '',
      color: tag?.color ?? branchTagColorPresets[0]
    })
    setBranchTagModalOpen(true)
  }

  function closeBranchTagModal(): void {
    setEditingBranchTag(null)
    setBranchTagModalOpen(false)
    branchTagForm.resetFields()
  }

  async function saveBranchTag(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const values = await branchTagForm.validateFields()
    setSavingBranchTag(true)

    try {
      await window.forgeDesk.saveProjectBranchTag({
        id: editingBranchTag?.id,
        projectId: project.id,
        label: values.label.trim(),
        branchName: values.branchName.trim(),
        color: values.color.trim()
      })
      message.success('分支标签颜色已保存')
      closeBranchTagModal()
      await loadBranchTags()
      onChanged()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setSavingBranchTag(false)
    }
  }

  async function deleteBranchTag(tag: ProjectBranchTag): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    try {
      setBranchTags(await window.forgeDesk.deleteProjectBranchTag(project.id, tag.id))
      message.success('分支标签颜色已删除')
      onChanged()
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const columns: ColumnsType<ProjectBranchTag> = [
    {
      title: '名称',
      dataIndex: 'label',
      key: 'label',
      width: 180,
      render: (value, tag) => <Tag color={tag.color}>{value}</Tag>
    },
    {
      title: '匹配分支',
      dataIndex: 'branchName',
      key: 'branchName',
      render: (value) => <Typography.Text code>{value}</Typography.Text>
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 160,
      render: (value) => (
        <Space size={8}>
          <span className="branch-tag-color-swatch" style={{ backgroundColor: value }} />
          <Typography.Text>{value}</Typography.Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, tag) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openBranchTagModal(tag)}>
            编辑
          </Button>
          <Popconfirm
            title="删除这条颜色规则？"
            description="删除后命中的分支会回到默认颜色。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => deleteBranchTag(tag)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="panel branch-tag-settings-panel">
      <div className="branch-tag-settings-toolbar">
        <Typography.Text type="secondary">填写短分支名即可匹配本地和远端同名分支。</Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openBranchTagModal()}>
          新增规则
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={branchTags}
        loading={loadingBranchTags}
        pagination={false}
        scroll={{ x: 640 }}
        locale={{ emptyText: <Empty description="还没有分支标签颜色规则" /> }}
      />
      <Modal
        title={editingBranchTag ? '编辑分支标签颜色' : '新增分支标签颜色'}
        open={branchTagModalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingBranchTag}
        onOk={saveBranchTag}
        onCancel={closeBranchTagModal}
      >
        <Form form={branchTagForm} layout="vertical">
          <Form.Item name="label" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="例如 主分支" />
          </Form.Item>
          <Form.Item name="branchName" label="分支短名" rules={[{ required: true, message: '请输入分支短名' }]}>
            <Input placeholder="例如 main 或 develop" />
          </Form.Item>
          <Form.Item
            name="color"
            label="颜色"
            rules={[
              { required: true, message: '请输入颜色' },
              { pattern: /^#[0-9a-fA-F]{6}$/, message: '请输入 6 位 hex 颜色，例如 #f5222d' }
            ]}
          >
            <Input
              placeholder="#f5222d"
              addonBefore={<span className="branch-tag-color-swatch" style={{ backgroundColor: selectedColor }} />}
            />
          </Form.Item>
          <div className="branch-tag-color-grid">
            {branchTagColorPresets.map((color) => (
              <button
                key={color}
                type="button"
                className={selectedColor.toLowerCase() === color.toLowerCase() ? 'branch-tag-color-button is-active' : 'branch-tag-color-button'}
                style={{ backgroundColor: color }}
                aria-label={`使用颜色 ${color}`}
                onClick={() => branchTagForm.setFieldsValue({ color })}
              />
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  )
}

function RemoteAlignmentPanel({ alignment, currentBranch }: { alignment: RemoteAlignmentSummary; currentBranch: string }): JSX.Element {
  const meta = getRemoteAlignmentStatusMeta(alignment.status)
  const remoteColumns: ColumnsType<RemoteAlignmentBranch> = alignment.remotes.map((remote) => ({
    title: remote.name,
    key: `remote:${remote.name}`,
    width: 220,
    render: (_, branch) => {
      const remoteRef = branch.remotes.find((item) => item.remoteName === remote.name)
      const commit = remoteRef?.commit ?? ''
      const ahead = remoteRef?.ahead ?? 0

      return (
        <Space direction="vertical" size={2}>
          <Typography.Text type="secondary" className="table-text" ellipsis={{ tooltip: remoteRef?.ref || `${remote.name}/${branch.branchName}` }}>
            {remoteRef?.ref || `${remote.name}/${branch.branchName}`}
          </Typography.Text>
          <Space size={6} wrap>
            <Tag color={commit ? 'default' : 'red'}>{commit ? formatShortCommit(commit) : '缺分支'}</Tag>
            {branch.status === 'diverged' && ahead > 0 && <Tag color="orange">+{formatNumber(ahead)}</Tag>}
          </Space>
        </Space>
      )
    }
  }))
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
    ...remoteColumns,
    {
      title: '独有提交',
      key: 'ahead',
      width: 120,
      render: (_, branch) =>
        branch.status === 'diverged' ? (
          <Tag color="orange">{formatNumber(branch.uniqueCommitCount)}</Tag>
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
          <Typography.Title level={4}>多端对齐</Typography.Title>
          <Typography.Text type="secondary">
            {formatNumber(alignment.remoteCount)} 个远端 · {getRemoteAlignmentDetail(alignment)}
          </Typography.Text>
        </Space>
        <Tag color={meta.color}>{meta.label}</Tag>
      </div>
      <div className="remote-alignment-remotes-list">
        {alignment.remotes.length === 0 ? (
          <Typography.Text type="secondary">还没有远端配置</Typography.Text>
        ) : (
          alignment.remotes.map((remote) => (
            <div key={remote.name} className="remote-alignment-remote-card">
              <Space size={6} wrap>
                <Typography.Text strong>{remote.name}</Typography.Text>
                <Tag>{formatNumber(remote.branchCount)} 分支</Tag>
              </Space>
              {remote.url ? <Typography.Text type="secondary" ellipsis={{ tooltip: remote.url }}>{remote.url}</Typography.Text> : <Typography.Text type="secondary">未配置 URL</Typography.Text>}
            </div>
          ))
        )}
      </div>
      {alignment.errorMessage && <Alert type={alignment.status === 'unknown' ? 'warning' : 'error'} showIcon message={alignment.errorMessage} />}
      <Table
        rowKey="branchName"
        size="small"
        columns={columns}
        dataSource={alignment.branches}
        pagination={false}
        rowClassName={(branch) => (branch.branchName === currentBranch ? 'current-branch-row' : '')}
        scroll={{ x: Math.max(720, 420 + alignment.remotes.length * 220) }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="同步远端后显示分支对齐结果" /> }}
      />
    </div>
  )
}

type RepositoryLogTreeView = 'log' | 'alignment'

const localBranchValuePrefix = 'local|'
const remoteBranchValuePrefix = 'remote|'

function createBranchOptionValue(kind: 'local' | 'remote', branchName: string): string {
  return `${kind === 'local' ? localBranchValuePrefix : remoteBranchValuePrefix}${branchName}`
}

function parseBranchOptionValue(value: string): { kind: 'local' | 'remote'; branchName: string } {
  if (value.startsWith(remoteBranchValuePrefix)) {
    return { kind: 'remote', branchName: value.slice(remoteBranchValuePrefix.length) }
  }

  return { kind: 'local', branchName: value.startsWith(localBranchValuePrefix) ? value.slice(localBranchValuePrefix.length) : value }
}

function getRemoteBranchLocalName(remoteBranchName: string): string {
  const [, ...branchParts] = remoteBranchName.split('/')

  return branchParts.join('/') || remoteBranchName
}

function RepositoryBranchControl({
  repository,
  repositories,
  selectedRepositoryId,
  switching,
  onRepositoryChange,
  onSwitchBranch
}: {
  repository: Repository
  repositories: Repository[]
  selectedRepositoryId?: string
  switching?: boolean
  onRepositoryChange?: (repositoryId: string) => void
  onSwitchBranch?: (repository: Repository, input: GitBranchSwitchInput) => Promise<void>
}): JSX.Element {
  const [createBranchOpen, setCreateBranchOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const localBranches = Array.from(new Set([repository.currentBranch, ...repository.branches].filter(Boolean)))
  const remoteBranches = Array.from(new Set(repository.remoteBranches.filter(Boolean)))
  const branchOptions = [
    {
      label: '本地分支',
      options: localBranches.map((branchName) => ({
        label: branchName,
        value: createBranchOptionValue('local', branchName)
      }))
    },
    {
      label: '远端分支',
      options: remoteBranches.map((branchName) => ({
        label: (
          <Space size={6}>
            <span>{branchName}</span>
            <Tag>远端</Tag>
          </Space>
        ),
        value: createBranchOptionValue('remote', branchName)
      }))
    }
  ].filter((group) => group.options.length > 0)
  const selectedBranchValue = createBranchOptionValue('local', repository.currentBranch)

  async function switchBranch(value: string): Promise<void> {
    if (!onSwitchBranch) {
      return
    }

    const nextBranch = parseBranchOptionValue(value)

    if (nextBranch.kind === 'local') {
      await onSwitchBranch(repository, { branchName: nextBranch.branchName })
      return
    }

    const localBranchName = getRemoteBranchLocalName(nextBranch.branchName)

    if (repository.branches.includes(localBranchName)) {
      await onSwitchBranch(repository, { branchName: localBranchName })
      return
    }

    Modal.confirm({
      title: '创建本地分支？',
      content: `远端分支 ${nextBranch.branchName} 还没有对应的本地分支。是否创建 ${localBranchName} 并切换过去？`,
      okText: '创建并切换',
      cancelText: '取消',
      onOk: () =>
        onSwitchBranch(repository, {
          branchName: localBranchName,
          create: true,
          startPoint: nextBranch.branchName,
          track: true
        })
    })
  }

  async function createBranch(): Promise<void> {
    const branchName = newBranchName.trim()

    if (!branchName) {
      message.warning('请输入分支名')
      return
    }

    if (!onSwitchBranch) {
      return
    }

    await onSwitchBranch(repository, { branchName, create: true })
    setCreateBranchOpen(false)
    setNewBranchName('')
  }

  return (
    <>
      <Space.Compact className="repository-branch-control">
        {repositories.length > 1 && onRepositoryChange && (
          <Select
            className="repository-branch-repository-select"
            value={selectedRepositoryId ?? repository.id}
            options={repositories.map((item) => ({ label: item.name, value: item.id }))}
            onChange={onRepositoryChange}
          />
        )}
        <Select
          showSearch
          className="repository-branch-select"
          value={selectedBranchValue}
          disabled={!onSwitchBranch}
          loading={switching}
          options={branchOptions}
          optionFilterProp="value"
          popupMatchSelectWidth={false}
          onChange={(value) => {
            switchBranch(value).catch(() => undefined)
          }}
        />
        {onSwitchBranch && (
          <Tooltip title="创建分支">
            <Button icon={<PlusOutlined />} loading={switching} onClick={() => setCreateBranchOpen(true)} />
          </Tooltip>
        )}
      </Space.Compact>
      <Modal
        title="创建分支"
        open={createBranchOpen}
        okText="创建并切换"
        cancelText="取消"
        confirmLoading={switching}
        onOk={createBranch}
        onCancel={() => setCreateBranchOpen(false)}
      >
        <Input
          autoFocus
          value={newBranchName}
          placeholder={`从 ${repository.currentBranch || '当前 HEAD'} 创建，例如 feature/new-page`}
          onChange={(event) => setNewBranchName(event.target.value)}
          onPressEnter={() => createBranch().catch(() => undefined)}
        />
      </Modal>
    </>
  )
}

function RepositorySummaryStrip({
  activeRepository,
  repositories,
  selectedRepositoryId,
  commitCount,
  switchingBranch,
  onRepositoryChange,
  onSwitchBranch
}: {
  activeRepository: Repository
  repositories: Repository[]
  selectedRepositoryId?: string
  commitCount: number
  switchingBranch?: boolean
  onRepositoryChange?: (repositoryId: string) => void
  onSwitchBranch?: (repository: Repository, input: GitBranchSwitchInput) => Promise<void>
}): JSX.Element {
  const fields = createRepositorySummaryFields(activeRepository, commitCount)

  return (
    <div className="repository-summary-strip">
      <div className="repository-summary-grid">
        {fields.map((field) => (
          <div className="repository-summary-item" key={field.label}>
            <Typography.Text type="secondary">{field.label}</Typography.Text>
            {field.label === '当前分支' ? (
              <RepositoryBranchControl
                repository={activeRepository}
                repositories={repositories}
                selectedRepositoryId={selectedRepositoryId}
                switching={switchingBranch}
                onRepositoryChange={onRepositoryChange}
                onSwitchBranch={onSwitchBranch}
              />
            ) : (
              <Typography.Text strong={field.strong} ellipsis={{ tooltip: field.value }}>
                {field.label === '提交总数' ? formatNumber(Number(field.value)) : field.value}
              </Typography.Text>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RepositoryLogTree({
  repository,
  repositories = [],
  selectedRepositoryId,
  view = 'log',
  showSummary = true,
  refreshToken = 0,
  emptyDescription = '请选择仓库',
  branchTagRefreshToken = 0,
  onCommitCountChange,
  onRepositoryChange
}: {
  repository: Repository | null
  repositories?: Repository[]
  selectedRepositoryId?: string
  view?: RepositoryLogTreeView
  showSummary?: boolean
  refreshToken?: number
  emptyDescription?: string
  branchTagRefreshToken?: number
  onCommitCountChange?: (repositoryId: string, commitCount: number) => void
  onRepositoryChange?: (repositoryId: string) => void
}): JSX.Element {
  const { setProjectSummary, updateRepository } = useForgeDeskStore()
  const [gitLogRefreshPreferences] = useGitLogRefreshPreferences()
  const [detailRepository, setDetailRepository] = useState<Repository | null>(repository)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [workspaceStatus, setWorkspaceStatus] = useState<GitWorkspaceStatus | null>(null)
  const [commitRange, setCommitRange] = useState({ startDate: '', endDate: '' })
  const [commitBranch, setCommitBranch] = useState('')
  const [commitAuthor, setCommitAuthor] = useState('')
  const [selectedCommit, setSelectedCommit] = useState<RepositoryLogCommit | null>(null)
  const [commitFiles, setCommitFiles] = useState<GitCommitFileChange[]>([])
  const [selectedFile, setSelectedFile] = useState<GitCommitFileChange | null>(null)
  const [commitDiff, setCommitDiff] = useState<GitCommitDiff | null>(null)
  const [diffModalOpen, setDiffModalOpen] = useState(false)
  const [visibleCommitCount, setVisibleCommitCount] = useState(commitGraphBatchSize)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [syncingRepositoryId, setSyncingRepositoryId] = useState<string | null>(null)
  const [gitError, setGitError] = useState<GitErrorGuidance | null>(null)
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false)
  const [branchTags, setBranchTags] = useState<ProjectBranchTag[]>([])
  const commitLoadMoreRef = useRef<HTMLDivElement | null>(null)
  const repositoryRefreshInFlightRef = useRef(false)
  const activeProjectId = (detailRepository ?? repository)?.projectId ?? ''
  const activeRepositoryForLog = detailRepository ?? repository

  const filteredCommits = useMemo(
    () => commits.filter((commit) => !commitAuthor || getCommitAuthorFilterValue(commit) === commitAuthor),
    [commitAuthor, commits]
  )
  const workspaceCommitFiles = useMemo<GitCommitFileChange[]>(
    () =>
      (workspaceStatus?.files ?? []).map((file) => ({
        id: `worktree:${file.path}:${file.oldPath}:${file.indexStatus}${file.worktreeStatus}`,
        status: getWorkspaceFileChangeStatus(file),
        path: file.path,
        oldPath: file.oldPath,
        additions: 0,
        deletions: 0,
        binary: false
      })),
    [workspaceStatus]
  )
  const graphCommits = useMemo<RepositoryLogCommit[]>(
    () =>
      activeRepositoryForLog
        ? prependWorkingTreeCommit<RepositoryLogCommit>(filteredCommits, workspaceStatus, ({ parentHashes, fileCount }) => ({
            id: `${activeRepositoryForLog.id}:${workingTreeCommitHash}`,
            repositoryId: activeRepositoryForLog.id,
            repositoryName: activeRepositoryForLog.name,
            hash: workingTreeCommitHash,
            shortHash: '未提交',
            parentHashes,
            refs: [],
            authorName: '',
            authorEmail: '',
            authorDisplayName: '工作区',
            authorDisplayEmail: '',
            mappedPersonId: '',
            committedAt: new Date().toISOString(),
            message: `未提交更改（${formatNumber(fileCount)} 个文件）`,
            branchName: workspaceStatus?.branch || activeRepositoryForLog.currentBranch || commitBranch || '',
            additions: 0,
            deletions: 0,
            filesChanged: fileCount,
            isWorkingTreeCommit: true,
            worktreeFiles: workspaceCommitFiles
          }), {
            currentBranch: workspaceStatus?.branch || activeRepositoryForLog.currentBranch || ''
          })
        : filteredCommits,
    [activeRepositoryForLog, commitBranch, filteredCommits, workspaceCommitFiles, workspaceStatus]
  )
  const activeBranchName = workspaceStatus?.branch || activeRepositoryForLog?.currentBranch || ''
  const graphRows = useMemo(() => createGraphRows(graphCommits), [graphCommits])
  const coloredGraphRows = useMemo(() => applyBranchColorsToGraphRows(graphRows, branchTags, activeBranchName), [activeBranchName, branchTags, graphRows])
  const visibleGraphRows = useMemo(() => coloredGraphRows.slice(0, visibleCommitCount), [coloredGraphRows, visibleCommitCount])
  const graphColumnWidth = useMemo(() => getGitGraphColumnWidth(visibleGraphRows), [visibleGraphRows])
  const hasMoreCommits = visibleCommitCount < graphRows.length
  const authorOptions = useMemo(
    () =>
      Array.from(new Set(commits.map((commit) => getCommitAuthorFilterValue(commit))))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [commits]
  )

  useEffect(() => {
    setVisibleCommitCount(commitGraphBatchSize)
  }, [commitAuthor, commitBranch, commitRange.startDate, commitRange.endDate, commits])

  useEffect(() => {
    let cancelled = false

    async function loadBranchTags(): Promise<void> {
      if (!activeProjectId || !window.forgeDesk) {
        setBranchTags([])
        return
      }

      try {
        const tags = await window.forgeDesk.listProjectBranchTags(activeProjectId)

        if (!cancelled) {
          setBranchTags(tags)
        }
      } catch (error) {
        if (!cancelled) {
          setBranchTags([])
          setGitError(createGitErrorGuidance(error, '读取分支标签颜色'))
        }
      }
    }

    loadBranchTags()

    return () => {
      cancelled = true
    }
  }, [activeProjectId, branchTagRefreshToken])

  useEffect(() => {
    if (view !== 'log' || !hasMoreCommits) {
      return
    }

    const node = commitLoadMoreRef.current

    if (!node) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCommitCount((current) =>
          getNextVisibleCommitCount({
            current,
            total: graphRows.length,
            batchSize: commitGraphBatchSize
          })
        )
      }
    }, { rootMargin: '220px 0px' })

    observer.observe(node)

    return () => observer.disconnect()
  }, [graphRows.length, hasMoreCommits, view])

  useEffect(() => {
    let cancelled = false

    async function loadRepositoryDetail(): Promise<void> {
      if (!repository) {
        setDetailRepository(null)
        setCommits([])
        setWorkspaceStatus(null)
        return
      }

      setDetailRepository(repository)
      setLoadingDetail(true)
      setCommitBranch('')
      setCommitAuthor('')
      setCommitRange({ startDate: '', endDate: '' })
      setWorkspaceStatus(null)
      setSelectedCommit(null)
      setCommitFiles([])
      setSelectedFile(null)
      setCommitDiff(null)
      setDiffModalOpen(false)
      setVisibleCommitCount(commitGraphBatchSize)
      setGitError(null)

      try {
        if (window.forgeDesk) {
          const detail = await window.forgeDesk.getRepositoryDetail(repository.id)
          const [nextCommits, nextWorkspaceStatus] = await Promise.all([
            window.forgeDesk.getRepositoryCommitGraph(detail.id),
            window.forgeDesk.getRepositoryWorkspaceStatus(detail.id)
          ])

          if (cancelled) {
            return
          }

          updateRepository(detail)
          setDetailRepository(detail)
          setCommits(nextCommits)
          setWorkspaceStatus(nextWorkspaceStatus)
          onCommitCountChange?.(detail.id, nextCommits.length)
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
  }, [repository?.id, repository?.latestCommit, repository?.remoteCount, repository?.remoteBranchCount, refreshToken])

  async function refreshRepositorySnapshot({
    targetRepository = detailRepository,
    nextRange = commitRange,
    nextBranch = commitBranch,
    showSuccess = false,
    context = '刷新 Log 树'
  }: {
    targetRepository?: Repository | null
    nextRange?: { startDate: string; endDate: string }
    nextBranch?: string
    showSuccess?: boolean
    context?: string
  } = {}): Promise<void> {
    if (!targetRepository || !window.forgeDesk || repositoryRefreshInFlightRef.current) {
      return
    }

    repositoryRefreshInFlightRef.current = true
    setLoadingDetail(true)
    setSelectedCommit(null)
    setCommitFiles([])
    setSelectedFile(null)
    setCommitDiff(null)
    setDiffModalOpen(false)
    setVisibleCommitCount(commitGraphBatchSize)

    try {
      const detail = await window.forgeDesk.getRepositoryDetail(targetRepository.id)
      const [nextCommits, nextWorkspaceStatus] = await Promise.all([
        window.forgeDesk.getRepositoryCommitGraph(detail.id, {
          ...nextRange,
          branchName: nextBranch || undefined
        }),
        window.forgeDesk.getRepositoryWorkspaceStatus(detail.id)
      ])

      updateRepository(detail)
      setDetailRepository(detail)
      setCommits(nextCommits)
      setWorkspaceStatus(nextWorkspaceStatus)
      onCommitCountChange?.(detail.id, nextCommits.length)
      setGitError(null)

      if (showSuccess) {
        message.success('Log 树已刷新')
      }
    } catch (error) {
      setGitError(createGitErrorGuidance(error, context))
    } finally {
      repositoryRefreshInFlightRef.current = false
      setLoadingDetail(false)
    }
  }

  async function refreshCommits(nextRange = commitRange, nextBranch = commitBranch, targetRepository = detailRepository): Promise<void> {
    if (!targetRepository || !window.forgeDesk) {
      return
    }

    setLoadingDetail(true)
    setSelectedCommit(null)
    setCommitFiles([])
    setSelectedFile(null)
    setCommitDiff(null)
    setDiffModalOpen(false)
    setVisibleCommitCount(commitGraphBatchSize)

    try {
      const [nextCommits, nextWorkspaceStatus] = await Promise.all([
        window.forgeDesk.getRepositoryCommitGraph(targetRepository.id, {
          ...nextRange,
          branchName: nextBranch || undefined
        }),
        window.forgeDesk.getRepositoryWorkspaceStatus(targetRepository.id)
      ])

      setCommits(nextCommits)
      setWorkspaceStatus(nextWorkspaceStatus)
      onCommitCountChange?.(targetRepository.id, nextCommits.length)
      setGitError(null)
    } catch (error) {
      setGitError(createGitErrorGuidance(error, '读取提交图谱'))
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    if (!gitLogRefreshPreferences.autoRefreshEnabled || !activeRepositoryForLog || !window.forgeDesk) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (!loadingDetail) {
        void refreshRepositorySnapshot({ targetRepository: activeRepositoryForLog, context: '自动刷新 Log 树' })
      }
    }, gitLogRefreshPreferences.intervalSeconds * 1000)

    return () => window.clearInterval(intervalId)
  }, [
    activeRepositoryForLog?.id,
    commitBranch,
    commitRange.endDate,
    commitRange.startDate,
    gitLogRefreshPreferences.autoRefreshEnabled,
    gitLogRefreshPreferences.intervalSeconds,
    loadingDetail
  ])

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
      setDiffModalOpen(false)
      setVisibleCommitCount(commitGraphBatchSize)
      await refreshCommits({ startDate: '', endDate: '' }, '', synced)
      const summary = await window.forgeDesk.analyzeProjectGit(synced.projectId)
      setProjectSummary(summary)
      setGitError(null)
      message.success('远端已 Fetch，Git 数据已刷新')
    } catch (error) {
      setGitError(createGitErrorGuidance(error, '同步远端'))
    } finally {
      setSyncingRepositoryId(null)
    }
  }

  async function selectCommit(commit: RepositoryLogCommit): Promise<void> {
    if (!detailRepository || !window.forgeDesk) {
      return
    }

    if (selectedCommit?.hash === commit.hash) {
      setSelectedCommit(null)
      setCommitFiles([])
      setSelectedFile(null)
      setCommitDiff(null)
      setDiffModalOpen(false)
      return
    }

    setSelectedCommit(commit)
    setSelectedFile(null)
    setCommitDiff(null)
    setDiffModalOpen(false)
    setLoadingFiles(true)

    if (isWorkingTreeCommit(commit)) {
      setCommitFiles(commit.worktreeFiles ?? [])
      setLoadingFiles(false)
      setGitError(null)
      return
    }

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
    if (!detailRepository || !selectedCommit || isWorkingTreeCommit(selectedCommit) || !window.forgeDesk) {
      return
    }

    setSelectedFile(file)
    setCommitDiff(null)
    setDiffModalOpen(true)
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
      {showSummary && (
        <RepositorySummaryStrip
          activeRepository={activeRepository}
          repositories={repositories}
          selectedRepositoryId={selectedRepositoryId}
          commitCount={commits.length}
          onRepositoryChange={onRepositoryChange}
        />
      )}
      <GitErrorNotice guidance={gitError} onClose={() => setGitError(null)} />
      {view === 'alignment' ? (
        <RemoteAlignmentPanel alignment={activeRepository.remoteAlignment} currentBranch={activeRepository.currentBranch} />
      ) : (
        <div className="git-browser">
          <div className="panel-title source-tree-toolbar">
            <Space size={8} wrap>
              <Typography.Title level={4}>提交图谱</Typography.Title>
              <Tag color={commitBranch ? 'blue' : 'default'}>{commitBranch || '全部引用'}</Tag>
              {gitLogRefreshPreferences.autoRefreshEnabled && <Tag color="processing">{gitLogRefreshPreferences.intervalSeconds}s 自动</Tag>}
            </Space>
            <Space wrap>
              <Tooltip title="重新读取本地仓库详情、提交图谱和工作区状态">
                <Button icon={<ReloadOutlined />} loading={loadingDetail} onClick={() => refreshRepositorySnapshot({ targetRepository: activeRepository, showSuccess: true })}>
                  刷新
                </Button>
              </Tooltip>
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
            rowClassName={(commit) =>
              [
                isWorkingTreeCommit(commit) ? 'working-tree-row' : '',
                commit.hash === selectedCommit?.hash ? 'selected-row' : ''
              ]
                .filter(Boolean)
                .join(' ')
            }
            onRow={(commit) => ({ onClick: () => selectCommit(commit) })}
            columns={[
              {
                title: '图谱',
                key: 'graph',
                width: graphColumnWidth,
                className: 'commit-graph-column',
                onCell: () => ({ style: { width: graphColumnWidth, minWidth: graphColumnWidth } }),
                onHeaderCell: () => ({ style: { width: graphColumnWidth, minWidth: graphColumnWidth } }),
                render: (_, commit) => <CommitGraphCell commit={commit} />
              },
              {
                title: '提交',
                dataIndex: 'message',
                key: 'message',
                render: (_, commit) => <CommitMessageCell commit={commit} branchTags={branchTags} currentBranch={activeBranchName} />
              },
              { title: '提交人', key: 'author', width: 210, render: (_, commit) => <CommitAuthorCell commit={commit} /> },
              {
                title: '时间',
                dataIndex: 'committedAt',
                key: 'committedAt',
                width: 160,
                render: (value, commit) => (isWorkingTreeCommit(commit) ? <Typography.Text type="secondary">未提交</Typography.Text> : new Date(value).toLocaleString())
              },
              {
                title: '+/-',
                key: 'lines',
                width: 96,
                render: (_, commit) => (isWorkingTreeCommit(commit) ? `${formatNumber(commit.filesChanged)} 文件` : `${formatNumber(commit.additions)} / ${formatNumber(commit.deletions)}`)
              }
            ]}
            dataSource={visibleGraphRows}
            tableLayout="fixed"
            expandable={{
              expandedRowKeys: selectedCommit ? [selectedCommit.id] : [],
              expandedRowRender: (commit) =>
                commit.hash === selectedCommit?.hash ? (
                  <CommitInlineDetail
                    commit={commit}
                    files={commitFiles}
                    selectedFile={selectedFile}
                    loadingFiles={loadingFiles}
                    graphColumnWidth={graphColumnWidth}
                    branchTags={branchTags}
                    currentBranch={activeBranchName}
                    canOpenDiff={!isWorkingTreeCommit(commit)}
                    onSelectFile={(file) => {
                      selectCommitFile(file)
                    }}
                  />
                ) : null,
              showExpandColumn: false
            }}
            pagination={false}
            scroll={{ x: graphColumnWidth + 864 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前范围没有提交" /> }}
          />
          {graphRows.length > 0 && (
            <div ref={commitLoadMoreRef} className="commit-load-more">
              {hasMoreCommits ? (
                <Typography.Text type="secondary">
                  已显示 {formatNumber(visibleGraphRows.length)} / {formatNumber(graphRows.length)}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">已显示全部 {formatNumber(graphRows.length)} 条提交</Typography.Text>
              )}
            </div>
          )}
        </div>
      )}
      <Modal
        title={selectedFile ? `文件对比：${selectedFile.path}` : '文件对比'}
        open={diffModalOpen}
        width="calc(100vw - 64px)"
        footer={null}
        className="diff-preview-modal"
        centered
        destroyOnHidden
        onCancel={() => setDiffModalOpen(false)}
      >
        <div className="diff-preview-content">
          <div className="diff-toolbar">
            <Space size={8} wrap>
              {selectedCommit && <Tag>{selectedCommit.shortHash}</Tag>}
              {selectedFile && <Tag color={getFileStatusLabel(selectedFile.status).color}>{getFileStatusLabel(selectedFile.status).label}</Tag>}
              <Tag color="blue">上一版 / Diff 结果</Tag>
            </Space>
          </div>
          <Spin spinning={loadingDiff}>
            <DiffViewer diff={commitDiff} />
          </Spin>
        </div>
      </Modal>
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
                      className={[
                        'branch-drawer-item',
                        branch.isCurrent ? 'is-current' : '',
                        branch.isActive ? 'is-active' : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => selectBranchFilter(branch.name)}
                    >
                      <span className="branch-drawer-name">{branch.name}</span>
                      <Space size={4}>
                        {branch.isCurrent && <Tag color={currentBranchRefColor}>当前</Tag>}
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

function RepositoryTable({ repositories, branchTagRefreshToken = 0 }: { repositories: Repository[]; branchTagRefreshToken?: number }): JSX.Element {
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
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [syncingRepositoryId, setSyncingRepositoryId] = useState<string | null>(null)
  const [savingRepositoryIdentity, setSavingRepositoryIdentity] = useState(false)

  const filteredCommits = useMemo(
    () => commits.filter((commit) => !commitAuthor || getCommitAuthorFilterValue(commit) === commitAuthor),
    [commitAuthor, commits]
  )
  const graphRows = useMemo(() => createGraphRows(filteredCommits), [filteredCommits])
  const authorOptions = useMemo(
    () =>
      Array.from(new Set(commits.map((commit) => getCommitAuthorFilterValue(commit))))
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
        <RepositoryLogTree repository={detailRepository} branchTagRefreshToken={branchTagRefreshToken} />
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

function normalizeEnvironmentVariableName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()
  return normalized || 'CUSTOM_SECRET'
}

function createCustomPasswordToolItem(input: {
  mode: PasswordToolMode
  variableName: string
  length: number
  byteLength: number
  groups: PasswordCharacterGroupKey[]
}): PasswordToolItem {
  const variableName = normalizeEnvironmentVariableName(input.variableName)

  if (input.mode === 'hex') {
    return {
      id: 'custom-secret',
      label: '自定义密钥',
      variableName,
      description: '十六进制随机密钥',
      mode: 'hex',
      byteLength: input.byteLength
    }
  }

  return {
    id: 'custom-password',
    label: '自定义密码',
    variableName,
    description: '自定义字符集密码',
    mode: 'password',
    length: input.length,
    groups: input.groups
  }
}

type PasswordWorkflowMode = 'preset' | 'custom'
type ToolKey = 'password' | 'file' | 'rsa' | 'excel' | 'cli-environment'
type ExcelToolKey = 'monthly-performance'

type RsaPrivateKeyGenerationForm = {
  name: string
  notes?: string
  keySize: RsaPrivateKeySize
}

type RsaPrivateKeyEditForm = {
  name: string
  notes?: string
}

type LoadedTextFile = {
  name: string
  size: number
  content: string
}

const ENV_FILE_ACCEPT = '.env,.txt,.config,.conf,.local,.development,.production,.staging,.yaml,.yml'

function getEnvDiffStatusLabel(status: EnvFileDiffStatus): string {
  switch (status) {
    case 'same':
      return '相同'
    case 'different':
      return '值不同'
    case 'missing-in-target':
      return 'B 缺少'
    case 'extra-in-target':
      return 'B 多出'
  }
}

function getEnvDiffStatusColor(status: EnvFileDiffStatus): string {
  switch (status) {
    case 'same':
      return 'success'
    case 'different':
      return 'warning'
    case 'missing-in-target':
      return 'error'
    case 'extra-in-target':
      return 'processing'
  }
}

function matchesEnvDiffFilter(row: EnvFileDiffRow, filter: EnvFileDiffRowFilter): boolean {
  switch (filter) {
    case 'missing':
      return row.status === 'missing-in-target'
    case 'extra':
      return row.status === 'extra-in-target'
    case 'different':
      return row.status === 'different'
    case 'all':
      return true
  }
}

type EnvEnvironmentCopyMode = 'content' | 'values'
type EnvMissingVariablesCopyMode = 'names' | 'rows'
type EnvDiffInputTarget = 'source' | 'target'

async function copyText(text: string, successText: string, emptyText = '没有可复制的内容', options: { allowEmpty?: boolean } = {}): Promise<void> {
  if (!options.allowEmpty && !text.trim()) {
    message.warning(emptyText)
    return
  }

  if (!navigator.clipboard?.writeText) {
    message.error('当前环境不支持剪贴板复制')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    message.success(successText)
  } catch (error) {
    message.error(getErrorMessage(error, '复制失败'))
  }
}

async function readTextFile(file: File): Promise<LoadedTextFile> {
  return {
    name: file.name,
    size: file.size,
    content: await file.text()
  }
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatRsaPrivateKeyTime(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString()
}

function ToolsPanel(): JSX.Element {
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null)

  if (activeTool === 'password') {
    return <PasswordGeneratorTool onBack={() => setActiveTool(null)} />
  }

  if (activeTool === 'file') {
    return <FileDiffTool onBack={() => setActiveTool(null)} />
  }

  if (activeTool === 'rsa') {
    return <RsaPrivateKeyTool onBack={() => setActiveTool(null)} />
  }

  if (activeTool === 'excel') {
    return <ExcelTool onBack={() => setActiveTool(null)} />
  }

  if (activeTool === 'cli-environment') {
    return <CliEnvironmentTool onBack={() => setActiveTool(null)} />
  }

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Typography.Title level={2}>工具</Typography.Title>
          <Typography.Text type="secondary">处理日常小事务。</Typography.Text>
        </div>
      </div>

      <div className="tool-entry-grid">
        <button className="tool-entry-card" type="button" onClick={() => setActiveTool('password')}>
          <span className="password-tool-icon">
            <KeyOutlined />
          </span>
          <span className="tool-entry-copy">
            <Typography.Text strong>密码工具</Typography.Text>
            <Typography.Text type="secondary">API Key、Secret、管理员密码。</Typography.Text>
          </span>
        </button>
        <button className="tool-entry-card" type="button" onClick={() => setActiveTool('file')}>
          <span className="password-tool-icon">
            <DiffOutlined />
          </span>
          <span className="tool-entry-copy">
            <Typography.Text strong>环境变量对比</Typography.Text>
            <Typography.Text type="secondary">粘贴文本或导入文件，找出 B 缺少的变量。</Typography.Text>
          </span>
        </button>
        <button className="tool-entry-card" type="button" onClick={() => setActiveTool('rsa')}>
          <span className="password-tool-icon">
            <KeyOutlined />
          </span>
          <span className="tool-entry-copy">
            <Typography.Text strong>RSA 私钥</Typography.Text>
            <Typography.Text type="secondary">生成并管理本地私钥记录。</Typography.Text>
          </span>
        </button>
        <button className="tool-entry-card" type="button" onClick={() => setActiveTool('excel')}>
          <span className="password-tool-icon">
            <FileExcelOutlined />
          </span>
          <span className="tool-entry-copy">
            <Typography.Text strong>Excel 工具</Typography.Text>
            <Typography.Text type="secondary">用 AI 整理数据并生成工作簿。</Typography.Text>
          </span>
        </button>
        <button className="tool-entry-card" type="button" onClick={() => setActiveTool('cli-environment')}>
          <span className="password-tool-icon">
            <CodeOutlined />
          </span>
          <span className="tool-entry-copy">
            <Typography.Text strong>命令行环境</Typography.Text>
            <Typography.Text type="secondary">检测 profile、PATH、Git 提示符。</Typography.Text>
          </span>
        </button>
      </div>
    </section>
  )
}

function splitCliEnvironmentPath(value: string, platform: CliEnvironmentSnapshot['platform']): string[] {
  const delimiter = platform === 'win32' ? ';' : ':'

  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getCliEnvironmentIssueAlertType(issue: CliEnvironmentIssue): 'success' | 'warning' | 'error' | 'info' {
  if (issue.status === 'error') {
    return 'error'
  }

  if (issue.status === 'warning') {
    return 'warning'
  }

  return 'success'
}

function getCliEnvironmentStatus(snapshot: CliEnvironmentSnapshot | null): { type: 'success' | 'warning' | 'info'; message: string; description: string } {
  if (!snapshot) {
    return { type: 'info', message: '等待检测', description: '正在读取当前 shell 配置。' }
  }

  if (snapshot.issues.length === 0) {
    return { type: 'success', message: '命令行环境正常', description: '新的 ForgeDesk 终端可以读取用户环境，并已有目录颜色和 Git 开发提示。' }
  }

  return { type: 'warning', message: '命令行环境需要修复', description: `发现 ${snapshot.issues.length} 个可改进项，其中 ${snapshot.repairableActions.length} 个可以自动修复。` }
}

function CliEnvironmentTool({ onBack }: { onBack: () => void }): JSX.Element {
  const [snapshot, setSnapshot] = useState<CliEnvironmentSnapshot | null>(null)
  const [repairResult, setRepairResult] = useState<CliEnvironmentRepairResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [openingTerminal, setOpeningTerminal] = useState(false)
  const statusView = getCliEnvironmentStatus(snapshot)
  const mergedPathItems = snapshot ? splitCliEnvironmentPath(snapshot.mergedPath, snapshot.platform).slice(0, 14) : []
  const repairDisabled = !snapshot || snapshot.repairableActions.length === 0 || repairing || loading

  async function refreshEnvironment(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoading(true)

    try {
      setSnapshot(await window.forgeDesk.inspectCliEnvironment())
      setRepairResult(null)
    } catch (error) {
      message.error(getErrorMessage(error, '检测命令行环境失败'))
    } finally {
      setLoading(false)
    }
  }

  async function repairEnvironment(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setRepairing(true)

    try {
      const result = await window.forgeDesk.repairCliEnvironment()
      setRepairResult(result)
      setSnapshot(result.snapshot)
      message.success(result.appliedActions.length > 0 ? '命令行环境已修复' : '没有需要修复的项目')
    } catch (error) {
      message.error(getErrorMessage(error, '修复命令行环境失败'))
    } finally {
      setRepairing(false)
    }
  }

  async function openVerificationTerminal(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setOpeningTerminal(true)

    try {
      await window.forgeDesk.openTerminal({
        title: '命令行环境验证',
        startupCommand: 'echo "ForgeDesk CLI environment"; echo "SHELL=$SHELL"; echo "PATH=$PATH"; command -v git; git --version; echo; echo "ls -al preview:"; ls -al; \r'
      })
      message.success('验证终端已打开')
    } catch (error) {
      message.error(getErrorMessage(error, '打开验证终端失败'))
    } finally {
      setOpeningTerminal(false)
    }
  }

  useEffect(() => {
    void refreshEnvironment()
  }, [])

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            工具
          </Button>
          <Typography.Title level={2}>命令行环境</Typography.Title>
          <Typography.Text type="secondary">检测 shell 启动链、PATH、Git 和开发提示符。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => refreshEnvironment()}>
            重新检测
          </Button>
          <Button icon={<DesktopOutlined />} loading={openingTerminal} onClick={() => openVerificationTerminal()}>
            打开验证终端
          </Button>
          <Button type="primary" icon={<ToolOutlined />} disabled={repairDisabled} loading={repairing} onClick={() => repairEnvironment()}>
            自动修复
          </Button>
        </Space>
      </div>

      <div className="cli-env-layout">
        <div className="panel cli-env-status-panel">
          <div className="password-tool-heading">
            <span className="password-tool-icon">
              <CodeOutlined />
            </span>
            <div>
              <Typography.Title level={3}>环境状态</Typography.Title>
              <Typography.Text type="secondary">新建终端会使用这里检测到的 shell 配置。</Typography.Text>
            </div>
          </div>

          <Spin spinning={loading && !snapshot}>
            <Space direction="vertical" size={14} className="full-width-control">
              <Alert type={statusView.type} showIcon message={statusView.message} description={statusView.description} />

              {snapshot && (
                <>
                  <div className="cli-env-summary-grid">
                    <div className="cli-env-summary-item">
                      <Typography.Text type="secondary">Shell</Typography.Text>
                      <Typography.Text code ellipsis={{ tooltip: snapshot.shell }}>{snapshot.shellName}</Typography.Text>
                    </div>
                    <div className="cli-env-summary-item">
                      <Typography.Text type="secondary">.profile</Typography.Text>
                      <Tag color={snapshot.profileSourcedFromLoginFile ? 'green' : 'gold'}>{snapshot.profileSourcedFromLoginFile ? '已加载' : '未加载'}</Tag>
                    </div>
                    <div className="cli-env-summary-item">
                      <Typography.Text type="secondary">Git Prompt</Typography.Text>
                      <Tag color={snapshot.promptConfigured ? 'green' : 'gold'}>{snapshot.promptProvider || '未配置'}</Tag>
                    </div>
                    <div className="cli-env-summary-item">
                      <Typography.Text type="secondary">ls 颜色</Typography.Text>
                      <Tag color={snapshot.listingColorsConfigured ? 'green' : 'gold'}>{snapshot.listingColorProvider || '未开启'}</Tag>
                    </div>
                    <div className="cli-env-summary-item">
                      <Typography.Text type="secondary">PNPM_HOME</Typography.Text>
                      <Typography.Text ellipsis={{ tooltip: snapshot.pnpmHome || '未读取' }}>{snapshot.pnpmHome || '-'}</Typography.Text>
                    </div>
                  </div>

                  <div className="cli-env-file-list">
                    {snapshot.configFiles.map((file) => (
                      <div className="cli-env-file-row" key={file.key}>
                        <Space size={8} wrap>
                          <Typography.Text strong>{file.label}</Typography.Text>
                          <Tag color={file.exists ? 'blue' : 'default'}>{file.exists ? '存在' : '缺失'}</Tag>
                          {file.managed && <Tag color="green">ForgeDesk</Tag>}
                        </Space>
                        <Typography.Text type="secondary" ellipsis={{ tooltip: file.path }}>{file.path}</Typography.Text>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Space>
          </Spin>
        </div>

        <div className="panel cli-env-details-panel">
          <div className="password-tool-heading">
            <span className="password-tool-icon">
              <DashboardOutlined />
            </span>
            <div>
              <Typography.Title level={3}>检测结果</Typography.Title>
              <Typography.Text type="secondary">Git、ls、PATH 和可修复项。</Typography.Text>
            </div>
          </div>

          {!snapshot ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="正在检测命令行环境" />
          ) : (
            <Space direction="vertical" size={14} className="full-width-control">
              {snapshot.commands.map((command) => (
                <div className="cli-env-command-row" key={command.name}>
                  <Space size={8} wrap>
                    <Typography.Text strong>{command.name}</Typography.Text>
                    <Tag color={command.available ? 'green' : 'red'}>{command.available ? '可用' : '缺失'}</Tag>
                    {command.version && <Tag>{command.version}</Tag>}
                  </Space>
                  <Typography.Text type={command.available ? 'secondary' : 'danger'} ellipsis={{ tooltip: command.path || command.error }}>
                    {command.path || command.error || '-'}
                  </Typography.Text>
                </div>
              ))}

              {snapshot.issues.length > 0 ? (
                <Space direction="vertical" size={10} className="full-width-control">
                  {snapshot.issues.map((issue) => (
                    <Alert key={issue.id} type={getCliEnvironmentIssueAlertType(issue)} showIcon message={issue.title} description={issue.detail} />
                  ))}
                </Space>
              ) : (
                <Alert type="success" showIcon message="没有发现需要处理的问题" />
              )}

              <div className="cli-env-path-panel">
                <div className="cli-env-path-heading">
                  <Typography.Text strong>合并后的 PATH</Typography.Text>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => copyText(snapshot.mergedPath, 'PATH 已复制')}>
                    复制
                  </Button>
                </div>
                <pre>{mergedPathItems.map((item, index) => `${index + 1}. ${item}`).join('\n') || '未读取到 PATH'}</pre>
              </div>

              {repairResult && (
                <Alert
                  type={repairResult.appliedActions.length > 0 ? 'success' : 'info'}
                  showIcon
                  message={repairResult.appliedActions.length > 0 ? '修复已完成' : '没有写入新配置'}
                  description={[
                    ...repairResult.changedFiles.map((file) => `已更新：${file}`),
                    ...repairResult.backupFiles.map((file) => `备份：${file}`)
                  ].join('\n') || '当前配置已经满足检测项。'}
                />
              )}
            </Space>
          )}
        </div>
      </div>
    </section>
  )
}

function getCurrentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ExcelTool({ onBack }: { onBack: () => void }): JSX.Element {
  const [activeExcelTool, setActiveExcelTool] = useState<ExcelToolKey | null>(null)

  if (activeExcelTool === 'monthly-performance') {
    return <MonthlyPerformanceTool onBack={() => setActiveExcelTool(null)} />
  }

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            工具
          </Button>
          <Typography.Title level={2}>Excel 工具</Typography.Title>
          <Typography.Text type="secondary">选择一种工作簿生成方式。</Typography.Text>
        </div>
      </div>

      <div className="tool-entry-grid">
        <button className="tool-entry-card" type="button" onClick={() => setActiveExcelTool('monthly-performance')}>
          <span className="password-tool-icon">
            <FileExcelOutlined />
          </span>
          <span className="tool-entry-copy">
            <Typography.Text strong>月度绩效</Typography.Text>
            <Typography.Text type="secondary">结合项目数据和 AI 口径生成绩效 Excel。</Typography.Text>
          </span>
        </button>
      </div>
    </section>
  )
}

function getMonthlyPerformanceStatusTag(status: MonthlyPerformanceSession['status']): JSX.Element {
  const view = {
    draft: { color: 'default', label: '对话中' },
    ready: { color: 'blue', label: '待导出' },
    exported: { color: 'green', label: '已生成' }
  }[status]

  return <Tag color={view.color}>{view.label}</Tag>
}

function formatMonthlyPerformanceTime(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString()
}

function createMonthlyPerformanceColumns(): ColumnsType<MonthlyPerformanceRow> {
  return [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 130, fixed: 'left' },
    { title: '角色', dataIndex: 'role', key: 'role', width: 120 },
    { title: '邮箱/身份', dataIndex: 'identity', key: 'identity', width: 210, render: (value: string) => <Typography.Text ellipsis={{ tooltip: value }}>{value || '-'}</Typography.Text> },
    { title: '提交数', dataIndex: 'commits', key: 'commits', width: 95, render: (value: number) => formatNumber(value) },
    { title: '新增行', dataIndex: 'additions', key: 'additions', width: 105, render: (value: number) => formatNumber(value) },
    { title: '删除行', dataIndex: 'deletions', key: 'deletions', width: 105, render: (value: number) => formatNumber(value) },
    { title: '变更文件', dataIndex: 'filesChanged', key: 'filesChanged', width: 105, render: (value: number) => formatNumber(value) },
    { title: '活跃天数', dataIndex: 'activeDays', key: 'activeDays', width: 105, render: (value: number) => formatNumber(value) },
    { title: '完成工作项', dataIndex: 'completedWorkItems', key: 'completedWorkItems', width: 115, render: (value: number) => formatNumber(value) },
    { title: '进行中工作项', dataIndex: 'inProgressWorkItems', key: 'inProgressWorkItems', width: 130, render: (value: number) => formatNumber(value) },
    { title: '逾期工作项', dataIndex: 'overdueWorkItems', key: 'overdueWorkItems', width: 115, render: (value: number) => formatNumber(value) },
    { title: 'AI 分数', dataIndex: 'aiScore', key: 'aiScore', width: 95 },
    { title: '绩效等级', dataIndex: 'performanceLevel', key: 'performanceLevel', width: 105, render: (value: string) => <Tag color={value === 'A' ? 'green' : value === 'B' ? 'blue' : value === 'C' ? 'gold' : 'default'}>{value || '待评估'}</Tag> },
    { title: '亮点', dataIndex: 'highlights', key: 'highlights', width: 240, render: (value: string) => <Typography.Text ellipsis={{ tooltip: value }}>{value || '-'}</Typography.Text> },
    { title: '风险/改进', dataIndex: 'risks', key: 'risks', width: 240, render: (value: string) => <Typography.Text ellipsis={{ tooltip: value }}>{value || '-'}</Typography.Text> },
    { title: '下月建议', dataIndex: 'nextMonthPlan', key: 'nextMonthPlan', width: 240, render: (value: string) => <Typography.Text ellipsis={{ tooltip: value }}>{value || '-'}</Typography.Text> },
    { title: '备注', dataIndex: 'notes', key: 'notes', width: 220, render: (value: string) => <Typography.Text ellipsis={{ tooltip: value }}>{value || '-'}</Typography.Text> }
  ]
}

function MonthlyPerformancePreviewPanel({ session }: { session: MonthlyPerformanceSession }): JSX.Element {
  const preview = session.preview
  const columns = useMemo(() => createMonthlyPerformanceColumns(), [])

  if (!preview) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="确认生成数据后显示表格预览" />
  }

  return (
    <Space direction="vertical" className="monthly-performance-preview" size={14}>
      <Row gutter={[10, 10]}>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="提交数" value={preview.totalCommits} /></div></Col>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="贡献人数" value={preview.contributorCount} /></div></Col>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="新增行" value={preview.totalAdditions} /></div></Col>
        <Col xs={24} md={6}><div className="metric-tile"><Statistic title="活跃天数" value={preview.activeDays} /></div></Col>
      </Row>
      {preview.aiSummary && <Alert type="info" showIcon message={preview.aiSummary} />}
      {preview.warnings.length > 0 && <Alert type="warning" showIcon message={preview.warnings.join('；')} />}
      {session.filePath && <Alert type="success" showIcon message="Excel 已生成" description={session.filePath} />}
      <Table
        className="content-table monthly-performance-table"
        rowKey={(row) => row.personId || row.identity || row.name}
        columns={columns}
        dataSource={preview.rows}
        scroll={{ x: 2440 }}
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="预览中没有人员明细" /> }}
      />
    </Space>
  )
}

function MonthlyPerformanceChatPage({
  initialSession,
  onBack,
  onSessionChange
}: {
  initialSession: MonthlyPerformanceSession
  onBack: () => void
  onSessionChange: (session: MonthlyPerformanceSession) => void
}): JSX.Element {
  const { projects } = useForgeDeskStore()
  const [session, setSession] = useState(initialSession)
  const [projectId, setProjectId] = useState(initialSession.projectId)
  const [month, setMonth] = useState(initialSession.month)
  const [draftMessage, setDraftMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState(false)

  function commitSession(nextSession: MonthlyPerformanceSession): void {
    setSession(nextSession)
    setProjectId(nextSession.projectId)
    setMonth(nextSession.month)
    onSessionChange(nextSession)
  }

  async function sendMessage(): Promise<void> {
    const content = draftMessage.trim()

    if (!window.forgeDesk || !content) {
      return
    }

    setSending(true)

    try {
      const nextSession = await window.forgeDesk.sendMonthlyPerformanceSessionMessage({
        sessionId: session.id,
        projectId,
        month,
        content
      })
      setDraftMessage('')
      commitSession(nextSession)
    } catch (error) {
      message.error(getErrorMessage(error, '发送绩效对话失败'))
    } finally {
      setSending(false)
    }
  }

  async function confirmData(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setConfirming(true)

    try {
      const nextSession = await window.forgeDesk.confirmMonthlyPerformanceSession({ sessionId: session.id, projectId, month })
      commitSession(nextSession)
      message.success('绩效数据已整理成表格')
    } catch (error) {
      message.error(getErrorMessage(error, '确认生成数据失败'))
    } finally {
      setConfirming(false)
    }
  }

  async function exportSession(): Promise<void> {
    if (!window.forgeDesk || !session.preview) {
      return
    }

    setExporting(true)

    try {
      const nextSession = await window.forgeDesk.exportMonthlyPerformanceSession({ sessionId: session.id })
      commitSession(nextSession)

      if (nextSession.filePath) {
        message.success('月度绩效 Excel 已生成')
      }
    } catch (error) {
      message.error(getErrorMessage(error, '生成 Excel 失败'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="workspace-section tools-workspace monthly-performance-chat-page">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            月度绩效
          </Button>
          <Typography.Title level={2}>新增绩效</Typography.Title>
          <Typography.Text type="secondary">{session.title}</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<CheckCircleOutlined />} loading={confirming} disabled={sending} onClick={confirmData}>
            确认生成数据
          </Button>
          <Button type="primary" icon={<FileExcelOutlined />} loading={exporting} disabled={!session.preview || confirming} onClick={exportSession}>
            生成 Excel
          </Button>
        </Space>
      </div>

      <div className="monthly-performance-chat-shell">
        <div className="panel monthly-performance-chat-panel">
          <div className="monthly-performance-chat-toolbar">
            <Select
              className="monthly-performance-project-select"
              value={projectId || undefined}
              placeholder="选择项目"
              options={projects.map((project) => ({ label: project.name, value: project.id }))}
              onChange={setProjectId}
            />
            <Input className="monthly-performance-month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <div className="monthly-performance-chat-messages">
            {session.messages.map((chatMessage) => (
              <div className={`monthly-performance-message is-${chatMessage.role}`} key={chatMessage.id}>
                <div className="monthly-performance-message-role">{chatMessage.role === 'user' ? '你' : 'AI'}</div>
                <div className="monthly-performance-message-bubble">{chatMessage.content}</div>
              </div>
            ))}
          </div>
          <div className="monthly-performance-composer">
            <Input.TextArea
              rows={4}
              value={draftMessage}
              placeholder="告诉我绩效规则、补充事实、成员评价或你想要的表格口径。"
              onChange={(event) => setDraftMessage(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <Button type="primary" icon={<ArrowRightOutlined />} loading={sending} disabled={!draftMessage.trim()} onClick={() => void sendMessage()}>
              发送
            </Button>
          </div>
        </div>

        <div className="panel monthly-performance-preview-panel">
          <div className="password-tool-heading">
            <span className="password-tool-icon">
              <FileExcelOutlined />
            </span>
            <div>
              <Typography.Title level={3}>表格预览</Typography.Title>
              <Typography.Text type="secondary">确认生成数据后，可导出 Excel。</Typography.Text>
            </div>
          </div>
          <MonthlyPerformancePreviewPanel session={session} />
        </div>
      </div>
    </section>
  )
}

function MonthlyPerformanceTool({ onBack }: { onBack: () => void }): JSX.Element {
  const { projects, selectedProjectId } = useForgeDeskStore()
  const [sessions, setSessions] = useState<MonthlyPerformanceSession[]>([])
  const [activeSession, setActiveSession] = useState<MonthlyPerformanceSession | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)

  async function refreshSessions(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoadingSessions(true)

    try {
      setSessions(await window.forgeDesk.listMonthlyPerformanceSessions())
    } catch (error) {
      message.error(getErrorMessage(error, '读取月度绩效历史失败'))
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    void refreshSessions()
  }, [])

  function updateSessionList(nextSession: MonthlyPerformanceSession): void {
    setSessions((current) => [nextSession, ...current.filter((item) => item.id !== nextSession.id)])
  }

  async function createSession(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    const projectId = selectedProjectId || projects[0]?.id

    if (!projectId) {
      message.warning('请先创建项目')
      return
    }

    setCreatingSession(true)

    try {
      const nextSession = await window.forgeDesk.createMonthlyPerformanceSession({
        projectId,
        month: getCurrentMonthValue()
      })
      updateSessionList(nextSession)
      setActiveSession(nextSession)
    } catch (error) {
      message.error(getErrorMessage(error, '新增绩效失败'))
    } finally {
      setCreatingSession(false)
    }
  }

  const columns: ColumnsType<MonthlyPerformanceSession> = [
    {
      title: '绩效记录',
      key: 'session',
      width: 320,
      render: (_, session) => (
        <Space direction="vertical" size={2}>
          <Space size={8} wrap>
            <Typography.Text strong>{session.title}</Typography.Text>
            <Button
              className="table-link-button"
              size="small"
              type="link"
              onClick={(event) => {
                event.stopPropagation()
                setActiveSession(session)
              }}
            >
              查看
            </Button>
          </Space>
          <Typography.Text type="secondary">{session.projectName} · {session.month}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: MonthlyPerformanceSession['status']) => getMonthlyPerformanceStatusTag(status)
    },
    {
      title: '聊天',
      key: 'messages',
      width: 100,
      render: (_, session) => formatNumber(session.messages.length)
    },
    {
      title: 'Excel',
      key: 'excel',
      width: 360,
      render: (_, session) =>
        session.filePath ? (
          <Typography.Text ellipsis={{ tooltip: session.filePath }}>{session.filePath}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">未生成</Typography.Text>
        )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 190,
      render: (value: string) => formatMonthlyPerformanceTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, session) => (
        <Button size="small" icon={<ArrowRightOutlined />} onClick={() => setActiveSession(session)}>
          进入
        </Button>
      )
    }
  ]

  if (activeSession) {
    return (
      <MonthlyPerformanceChatPage
        initialSession={activeSession}
        onBack={() => {
          setActiveSession(null)
          void refreshSessions()
        }}
        onSessionChange={(session) => {
          setActiveSession(session)
          updateSessionList(session)
        }}
      />
    )
  }

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            Excel 工具
          </Button>
          <Typography.Title level={2}>月度绩效</Typography.Title>
          <Typography.Text type="secondary">查看历史绩效对话和已生成的 Excel。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loadingSessions} onClick={() => refreshSessions()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} loading={creatingSession} onClick={createSession}>
            新增绩效
          </Button>
        </Space>
      </div>

      <div className="panel monthly-performance-history-panel">
        <Table
          className="content-table monthly-performance-history-table"
          rowKey="id"
          columns={columns}
          dataSource={sessions}
          loading={loadingSessions}
          pagination={false}
          onRow={(session) => ({
            className: 'clickable-table-row',
            onClick: () => setActiveSession(session)
          })}
          scroll={{ x: 1220 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有月度绩效记录" /> }}
        />
      </div>
    </section>
  )
}

function RsaPrivateKeyTool({ onBack }: { onBack: () => void }): JSX.Element {
  const [form] = Form.useForm<RsaPrivateKeyGenerationForm>()
  const [editForm] = Form.useForm<RsaPrivateKeyEditForm>()
  const [records, setRecords] = useState<RsaPrivateKeyRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RsaPrivateKeyRecord | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function refreshRecords(): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setLoadingRecords(true)

    try {
      setRecords(await window.forgeDesk.listRsaPrivateKeys())
    } catch (error) {
      message.error(getErrorMessage(error, '读取 RSA 私钥记录失败'))
    } finally {
      setLoadingRecords(false)
    }
  }

  useEffect(() => {
    void refreshRecords()
  }, [])

  async function generateRsaPrivateKey(values: RsaPrivateKeyGenerationForm): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    setGenerating(true)

    try {
      const record = await window.forgeDesk.createRsaPrivateKey(values)
      setRecords((current) => [record, ...current])
      form.resetFields()
      form.setFieldsValue({ keySize: 2048 })
      setGenerationModalOpen(false)
      message.success('RSA 私钥已生成')
    } catch (error) {
      message.error(getErrorMessage(error, '生成 RSA 私钥失败'))
    } finally {
      setGenerating(false)
    }
  }

  function closeGenerationModal(): void {
    if (generating) {
      return
    }

    setGenerationModalOpen(false)
    form.resetFields()
    form.setFieldsValue({ keySize: 2048 })
  }

  function openEditRecord(record: RsaPrivateKeyRecord): void {
    setEditingRecord(record)
    editForm.setFieldsValue({
      name: record.name,
      notes: record.notes
    })
  }

  async function saveEditedRecord(values: RsaPrivateKeyEditForm): Promise<void> {
    if (!window.forgeDesk || !editingRecord) {
      return
    }

    setSavingEdit(true)

    try {
      const updated = await window.forgeDesk.updateRsaPrivateKey({
        id: editingRecord.id,
        ...values
      })
      setRecords((current) => current.map((record) => (record.id === updated.id ? updated : record)))
      setEditingRecord(null)
      message.success('RSA 私钥记录已更新')
    } catch (error) {
      message.error(getErrorMessage(error, '更新 RSA 私钥记录失败'))
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteRecord(record: RsaPrivateKeyRecord): Promise<void> {
    if (!window.forgeDesk) {
      return
    }

    try {
      setRecords(await window.forgeDesk.deleteRsaPrivateKey(record.id))
      message.success('RSA 私钥记录已删除')
    } catch (error) {
      message.error(getErrorMessage(error, '删除 RSA 私钥记录失败'))
    }
  }

  const columns: ColumnsType<RsaPrivateKeyRecord> = useMemo(
    () => [
      {
        title: '记录',
        key: 'record',
        width: 260,
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong className="table-text" ellipsis={{ tooltip: record.name }}>
              {record.name}
            </Typography.Text>
            <Typography.Text className="table-text" type="secondary" ellipsis={{ tooltip: record.notes || '无备注' }}>
              {record.notes || '无备注'}
            </Typography.Text>
          </Space>
        )
      },
      {
        title: '位数',
        dataIndex: 'keySize',
        key: 'keySize',
        width: 92,
        render: (keySize: RsaPrivateKeySize) => <Tag color={keySize === 4096 ? 'blue' : 'default'}>{keySize}</Tag>
      },
      {
        title: '指纹',
        dataIndex: 'fingerprint',
        key: 'fingerprint',
        width: 300,
        render: (fingerprint: string) => <Typography.Text code ellipsis={{ tooltip: fingerprint }}>{fingerprint}</Typography.Text>
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (createdAt: string) => formatRsaPrivateKeyTime(createdAt)
      },
      {
        title: '操作',
        key: 'actions',
        width: 240,
        render: (_, record) => (
          <Space wrap>
            <Tooltip title="复制公钥">
              <Button size="small" icon={<UnlockOutlined />} onClick={() => copyText(record.publicKeyPem, 'RSA 公钥已复制')} />
            </Tooltip>
            <Tooltip title="复制私钥">
              <Button size="small" icon={<LockOutlined />} onClick={() => copyText(record.privateKeyPem, 'RSA 私钥已复制')} />
            </Tooltip>
            <Tooltip title="命名和备注">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEditRecord(record)} />
            </Tooltip>
            <Popconfirm
              title="删除这条 RSA 私钥记录？"
              description="删除后无法从 ForgeDesk 记录中恢复。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteRecord(record)}
            >
              <Tooltip title="删除">
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    ],
    []
  )

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            工具
          </Button>
          <Typography.Title level={2}>RSA 私钥</Typography.Title>
          <Typography.Text type="secondary">生成 RSA 私钥，并保留可命名、可备注的本地记录。</Typography.Text>
        </div>
        <Space wrap>
          <Button className="rsa-generate-action" type="primary" icon={<KeyOutlined />} onClick={() => setGenerationModalOpen(true)}>
            生成 RSA 私钥
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refreshRecords()} loading={loadingRecords}>
            刷新
          </Button>
        </Space>
      </div>

      <div className="panel rsa-records-panel">
        <div className="password-tool-heading">
          <span className="password-tool-icon">
            <FileTextOutlined />
          </span>
          <div>
            <Typography.Title level={3}>已生成记录</Typography.Title>
            <Typography.Text type="secondary">复制公钥或私钥，维护名称和备注。</Typography.Text>
          </div>
        </div>

        <Table
          className="content-table rsa-records-table"
          rowKey="id"
          columns={columns}
          dataSource={records}
          loading={loadingRecords}
          pagination={false}
          scroll={{ x: 1080 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成 RSA 私钥" /> }}
        />
      </div>

      <Modal
        title="生成 RSA 私钥"
        open={generationModalOpen}
        confirmLoading={generating}
        okText="生成"
        cancelText="取消"
        closable={!generating}
        maskClosable={!generating}
        onOk={() => form.submit()}
        onCancel={closeGenerationModal}
      >
        <Alert type="info" showIcon message="私钥完整内容只保存在本机应用数据库中。" />
        <Form form={form} layout="vertical" className="rsa-generation-modal-form" initialValues={{ keySize: 2048 }} onFinish={generateRsaPrivateKey}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入记录名称' }]}>
            <Input placeholder="例如：支付回调签名私钥" />
          </Form.Item>
          <Form.Item name="keySize" label="位数" rules={[{ required: true, message: '请选择 RSA 位数' }]}>
            <Select
              options={[
                { label: '2048 位', value: 2048 },
                { label: '4096 位', value: 4096 }
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={4} placeholder="用途、环境、轮换说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑 RSA 私钥记录"
        open={Boolean(editingRecord)}
        confirmLoading={savingEdit}
        okText="保存"
        cancelText="取消"
        onOk={() => editForm.submit()}
        onCancel={() => setEditingRecord(null)}
      >
        <Form form={editForm} layout="vertical" onFinish={saveEditedRecord}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入记录名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}

function FileDiffTool({ onBack }: { onBack: () => void }): JSX.Element {
  const [tasks, setTasks] = useState<EnvFileDiffTask[]>(() => {
    const storedTasks = readStoredEnvFileDiffTasks()
    return storedTasks.length > 0 ? storedTasks : [createEnvFileDiffTask()]
  })
  const [activeTaskId, setActiveTaskId] = useState(() => readStoredEnvFileDiffActiveTaskId())
  const [taskQuery, setTaskQuery] = useState('')
  const activeTask = useMemo(() => tasks.find((task) => task.id === activeTaskId) ?? tasks[0] ?? null, [activeTaskId, tasks])
  const sourceText = activeTask?.sourceText ?? ''
  const targetText = activeTask?.targetText ?? ''
  const sourceFile = activeTask?.sourceFile ?? null
  const targetFile = activeTask?.targetFile ?? null
  const resultFilter = activeTask?.resultFilter ?? 'all'
  const sourceVariables: EnvFileVariables = useMemo(() => parseEnvFileVariables(sourceText), [sourceText])
  const targetVariables: EnvFileVariables = useMemo(() => parseEnvFileVariables(targetText), [targetText])
  const diffResult: EnvFileDiffResult | null = useMemo(
    () => (sourceText.trim() || targetText.trim() ? compareEnvFiles(sourceText, targetText) : null),
    [sourceText, targetText]
  )
  const visibleRows = useMemo(() => diffResult?.rows.filter((row) => matchesEnvDiffFilter(row, resultFilter)) ?? [], [diffResult, resultFilter])
  const missingVariablesText = diffResult ? formatVariableNames(diffResult.missingInTarget) : ''
  const missingVariableRowsText = useMemo(() => {
    if (!diffResult) {
      return ''
    }

    const missingVariableNames = new Set(diffResult.missingInTarget)
    return formatEnvVariableRows(sourceVariables.variables.filter((variable) => missingVariableNames.has(variable.name)))
  }, [diffResult, sourceVariables.variables])
  const hasAnyInput = Boolean(sourceText.trim() || targetText.trim() || sourceFile || targetFile)
  const activeIssueCount = diffResult ? diffResult.missingInTarget.length + diffResult.extraInTarget.length + diffResult.differentValues.length : 0
  const normalizedTaskQuery = taskQuery.trim().toLowerCase()
  const taskListItems = useMemo(
    () =>
      tasks.map((task) => {
        const hasTaskInput = Boolean(task.sourceText.trim() || task.targetText.trim() || task.sourceFile || task.targetFile)
        const taskDiff = hasTaskInput ? compareEnvFiles(task.sourceText, task.targetText) : null
        const displayTitle = getTaskDisplayTitle(task)
        const fileLabel = getTaskFileLabel(task)
        const issueCount = taskDiff ? taskDiff.missingInTarget.length + taskDiff.extraInTarget.length + taskDiff.differentValues.length : 0
        const variableCount = taskDiff ? new Set([...taskDiff.sourceVariables, ...taskDiff.targetVariables]).size : 0
        const searchText = [
          displayTitle,
          fileLabel,
          task.title,
          task.sourceFile?.name ?? '',
          task.targetFile?.name ?? '',
          ...(taskDiff?.sourceVariables ?? []),
          ...(taskDiff?.targetVariables ?? [])
        ]
          .join(' ')
          .toLowerCase()

        return {
          task,
          displayTitle,
          fileLabel,
          hasTaskInput,
          issueCount,
          variableCount,
          searchText
        }
      }),
    [tasks]
  )
  const visibleTaskListItems = useMemo(
    () => (normalizedTaskQuery ? taskListItems.filter((item) => item.searchText.includes(normalizedTaskQuery)) : taskListItems),
    [normalizedTaskQuery, taskListItems]
  )

  useEffect(() => {
    writeStoredEnvFileDiffTasks(tasks)
  }, [tasks])

  useEffect(() => {
    if (activeTask && activeTask.id !== activeTaskId) {
      setActiveTaskId(activeTask.id)
    }
  }, [activeTask, activeTaskId])

  useEffect(() => {
    writeStoredEnvFileDiffActiveTaskId(activeTask?.id ?? '')
  }, [activeTask?.id])

  function sortTasks(nextTasks: EnvFileDiffTask[]): EnvFileDiffTask[] {
    return [...nextTasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  function commitActiveTask(patch: Partial<EnvFileDiffTask>): void {
    if (!activeTask) {
      return
    }

    const updatedAt = new Date().toISOString()
    setTasks((current) =>
      sortTasks(
        current.map((task) =>
          task.id === activeTask.id
            ? {
                ...task,
                ...patch,
                updatedAt
              }
            : task
        )
      )
    )
  }

  function createTask(): void {
    const task = createEnvFileDiffTask()
    setTasks((current) => [task, ...current])
    setActiveTaskId(task.id)
  }

  function deleteTask(taskId: string): void {
    const remainingTasks = tasks.filter((task) => task.id !== taskId)
    const fallbackTask = remainingTasks[0] ?? createEnvFileDiffTask()
    const nextTasks = remainingTasks.length > 0 ? remainingTasks : [fallbackTask]

    setTasks(nextTasks)

    if (!activeTask || taskId === activeTask.id || !nextTasks.some((task) => task.id === activeTask.id)) {
      setActiveTaskId(nextTasks[0].id)
    }

    message.success('对比任务已删除')
  }

  function getTaskFileMeta(file: LoadedTextFile): EnvFileDiffTaskFile {
    return {
      name: file.name,
      size: file.size
    }
  }

  function getTaskDisplayTitle(task: EnvFileDiffTask): string {
    const customTitle = task.title.trim()
    const fileLabels = [
      task.sourceFile ? `A: ${task.sourceFile.name}` : '',
      task.targetFile ? `B: ${task.targetFile.name}` : ''
    ].filter(Boolean)

    if (customTitle && customTitle !== '环境变量对比') {
      return customTitle
    }

    if (fileLabels.length > 0) {
      return fileLabels.join(' / ')
    }

    return `环境变量对比 · ${formatRsaPrivateKeyTime(task.createdAt)}`
  }

  function getTaskFileLabel(task: EnvFileDiffTask): string {
    const fileLabels = [
      task.sourceFile ? `A ${task.sourceFile.name}` : '',
      task.targetFile ? `B ${task.targetFile.name}` : ''
    ].filter(Boolean)

    return fileLabels.length > 0 ? fileLabels.join(' / ') : `更新 ${formatRsaPrivateKeyTime(task.updatedAt)}`
  }

  function updateTaskTitle(value: string): void {
    commitActiveTask({ title: value })
  }

  function normalizeTaskTitle(): void {
    const nextTitle = activeTask?.title.trim() || '环境变量对比'
    commitActiveTask({ title: nextTitle })
  }

  function updateVariableValue(variableName: string, target: 'source' | 'target', value: string): void {
    if (target === 'source') {
      commitActiveTask({
        sourceText: updateEnvVariableValue(sourceText, variableName, value),
        sourceFile: null
      })
      return
    }

    commitActiveTask({
      targetText: updateEnvVariableValue(targetText, variableName, value),
      targetFile: null
    })
  }

  function renderValueInput(value: string, variableName: string, target: 'source' | 'target', isMissing: boolean): JSX.Element {
    const environmentName = target === 'source' ? '环境 A' : '环境 B'

    return (
      <Input.TextArea
        className="env-diff-value-input"
        value={value}
        autoSize={{ minRows: 1, maxRows: 4 }}
        placeholder={isMissing ? `未设置，输入后写入${environmentName}` : '空值'}
        onChange={(event) => updateVariableValue(variableName, target, event.target.value)}
      />
    )
  }

  const diffColumns: ColumnsType<EnvFileDiffRow> = [
    {
      title: '变量名',
      dataIndex: 'variableName',
      key: 'variableName',
      width: 280,
      render: (value: string) => <Typography.Text className="env-diff-variable-name">{value}</Typography.Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: EnvFileDiffStatus) => <Tag color={getEnvDiffStatusColor(status)}>{getEnvDiffStatusLabel(status)}</Tag>
    },
    {
      title: '环境 A 值',
      dataIndex: 'sourceValue',
      key: 'sourceValue',
      width: 360,
      render: (value: string, row) => renderValueInput(value, row.variableName, 'source', row.status === 'extra-in-target')
    },
    {
      title: '环境 B 值',
      dataIndex: 'targetValue',
      key: 'targetValue',
      width: 360,
      render: (value: string, row) => renderValueInput(value, row.variableName, 'target', row.status === 'missing-in-target')
    }
  ]

  async function chooseFile(file: File | undefined, target: 'source' | 'target'): Promise<void> {
    if (!file) {
      return
    }

    try {
      const loadedFile = await readTextFile(file)

      if (target === 'source') {
        commitActiveTask({
          sourceFile: getTaskFileMeta(loadedFile),
          sourceText: loadedFile.content
        })
      } else {
        commitActiveTask({
          targetFile: getTaskFileMeta(loadedFile),
          targetText: loadedFile.content
        })
      }
    } catch (error) {
      message.error(getErrorMessage(error, '读取文件失败'))
    }
  }

  function updateInputText(value: string, target: 'source' | 'target'): void {
    if (target === 'source') {
      commitActiveTask({
        sourceFile: null,
        sourceText: value
      })
      return
    }

    commitActiveTask({
      targetFile: null,
      targetText: value
    })
  }

  function clearInputs(): void {
    commitActiveTask({
      sourceText: '',
      targetText: '',
      sourceFile: null,
      targetFile: null,
      resultFilter: 'all'
    })
  }

  function updateResultFilter(filter: EnvFileDiffRowFilter): void {
    commitActiveTask({ resultFilter: filter })
  }

  function copyEnvironment(target: EnvDiffInputTarget, mode: EnvEnvironmentCopyMode): void {
    const environmentName = target === 'source' ? '环境 A' : '环境 B'
    const text = target === 'source' ? sourceText : targetText
    const parsedVariables = target === 'source' ? sourceVariables : targetVariables

    if (mode === 'values') {
      void copyText(formatEnvVariableValues(parsedVariables.variables), `${environmentName} 变量值已复制`)
      return
    }

    void copyText(text, `${environmentName} 已复制`)
  }

  function copyMissingVariables(mode: EnvMissingVariablesCopyMode): void {
    if (mode === 'rows') {
      void copyText(missingVariableRowsText, 'B 缺少变量行已复制')
      return
    }

    void copyText(missingVariablesText, 'B 缺少变量名已复制')
  }

  function getEnvironmentCopyMenu(target: EnvDiffInputTarget): MenuProps {
    const parsedVariables = target === 'source' ? sourceVariables : targetVariables

    return {
      items: [
        { key: 'content', label: '复制完整内容' },
        { key: 'values', label: '只复制变量值', disabled: parsedVariables.variables.length === 0 }
      ],
      onClick: ({ key }) => copyEnvironment(target, key as EnvEnvironmentCopyMode)
    }
  }

  function renderEnvironmentCopyControl(target: EnvDiffInputTarget, size: 'small' | 'middle' = 'middle'): JSX.Element {
    const environmentName = target === 'source' ? '环境 A' : '环境 B'
    const buttonText = target === 'source' ? '复制环境 A' : '复制环境 B'
    const text = target === 'source' ? sourceText : targetText
    const disabled = !text.trim()

    return (
      <Space.Compact className="env-diff-copy-control">
        <Button size={size} icon={<CopyOutlined />} disabled={disabled} onClick={() => copyEnvironment(target, 'content')}>
          {buttonText}
        </Button>
        <Dropdown disabled={disabled} menu={getEnvironmentCopyMenu(target)} trigger={['click']}>
          <Button size={size} aria-label={`${environmentName}复制选项`} disabled={disabled} icon={<DownOutlined />} />
        </Dropdown>
      </Space.Compact>
    )
  }

  function renderMissingVariablesCopyControl(): JSX.Element {
    const disabled = !diffResult?.missingInTarget.length
    const menu: MenuProps = {
      items: [
        { key: 'names', label: '只复制变量名' },
        { key: 'rows', label: '复制变量行' }
      ],
      onClick: ({ key }) => copyMissingVariables(key as EnvMissingVariablesCopyMode)
    }

    return (
      <Space.Compact className="env-diff-copy-control">
        <Button icon={<CopyOutlined />} disabled={disabled} onClick={() => copyMissingVariables('names')}>
          复制 B 缺少变量名
        </Button>
        <Dropdown disabled={disabled} menu={menu} trigger={['click']}>
          <Button aria-label="B 缺少变量复制选项" disabled={disabled} icon={<DownOutlined />} />
        </Dropdown>
      </Space.Compact>
    )
  }

  function renderInputMeta(parsedVariables: EnvFileVariables, text: string, file: EnvFileDiffTaskFile | null): JSX.Element {
    if (!text.trim()) {
      return <Typography.Text type="secondary">等待输入</Typography.Text>
    }

    const ignoredText = parsedVariables.ignoredLineCount > 0 ? `，${parsedVariables.ignoredLineCount} 行未识别` : ''

    return (
      <Typography.Text type="secondary">
        {parsedVariables.variableNames.length} 个变量{ignoredText}
        {file ? ` · ${file.name} · ${formatFileSize(file.size)}` : ''}
      </Typography.Text>
    )
  }

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            工具
          </Button>
          <Typography.Title level={2}>环境变量对比</Typography.Title>
          <Typography.Text type="secondary">按任务保留每次对比，手动删除前返回工具页也不会消失。</Typography.Text>
        </div>
      </div>

      <div className="env-diff-workflow">
        <aside className="panel env-diff-task-panel">
          <div className="env-diff-task-heading">
            <div className="password-tool-heading">
              <span className="password-tool-icon">
                <DiffOutlined />
              </span>
              <div>
                <Typography.Title level={3}>对比任务</Typography.Title>
                <Typography.Text type="secondary">{tasks.length} 条任务，选择一条继续编辑。</Typography.Text>
              </div>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={createTask}>
              新建对比
            </Button>
          </div>

          <Input
            allowClear
            className="env-diff-task-search"
            placeholder="搜索任务、文件或变量"
            prefix={<SearchOutlined />}
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
          />

          <div className="env-diff-task-list" role="list">
            {visibleTaskListItems.map((item) => (
              <div className={`env-diff-task-item${item.task.id === activeTask?.id ? ' is-active' : ''}`} key={item.task.id} role="listitem">
                <button className="env-diff-task-select" type="button" aria-pressed={item.task.id === activeTask?.id} onClick={() => setActiveTaskId(item.task.id)}>
                  <Typography.Text strong className="env-diff-task-title" ellipsis={{ tooltip: item.displayTitle }}>
                    {item.displayTitle}
                  </Typography.Text>
                  <Typography.Text className="env-diff-task-meta" type="secondary">
                    {item.fileLabel}
                  </Typography.Text>
                  <div className="env-diff-task-counts">
                    <Tag>{item.hasTaskInput ? `${item.variableCount} 变量` : '空任务'}</Tag>
                    <Tag color={item.issueCount > 0 ? 'orange' : item.hasTaskInput ? 'green' : 'default'}>
                      {item.hasTaskInput ? (item.issueCount > 0 ? `${item.issueCount} 待处理` : '已一致') : '待输入'}
                    </Tag>
                  </div>
                </button>
                <Popconfirm
                  title="删除这个对比任务？"
                  description="删除后不会再保留这次对比内容。"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => deleteTask(item.task.id)}
                >
                  <Tooltip title="删除">
                    <Button className="env-diff-task-delete" danger size="small" icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </div>
            ))}

            {visibleTaskListItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的任务" /> : null}
          </div>
        </aside>

        <div className="env-diff-main-stack">
          <div className="panel file-picker-panel">
            <div className="password-tool-heading">
              <span className="password-tool-icon">
                <FileTextOutlined />
              </span>
              <div>
                <Typography.Title level={3}>输入环境</Typography.Title>
                <Typography.Text type="secondary">环境 A 是基准，环境 B 是要检查和补齐的目标。</Typography.Text>
              </div>
            </div>

            <div className="env-diff-input-toolbar">
              <div className="env-diff-current-task">
                <Typography.Text type="secondary">任务名称</Typography.Text>
                <Input
                  className="env-diff-task-title-input"
                  value={activeTask?.title ?? ''}
                  placeholder="给这次对比起个名字"
                  onBlur={normalizeTaskTitle}
                  onChange={(event) => updateTaskTitle(event.target.value)}
                />
              </div>
              <div className="env-diff-input-actions">
                <Tag color={activeIssueCount > 0 ? 'orange' : diffResult ? 'green' : 'default'}>
                  {diffResult ? (activeIssueCount > 0 ? `${activeIssueCount} 项待处理` : '当前任务已一致') : '等待输入'}
                </Tag>
                <Button size="small" icon={<DeleteOutlined />} disabled={!hasAnyInput} onClick={clearInputs}>
                  清空
                </Button>
              </div>
            </div>

            <div className="env-diff-text-grid">
              <div className="env-diff-text-card">
                <div className="env-diff-text-heading">
                  <div className="env-diff-text-title-row">
                    <Typography.Text strong>环境 A（基准）</Typography.Text>
                    {renderEnvironmentCopyControl('source', 'small')}
                  </div>
                  {renderInputMeta(sourceVariables, sourceText, sourceFile)}
                </div>
                <Input.TextArea
                  className="env-diff-textarea"
                  value={sourceText}
                  placeholder={'直接粘贴环境 A，例如：\nDATABASE_URL=...\nexport REDIS_URL=...\nJWT_SECRET=...'}
                  rows={14}
                  onChange={(event) => updateInputText(event.target.value, 'source')}
                />
                <div className="env-diff-file-row">
                  <label className="env-file-import-button">
                    <UploadOutlined />
                    <span>导入环境 A 文件</span>
                    <input
                      accept={ENV_FILE_ACCEPT}
                      type="file"
                      onChange={(event) => {
                        void chooseFile(event.target.files?.[0], 'source')
                      }}
                    />
                  </label>
                  <Typography.Text type="secondary">{sourceFile ? `${sourceFile.name} · ${formatFileSize(sourceFile.size)}` : '也可以直接粘贴 .env 内容'}</Typography.Text>
                </div>
              </div>

              <div className="env-diff-text-card">
                <div className="env-diff-text-heading">
                  <div className="env-diff-text-title-row">
                    <Typography.Text strong>环境 B</Typography.Text>
                    {renderEnvironmentCopyControl('target', 'small')}
                  </div>
                  {renderInputMeta(targetVariables, targetText, targetFile)}
                </div>
                <Input.TextArea
                  className="env-diff-textarea"
                  value={targetText}
                  placeholder={'直接粘贴环境 B，例如：\nDATABASE_URL=...\nREDIS_URL=...'}
                  rows={14}
                  onChange={(event) => updateInputText(event.target.value, 'target')}
                />
                <div className="env-diff-file-row">
                  <label className="env-file-import-button">
                    <UploadOutlined />
                    <span>导入环境 B 文件</span>
                    <input
                      accept={ENV_FILE_ACCEPT}
                      type="file"
                      onChange={(event) => {
                        void chooseFile(event.target.files?.[0], 'target')
                      }}
                    />
                  </label>
                  <Typography.Text type="secondary">{targetFile ? `${targetFile.name} · ${formatFileSize(targetFile.size)}` : '也可以直接粘贴 .env 内容'}</Typography.Text>
                </div>
              </div>
            </div>
          </div>

          <div className="panel file-diff-panel env-diff-result-panel">
            <div className="password-tool-heading">
              <span className="password-tool-icon">
                <DiffOutlined />
              </span>
              <div>
                <Typography.Title level={3}>对比结果表格</Typography.Title>
                <Typography.Text type="secondary">查看每个变量在环境 A 和环境 B 中的值。</Typography.Text>
              </div>
            </div>

            {!diffResult ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="粘贴环境 A 或环境 B 后显示表格" />
            ) : (
              <div className="file-diff-result">
                <div className="file-diff-summary">
                  <Statistic title="A 变量数" value={diffResult.sourceVariables.length} />
                  <Statistic title="B 变量数" value={diffResult.targetVariables.length} />
                  <Statistic title="B 缺少" value={diffResult.missingInTarget.length} valueStyle={{ color: diffResult.missingInTarget.length > 0 ? '#cf1322' : '#389e0d' }} />
                  <Statistic title="值不同" value={diffResult.differentValues.length} valueStyle={{ color: diffResult.differentValues.length > 0 ? '#d46b08' : '#389e0d' }} />
                </div>

                {diffResult.sourceIgnoredLineCount > 0 || diffResult.targetIgnoredLineCount > 0 ? (
                  <Alert
                    type="info"
                    showIcon
                    message={`已忽略未识别行：A ${diffResult.sourceIgnoredLineCount} 行，B ${diffResult.targetIgnoredLineCount} 行`}
                  />
                ) : null}

                <div className="env-diff-result-toolbar">
                  <Segmented
                    value={resultFilter}
                    options={[
                      { label: `全部 ${diffResult.rows.length}`, value: 'all' },
                      { label: `B 缺少 ${diffResult.missingInTarget.length}`, value: 'missing' },
                      { label: `B 多出 ${diffResult.extraInTarget.length}`, value: 'extra' },
                      { label: `值不同 ${diffResult.differentValues.length}`, value: 'different' }
                    ]}
                    onChange={(value) => updateResultFilter(value as EnvFileDiffRowFilter)}
                  />
                  <div className="env-diff-result-actions">
                    {renderMissingVariablesCopyControl()}
                    {renderEnvironmentCopyControl('source')}
                    {renderEnvironmentCopyControl('target')}
                  </div>
                </div>

                <Table<EnvFileDiffRow>
                  className="content-table env-diff-table"
                  rowKey="id"
                  columns={diffColumns}
                  dataSource={visibleRows}
                  scroll={{ x: 1120 }}
                  pagination={false}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选没有结果" /> }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function PasswordGeneratorTool({ onBack }: { onBack: () => void }): JSX.Element {
  const [workflowMode, setWorkflowMode] = useState<PasswordWorkflowMode>('preset')
  const [presetRows, setPresetRows] = useState<GeneratedPasswordRow[]>([])
  const [customMode, setCustomMode] = useState<PasswordToolMode>('password')
  const [customVariableName, setCustomVariableName] = useState('CUSTOM_PASSWORD')
  const [customLength, setCustomLength] = useState(24)
  const [customByteLength, setCustomByteLength] = useState(32)
  const [customGroups, setCustomGroups] = useState<PasswordCharacterGroupKey[]>(DEFAULT_PASSWORD_GROUP_KEYS)
  const [customValue, setCustomValue] = useState('')

  const customItem = useMemo(
    () =>
      createCustomPasswordToolItem({
        mode: customMode,
        variableName: customVariableName,
        length: customLength,
        byteLength: customByteLength,
        groups: customGroups
      }),
    [customByteLength, customGroups, customLength, customMode, customVariableName]
  )
  const presetEnvText = formatEnvironmentVariableRows(presetRows)
  const customEnvText = `${customItem.variableName}=${customValue}`
  const customGenerationDisabled = customMode === 'password' && customGroups.length === 0

  function regeneratePresetRows(): void {
    try {
      setPresetRows(createGeneratedPasswordRows(DEFAULT_PASSWORD_TOOL_ITEMS))
      setWorkflowMode('preset')
      message.success('常用密码已生成')
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  function generateCustomValue(): void {
    try {
      setCustomValue(generatePasswordToolValue(customItem))
      setWorkflowMode('custom')
      message.success('已生成新值')
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  function generateCurrentMode(): void {
    if (workflowMode === 'preset') {
      regeneratePresetRows()
      return
    }

    generateCustomValue()
  }

  return (
    <section className="workspace-section tools-workspace">
      <div className="section-heading">
        <div>
          <Button className="tool-back-button" icon={<ArrowLeftOutlined />} onClick={onBack}>
            工具
          </Button>
          <Typography.Title level={2}>密码工具</Typography.Title>
          <Typography.Text type="secondary">选择生成方式，生成后直接显示结果。</Typography.Text>
        </div>
      </div>

      <div className="password-tool-layout">
        <div className="panel password-options-panel">
          <div className="password-tool-heading">
            <span className="password-tool-icon">
              <KeyOutlined />
            </span>
            <div>
              <Typography.Title level={3}>生成选项</Typography.Title>
              <Typography.Text type="secondary">先选类型，再生成。</Typography.Text>
            </div>
          </div>

          <Segmented
            block
            value={workflowMode}
            options={[
              { label: '常用密码', value: 'preset' },
              { label: '自定义', value: 'custom' }
            ]}
            onChange={(value) => setWorkflowMode(value as PasswordWorkflowMode)}
          />

          {workflowMode === 'preset' ? (
            <div className="password-preset-summary">
              {DEFAULT_PASSWORD_TOOL_ITEMS.map((item) => (
                <div className="password-preset-summary-row" key={item.id}>
                  <Typography.Text strong>{item.variableName}</Typography.Text>
                  <Tag>{getPasswordToolItemLengthLabel(item)}</Tag>
                </div>
              ))}
            </div>
          ) : (
            <Form layout="vertical" className="password-custom-form">
              <Form.Item label="类型">
                <Segmented
                  block
                  value={customMode}
                  options={[
                    { label: '强密码', value: 'password' },
                    { label: '十六进制密钥', value: 'hex' }
                  ]}
                  onChange={(value) => setCustomMode(value as PasswordToolMode)}
                />
              </Form.Item>
              <div className="password-custom-grid">
                <Form.Item label="变量名">
                  <Input value={customVariableName} onChange={(event) => setCustomVariableName(event.target.value)} />
                </Form.Item>
                <Form.Item label={customMode === 'hex' ? '随机字节数' : '长度'}>
                  <InputNumber
                    className="full-width-control"
                    min={customMode === 'hex' ? 16 : 8}
                    max={customMode === 'hex' ? 64 : 128}
                    value={customMode === 'hex' ? customByteLength : customLength}
                    onChange={(value) => {
                      const nextValue = Number(value)

                      if (customMode === 'hex') {
                        setCustomByteLength(Number.isFinite(nextValue) ? nextValue : 32)
                      } else {
                        setCustomLength(Number.isFinite(nextValue) ? nextValue : 24)
                      }
                    }}
                  />
                </Form.Item>
              </div>
              {customMode === 'password' && (
                <Form.Item label="字符范围">
                  <Checkbox.Group
                    value={customGroups}
                    options={PASSWORD_CHARACTER_GROUPS.map((group) => ({ label: group.label, value: group.key }))}
                    onChange={(values) => setCustomGroups(values as PasswordCharacterGroupKey[])}
                  />
                </Form.Item>
              )}
            </Form>
          )}

          <Button type="primary" block icon={<ReloadOutlined />} disabled={workflowMode === 'custom' && customGenerationDisabled} onClick={generateCurrentMode}>
            生成密码
          </Button>
        </div>

        <div className="panel password-output-panel">
          <div className="password-tool-heading">
            <span className="password-tool-icon">
              <FileTextOutlined />
            </span>
            <div>
              <Typography.Title level={3}>生成结果</Typography.Title>
              <Typography.Text type="secondary">明文显示，直接复制。</Typography.Text>
            </div>
          </div>

          {workflowMode === 'preset' && presetRows.length > 0 && (
            <div className="password-output-list">
              {presetRows.map((row) => (
                <div className="password-output-row" key={row.id}>
                  <div className="password-output-meta">
                    <Space size={8} wrap>
                      <Typography.Text strong>{row.variableName}</Typography.Text>
                      <Tag>{getPasswordToolItemLengthLabel(row)}</Tag>
                    </Space>
                    <Typography.Text type="secondary">{row.description}</Typography.Text>
                  </div>
                  <div className="password-plain-value">{row.value}</div>
                  <Space wrap className="password-copy-row">
                    <Button icon={<CopyOutlined />} onClick={() => copyText(row.value, `${row.variableName} 已复制`)}>
                      复制值
                    </Button>
                    <Button icon={<FileTextOutlined />} onClick={() => copyText(`${row.variableName}=${row.value}`, `${row.variableName} 变量行已复制`)}>
                      复制变量
                    </Button>
                  </Space>
                </div>
              ))}
              <div className="password-env-block">
                <pre>{presetEnvText}</pre>
                <Button type="primary" icon={<CopyOutlined />} onClick={() => copyText(presetEnvText, '环境变量已复制')}>
                  复制全部
                </Button>
              </div>
            </div>
          )}

          {workflowMode === 'custom' && customValue && (
            <div className="password-output-list">
              <div className="password-output-row">
                <div className="password-output-meta">
                  <Space size={8} wrap>
                    <Typography.Text strong>{customItem.variableName}</Typography.Text>
                    <Tag>{getPasswordToolItemLengthLabel(customItem)}</Tag>
                  </Space>
                  <Typography.Text type="secondary">{customItem.description}</Typography.Text>
                </div>
                <div className="password-plain-value">{customValue}</div>
                <div className="password-env-block compact">
                  <pre>{customEnvText}</pre>
                </div>
                <Space wrap className="password-copy-row">
                  <Button icon={<CopyOutlined />} onClick={() => copyText(customValue, '自定义值已复制')}>
                    复制值
                  </Button>
                  <Button type="primary" icon={<FileTextOutlined />} onClick={() => copyText(customEnvText, '自定义变量行已复制')}>
                    复制变量
                  </Button>
                </Space>
              </div>
            </div>
          )}

          {((workflowMode === 'preset' && presetRows.length === 0) || (workflowMode === 'custom' && !customValue)) && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成结果" />
          )}
        </div>
      </div>
    </section>
  )
}

function App({ themePreference, resolvedTheme, onThemePreferenceChange }: AppProps): JSX.Element {
  const { loadingWorkspace, loadWorkspace } = useForgeDeskStore()
  const [activeKey, setActiveKey] = useState<AppNavigationKey>('overview')
  const [settingsInitialModule, setSettingsInitialModule] = useState<SettingsModuleKey>('overview')
  const [creatingProject, setCreatingProject] = useState(false)
  const [terminalOpenRequest, setTerminalOpenRequest] = useState<TerminalOpenRequest | null>(null)
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([])
  const [systemLogDrawerOpen, setSystemLogDrawerOpen] = useState(false)
  const [systemLogFilter, setSystemLogFilter] = useState<SystemLogFilter>('all')
  const [deploymentRefreshActive, setDeploymentRefreshActive] = useState(false)
  const [appUpdateState, setAppUpdateState] = useState<AppUpdateState>({
    status: 'idle',
    currentVersion: ''
  })
  const [appRuntimeInfo, setAppRuntimeInfo] = useState<AppRuntimeInfo | null>(null)
  const [quickBuildState, setQuickBuildState] = useState<QuickBuildState>(() => createInitialQuickBuildState())
  const terminalOpenRequestIdRef = useRef(0)
  const quickBuildStateRef = useRef(quickBuildState)
  const systemLogSummary = useMemo(() => createSystemLogSummary(systemLogs), [systemLogs])

  useEffect(() => {
    let cancelled = false

    async function loadWhenReady(): Promise<void> {
      for (let attempt = 0; attempt < 10 && !window.forgeDesk; attempt += 1) {
        await wait(50)
      }

      if (!cancelled) {
        await loadWorkspace()
      }
    }

    loadWhenReady().catch((error) => message.error(getErrorMessage(error)))

    return () => {
      cancelled = true
    }
  }, [loadWorkspace])

  useEffect(() => {
    quickBuildStateRef.current = quickBuildState
  }, [quickBuildState])

  useEffect(() => {
    if (!window.forgeDesk) {
      return undefined
    }

    let mounted = true

    window.forgeDesk
      .getAppRuntimeInfo()
      .then((info) => {
        if (!mounted) {
          return
        }

        setAppRuntimeInfo(info)
        setQuickBuildState((current) => ({
          ...current,
          cwd: current.cwd || info.projectRoot
        }))
      })
      .catch((error) => message.error(getErrorMessage(error)))

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!window.forgeDesk) {
      return undefined
    }

    let mounted = true

    window.forgeDesk
      .getAppUpdateState()
      .then((state) => {
        if (mounted) {
          setAppUpdateState(state)
        }
      })
      .catch((error) => message.error(getErrorMessage(error)))

    const unsubscribe = window.forgeDesk.onAppUpdateState((state) => setAppUpdateState(state))

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!window.forgeDesk) {
      return undefined
    }

    let mounted = true

    window.forgeDesk
      .getQuickBuildTask()
      .then((task) => {
        if (!mounted) {
          return
        }

        const nextState = createQuickBuildStateFromTask(task, appRuntimeInfo?.projectRoot || quickBuildStateRef.current.cwd)
        quickBuildStateRef.current = nextState
        setQuickBuildState(nextState)
      })
      .catch((error) => message.error(getErrorMessage(error)))

    const unsubscribe = window.forgeDesk.onQuickBuildTaskUpdated((task) => {
      const previous = quickBuildStateRef.current
      const nextState = createQuickBuildStateFromTask(task, appRuntimeInfo?.projectRoot || previous.cwd)

      quickBuildStateRef.current = nextState
      setQuickBuildState(nextState)

      if (!task || task.status === 'running' || previous.taskId !== task.id || previous.status !== 'running') {
        return
      }

      const resultTitle = getQuickBuildTaskResultTitle(task)
      const success = task.status === 'succeeded'

      appendSystemLog({
        level: success ? 'success' : task.status === 'cancelled' ? 'warning' : 'error',
        source: '快速构建',
        title: resultTitle,
        message: formatQuickBuildTaskLogMessage(task),
        meta: {
          command: task.command,
          cwd: task.cwd,
          exitCode: task.exitCode,
          signal: task.signal,
          taskId: task.id
        }
      })

      if (success) {
        const prompt = createQuickBuildCompletionPrompt(task)

        if (prompt) {
          Modal.success({
            title: prompt.title,
            content: (
              <Space direction="vertical" size={8}>
                <Typography.Text>{prompt.description}</Typography.Text>
                <Typography.Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                  {prompt.detail}
                </Typography.Text>
              </Space>
            ),
            okText: prompt.okText
          })
        } else {
          message.success('快速构建完成')
        }
      } else if (task.status === 'cancelled') {
        message.warning('快速构建已终止')
      } else {
        message.error(resultTitle)
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [appRuntimeInfo?.projectRoot])

  const navigationIcons: Record<AppNavigationKey, JSX.Element> = {
    overview: <DashboardOutlined />,
    tasks: <CheckSquareOutlined />,
    docs: <FileTextOutlined />,
    services: <ThunderboltOutlined />,
    docker: <DockerOutlined />,
    tools: <ToolOutlined />,
    terminal: <CodeOutlined />,
    settings: <SettingOutlined />
  }
  const menuItems = APP_NAVIGATION_ITEMS.filter((item) => item.key !== 'terminal' && item.key !== 'settings').map((item) => ({
    ...item,
    icon: navigationIcons[item.key]
  }))
  const footerMenuItems = APP_NAVIGATION_ITEMS.filter((item) => item.key === 'terminal' || item.key === 'settings').map((item) => ({
    ...item,
    icon: navigationIcons[item.key]
  }))
  const appVersionLabel = appUpdateState.currentVersion ? `v${appUpdateState.currentVersion}` : ''
  const showQuickBuildButton = appRuntimeInfo?.isDevelopmentBuild === true
  const quickBuildTooltip = (
    <div className="quick-build-tooltip">
      <Typography.Text strong>快速构建</Typography.Text>
      <span>状态：{getQuickBuildStatusText(quickBuildState.status)}</span>
      <span>命令：{quickBuildState.command}</span>
      <span>目录：{quickBuildState.cwd || appRuntimeInfo?.projectRoot || '识别中'}</span>
      <span>开始：{formatQuickBuildTime(quickBuildState.startedAt)}</span>
      {quickBuildState.finishedAt ? <span>结束：{formatQuickBuildTime(quickBuildState.finishedAt)}</span> : null}
      {quickBuildState.updatedAt ? <span>更新：{formatQuickBuildTime(quickBuildState.updatedAt)}</span> : null}
      {quickBuildState.exitCode !== undefined ? <span>退出码：{quickBuildState.exitCode}</span> : null}
      {quickBuildState.signal ? <span>信号：{quickBuildState.signal}</span> : null}
      {quickBuildState.message ? <span>信息：{quickBuildState.message}</span> : null}
      <span>最近输出：{formatQuickBuildLastOutput(quickBuildState.log)}</span>
      {appRuntimeInfo ? <span>环境：{appRuntimeInfo.isDevServer ? '开发服务' : '开发构建'}</span> : null}
    </div>
  )

  function openTerminalRequest(request: Omit<TerminalOpenRequest, 'requestId'>): void {
    terminalOpenRequestIdRef.current += 1
    setTerminalOpenRequest({ ...request, requestId: terminalOpenRequestIdRef.current })
  }

  function openNavigationKey(key: AppNavigationKey): void {
    if (key === 'settings') {
      setSettingsInitialModule('overview')
    }

    setActiveKey(key)
  }

  function openSettingsModule(module: SettingsModuleKey): void {
    setSettingsInitialModule(module)
    setActiveKey('settings')
  }

  function openGlobalTerminalRequest(request: Omit<TerminalOpenRequest, 'requestId'>): void {
    openTerminalRequest(request)
    setActiveKey('terminal')
  }

  async function startQuickBuild(): Promise<void> {
    const cwd = appRuntimeInfo?.projectRoot || quickBuildState.cwd

    if (!window.forgeDesk || !cwd) {
      message.error('当前环境无法启动快速构建')
      return
    }

    if (quickBuildState.status === 'running') {
      message.info('快速构建正在后台运行')
      return
    }

    const startedAt = new Date().toISOString()
    const runningState: QuickBuildState = {
      command: quickBuildCommand,
      cwd,
      message: '正在执行快速构建',
      startedAt,
      status: 'running'
    }

    quickBuildStateRef.current = runningState
    setQuickBuildState(runningState)
    appendSystemLog({
      level: 'info',
      source: '快速构建',
      title: '开始快速构建',
      message: `正在执行 ${quickBuildCommand}`,
      meta: {
        command: quickBuildCommand,
        cwd
      }
    })

    try {
      const task = await window.forgeDesk.startQuickBuild({ cwd })
      const nextState = createQuickBuildStateFromTask(task, cwd)

      quickBuildStateRef.current = nextState
      setQuickBuildState(nextState)
      message.success('快速构建已在后台开始')
    } catch (error) {
      const errorMessage = getErrorMessage(error, '快速构建启动失败')
      const nextState: QuickBuildState = {
        ...runningState,
        finishedAt: new Date().toISOString(),
        message: errorMessage,
        status: 'error'
      }

      quickBuildStateRef.current = nextState
      setQuickBuildState(nextState)
      appendSystemLog({
        level: 'error',
        source: '快速构建',
        title: '快速构建启动失败',
        message: errorMessage,
        meta: {
          command: quickBuildCommand,
          cwd
        }
      })
      message.error(errorMessage)
    }
  }

  function appendSystemLog(entry: SystemLogInput): void {
    setSystemLogs((current) => [createSystemLogEntry(entry), ...current].slice(0, 300))
  }

  function clearSystemLogs(): void {
    setSystemLogs([])
    setSystemLogFilter('all')
  }

  if (activeKey === 'terminal') {
    return (
      <Layout className="terminal-mode-shell">
        <div className="terminal-mode-header">
          <Space direction="vertical" size={0}>
            <Typography.Text strong>ForgeDesk</Typography.Text>
            <Typography.Text type="secondary">命令行工具</Typography.Text>
          </Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveKey('overview')}>
            返回控制台
          </Button>
        </div>
        <div className="terminal-mode-body terminal-mode-body-with-remotes">
          <TerminalRemoteShortcuts onOpenTerminalRequest={openTerminalRequest} />
          <div className="terminal-mode-terminal">
            <TerminalWorkspace defaultTitle="ForgeDesk CLI" openRequest={terminalOpenRequest} />
          </div>
        </div>
        <ReleasePublishTaskDock />
      </Layout>
    )
  }

  return (
    <Layout className="app-shell">
      <Layout.Sider width={236} theme={resolvedTheme} className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">
            <div className="brand-mark">
              <img src={forgedeskLogoUrl} alt="ForgeDesk" />
            </div>
            <div className="brand-copy">
              <div className="brand-heading">
                <Typography.Title level={4}>ForgeDesk</Typography.Title>
              </div>
            </div>
          </div>
          <Menu className="sidebar-nav" mode="inline" selectedKeys={activeKey === 'settings' ? [] : [activeKey]} items={menuItems} onClick={({ key }) => openNavigationKey(key as AppNavigationKey)} />
          <div className="sidebar-footer">
            <Menu
              className="sidebar-footer-menu"
              mode="inline"
              selectedKeys={activeKey === 'settings' ? ['settings'] : []}
              items={footerMenuItems}
              onClick={({ key }) => openNavigationKey(key as AppNavigationKey)}
            />
          </div>
        </div>
      </Layout.Sider>
      <Layout className="app-main">
        <Layout.Content className="content">
          {loadingWorkspace && (
            <div className="loading-panel">
              <Spin />
            </div>
          )}
          {!loadingWorkspace && activeKey === 'settings' && (
            <SettingsPanel
              initialModule={settingsInitialModule}
              themePreference={themePreference}
              resolvedTheme={resolvedTheme}
              onThemePreferenceChange={onThemePreferenceChange}
              onSystemLog={appendSystemLog}
              onDeploymentRefreshActiveChange={setDeploymentRefreshActive}
              onOpenSystemLog={() => setSystemLogDrawerOpen(true)}
              onCreateProject={() => {
                setActiveKey('overview')
                setCreatingProject(true)
              }}
            />
          )}
          {!loadingWorkspace && activeKey === 'services' && (
            <section className="workspace-section">
              <GlobalServiceCenterPanel
                onSystemLog={appendSystemLog}
                onDeploymentRefreshActiveChange={setDeploymentRefreshActive}
                onOpenSystemLog={() => setSystemLogDrawerOpen(true)}
              />
            </section>
          )}
          {!loadingWorkspace && activeKey === 'docker' && <DockerPanel onOpenTerminalRequest={openGlobalTerminalRequest} />}
          {!loadingWorkspace && activeKey === 'docs' && <OaDocsPanel onOpenSettings={() => openSettingsModule('oa')} />}
          {!loadingWorkspace && activeKey === 'tasks' && <TaskListPanel />}
          {!loadingWorkspace && activeKey === 'tools' && <ToolsPanel />}
          {!loadingWorkspace && activeKey === 'overview' && (
            <ProjectOverview
              onCreateProject={() => setCreatingProject(true)}
              onOpenSettings={() => openSettingsModule('overview')}
              onOpenTerminalRequest={openTerminalRequest}
            />
          )}
          <CreateProjectModal open={creatingProject} onClose={() => setCreatingProject(false)} onCreated={() => setActiveKey('overview')} />
        </Layout.Content>
      </Layout>
      <SystemLogDrawer
        open={systemLogDrawerOpen}
        logs={systemLogs}
        filter={systemLogFilter}
        onFilterChange={setSystemLogFilter}
        onClose={() => setSystemLogDrawerOpen(false)}
        onClear={clearSystemLogs}
      />
      <AppStatusBar
        summary={systemLogSummary}
        refreshing={deploymentRefreshActive}
        showQuickBuildButton={showQuickBuildButton}
        quickBuildState={quickBuildState}
        quickBuildTooltip={quickBuildTooltip}
        versionLabel={appVersionLabel}
        onQuickBuild={() => startQuickBuild().catch((error) => message.error(getErrorMessage(error, '快速构建启动失败')))}
        onOpenLogs={() => setSystemLogDrawerOpen(true)}
      />
      <ReleasePublishTaskDock />
    </Layout>
  )
}

export default App
