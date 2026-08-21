import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, Notification, powerMonitor, shell, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { execFile, spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import Database from 'better-sqlite3'
import simpleGit from 'simple-git'
import { requestCommitMessageSuggestion, type CommitMessageSuggestion } from './ai-commit-message-assistant'
import { requestConflictResolutionSuggestion, type ConflictResolutionSuggestion } from './ai-conflict-assistant'
import { requestReleaseSuggestion, type ReleaseSuggestion } from './ai-release-assistant'
import { getRedactedAiSettings, readAiSettingsFile, writeAiSettingsFile, type AiSettings, type RedactedAiSettings } from './ai-settings'
import { findLocalAiCommand, inspectAiRuntime, inspectCodexRuntime, type AiRuntimeStatus } from './ai-runtime'
import {
  codexInstallUrl,
  detectCodexProvider,
  getAiProviderAdapter,
  getInitializationSnapshot,
  listAiProviderRuntimeSnapshots,
  type AiProviderAccountSnapshot,
  type AiProviderRuntimeSnapshot,
  type InitializationSnapshot,
  type QuotaSnapshot
} from './ai-providers'
import {
  activateCodexAccount,
  createCodexAccount,
  getActiveCodexAccountInfo,
  importCodexAccount,
  listCodexAccounts,
  removeCodexAccount,
  resolveCodexHome,
  syncActiveCodexHome,
  type CodexAccountImportInput,
  type CodexAccountCreateInput,
  type CodexAccountInfo,
  type CodexAccountRegistryView
} from './codex-accounts'
import {
  getCodexApiService,
  rotateCodexApiKey,
  startCodexApiService,
  stopCodexApiService,
  getCodexApiServiceIntegrationSettings,
  type CodexApiServiceSettings,
  type CodexApiServiceView
} from './codex-api-service'
import {
  getProjectAiBinding,
  migrateProjectAiBindingTable,
  saveProjectAiBinding,
  type ProjectAiBinding,
  type ProjectAiBindingInput
} from './project-ai-bindings'
import { CodexActivityService, type CodexActivitySnapshot } from './codex-activity'
import { CodexAppServerThreadService, type CodexAppServerNotification } from './codex-app-server'
import {
  ManagedTaskService,
  migrateManagedTaskTables,
  managedTaskStageLabels,
  type ManagedTask,
  type ManagedTaskCreateInput,
  type ManagedTaskImportedThread,
  type ManagedTaskLegacyImport,
  type ManagedTaskPlanItem
} from './managed-tasks'
import {
  CodexSessionService,
  type CodexSessionEvent,
  type CodexSessionMessageInput,
  type CodexSessionDetail,
  type CodexSessionSummary,
  type CodexSessionsSnapshot
} from './codex-sessions'
import {
  CodexSiteService,
  migrateCodexSiteTables,
  type CodexSite,
  type CodexSiteCreateInput,
  type CodexSiteUpdateInput
} from './codex-sites'
import {
  CodexTaskService,
  migrateCodexTaskTables,
  type CodexTaskCreateInput,
  type CodexTaskEnvironment,
  type CodexTaskEvent,
  type CodexTaskMessageInput,
  type CodexTaskRenameInput,
  type CodexTaskRecord
} from './codex-tasks'
import {
  CodexProjectMonitorService,
  codexProjectKey,
  findAutomaticCodexProjectId,
  migrateCodexProjectMonitorTables,
  saveCodexProjectLink,
  listCodexProjectLinks,
  deleteCodexProjectLink,
  type CodexProjectLink,
  type CodexProjectLinkInput,
  type CodexProjectMonitorSnapshot,
  type MonitorProjectRecord,
  type CodexUncommittedAlert
} from './codex-project-monitor'
import {
  deleteProjectGroup,
  listProjectGroups,
  migrateProjectGroupTables,
  reorderProjectGroups,
  saveProjectGroup,
  setProjectGroup,
  type ProjectGroupInput,
  type ProjectGroupRecord
} from './project-groups'
import { listOpenRouterModels, type OpenRouterModel } from './openrouter-models'
import { getMarketDataSnapshot, type MarketPeriod } from './market-data'
import {
  readOverviewSnapshot,
  refreshOverviewNews,
  summarizeOverviewProjects,
  type OverviewNewsReport,
  type OverviewProjectReport,
  type OverviewSnapshot
} from './overview-assistant'
import { collectLightweightResourceSnapshot, collectSystemMonitorSnapshot, type SystemMonitorSnapshot } from './system-monitoring'
import {
  ResourceMonitorService,
  collectResourceProcesses,
  deleteStorageRoot,
  executeCleanupToTrash,
  executeExternalCleanup,
  exportProcessAnalysisCsv,
  getResourceRetentionStatus,
  getStorageOverview,
  importLegacyResourceHistory,
  listCleanupAudit,
  listExternalCleanupPreviews,
  listLatestProcesses,
  listProcessAnalysis,
  listProcessHistory,
  listResourceHistory,
  listStorageDirectories,
  migrateResourceGovernanceTables,
  pauseStorageScan,
  previewCleanup,
  runResourceRetention,
  saveStorageRoot,
  setCleanupCategoryAuthorization,
  signalResourceProcess,
  startStorageScan,
  verifyDuplicateGroup,
  type CleanupCategory,
  type ProcessAnalysis,
  type StorageDirectoryQuery,
  type StorageScanProgress
} from './resource-governance'
import { getRedactedOaSettings, readOaSettingsFile, writeOaSettingsFile, type OaSettings, type RedactedOaSettings } from './oa-settings'
import { getLarkDocumentTasks, listLarkDocuments, type LarkDocumentList, type LarkDocumentRecord, type LarkDocumentTaskList } from './lark-documents'
import {
  deleteLarkBitableRecord,
  getLarkBitableSnapshot,
  saveLarkBitableRecord,
  type LarkBitableSnapshot
} from './lark-bitable'
import {
  getLarkBotDashboard,
  getLarkBotSettings,
  listLarkBotNotifications,
  listLarkBotTasks,
  saveLarkBotSettings,
  sendLarkBotReminder,
  sendLarkBotTestMessage,
  syncLarkBot,
  type LarkBotDashboard,
  type LarkBotNotification,
  type LarkBotRuntimeSettings,
  type LarkBotTask
} from './lark-bot-service'
import { MenuBarManagerService } from './menu-bar-manager'
import { collectCloseGuardActivities, createCloseGuardPrompt, type CloseGuardAction, type CloseGuardActivity } from './app-close-guard'
import { acquireSingleProcessFileLock } from './instance-lock'
import { isAppUpdateQuitRequested, registerAppUpdateIpc } from './app-updates'
import { inspectCliEnvironment, repairCliEnvironment, type CliEnvironmentRepairResult, type CliEnvironmentSnapshot } from './cli-environment'
import {
  cancelCodemagicBuild,
  createCodemagicArtifactPublicUrl,
  deleteCodemagicToken,
  getCodemagicBuild,
  getCodemagicTokenSecret,
  listCodemagicApps,
  listCodemagicTeams,
  listCodemagicTokens,
  refreshCodemagicToken,
  saveCodemagicToken,
  startCodemagicBuild,
  type CodemagicApp,
  type CodemagicArtifact,
  type CodemagicBuild,
  type CodemagicTokenInput,
  type CodemagicTokenView
} from './codemagic'
import {
  deleteCodemagicRepositoryBinding as deleteCodemagicRepositoryBindingRecord,
  getCodemagicRepositoryBinding as getCodemagicRepositoryBindingRecord,
  migrateCodemagicRepositoryBindingTable,
  saveCodemagicRepositoryBinding as saveCodemagicRepositoryBindingRecord,
  type CodemagicRepositoryBinding,
  type CodemagicRepositoryBindingInput
} from './codemagic-bindings'
import {
  deleteProjectCloudflareDnsRecord,
  deleteProjectCloudflareSettings,
  getProjectCloudflareSettings,
  listProjectCloudflareDnsRecords,
  migrateProjectCloudflareTables,
  saveProjectCloudflareDnsRecord,
  saveProjectCloudflareSettings,
  testProjectCloudflareConnection,
  type CloudflareConnectionTestResult,
  type CloudflareDnsRecord,
  type CloudflareDnsRecordInput,
  type ProjectCloudflareSettings,
  type ProjectCloudflareSettingsInput
} from './cloudflare'
import {
  deleteProjectFirebaseReleaseSettings,
  getProjectFirebaseReleaseSettings,
  migrateProjectFirebaseReleaseTables,
  resolveProjectFirebaseReleaseSettings,
  saveProjectFirebaseReleaseSettings,
  type ProjectFirebaseReleaseSettings,
  type ProjectFirebaseReleaseSettingsInput
} from './firebase-app-distribution'
import {
  deleteDataSourceConnection as deleteDataSourceConnectionRecord,
  listDataSourceConnections as listDataSourceConnectionRecords,
  listDatabaseTables as listDataSourceDatabaseTables,
  listS3Objects as listDataSourceS3Objects,
  migrateDataSourceTables,
  previewDatabaseTable as previewDataSourceDatabaseTable,
  previewRedisValue as previewDataSourceRedisValue,
  previewS3Object as previewDataSourceS3Object,
  runDataSourceSql as runDataSourceSqlQuery,
  saveDataSourceConnection as saveDataSourceConnectionRecord,
  scanRedisKeys as scanDataSourceRedisKeys,
  testDataSourceConnection as testDataSourceConnectionRecord,
  type DataSourceConnectionInput,
  type DataSourceConnectionRecord,
  type DataSourceConnectionTestResult,
  type DataSourceDatabaseTable,
  type DataSourceRedisScanResult,
  type DataSourceRedisValuePreview,
  type DataSourceS3ListResult,
  type DataSourceS3ObjectPreview,
  type DataSourceTabularResult
} from './data-sources'
import { buildGitAuthorLookup, resolveGitAuthorDisplay, type GitAuthorLookup } from './git-author-mapping'
import { serializeGitIpcPayload } from './git-ipc'
import { discoverSubmoduleTree, type SubmoduleDescriptor } from './git-submodules'
import {
  analyzeDeploymentApproval,
  executeDeploymentApproval,
  getDeploymentApprovalConfig,
  listDeploymentApprovals,
  migrateDeploymentApprovalTables,
  saveDeploymentApprovalConfig,
  type DeploymentApprovalAnalysis,
  type DeploymentApprovalConfig,
  type DeploymentApprovalExecutionResult,
  type DeploymentApprovalHistory
} from './deployment-approvals'
import { parseControlledGitCommand, validateRepositoryRemoteName } from './git-controls'
import {
  deleteGithubToken,
  getGithubTokenSecret,
  listGithubTokens,
  refreshGithubToken,
  saveGithubToken,
  type GithubTokenInput,
  type GithubTokenView
} from './github-tokens'
import { createGuiToolFallbackPath, createScriptExecutionEnv, mergePathValues } from './shell-environment'
import {
  buildGitAddArgs,
  buildGitCommitArgs,
  buildGitDiffStatArgs,
  buildGitFastForwardCheckArgs,
  buildGitMergeArgs,
  buildGitMergeBaseArgs,
  buildGitMergeTreeArgs,
  buildGitPushOperationArgs,
  buildGitPushTargetCommitCountArgs,
  buildGitPushTargetLocalCommitCountArgs,
  buildGitPushTargetRemoteRefVerifyArgs,
  buildGitRevListCountArgs,
  buildGitSwitchBranchArgs,
  buildGitTagArgs,
  buildGitVerifyRefArgs,
  isEmptyRepositoryHeadError,
  parsePorcelainStatus,
  type GitAddInput,
  type GitBranchSwitchInput,
  type GitCommitInput,
  type GitMergeAnalysisInput,
  type GitMergeInput,
  type GitPushInput,
  type GitPushTarget,
  type GitStatusFile
} from './git-workspace'
import { buildRemoteCloneArgs, deriveRemoteRepositoryName, findNearestRepositoryParent, resolveRemoteCloneTarget, type RemoteProjectCreateInput } from './project-creation'
import { extractConflictSections, hasConflictMarkers, type ConflictSection } from './merge-conflicts'
import {
  deleteProjectBranchTag as deleteProjectBranchTagRecord,
  listProjectBranchTags as listProjectBranchTagRecords,
  migrateProjectBranchTagTable,
  saveProjectBranchTag as saveProjectBranchTagRecord,
  type ProjectBranchTagInput,
  type ProjectBranchTagRecord
} from './project-branch-tags'
import {
  deleteProjectTerminalCommand as deleteProjectTerminalCommandRecord,
  listProjectTerminalCommands as listProjectTerminalCommandRecords,
  migrateProjectTerminalCommandTable,
  saveProjectTerminalCommand as saveProjectTerminalCommandRecord,
  type ProjectTerminalCommandInput,
  type ProjectTerminalCommandRecord
} from './project-terminal-commands'
import {
  clearProjectGitTasks,
  deleteProjectGitTask,
  getProjectGitTask,
  listProjectGitTasks,
  migrateProjectGitTaskTable,
  recoverProjectGitTasks,
  saveProjectGitTask,
  type ProjectGitTaskLog
} from './project-git-task-logs'
import {
  createRsaPrivateKeyRecord,
  deleteRsaPrivateKeyRecord,
  listRsaPrivateKeyRecords,
  migrateRsaPrivateKeyTables,
  updateRsaPrivateKeyRecord,
  type RsaPrivateKeyCreateInput,
  type RsaPrivateKeyRecord,
  type RsaPrivateKeyUpdateInput
} from './rsa-private-keys'
import { migrateDockerTables } from './docker'
import { createDockerIpcService, registerDockerIpc } from './docker-ipc'
import { readSshConfigFile, writeSshConfigFile, type SshConfigFile } from './ssh-config'
import { createNodePtyFactory } from './node-pty-factory'
import {
  buildTerminalRemoteSshCommand,
  deleteTerminalRemoteGroup as deleteTerminalRemoteGroupRecord,
  deleteTerminalRemoteHost as deleteTerminalRemoteHostRecord,
  listTerminalRemoteGroups as listTerminalRemoteGroupRecords,
  listTerminalRemoteHosts as listTerminalRemoteHostRecords,
  migrateTerminalRemoteShortcutTables,
  saveTerminalRemoteGroup as saveTerminalRemoteGroupRecord,
  saveTerminalRemoteHost as saveTerminalRemoteHostRecord,
  type TerminalRemoteGroupInput,
  type TerminalRemoteGroupRecord,
  type TerminalRemoteHostInput,
  type TerminalRemoteHostRecord
} from './terminal-remote-shortcuts'
import {
  deleteSshKeyFile,
  fixSshPrivateKeyPermissions,
  importSshKeyFile,
  normalizeSshKeyFileName,
  readSshKeyInventory,
  resolveSshKeyFilePath,
  type SshKeyGenerationInput,
  type SshKeyImportInput,
  type SshPrivateKeyRecord,
  type SshPublicKeyRecord
} from './ssh-keys'
import { createGpgImportPlan, parseGpgSecretKeys, type GpgSecretKeyRecord } from './gpg-keys'
import {
  clearSshPassphrase,
  listSshPassphrasePaths,
  readSshPassphrases,
  saveSshPassphrase,
  withSshPassphraseAskpass
} from './ssh-passphrases'
import {
  createNextjsPm2ArtifactName,
  createNextjsPm2RemoteDeployScript,
  createNextjsPm2RemotePrepareScript,
  isNextjsProject,
  normalizeNextjsPm2DeployConfig,
  type NextjsPm2DeployConfig,
  type NextjsPm2DeployConfigInput
} from './nextjs-pm2-release'
import { requestProjectDeploymentSuggestion } from './ai-project-deployment-assistant'
import {
  createProjectDeploymentTask,
  deleteProjectDeploymentTarget,
  getDeploymentProviderCapabilities,
  getDefaultDeploymentConfig,
  getProjectDeploymentTarget,
  getProjectDeploymentTask,
  inspectProjectDeploymentContext,
  listProjectDeploymentTargets,
  listProjectDeploymentTasks,
  migrateProjectDeploymentTables,
  recoverProjectDeploymentTasks,
  saveProjectDeploymentTarget,
  saveProjectDeploymentTask,
  validateProjectDeploymentConfig,
  type DeploymentInspection,
  type DeploymentProviderType,
  type DeploymentSourceMode,
  type ProjectDeploymentConfig,
  type ProjectDeploymentPreparation,
  type ProjectDeploymentSuggestion,
  type ProjectDeploymentTarget,
  type ProjectDeploymentTargetInput,
  type ProjectDeploymentTaskSnapshot
} from './project-deployment'
import { registerTerminalIpc } from './terminal-ipc'
import { TerminalService, type TerminalDataEvent, type TerminalExitEvent, type TerminalSession } from './terminal-service'
import { createEmptyRemoteAlignment, parseRemoteAlignment, summarizeRemoteAlignment, type GitRemote, type RemoteAlignmentSummary } from './remote-alignment'
import {
  createReleasePlan,
  createReleaseTagName,
  createReleaseVersionRecommendation,
  type ReleasePlan,
  type ReleasePublishProvider,
  type ReleasePublishActionKey,
  type ReleaseScriptName,
  type ReleaseVersionRecommendation
} from './release-publishing'
import {
  getReleasePublishTask as getStoredReleasePublishTask,
  listReleasePublishTasks as listStoredReleasePublishTasks,
  migrateReleasePublishTaskTable,
  saveReleasePublishTask,
  type ReleasePublishArtifact,
  type ReleasePublishTaskSnapshot as StoredReleasePublishTaskSnapshot,
  type ReleasePublishTaskStatus
} from './release-publish-tasks'
import {
  bindProjectService as bindProjectServiceRecord,
  addServiceDomain as addServiceDomainRecord,
  checkServiceDomain,
  deployVercelStaticProjectForService,
  deleteServiceEnvVar as deleteServiceEnvVarRecord,
  deleteOldServiceMonitorHistory,
  deleteServiceConnection as deleteServiceConnectionRecord,
  inspectServiceDomainConfig as inspectServiceDomainConfigRecord,
  isMonitorableServiceDomain,
  listAllProjectServices as listAllProjectServiceRecords,
  listAllServiceMonitorHistory as listAllServiceMonitorHistoryRecords,
  listCachedServiceDeployments as listCachedServiceDeploymentRecords,
  listLatestServiceMonitorChecks as listLatestServiceMonitorCheckRecords,
  listProjectServices as listProjectServiceRecords,
  listServiceConnections as listServiceConnectionRecords,
  listServiceDeployments as listServiceDeploymentRecords,
  listServiceEnvironmentLogs as listServiceEnvironmentLogRecords,
  listServiceEnvVars as listServiceEnvVarRecords,
  listServiceMonitorHistory as listServiceMonitorHistoryRecords,
  listServiceRuntimeLogs as listServiceRuntimeLogRecords,
  migrateServiceMonitoringTables,
  recordServiceMonitorCheck,
  removeServiceDomain as removeServiceDomainRecord,
  revealServiceEnvVar as revealServiceEnvVarRecord,
  runServiceDeploymentAction as runServiceDeploymentActionRecord,
  saveServiceExternalProjectAlias as saveServiceExternalProjectAliasRecord,
  saveServiceEnvVar as saveServiceEnvVarRecord,
  saveProjectService as saveProjectServiceRecord,
  saveServiceConnection as saveServiceConnectionRecord,
  syncServiceConnection,
  verifyServiceDomain as verifyServiceDomainRecord,
  type ProjectServiceInput,
  type ProjectServiceRecord,
  type ServiceEnvironmentLogRecord,
  type ServiceConnectionInput,
  type ServiceConnectionRecord,
  type ServiceDeploymentListOptions,
  type ServiceDeploymentSummary,
  type ServiceDeploymentActionInput,
  type ServiceExternalProjectAliasInput,
  type ServiceEnvVarRecord,
  type ServiceMonitorCheckRecord,
  type VercelDomainConfig,
  type VercelDomainInput,
  type VercelEnvVarInput,
} from './service-monitoring'
import {
  deleteProjectPlaneBinding as deleteProjectPlaneBindingRecord,
  getPlaneProjectContent,
  getPlaneProjectWebUrl,
  getPlaneSettings,
  getProjectPlaneBinding,
  listPlaneProjects,
  migratePlaneIntegrationTables,
  savePlaneSettings,
  saveProjectPlaneBinding,
  testPlaneConnection,
  type PlaneProjectBindingInput,
  type PlaneSettingsInput
} from './plane-integration'
import {
  appendMonthlyPerformanceMessages,
  createMonthlyPerformanceSession,
  createMonthlyPerformanceRange,
  createMonthlyPerformanceSourceRows,
  getMonthlyPerformanceSession,
  listMonthlyPerformanceSessions,
  migrateMonthlyPerformanceTables,
  requestMonthlyPerformanceChat,
  requestMonthlyPerformancePreview,
  saveMonthlyPerformanceSessionExport,
  saveMonthlyPerformanceSessionPreview,
  updateMonthlyPerformanceSessionScope,
  writeMonthlyPerformanceWorkbook,
  type MonthlyPerformanceExportInput,
  type MonthlyPerformanceExportResult,
  type MonthlyPerformancePreview,
  type MonthlyPerformancePreviewInput,
  type MonthlyPerformanceSession,
  type MonthlyPerformanceSessionCreateInput,
  type MonthlyPerformanceSessionExportInput,
  type MonthlyPerformanceSessionMessageInput,
  type MonthlyPerformanceWorkItemSource
} from './monthly-performance'

// Development and packaged builds share the ForgeDesk user-data directory. Do
// not allow a second main process to open the same SQLite database: besides
// SQLITE_BUSY errors this can make native-module failures look like an
// Electron/V8 startup crash. The file lock covers Electron major-version
// transitions, where Electron's built-in lock is not interoperable.
const releaseSingleProcessFileLock = acquireSingleProcessFileLock(join(app.getPath('userData'), 'forgedesk.instance.lock'))
const hasElectronInstanceLock = app.requestSingleInstanceLock()
const hasSingleInstanceLock = Boolean(releaseSingleProcessFileLock && hasElectronInstanceLock)

if (!hasSingleInstanceLock) {
  releaseSingleProcessFileLock?.()
  if (hasElectronInstanceLock) app.releaseSingleInstanceLock()
  app.quit()
} else {
  process.once('exit', () => releaseSingleProcessFileLock?.())
}

type RepositoryScanResult = {
  id: string
  name: string
  repositoryKind: 'root' | 'submodule'
  parentRepositoryId: string
  relativePath: string
  submoduleName: string
  submoduleUrl: string
  expectedCommit: string
  checkedOutCommit: string
  isDetached: boolean
  submoduleState: 'aligned' | 'changed' | 'dirty' | 'uninitialized' | 'missing' | 'conflicted' | 'unknown'
  available: boolean
  scanError: string
  active: boolean
  localPath: string
  remoteUrl: string
  remotes: GitRemote[]
  remoteCount: number
  localBranchCount: number
  remoteBranchCount: number
  branches: string[]
  remoteBranches: string[]
  pushTargets: GitPushTarget[]
  defaultBranch: string
  currentBranch: string
  latestCommit: string
  hasChanges: boolean
  ahead: number
  localUserName: string
  localUserEmail: string
  effectiveUserName: string
  effectiveUserEmail: string
  remoteAlignment: RemoteAlignmentSummary
}

type RepositoryRemoteInput = {
  repositoryId: string
  currentName?: string
  name: string
  fetchUrl: string
  pushUrl?: string
}

type CodemagicAppListInput = {
  tokenId: string
  teamId?: string
  name?: string
}

type CodemagicArtifactPublicUrlInput = {
  tokenId: string
  secureFilename: string
  expiresAt?: number
}

type GitCommandRequest = {
  repositoryId: string
  command: string
}

type GitCommandResult = {
  ok: boolean
  command: string
  args: string[]
  stdout: string
  stderr: string
  exitCode: number | null
}

type GitConflictFile = {
  path: string
  sections: ConflictSection[]
  content: string
}

type GitWorkspaceStatus = {
  repositoryId: string
  branch: string
  files: GitStatusFile[]
  conflicts: GitConflictFile[]
  pushTargets: GitPushTarget[]
}

type GitOperationResult = {
  ok: boolean
  repository: RepositoryRecord
  status: GitWorkspaceStatus
  stdout: string
  stderr: string
}

type GitPushTaskResult = {
  ok: boolean
  branch: string
  pushTargets: GitPushTarget[]
  stdout: string
  stderr: string
}

type GitCommitMessageInput = {
  paths: string[]
}

type RepositoryReleasePrepareInput = {
  targetVersion?: string
  provider?: ReleasePublishProvider
}

type RepositoryReleasePreparation = {
  repositoryId: string
  packageManager: 'pnpm' | 'npm' | 'yarn'
  localPath: string
  documentationContext: string
  recentCommits: string[]
  plan: ReleasePlan
}

type RepositoryReleaseSuggestionInput = {
  targetVersion?: string
}

type RepositoryReleaseTagRecommendation = ReleaseVersionRecommendation

type RepositoryReleasePublishInput = {
  provider?: ReleasePublishProvider
  version: string
  tagName: string
  releaseTitle: string
  releaseNotes: string
  commitMessage: string
  githubTokenId?: string
  githubToken?: string
  codemagicTokenId?: string
  codemagicTeamId?: string
  codemagicAppId?: string
  codemagicAppName?: string
  codemagicWorkflowId?: string
  codemagicWorkflowName?: string
  codemagicDefaultBranch?: string
  codemagicLabels?: string[]
  saveCodemagicBinding?: boolean
  nextjsPm2SshHost?: string
  nextjsPm2RemotePath?: string
  nextjsPm2UploadPath?: string
  nextjsPm2AppName?: string
  nextjsPm2Port?: string | number
  nextjsPm2StartCommand?: string
  nextjsPm2InstallCommand?: string
  releaseActions?: ReleasePublishActionKey[]
}

type RepositoryReleasePublishResult = {
  ok: boolean
  provider: ReleasePublishProvider
  repository: RepositoryRecord
  plan: ReleasePlan
  stdout: string
  stderr: string
  exitCode: number | null
  externalBuildId?: string
  externalBuildUrl?: string
  externalStatus?: string
  externalWorkflow?: string
  externalBranch?: string
  externalTag?: string
  artifacts?: ReleasePublishArtifact[]
}

type RepositoryReleasePublishTaskSnapshot = StoredReleasePublishTaskSnapshot<ReleasePlan, RepositoryRecord> & {
  selectedScript: ReleaseScriptName
  provider: ReleasePublishProvider
  status: ReleasePublishTaskStatus
}

type ReleasePublishCallbacks = {
  onLog?: (message: string) => void
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void
  onPhase?: (phase: string, index: number, total: number) => void
  onProcess?: (child: ChildProcessWithoutNullStreams) => void
  onCodemagicBuild?: (build: CodemagicBuild, externalBuildUrl: string) => void
  onExternalCancel?: (cancel: () => Promise<void>) => void
  shouldCancel?: () => boolean
}

type GitMergeAnalysis = {
  repositoryId: string
  ok: boolean
  source: string
  target: string
  currentBranch: string
  incomingCommits: number
  localOnlyCommits: number
  fastForward: boolean
  mergeBase: string
  issues: string[]
  warnings: string[]
}

type ProjectRecord = {
  id: string
  name: string
  description: string
  status: 'ready' | 'needs-setup' | 'warning'
  owner: string
  workspacePath: string
  groupId: string | null
  createdAt: string
  isFavorite: boolean
}

type RepositoryRecord = RepositoryScanResult & {
  projectId: string
}

type ContributorSummary = {
  personId: string
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
}

type GitContributorIdentity = {
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  filesChanged: number
  activeDays: number
  mappedPersonId: string
  mappedPersonName: string
}

type DailyGitMetric = {
  date: string
  commits: number
  additions: number
  deletions: number
}

type RepositoryContribution = {
  repositoryId: string
  repositoryName: string
  commits: number
  additions: number
  deletions: number
}

type GitCommitRecord = {
  id: string
  repositoryId: string
  repositoryName: string
  hash: string
  shortHash: string
  parentHashes: string[]
  refs: string[]
  authorName: string
  authorEmail: string
  authorDisplayName: string
  authorDisplayEmail: string
  mappedPersonId: string
  committedAt: string
  message: string
  branchName: string
  additions: number
  deletions: number
  filesChanged: number
}

type GitCommitFileChange = {
  id: string
  status: string
  path: string
  oldPath: string
  additions: number
  deletions: number
  binary: boolean
}

type GitCommitDiff = {
  commitHash: string
  filePath: string
  oldPath: string
  status: string
  patch: string
  oldContent: string
  newContent: string
  binary: boolean
}

type ProjectPersonRecord = {
  id: string
  projectId: string
  displayName: string
  role: string
  identities: Array<{
    id: string
    name: string
    email: string
  }>
}

type ProjectGitSummary = {
  projectId: string
  status: 'not-analyzed' | 'ready' | 'failed'
  lastAnalyzedAt: string
  errorMessage: string
  totalCommits: number
  contributorCount: number
  totalAdditions: number
  totalDeletions: number
  activeDays: number
  dailyMetrics: DailyGitMetric[]
  contributors: ContributorSummary[]
  repositories: RepositoryContribution[]
}

type WorkspaceSnapshot = {
  projects: ProjectRecord[]
  repositories: RepositoryRecord[]
}

type GitSetupStatus = {
  gitAvailable: boolean
  gitVersion: string
  userName: string
  userEmail: string
  gpgAvailable: boolean
  gpgVersion: string
  gpgKeys: GpgSecretKeyRecord[]
  gitSigningKey: string
  gitCommitGpgSign: boolean
  sshPublicKeys: SshPublicKeyRecord[]
  sshPrivateKeys: SshPrivateKeyRecord[]
}

type GpgInstallResult = {
  status: GitSetupStatus
  requiresManualInstall: boolean
}

type AppRuntimeInfo = {
  version: string
  canQuickBuild: boolean
  isPackaged: boolean
  isDevelopmentBuild: boolean
  isDevServer: boolean
  appPath: string
  projectRoot: string
}

type QuickBuildTaskStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

type QuickBuildStartInput = {
  cwd?: string
}

type QuickBuildRestartInput = {
  cwd?: string
}

type QuickBuildRestartResult = {
  appPath: string
  restarted: boolean
}

type QuickBuildTaskSnapshot = {
  id: string
  command: string
  cwd: string
  status: QuickBuildTaskStatus
  phase: string
  hint: string
  lastOutputAt: string
  processPid?: number
  startedAt: string
  updatedAt: string
  finishedAt?: string
  log: string
  stdout: string
  stderr: string
  exitCode: number | null
  signal?: string
  error?: string
}

type GitExecutionOptions = {
  env?: NodeJS.ProcessEnv
  operationId?: string
  preserveOutput?: boolean
}

type GitExecutionError = Error & {
  killed?: boolean
  signal?: NodeJS.Signals | null
}

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const sshDirectory = join(homedir(), '.ssh')
const appIconPath = isDev ? join(__dirname, '../../resources/forgedesk.png') : join(process.resourcesPath, 'forgedesk.png')
let database: Database.Database | null = null
const terminalService = new TerminalService({
  onData: (event) => sendTerminalEvent('terminal:data', event),
  onExit: (event) => sendTerminalEvent('terminal:exit', event),
  ptyFactory: createNodePtyFactory()
})
const codexTaskService = new CodexTaskService({
  db: () => getDatabase(),
  emit: (event) => sendCodexTaskEvent(event),
  resolveProjectId: (cwd) => {
    const manualLink = listCodexProjectLinks(getDatabase()).find((link) => link.codexKey === codexProjectKey(cwd))
    if (manualLink) return manualLink.projectId ?? undefined
    return findAutomaticCodexProjectId(cwd, listCodexMonitorProjects())
  },
  resolveCodexHome: (accountId) => resolveCodexHome(app.getPath('userData'), accountId)
})
const managedTaskService = new ManagedTaskService(() => getDatabase())
let managedCodexThreadService: CodexAppServerThreadService | null = null
const codexActivityService = new CodexActivityService()
const codexSiteService = new CodexSiteService({ db: () => getDatabase() })
const codexSessionService = new CodexSessionService({
  emit: (event) => sendCodexSessionEvent(event),
  resolveCodexHome: (accountId) => resolveCodexHome(app.getPath('userData'), accountId)
})
const codexProjectMonitorService = new CodexProjectMonitorService({
  db: () => getDatabase(),
  listGroups: () => listProjectGroups(getDatabase()),
  listProjects: () => listCodexMonitorProjects(),
  listSessions: () => codexSessionService.list(),
  listTasks: () => codexTaskService.list(),
  onAlert: (alert) => sendCodexMonitorAlert(alert)
})
let codexMonitorRefreshPromise: Promise<CodexProjectMonitorSnapshot> | null = null

async function refreshCodexProjectMonitor(emit = true): Promise<CodexProjectMonitorSnapshot> {
  if (codexMonitorRefreshPromise) return codexMonitorRefreshPromise
  codexMonitorRefreshPromise = codexProjectMonitorService.snapshot()
    .then((snapshot) => {
      if (emit) sendCodexProjectMonitorEvent(snapshot)
      return snapshot
    })
    .finally(() => {
      codexMonitorRefreshPromise = null
    })
  return codexMonitorRefreshPromise
}
const releasePublishTasks = new Map<string, RepositoryReleasePublishTaskSnapshot>()
const releasePublishTaskProcesses = new Map<string, ChildProcessWithoutNullStreams>()
const releasePublishTaskExternalCancelers = new Map<string, () => Promise<void>>()
const projectDeploymentTasks = new Map<string, ProjectDeploymentTaskSnapshot>()
const projectDeploymentTaskProcesses = new Map<string, ChildProcessWithoutNullStreams>()
const releaseTaskMaxLogLength = 1024 * 1024
const releaseTaskHistoryLimit = 20
const releasePublishPhaseTotal = 9
const quickBuildCommand = 'pnpm package:mac:legacy'
const quickBuildMaxLogLength = 1024 * 1024
let quickBuildTask: QuickBuildTaskSnapshot | null = null
let quickBuildProcess: ChildProcessWithoutNullStreams | null = null
let closeGuardPrompt: Promise<boolean> | null = null
let forceQuitRequested = false
const confirmedWindowCloseIds = new Set<number>()
let menuBarManagerService: MenuBarManagerService | null = null
const resourceMonitorService = new ResourceMonitorService(() => getDatabase(), collectLightweightResourceSnapshot)
let storageGovernanceTimer: NodeJS.Timeout | null = null

function getPrimaryWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null
}

function getCloseGuardActivities(): CloseGuardActivity[] {
  return collectCloseGuardActivities({
    quickBuildTask,
    releasePublishTasks: releasePublishTasks.values(),
    terminalSessions: terminalService.list()
  })
}

async function confirmCloseGuardAction(action: CloseGuardAction, ownerWindow: BrowserWindow | null = getPrimaryWindow()): Promise<boolean> {
  const prompt = createCloseGuardPrompt(action, getCloseGuardActivities())

  if (!prompt) {
    return true
  }

  if (closeGuardPrompt) {
    return closeGuardPrompt
  }

  const options = {
    buttons: prompt.buttons,
    cancelId: prompt.cancelId,
    defaultId: prompt.defaultId,
    detail: prompt.detail,
    message: prompt.message,
    noLink: true,
    title: prompt.title,
    type: 'warning' as const
  }

  closeGuardPrompt = (async () => {
    const result = ownerWindow && !ownerWindow.isDestroyed()
      ? await dialog.showMessageBox(ownerWindow, options)
      : await dialog.showMessageBox(options)

    return result.response === prompt.confirmButtonIndex
  })()

  try {
    return await closeGuardPrompt
  } finally {
    closeGuardPrompt = null
  }
}

function stopRunningCloseGuardActivities(): void {
  void menuBarManagerService?.shutdown().catch((error) => console.warn('Failed to stop menu bar helper while quitting', error))

  if (quickBuildTask?.status === 'running') {
    try {
      cancelQuickBuildTask()
    } catch (error) {
      console.warn('Failed to cancel quick build while quitting', error)
    }
  }

  for (const task of Array.from(releasePublishTasks.values())) {
    if (task.status !== 'running') {
      continue
    }

    try {
      void cancelRepositoryReleasePublishTask(task.id).catch((error) => console.warn('Failed to cancel release task while quitting', error))
    } catch (error) {
      console.warn('Failed to cancel release task while quitting', error)
    }
  }

  for (const session of terminalService.list()) {
    if (session.exited) {
      continue
    }

    try {
      terminalService.close(session.id)
    } catch (error) {
      console.warn('Failed to close terminal session while quitting', error)
    }
  }
}

async function requestAppQuit(ownerWindow: BrowserWindow | null = getPrimaryWindow()): Promise<void> {
  if (forceQuitRequested) {
    return
  }

  const confirmed = await confirmCloseGuardAction('quit-app', ownerWindow)

  if (!confirmed) {
    return
  }

  forceQuitRequested = true
  stopRunningCloseGuardActivities()
  app.quit()
}

async function requestWindowDismiss(targetWindow: BrowserWindow | null = getPrimaryWindow(), source: 'shortcut' | 'system' = 'system'): Promise<void> {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return
  }

  if (source === 'system' && process.platform !== 'darwin' && BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).length <= 1) {
    await requestAppQuit(targetWindow)
    return
  }

  const confirmed = await confirmCloseGuardAction('close-window', targetWindow)

  if (!confirmed || targetWindow.isDestroyed()) {
    return
  }

  if (source === 'shortcut' || process.platform === 'darwin') {
    targetWindow.hide()
    return
  }

  confirmedWindowCloseIds.add(targetWindow.id)
  targetWindow.close()
}

function attachWindowCloseGuard(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (forceQuitRequested) {
      return
    }

    if (confirmedWindowCloseIds.delete(window.id)) {
      return
    }

    event.preventDefault()
    void requestWindowDismiss(window, 'system')
  })
}

function showOrCreatePrimaryWindow(): void {
  const window = getPrimaryWindow()

  if (!window) {
    createWindow()
    return
  }

  if (window.isMinimized()) {
    window.restore()
  }

  window.show()
  window.focus()
}

function installApplicationMenu(): void {
  const closeWindowItem: MenuItemConstructorOptions = {
    accelerator: 'CommandOrControl+W',
    click: () => {
      void requestWindowDismiss(getPrimaryWindow(), 'shortcut')
    },
    label: '关闭窗口'
  }
  const editMenu: MenuItemConstructorOptions = {
    label: '编辑',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }
  const viewSubmenu: MenuItemConstructorOptions[] = [{ role: 'reload' }]

  if (isDev) {
    viewSubmenu.push({ role: 'forceReload' }, { role: 'toggleDevTools' })
  }

  viewSubmenu.push(
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' }
  )

  const viewMenu: MenuItemConstructorOptions = {
    label: '视图',
    submenu: viewSubmenu
  }
  const windowMenu: MenuItemConstructorOptions = {
    label: '窗口',
    submenu: [
      closeWindowItem,
      { role: 'minimize' },
      ...(process.platform === 'darwin' ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])
    ]
  }
  const template: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [
        {
          label: 'ForgeDesk',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            {
              accelerator: 'Command+Q',
              click: () => {
                void requestAppQuit()
              },
              label: '退出 ForgeDesk'
            }
          ]
        },
        editMenu,
        viewMenu,
        windowMenu
      ]
    : [
        {
          label: '文件',
          submenu: [
            {
              accelerator: 'Control+Q',
              click: () => {
                void requestAppQuit()
              },
              label: '退出 ForgeDesk'
            }
          ]
        },
        editMenu,
        viewMenu,
        windowMenu
      ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function hasForgeDeskPackage(candidatePath: string): boolean {
  if (resolve(candidatePath).split(/[\\/]/).some((part) => part.endsWith('.asar'))) {
    return false
  }

  const packageJsonPath = join(candidatePath, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return false
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      name?: unknown
      scripts?: Record<string, unknown>
    }

    return packageJson.name === 'forgedesk' && typeof packageJson.scripts?.['package:mac:legacy'] === 'string'
  } catch {
    return false
  }
}

function findForgeDeskProjectRoot(startPath: string): string | null {
  let currentPath = resolve(startPath)

  while (true) {
    if (hasForgeDeskPackage(currentPath)) {
      return currentPath
    }

    const parentPath = dirname(currentPath)

    if (parentPath === currentPath) {
      return null
    }

    currentPath = parentPath
  }
}

function resolveForgeDeskProjectRoot(): string {
  const candidates = [
    process.env.FORGEDESK_PROJECT_ROOT,
    process.env.INIT_CWD,
    app.getAppPath(),
    __dirname,
    process.cwd()
  ]

  for (const candidate of candidates) {
    if (!candidate?.trim()) {
      continue
    }

    const projectRoot = findForgeDeskProjectRoot(candidate)

    if (projectRoot) {
      return projectRoot
    }
  }

  return resolve(process.cwd())
}

function createAppRuntimeInfo(): AppRuntimeInfo {
  const projectRoot = resolveForgeDeskProjectRoot()

  return {
    appPath: app.getAppPath(),
    canQuickBuild: hasForgeDeskPackage(projectRoot),
    isDevelopmentBuild: !app.isPackaged,
    isDevServer: isDev,
    isPackaged: app.isPackaged,
    projectRoot,
    version: app.getVersion()
  }
}

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : '读取远端对齐状态失败'
}

function getUnknownErrorMessage(error: unknown, fallback = '操作失败'): string {
  return error instanceof Error ? error.message : fallback
}

function trimReleaseTaskLog(log: string): string {
  return log.length > releaseTaskMaxLogLength ? log.slice(log.length - releaseTaskMaxLogLength) : log
}

function updateReleaseTask(task: RepositoryReleasePublishTaskSnapshot, patch: Partial<RepositoryReleasePublishTaskSnapshot>): void {
  Object.assign(task, patch, { updatedAt: new Date().toISOString() })
  persistReleaseTask(task)
}

function persistReleaseTask(task: RepositoryReleasePublishTaskSnapshot): void {
  try {
    saveReleasePublishTask(getDatabase(), task)
  } catch (error) {
    console.warn('Failed to persist release publish task', error)
  }
}

function appendReleaseTaskLog(task: RepositoryReleasePublishTaskSnapshot, message: string): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const nextLog = [task.log, `[${time}] ${message}`].filter(Boolean).join('\n')
  updateReleaseTask(task, { log: trimReleaseTaskLog(nextLog) })
}

function setReleaseTaskPhase(task: RepositoryReleasePublishTaskSnapshot, phase: string, phaseIndex: number, phaseTotal = releasePublishPhaseTotal): void {
  const changed = task.phase !== phase || task.phaseIndex !== phaseIndex || task.phaseTotal !== phaseTotal
  updateReleaseTask(task, { phase, phaseIndex, phaseTotal })

  if (changed) {
    appendReleaseTaskLog(task, `当前步骤 ${phaseIndex}/${phaseTotal}：${phase}`)
  }
}

function setReleaseTaskHint(task: RepositoryReleasePublishTaskSnapshot, hint: string): void {
  if (!hint || task.hint === hint) {
    return
  }

  updateReleaseTask(task, { hint })
  appendReleaseTaskLog(task, `提示：${hint}`)
}

function explainReleaseOutput(task: RepositoryReleasePublishTaskSnapshot, line: string): void {
  const text = line.trim()
  const lower = text.toLowerCase()

  if (!text) {
    return
  }

  if (lower.includes('replacing existing signature') || lower.includes('signing') || lower.includes('codesign')) {
    setReleaseTaskPhase(task, '签名 macOS 应用', 8)
    setReleaseTaskHint(task, '正在给 macOS 应用和原生模块签名；如果文件很多，这一步可能持续几分钟。')
    return
  }

  if (lower.includes('building dmg') || lower.includes('dmg')) {
    setReleaseTaskPhase(task, '生成 DMG 安装包', 8)
    setReleaseTaskHint(task, '正在生成 DMG 安装包，完成后会继续生成更新文件并上传。')
    return
  }

  if (lower.includes('building block map') || lower.includes('blockmap')) {
    setReleaseTaskPhase(task, '生成更新校验文件', 8)
    setReleaseTaskHint(task, '正在生成自动更新需要的 blockmap 校验文件。')
    return
  }

  if (lower.includes('building zip') || lower.includes('.zip')) {
    setReleaseTaskPhase(task, '生成 ZIP 更新包', 8)
    setReleaseTaskHint(task, '正在生成 ZIP 更新包，这是 macOS 自动更新会用到的文件。')
    return
  }

  if (task.provider === 'nextjs-pm2' && (lower.includes('scp') || lower.includes('upload') || lower.includes('pm2') || lower.includes('release'))) {
    setReleaseTaskHint(task, '正在上传发布包或执行远端 PM2 部署。')
    return
  }

  if (task.provider === 'firebase' && (lower.includes('firebase') || lower.includes('upload') || lower.includes('appdistribution'))) {
    setReleaseTaskPhase(task, '上传到 Firebase App Distribution', 6)
    setReleaseTaskHint(task, '构建产物已经生成，正在上传到 Firebase App Distribution。')
    return
  }

  if (lower.includes('publishing') || lower.includes('uploading') || lower.includes('github') || lower.includes('release')) {
    setReleaseTaskPhase(task, '上传到 GitHub Releases', 8)
    setReleaseTaskHint(task, '本地产物已经生成，正在上传到 GitHub Releases；如果网络或代理不稳定，这一步最容易长时间停住。')
  }
}

function appendReleaseTaskOutput(task: RepositoryReleasePublishTaskSnapshot, stream: 'stdout' | 'stderr', chunk: string): void {
  const text = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  const currentOutput = stream === 'stdout' ? task.stdout : task.stderr
  const nextOutput = trimReleaseTaskLog(currentOutput + chunk)

  updateReleaseTask(task, stream === 'stdout' ? { stdout: nextOutput, lastOutputAt: new Date().toISOString() } : { stderr: nextOutput, lastOutputAt: new Date().toISOString() })

  for (const line of lines) {
    explainReleaseOutput(task, line)
    appendReleaseTaskLog(task, `${stream}: ${line}`)
  }
}

function getReleaseTaskSnapshot(task: RepositoryReleasePublishTaskSnapshot): RepositoryReleasePublishTaskSnapshot {
  return { ...task }
}

function pruneReleaseTaskHistory(): void {
  const completedTasks = Array.from(releasePublishTasks.values())
    .filter((task) => task.status !== 'running')
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))

  for (const task of completedTasks.slice(releaseTaskHistoryLimit)) {
    releasePublishTasks.delete(task.id)
  }
}

function trimQuickBuildText(value: string): string {
  return value.length > quickBuildMaxLogLength ? value.slice(value.length - quickBuildMaxLogLength) : value
}

function getQuickBuildTaskSnapshot(task = quickBuildTask): QuickBuildTaskSnapshot | null {
  return task ? { ...task } : null
}

function sendQuickBuildTaskUpdate(task: QuickBuildTaskSnapshot): void {
  const snapshot = getQuickBuildTaskSnapshot(task)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('quick-build:task-updated', snapshot)
  }
}

function updateQuickBuildTask(task: QuickBuildTaskSnapshot, patch: Partial<QuickBuildTaskSnapshot>): void {
  Object.assign(task, patch, { updatedAt: new Date().toISOString() })
  sendQuickBuildTaskUpdate(task)
}

function appendQuickBuildLog(task: QuickBuildTaskSnapshot, message: string): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const nextLog = [task.log, `[${time}] ${message}`].filter(Boolean).join('\n')

  updateQuickBuildTask(task, {
    lastOutputAt: new Date().toISOString(),
    log: trimQuickBuildText(nextLog)
  })
}

function appendQuickBuildOutput(task: QuickBuildTaskSnapshot, stream: 'stdout' | 'stderr', chunk: string): void {
  const text = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  const currentOutput = stream === 'stdout' ? task.stdout : task.stderr
  const nextOutput = trimQuickBuildText(currentOutput + chunk)

  updateQuickBuildTask(task, stream === 'stdout' ? { stdout: nextOutput, lastOutputAt: new Date().toISOString() } : { stderr: nextOutput, lastOutputAt: new Date().toISOString() })

  for (const line of lines) {
    appendQuickBuildLog(task, `${stream}: ${line}`)
  }
}

function resolveQuickBuildCwd(input: QuickBuildStartInput = {}): string {
  const requestedCwd = input.cwd?.trim()

  if (requestedCwd && hasForgeDeskPackage(requestedCwd)) {
    return resolve(requestedCwd)
  }

  const projectRoot = resolveForgeDeskProjectRoot()

  if (!hasForgeDeskPackage(projectRoot)) {
    throw new Error('未找到可执行快速构建的 ForgeDesk 项目目录')
  }

  return projectRoot
}

async function runQuickBuildTask(task: QuickBuildTaskSnapshot): Promise<void> {
  try {
    const scriptEnv = await createScriptExecutionEnv(process.env)

    appendQuickBuildLog(task, `[ForgeDesk] 当前目录：${task.cwd}`)
    appendQuickBuildLog(task, `[ForgeDesk] 快速构建开始：${new Date(task.startedAt).toLocaleString('zh-CN', { hour12: false })}`)

    const child = spawn('/bin/zsh', ['-lc', task.command], {
      cwd: task.cwd,
      detached: true,
      env: scriptEnv
    })

    quickBuildProcess = child
    updateQuickBuildTask(task, {
      phase: '执行构建命令',
      hint: '快速构建正在后台运行，可以继续使用当前页面。',
      processPid: child.pid
    })

    child.stdout.on('data', (chunk: Buffer) => appendQuickBuildOutput(task, 'stdout', chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => appendQuickBuildOutput(task, 'stderr', chunk.toString()))

    const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; error?: string }>((resolveResult) => {
      let settled = false
      const finish = (nextResult: { exitCode: number | null; signal: NodeJS.Signals | null; error?: string }): void => {
        if (settled) {
          return
        }

        settled = true
        resolveResult(nextResult)
      }

      child.on('error', (error) => {
        appendQuickBuildOutput(task, 'stderr', error.message)
        finish({ exitCode: null, signal: null, error: error.message })
      })
      child.on('exit', (exitCode, signal) => finish({ exitCode, signal }))
    })

    const finishedAt = new Date().toISOString()

    if (task.status === 'cancelled') {
      updateQuickBuildTask(task, {
        exitCode: result.exitCode,
        finishedAt,
        phase: '构建已终止',
        signal: result.signal ?? undefined
      })
      appendQuickBuildLog(task, '[ForgeDesk] 快速构建已终止')
      return
    }

    if (result.error) {
      throw new Error(result.error)
    }

    const succeeded = result.exitCode === 0

    appendQuickBuildLog(task, succeeded ? '[ForgeDesk] 快速构建完成' : `[ForgeDesk] 快速构建失败：退出码 ${result.exitCode ?? '-'}`)
    updateQuickBuildTask(task, {
      exitCode: result.exitCode,
      finishedAt,
      hint: succeeded ? '快速构建已完成。' : '快速构建未成功完成，请查看构建日志。',
      phase: succeeded ? '构建完成' : '构建失败',
      signal: result.signal ?? undefined,
      status: succeeded ? 'succeeded' : 'failed'
    })
  } catch (error) {
    const errorMessage = getUnknownErrorMessage(error, '快速构建失败')

    if (task.status === 'cancelled') {
      updateQuickBuildTask(task, {
        error: errorMessage,
        finishedAt: new Date().toISOString(),
        phase: '构建已终止'
      })
      appendQuickBuildLog(task, '[ForgeDesk] 快速构建已终止')
      return
    }

    appendQuickBuildLog(task, `快速构建失败：${errorMessage}`)
    updateQuickBuildTask(task, {
      error: errorMessage,
      finishedAt: new Date().toISOString(),
      hint: '快速构建启动或执行失败，请查看构建日志。',
      phase: '构建失败',
      status: 'failed',
      stderr: task.stderr || errorMessage
    })
  } finally {
    if (quickBuildTask?.id === task.id) {
      quickBuildProcess = null
    }
  }
}

function startQuickBuildTask(input: QuickBuildStartInput = {}): QuickBuildTaskSnapshot {
  if (quickBuildTask?.status === 'running') {
    appendQuickBuildLog(quickBuildTask, '快速构建已经在后台运行，已返回当前任务')
    return getQuickBuildTaskSnapshot(quickBuildTask) as QuickBuildTaskSnapshot
  }

  const cwd = resolveQuickBuildCwd(input)
  const now = new Date().toISOString()
  const task: QuickBuildTaskSnapshot = {
    id: randomUUID(),
    command: quickBuildCommand,
    cwd,
    status: 'running',
    phase: '等待后台任务启动',
    hint: '后台构建任务已创建。',
    lastOutputAt: now,
    startedAt: now,
    updatedAt: now,
    log: '',
    stdout: '',
    stderr: '',
    exitCode: null
  }

  quickBuildTask = task
  sendQuickBuildTaskUpdate(task)
  appendQuickBuildLog(task, '快速构建任务已进入后台')
  void runQuickBuildTask(task)

  return getQuickBuildTaskSnapshot(task) as QuickBuildTaskSnapshot
}

function resolveQuickBuildRestartCwd(input: QuickBuildRestartInput = {}): string {
  const requestedCwd = input.cwd?.trim() || quickBuildTask?.cwd

  if (requestedCwd && hasForgeDeskPackage(requestedCwd)) {
    return resolve(requestedCwd)
  }

  return resolveQuickBuildCwd()
}

function openMacAppInstance(appPath: string): Promise<void> {
  return new Promise((resolveOpen, rejectOpen) => {
    execFile('open', ['-n', appPath], { timeout: 10000 }, (error, _stdout, stderr) => {
      if (error) {
        rejectOpen(new Error(stderr?.trim() || error.message))
        return
      }

      resolveOpen()
    })
  })
}

async function restartQuickBuildApp(input: QuickBuildRestartInput = {}, ownerWindow: BrowserWindow | null = getPrimaryWindow()): Promise<QuickBuildRestartResult> {
  if (process.platform !== 'darwin') {
    throw new Error('快速重启只支持 macOS app')
  }

  const cwd = resolveQuickBuildRestartCwd(input)
  const appPath = join(cwd, 'dist', 'ForgeDesk.app')

  let appStats

  try {
    appStats = await stat(appPath)
  } catch {
    throw new Error(`未找到构建好的 app：${appPath}`)
  }

  if (!appStats.isDirectory()) {
    throw new Error(`构建产物不是 macOS app：${appPath}`)
  }

  const confirmed = await confirmCloseGuardAction('quit-app', ownerWindow)

  if (!confirmed) {
    return { appPath, restarted: false }
  }

  await openMacAppInstance(appPath)

  forceQuitRequested = true
  stopRunningCloseGuardActivities()
  setTimeout(() => app.quit(), 100)

  return { appPath, restarted: true }
}

function stopQuickBuildProcess(task: QuickBuildTaskSnapshot): void {
  const pid = quickBuildProcess?.pid ?? task.processPid

  if (!pid) {
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      return
    }
  }

  setTimeout(() => {
    if (task.status !== 'cancelled') {
      return
    }

    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // The process may already have exited after SIGTERM.
      }
    }
  }, 5000)
}

function cancelQuickBuildTask(): QuickBuildTaskSnapshot {
  if (!quickBuildTask) {
    throw new Error('暂无快速构建任务')
  }

  if (quickBuildTask.status !== 'running') {
    return getQuickBuildTaskSnapshot(quickBuildTask) as QuickBuildTaskSnapshot
  }

  updateQuickBuildTask(quickBuildTask, {
    finishedAt: new Date().toISOString(),
    hint: '已请求终止后台构建进程。',
    phase: '正在终止构建',
    status: 'cancelled'
  })
  appendQuickBuildLog(quickBuildTask, '已请求终止快速构建进程')
  stopQuickBuildProcess(quickBuildTask)

  return getQuickBuildTaskSnapshot(quickBuildTask) as QuickBuildTaskSnapshot
}

function sendTerminalEvent(channel: 'terminal:data', event: TerminalDataEvent): void
function sendTerminalEvent(channel: 'terminal:exit', event: TerminalExitEvent): void
function sendTerminalEvent(channel: 'terminal:data' | 'terminal:exit', event: TerminalDataEvent | TerminalExitEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, event)
  }
}

function sendCodexTaskEvent(event: CodexTaskEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('codex:tasks:event', event)
  }
  if (event.type !== 'output' && event.type !== 'updated') void refreshCodexProjectMonitor()
}

function sendCodexSessionEvent(event: CodexSessionEvent): void {
  codexSiteService.handleSessionEvent(event.sessionId, event.type, event.error)
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('codex:sessions:event', event)
  }
  if (event.type !== 'item' && event.type !== 'updated') void refreshCodexProjectMonitor()
}

function sendProjectGitTaskEvent(task: ProjectGitTaskLog): void {
  const payload = serializeGitIpcPayload('project-git-tasks:updated', task)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('project-git-tasks:updated', payload)
  }
}

function sendCodexProjectMonitorEvent(snapshot: CodexProjectMonitorSnapshot): void {
  const payload = serializeGitIpcPayload('codex:project-monitor:updated', snapshot)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('codex:project-monitor:updated', payload)
  }
}

function sendCodexMonitorAlert(alert: CodexUncommittedAlert): void {
  const payload = serializeGitIpcPayload('codex:project-monitor:alert', alert)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('codex:project-monitor:alert', payload)
  }

  if (!Notification.isSupported()) return

  const notification = new Notification({
    body: `${alert.projectName || '未关联项目'} · ${alert.filesChanged} 个文件仍有未提交改动`,
    title: 'Codex 执行完成，但工作区未提交'
  })
  notification.on('click', () => {
    const focusPayload = serializeGitIpcPayload('codex:project-monitor:focus', alert)

    for (const window of BrowserWindow.getAllWindows()) {
      window.show()
      window.focus()
      window.webContents.send('codex:project-monitor:focus', focusPayload)
    }
  })
  notification.show()
}

function expandHomePath(path: string): string {
  if (path === '~') {
    return homedir()
  }

  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }

  return path
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolveOutput) => {
    execFile('git', args, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolveOutput('')
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

function runGitStrict(args: string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('git', args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

const GPG_COMMAND_CANDIDATES = [
  'gpg',
  'gpg2',
  '/opt/homebrew/bin/gpg',
  '/opt/homebrew/bin/gpg2',
  '/usr/local/bin/gpg',
  '/usr/local/bin/gpg2',
  '/usr/local/MacGPG2/bin/gpg',
  '/usr/local/MacGPG2/bin/gpg2'
]

const BREW_COMMAND_CANDIDATES = ['brew', '/opt/homebrew/bin/brew', '/usr/local/bin/brew']

type GpgExecutionError = Error & { code?: string }

function createGpgExecutionEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: mergePathValues(process.env.PATH, createGuiToolFallbackPath())
  }
}

function isMissingGpgExecutable(error: unknown): boolean {
  return (error as GpgExecutionError | undefined)?.code === 'ENOENT'
}

function createMissingGpgError(): Error {
  return new Error('未检测到 gpg 命令。请先安装 GPG Suite，或在终端运行 brew install gnupg；安装后回到 ForgeDesk 重新检测。')
}

function runGpgCommand(command: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(command, args, { timeout, maxBuffer: 1024 * 1024 * 20, env: createGpgExecutionEnv() }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(new Error(stderr.trim() || error.message), { code: (error as NodeJS.ErrnoException).code }))
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

async function runGpg(args: string[]): Promise<string> {
  for (const command of GPG_COMMAND_CANDIDATES) {
    try {
      return await runGpgCommand(command, args, 10000)
    } catch (error) {
      if (isMissingGpgExecutable(error)) {
        continue
      }

      return ''
    }
  }

  return ''
}

async function runGpgStrict(args: string[]): Promise<string> {
  for (const command of GPG_COMMAND_CANDIDATES) {
    try {
      return await runGpgCommand(command, args, 30000)
    } catch (error) {
      if (isMissingGpgExecutable(error)) {
        continue
      }

      throw error
    }
  }

  throw createMissingGpgError()
}

function runBrewInstallGpg(command: string): Promise<void> {
  return new Promise((resolveInstall, rejectInstall) => {
    execFile(command, ['install', 'gnupg'], { timeout: 300000, maxBuffer: 1024 * 1024 * 20, env: createGpgExecutionEnv() }, (error, _stdout, stderr) => {
      if (error) {
        rejectInstall(Object.assign(new Error(stderr.trim() || error.message), { code: (error as NodeJS.ErrnoException).code }))
        return
      }

      resolveInstall()
    })
  })
}

async function installGpgWithBrew(): Promise<GpgInstallResult> {
  if (process.platform !== 'darwin') {
    throw new Error('ForgeDesk 当前只支持在 macOS 上自动安装 GPG，请手动安装 gnupg。')
  }

  for (const command of BREW_COMMAND_CANDIDATES) {
    try {
      await runBrewInstallGpg(command)
      const status = await getGitSetupStatus()

      if (!status.gpgAvailable) {
        throw new Error('Homebrew 已完成安装，但 ForgeDesk 仍未检测到 gpg。请点击“重新检测”或重启 ForgeDesk。')
      }

      return { status, requiresManualInstall: false }
    } catch (error) {
      if (isMissingGpgExecutable(error)) {
        continue
      }

      throw new Error(`GPG 安装失败：${(error as Error).message}`)
    }
  }

  return {
    status: await getGitSetupStatus(),
    requiresManualInstall: true
  }
}

function unzipToDirectory(zipPath: string, targetDirectory: string): Promise<void> {
  return new Promise((resolveOutput, reject) => {
    execFile('unzip', ['-qq', '-o', zipPath, '-d', targetDirectory], { timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput()
    })
  })
}

function runGitInPath(localPath: string, args: string[]): Promise<string> {
  return new Promise((resolveOutput) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolveOutput('')
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

function runGitLog(localPath: string, options: { sinceDate?: string; branchName?: string; allRefs?: boolean } = {}): Promise<string> {
  const args = ['-C', localPath, 'log']

  if (options.sinceDate) {
    args.push(`--since=${options.sinceDate}`)
  }

  if (options.branchName) {
    args.push(options.branchName)
  } else if (options.allRefs) {
    args.push('--all', 'HEAD')
  }

  args.push('--date=iso-strict', '--numstat', '--decorate=short', '--pretty=format:__FORGEDESK_COMMIT__%x1f%H%x1f%P%x1f%D%x1f%an%x1f%ae%x1f%aI%x1f%s')

  return new Promise((resolveOutput, reject) => {
    execFile(
      'git',
      args,
      { timeout: 30000, maxBuffer: 1024 * 1024 * 20 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message))
          return
        }

        resolveOutput(stdout)
      }
    )
  })
}

function parseBranchList(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.replace(/^\*\s*/, '').trim())
    .filter(Boolean)
}

function parseRefs(refs: string): string[] {
  return refs
    .split(',')
    .map((ref) => ref.trim())
    .filter(Boolean)
}

async function listRepositoryBranches(localPath: string): Promise<{ branches: string[]; remoteBranches: string[] }> {
  const [localBranches, remoteBranches] = await Promise.all([
    runGitInPath(localPath, ['branch', '--format=%(refname:short)']),
    runGitInPath(localPath, ['branch', '-r', '--format=%(refname:short)'])
  ])

  return {
    branches: parseBranchList(localBranches),
    remoteBranches: parseBranchList(remoteBranches).filter((branch) => !branch.includes('HEAD ->'))
  }
}

async function listRemoteBranchRefs(localPath: string, remoteName: string): Promise<Map<string, string>> {
  const output = await runGitInPath(localPath, ['for-each-ref', '--format=%(refname:short)%00%(objectname)', `refs/remotes/${remoteName}`])
  const refs = new Map<string, string>()
  const remotePrefix = `${remoteName}/`

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const [refName, commitHash] = line.split('\0')

    if (!refName || !commitHash || refName.endsWith('/HEAD') || !refName.startsWith(remotePrefix)) {
      continue
    }

    refs.set(refName.slice(remotePrefix.length), commitHash)
  }

  return refs
}

async function countExclusiveCommits(localPath: string, baseCommit: string, headCommit: string): Promise<number> {
  const output = await runGitInPathOptional(localPath, ['rev-list', '--count', `${baseCommit}..${headCommit}`])
  const count = Number(output.trim())
  return Number.isFinite(count) ? count : 0
}

async function inspectRepositoryPushTargets(localPath: string, remotes: GitRemote[], currentBranch: string): Promise<GitPushTarget[]> {
  const branch = currentBranch.trim()

  if (!branch || branch === 'detached' || remotes.length === 0) {
    return []
  }

  const targets = await Promise.all(
    remotes
      .filter((remote) => remote.name)
      .map(async (remote): Promise<GitPushTarget | null> => {
        try {
          const remoteRefResult = await runGitInPathResult(localPath, buildGitPushTargetRemoteRefVerifyArgs(remote.name, branch))
          const countArgs = remoteRefResult.ok ? buildGitPushTargetCommitCountArgs(remote.name, branch) : buildGitPushTargetLocalCommitCountArgs(branch)
          const countOutput = await runGitInPathOptional(localPath, countArgs)

          return {
            remote: remote.name,
            branch,
            ahead: parseGitCount(countOutput),
            hasRemoteBranch: remoteRefResult.ok
          }
        } catch {
          return null
        }
      })
  )

  return targets.filter((target): target is GitPushTarget => Boolean(target))
}

async function inspectRemoteAlignment(
  localPath: string,
  remotes: GitRemote[],
  currentBranch: string,
  defaultBranch: string
): Promise<RemoteAlignmentSummary> {
  try {
    const refsByRemote = new Map(await Promise.all(remotes.map(async (remote) => [remote.name, await listRemoteBranchRefs(localPath, remote.name)] as const)))

    return summarizeRemoteAlignment({
      remotes,
      refsByRemote,
      currentBranch,
      defaultBranch,
      countExclusiveCommits: (baseCommit, headCommit) => countExclusiveCommits(localPath, baseCommit, headCommit)
    })
  } catch (error) {
    return {
      remotes: remotes.map((remote) => ({
        name: remote.name,
        url: remote.fetchUrl || remote.pushUrl || '',
        branchCount: 0
      })),
      remoteCount: remotes.length,
      status: 'unknown',
      branchCount: 0,
      alignedBranchCount: 0,
      divergedBranchCount: 0,
      missingBranchCount: 0,
      currentBranchStatus: '',
      errorMessage: getErrorText(error),
      branches: []
    }
  }
}

function getDatabase(): Database.Database {
  if (database) {
    return database
  }

  const databasePath = join(app.getPath('userData'), 'forgedesk.db')
  database = new Database(databasePath)
  database.pragma('busy_timeout = 5000')
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  migrateDatabase(database)
  return database
}

function migrateDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready',
      owner TEXT NOT NULL DEFAULT '',
      workspace_path TEXT NOT NULL DEFAULT '',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      repository_kind TEXT NOT NULL DEFAULT 'root',
      parent_repository_id TEXT NOT NULL DEFAULT '',
      relative_path TEXT NOT NULL DEFAULT '.',
      submodule_name TEXT NOT NULL DEFAULT '',
      submodule_url TEXT NOT NULL DEFAULT '',
      expected_commit TEXT NOT NULL DEFAULT '',
      checked_out_commit TEXT NOT NULL DEFAULT '',
      is_detached INTEGER NOT NULL DEFAULT 0,
      submodule_state TEXT NOT NULL DEFAULT 'unknown',
      available INTEGER NOT NULL DEFAULT 1,
      scan_error TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      local_path TEXT NOT NULL,
      remote_url TEXT NOT NULL DEFAULT '',
      remotes_json TEXT NOT NULL DEFAULT '[]',
      remote_count INTEGER NOT NULL DEFAULT 0,
      local_branch_count INTEGER NOT NULL DEFAULT 0,
      remote_branch_count INTEGER NOT NULL DEFAULT 0,
      branches_json TEXT NOT NULL DEFAULT '[]',
      remote_branches_json TEXT NOT NULL DEFAULT '[]',
      push_targets_json TEXT NOT NULL DEFAULT '[]',
      remote_alignment_json TEXT NOT NULL DEFAULT '{}',
      default_branch TEXT NOT NULL DEFAULT '',
      current_branch TEXT NOT NULL DEFAULT '',
      latest_commit TEXT NOT NULL DEFAULT '',
      has_changes INTEGER NOT NULL DEFAULT 0,
      ahead INTEGER NOT NULL DEFAULT 0,
      local_user_name TEXT NOT NULL DEFAULT '',
      local_user_email TEXT NOT NULL DEFAULT '',
      effective_user_name TEXT NOT NULL DEFAULT '',
      effective_user_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS git_commits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      hash TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      message TEXT NOT NULL,
      branch_name TEXT NOT NULL DEFAULT '',
      additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0,
      files_changed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      project_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      last_analyzed_at TEXT NOT NULL,
      error_message TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      git_identities TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_people (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_person_identities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      git_name TEXT NOT NULL DEFAULT '',
      git_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES project_people(id) ON DELETE CASCADE
    );
  `)

  migrateProjectBranchTagTable(db)
  migrateProjectTerminalCommandTable(db)
  migrateServiceMonitoringTables(db)
  migrateDeploymentApprovalTables(db)
  migrateRsaPrivateKeyTables(db)
  migrateDockerTables(db)
  migrateTerminalRemoteShortcutTables(db)
  migratePlaneIntegrationTables(db)
  migrateProjectCloudflareTables(db)
  migrateProjectFirebaseReleaseTables(db)
  migrateDataSourceTables(db)
  migrateCodemagicRepositoryBindingTable(db)
  migrateReleasePublishTaskTable(db)
  migrateProjectDeploymentTables(db)
  recoverProjectDeploymentTasks(db)
  migrateMonthlyPerformanceTables(db)
  migrateResourceGovernanceTables(db)
  migrateCodexTaskTables(db)
  migrateManagedTaskTables(db)
  migrateProjectGroupTables(db)
  migrateCodexProjectMonitorTables(db)
  migrateCodexSiteTables(db)
  migrateProjectAiBindingTable(db)
  migrateProjectGitTaskTable(db)
  recoverProjectGitTasks(db)

  addColumnIfMissing(db, 'repositories', 'remotes_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'repository_kind', "TEXT NOT NULL DEFAULT 'root'")
  addColumnIfMissing(db, 'repositories', 'parent_repository_id', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'repositories', 'relative_path', "TEXT NOT NULL DEFAULT '.'")
  addColumnIfMissing(db, 'repositories', 'submodule_name', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'repositories', 'submodule_url', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'repositories', 'expected_commit', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'repositories', 'checked_out_commit', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'repositories', 'is_detached', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'submodule_state', "TEXT NOT NULL DEFAULT 'unknown'")
  addColumnIfMissing(db, 'repositories', 'available', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(db, 'repositories', 'scan_error', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'repositories', 'active', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(db, 'repositories', 'remote_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'local_branch_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'remote_branch_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'repositories', 'branches_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_branches_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'push_targets_json', "TEXT NOT NULL DEFAULT '[]'")
  addColumnIfMissing(db, 'repositories', 'remote_alignment_json', "TEXT NOT NULL DEFAULT '{}'")
  addColumnIfMissing(db, 'git_commits', 'branch_name', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'projects', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0')
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>

  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
  }
}

function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (!value) {
    return fallback
  }

  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function createProjectId(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'}-${Date.now()}`
}

function mapProjectRow(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    groupId: String(row.group_id ?? '') || null,
    description: String(row.description ?? ''),
    status: (String(row.status) as ProjectRecord['status']) || 'ready',
    owner: String(row.owner ?? ''),
    workspacePath: String(row.workspace_path ?? ''),
    createdAt: String(row.created_at),
    isFavorite: Number(row.is_favorite ?? 0) === 1
  }
}

function mapRepositoryRow(row: Record<string, unknown>): RepositoryRecord {
  const remotes = parseJsonArray<GitRemote>(row.remotes_json)
  const branches = parseJsonArray<string>(row.branches_json)
  const remoteBranches = parseJsonArray<string>(row.remote_branches_json)
  const pushTargets = parseJsonArray<GitPushTarget>(row.push_targets_json)
  const remoteAlignment = parseRemoteAlignment(row.remote_alignment_json)

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    repositoryKind: String(row.repository_kind ?? 'root') === 'submodule' ? 'submodule' : 'root',
    parentRepositoryId: String(row.parent_repository_id ?? ''),
    relativePath: String(row.relative_path ?? '.'),
    submoduleName: String(row.submodule_name ?? ''),
    submoduleUrl: String(row.submodule_url ?? ''),
    expectedCommit: String(row.expected_commit ?? ''),
    checkedOutCommit: String(row.checked_out_commit ?? ''),
    isDetached: Number(row.is_detached ?? 0) === 1,
    submoduleState: (String(row.submodule_state ?? 'unknown') as RepositoryRecord['submoduleState']) || 'unknown',
    available: Number(row.available ?? 1) === 1,
    scanError: String(row.scan_error ?? ''),
    active: Number(row.active ?? 1) === 1,
    localPath: String(row.local_path),
    remoteUrl: String(row.remote_url ?? ''),
    remotes,
    remoteCount: Number(row.remote_count ?? remotes.length),
    localBranchCount: Number(row.local_branch_count ?? branches.length),
    remoteBranchCount: Number(row.remote_branch_count ?? remoteBranches.length),
    branches,
    remoteBranches,
    pushTargets,
    defaultBranch: String(row.default_branch ?? ''),
    currentBranch: String(row.current_branch ?? ''),
    latestCommit: String(row.latest_commit ?? ''),
    hasChanges: Boolean(row.has_changes),
    ahead: Number(row.ahead ?? 0),
    localUserName: String(row.local_user_name ?? ''),
    localUserEmail: String(row.local_user_email ?? ''),
    effectiveUserName: String(row.effective_user_name ?? ''),
    effectiveUserEmail: String(row.effective_user_email ?? ''),
    remoteAlignment
  }
}

function listProjects(): ProjectRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM projects ORDER BY is_favorite DESC, created_at DESC, id DESC')
    .all()
    .map((row) => mapProjectRow(row as Record<string, unknown>))
}

function getProjectOrThrow(projectId: string): ProjectRecord {
  const row = getDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined

  if (!row) {
    throw new Error('项目不存在')
  }

  return mapProjectRow(row)
}

function listRepositories(projectId?: string): RepositoryRecord[] {
  const statement = projectId
    ? getDatabase().prepare('SELECT * FROM repositories WHERE project_id = ? AND active = 1 ORDER BY relative_path ASC, name ASC')
    : getDatabase().prepare('SELECT * FROM repositories WHERE active = 1 ORDER BY relative_path ASC, name ASC')
  const rows = projectId ? statement.all(projectId) : statement.all()
  return rows.map((row) => mapRepositoryRow(row as Record<string, unknown>))
}

function listCodexMonitorProjects(): MonitorProjectRecord[] {
  return listProjects().map((project) => ({
    groupId: project.groupId,
    id: project.id,
    name: project.name,
    repositoryPaths: listRepositories(project.id).map((repository) => repository.localPath).filter(Boolean),
    workspacePath: project.workspacePath
  }))
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function identityKey(name: string, email: string): string {
  return `${name.trim().toLowerCase()} <${email.trim().toLowerCase()}>`
}

function emailIdentityKey(email: string): string {
  return email.trim().toLowerCase()
}

function nameIdentityKey(name: string): string {
  return name.trim().toLowerCase()
}

function listProjectPeople(projectId: string): ProjectPersonRecord[] {
  const db = getDatabase()
  normalizeProjectPeople(projectId)
  const people = db.prepare('SELECT * FROM project_people WHERE project_id = ? ORDER BY display_name ASC').all(projectId) as Array<Record<string, unknown>>
  const identities = db.prepare('SELECT * FROM project_person_identities WHERE project_id = ? ORDER BY git_name ASC, git_email ASC').all(projectId) as Array<Record<string, unknown>>
  const identityGroups = new Map<string, ProjectPersonRecord['identities']>()

  for (const identity of identities) {
    const personId = String(identity.person_id)
    const current = identityGroups.get(personId) ?? []
    current.push({
      id: String(identity.id),
      name: String(identity.git_name ?? ''),
      email: String(identity.git_email ?? '')
    })
    identityGroups.set(personId, current)
  }

  return people.map((person) => ({
    id: String(person.id),
    projectId: String(person.project_id),
    displayName: String(person.display_name ?? ''),
    role: String(person.role ?? ''),
    identities: identityGroups.get(String(person.id)) ?? []
  }))
}

function normalizeProjectPeople(projectId: string): void {
  const db = getDatabase()
  const people = db.prepare('SELECT * FROM project_people WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as Array<Record<string, unknown>>
  const displayNames = new Set(people.map((person) => String(person.display_name ?? '').trim()).filter(Boolean))
  const roleCounts = new Map<string, number>()

  for (const person of people) {
    const role = String(person.role ?? '').trim()

    if (role) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1)
    }
  }

  const mergeGroups = new Map<string, Array<Record<string, unknown>>>()

  for (const person of people) {
    const role = String(person.role ?? '').trim()

    if (!role) {
      continue
    }

    if ((roleCounts.get(role) ?? 0) > 1 || displayNames.has(role)) {
      const group = mergeGroups.get(role) ?? []
      group.push(person)
      mergeGroups.set(role, group)
    }
  }

  if (mergeGroups.size === 0) {
    return
  }

  const now = new Date().toISOString()
  db.transaction(() => {
    for (const [displayName, group] of mergeGroups) {
      const existingTarget = people.find((person) => String(person.display_name ?? '').trim() === displayName)
      const target = existingTarget ?? group[0]
      const targetId = String(target.id)

      db.prepare('UPDATE project_people SET display_name = ?, role = ?, updated_at = ? WHERE id = ?').run(displayName, '', now, targetId)

      for (const person of group) {
        const personId = String(person.id)

        if (personId === targetId) {
          continue
        }

        db.prepare('UPDATE project_person_identities SET person_id = ?, updated_at = ? WHERE person_id = ?').run(targetId, now, personId)
        db.prepare('DELETE FROM project_people WHERE id = ?').run(personId)
      }
    }
  })()
}

function saveProjectPerson(input: {
  id?: string
  projectId: string
  displayName: string
  role?: string
  identities: Array<{ name: string; email: string }>
}): ProjectPersonRecord {
  const displayName = input.displayName.trim()

  if (!displayName) {
    throw new Error('请输入人员名称')
  }

  const project = getDatabase().prepare('SELECT id FROM projects WHERE id = ?').get(input.projectId)

  if (!project) {
    throw new Error('项目不存在')
  }

  const now = new Date().toISOString()
  const personId = input.id || createId('person')
  const identitiesByKey = new Map<string, { name: string; email: string }>()

  for (const identity of input.identities
    .map((identity) => ({ name: identity.name.trim(), email: identity.email.trim() }))
    .filter((identity) => identity.name || identity.email)) {
    identitiesByKey.set(identityKey(identity.name, identity.email), identity)
  }

  const identities = Array.from(identitiesByKey.values())

  getDatabase()
    .transaction(() => {
      getDatabase()
        .prepare(
          `
          INSERT INTO project_people (id, project_id, display_name, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            role = excluded.role,
            updated_at = excluded.updated_at
        `
        )
        .run(personId, input.projectId, displayName, input.role?.trim() ?? '', now, now)

      getDatabase().prepare('DELETE FROM project_person_identities WHERE person_id = ?').run(personId)
      const insertIdentity = getDatabase().prepare(`
        INSERT INTO project_person_identities (id, project_id, person_id, git_name, git_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const identity of identities) {
        insertIdentity.run(createId('identity'), input.projectId, personId, identity.name, identity.email, now, now)
      }
    })()

  const person = listProjectPeople(input.projectId).find((item) => item.id === personId)

  if (!person) {
    throw new Error('人员映射保存失败')
  }

  return person
}

function deleteProjectPerson(projectId: string, personId: string): ProjectPersonRecord[] {
  getDatabase().prepare('DELETE FROM project_people WHERE project_id = ? AND id = ?').run(projectId, personId)
  return listProjectPeople(projectId)
}

function deleteProject(projectId: string): WorkspaceSnapshot {
  const db = getDatabase()
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)

  if (!existing) {
    throw new Error('项目不存在')
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
  return getWorkspaceSnapshot()
}

function getWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    projects: listProjects(),
    repositories: listRepositories()
  }
}

function upsertRepository(projectId: string, repository: RepositoryScanResult): RepositoryRecord {
  const now = new Date().toISOString()
  getDatabase()
    .prepare(
      `
      INSERT INTO repositories (
        id, project_id, name, repository_kind, parent_repository_id, relative_path, submodule_name, submodule_url,
        expected_commit, checked_out_commit, is_detached, submodule_state, available, scan_error, active,
        local_path, remote_url, remotes_json, remote_count, local_branch_count,
        remote_branch_count, branches_json, remote_branches_json, push_targets_json, remote_alignment_json, default_branch, current_branch, latest_commit,
        has_changes, ahead, local_user_name, local_user_email, effective_user_name, effective_user_email,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        name = excluded.name,
        repository_kind = excluded.repository_kind,
        parent_repository_id = excluded.parent_repository_id,
        relative_path = excluded.relative_path,
        submodule_name = excluded.submodule_name,
        submodule_url = excluded.submodule_url,
        expected_commit = excluded.expected_commit,
        checked_out_commit = excluded.checked_out_commit,
        is_detached = excluded.is_detached,
        submodule_state = excluded.submodule_state,
        available = excluded.available,
        scan_error = excluded.scan_error,
        active = excluded.active,
        local_path = excluded.local_path,
        remote_url = excluded.remote_url,
        remotes_json = excluded.remotes_json,
        remote_count = excluded.remote_count,
        local_branch_count = excluded.local_branch_count,
        remote_branch_count = excluded.remote_branch_count,
        branches_json = excluded.branches_json,
        remote_branches_json = excluded.remote_branches_json,
        push_targets_json = excluded.push_targets_json,
        remote_alignment_json = excluded.remote_alignment_json,
        default_branch = excluded.default_branch,
        current_branch = excluded.current_branch,
        latest_commit = excluded.latest_commit,
        has_changes = excluded.has_changes,
        ahead = excluded.ahead,
        local_user_name = excluded.local_user_name,
        local_user_email = excluded.local_user_email,
        effective_user_name = excluded.effective_user_name,
        effective_user_email = excluded.effective_user_email,
        updated_at = excluded.updated_at
    `
    )
    .run(
      repository.id,
      projectId,
      repository.name,
      repository.repositoryKind,
      repository.parentRepositoryId,
      repository.relativePath,
      repository.submoduleName,
      repository.submoduleUrl,
      repository.expectedCommit,
      repository.checkedOutCommit,
      repository.isDetached ? 1 : 0,
      repository.submoduleState,
      repository.available ? 1 : 0,
      repository.scanError,
      1,
      repository.localPath,
      repository.remoteUrl,
      JSON.stringify(repository.remotes),
      repository.remoteCount,
      repository.localBranchCount,
      repository.remoteBranchCount,
      JSON.stringify(repository.branches),
      JSON.stringify(repository.remoteBranches),
      JSON.stringify(repository.pushTargets),
      JSON.stringify(repository.remoteAlignment),
      repository.defaultBranch,
      repository.currentBranch,
      repository.latestCommit,
      repository.hasChanges ? 1 : 0,
      repository.ahead,
      repository.localUserName,
      repository.localUserEmail,
      repository.effectiveUserName,
      repository.effectiveUserEmail,
      now,
      now
    )

  return { ...repository, projectId }
}

function createGitExecutionEnv(options: GitExecutionOptions = {}): NodeJS.ProcessEnv {
  return options.env ? { ...process.env, ...options.env } : process.env
}

const activeGitProcesses = new Map<string, Set<ChildProcess>>()
const cancelledGitOperations = new Set<string>()

function isGitOperationCancelled(operationId?: string): boolean {
  return Boolean(operationId && cancelledGitOperations.has(operationId))
}

function registerGitProcess(operationId: string | undefined, child: ChildProcess): void {
  if (!operationId) return

  const processes = activeGitProcesses.get(operationId) ?? new Set<ChildProcess>()
  processes.add(child)
  activeGitProcesses.set(operationId, processes)

  if (isGitOperationCancelled(operationId)) {
    terminateGitProcess(child, 'SIGTERM')
  }
}

function unregisterGitProcess(operationId: string | undefined, child: ChildProcess): void {
  if (!operationId) return

  const processes = activeGitProcesses.get(operationId)
  if (!processes) return

  processes.delete(child)
  if (processes.size === 0) activeGitProcesses.delete(operationId)
}

function terminateGitProcess(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): boolean {
  if (!child.pid) return false

  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal)
      return true
    } catch {
      // The process may have already exited; fall back to the child handle.
    }
  }

  try {
    return child.kill(signal)
  } catch {
    return false
  }
}

function cancelRepositoryGitOperation(operationId: string): boolean {
  const normalizedId = operationId.trim()
  if (!normalizedId) return false

  cancelledGitOperations.add(normalizedId)
  const processes = activeGitProcesses.get(normalizedId)
  let terminated = false

  processes?.forEach((child) => {
    terminated = terminateGitProcess(child) || terminated
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) terminateGitProcess(child, 'SIGKILL')
    }, 1000).unref?.()
  })

  setTimeout(() => cancelledGitOperations.delete(normalizedId), 60_000).unref?.()
  return terminated
}

function formatGitCommandForMessage(args: string[]): string {
  return `git ${args.join(' ')}`
}

function createGitFailureMessage(args: string[], error: GitExecutionError, stdout: string | Buffer = '', stderr: string | Buffer = ''): string {
  const output = [stderr, stdout]
    .map((value) => value.toString().trim())
    .filter(Boolean)
    .join('\n')

  if (output) {
    return output
  }

  const lowerMessage = error.message.toLowerCase()
  const timedOut = error.killed || error.signal === 'SIGTERM' || lowerMessage.includes('timed out')

  if (timedOut) {
    return `${formatGitCommandForMessage(args)} 执行超时，可能在等待 SSH 密码、主机指纹确认，或远端网络没有响应。`
  }

  return error.message.trim() || `${formatGitCommandForMessage(args)} 执行失败`
}

function runGitInPathStrict(localPath: string, args: string[], options: GitExecutionOptions = {}): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = execFile('git', ['-C', localPath, ...args], {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 20,
      env: createGitExecutionEnv(options)
    }, (error, stdout, stderr) => {
      unregisterGitProcess(options.operationId, child)

      if (isGitOperationCancelled(options.operationId)) {
        reject(new Error('Git 操作已终止'))
        return
      }

      if (error) {
        reject(new Error(createGitFailureMessage(args, error, stdout, stderr)))
        return
      }

      resolveOutput(options.preserveOutput ? stdout : stdout.trim())
    })
    registerGitProcess(options.operationId, child)
  })
}

function runGitInPathOptional(localPath: string, args: string[]): Promise<string> {
  return new Promise((resolveOutput) => {
    execFile('git', ['-C', localPath, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout) => {
      if (error) {
        resolveOutput('')
        return
      }

      resolveOutput(stdout)
    })
  })
}

function runGitInPathResult(localPath: string, args: string[], options: GitExecutionOptions = {}): Promise<GitCommandResult> {
  return new Promise((resolveResult) => {
    const child = execFile('git', ['-C', localPath, ...args], {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 20,
      env: createGitExecutionEnv(options)
    }, (error, stdout, stderr) => {
      unregisterGitProcess(options.operationId, child)
      const exitCode = typeof error?.code === 'number' ? error.code : error ? null : 0
      const cancelled = isGitOperationCancelled(options.operationId)
      const failureMessage = cancelled ? 'Git 操作已终止' : error ? createGitFailureMessage(args, error, stdout, stderr) : ''

      resolveResult({
        ok: !error && !cancelled,
        command: `git ${args.join(' ')}`,
        args,
        stdout: stdout.trimEnd(),
        stderr: (failureMessage || stderr || '').trimEnd(),
        exitCode
      })
    })
    registerGitProcess(options.operationId, child)
  })
}

async function withSavedSshPassphrases<T>(operation: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  return withSshPassphraseAskpass(await readSshPassphrases(app.getPath('userData')), operation)
}

async function cloneRemoteRepository(remoteUrl: string, targetPath: string): Promise<void> {
  const args = buildRemoteCloneArgs(remoteUrl, targetPath)

  await withSavedSshPassphrases(
    (sshEnv) =>
      new Promise<void>((resolveClone, rejectClone) => {
        const child = spawn('git', args, {
          cwd: dirname(targetPath),
          env: { ...process.env, ...sshEnv },
          stdio: 'pipe'
        })
        let stdout = ''
        let stderr = ''

        const appendOutput = (current: string, chunk: Buffer): string => {
          const next = current + chunk.toString()
          return next.length > 64 * 1024 ? next.slice(-64 * 1024) : next
        }

        child.stdout.on('data', (chunk: Buffer) => {
          stdout = appendOutput(stdout, chunk)
        })
        child.stderr.on('data', (chunk: Buffer) => {
          stderr = appendOutput(stderr, chunk)
        })
        child.once('error', (error) => rejectClone(new Error(error.message)))
        child.once('exit', (exitCode) => {
          if (exitCode === 0) {
            resolveClone()
            return
          }

          const output = [stderr, stdout].map((value) => value.trim()).filter(Boolean).join('\n')
          rejectClone(new Error(output || `git clone 执行失败（退出码 ${exitCode ?? '未知'}）`))
        })
      })
  )
}

function runSshKeygen(args: string[], env: NodeJS.ProcessEnv = {}): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile('ssh-keygen', args, { timeout: 10000, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message))
        return
      }

      resolveOutput(stdout.trim())
    })
  })
}

async function findAvailableSshKeyPath(): Promise<string> {
  const candidates = ['id_ed25519', 'id_ed25519_forgedesk']

  for (const candidate of candidates) {
    const path = join(sshDirectory, candidate)

    if (!existsSync(path) && !existsSync(`${path}.pub`)) {
      return path
    }
  }

  let index = 2

  while (true) {
    const path = join(sshDirectory, `id_ed25519_forgedesk_${index}`)

    if (!existsSync(path) && !existsSync(`${path}.pub`)) {
      return path
    }

    index += 1
  }
}

function createWindow(show = true): void {
  const mainWindow = new BrowserWindow({
    show,
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: 'ForgeDesk',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 13 }
        }
      : {}),
    backgroundColor: '#f6f7f9',
    icon: appIconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  attachWindowCloseGuard(mainWindow)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

type RepositoryScanContext = {
  repositoryKind?: 'root' | 'submodule'
  parentRepositoryId?: string
  relativePath?: string
  submoduleName?: string
  submoduleUrl?: string
  expectedCommit?: string
  statusMarker?: SubmoduleDescriptor['statusMarker']
}

function getSubmoduleState(
  context: RepositoryScanContext,
  available: boolean,
  hasChanges: boolean,
  checkedOutCommit: string
): RepositoryScanResult['submoduleState'] {
  if (context.repositoryKind !== 'submodule') {
    return 'unknown'
  }

  if (!available) {
    return context.statusMarker === '-' ? 'uninitialized' : 'missing'
  }

  if (context.statusMarker === 'U') {
    return 'conflicted'
  }

  if (context.expectedCommit && checkedOutCommit && context.expectedCommit !== checkedOutCommit) {
    return 'changed'
  }

  if (hasChanges) {
    return 'dirty'
  }

  if (context.expectedCommit && checkedOutCommit) {
    return 'aligned'
  }

  return 'unknown'
}

function createUnavailableRepositoryScan(localPath: string, context: RepositoryScanContext): RepositoryScanResult {
  const normalizedPath = resolve(expandHomePath(localPath))
  const submodule = context.repositoryKind === 'submodule'

  return {
    id: normalizedPath,
    name: context.submoduleName || basename(normalizedPath),
    repositoryKind: context.repositoryKind ?? 'root',
    parentRepositoryId: context.parentRepositoryId ?? '',
    relativePath: context.relativePath ?? basename(normalizedPath),
    submoduleName: context.submoduleName ?? '',
    submoduleUrl: context.submoduleUrl ?? '',
    expectedCommit: context.expectedCommit ?? '',
    checkedOutCommit: '',
    isDetached: false,
    submoduleState: getSubmoduleState(context, false, false, ''),
    available: false,
    scanError: submodule ? '子模块尚未初始化或本地目录不存在' : '仓库已不存在或不是 Git 仓库',
    active: true,
    localPath: normalizedPath,
    remoteUrl: context.submoduleUrl ?? '',
    remotes: [],
    remoteCount: 0,
    localBranchCount: 0,
    remoteBranchCount: 0,
    branches: [],
    remoteBranches: [],
    pushTargets: [],
    defaultBranch: '',
    currentBranch: 'unavailable',
    latestCommit: context.expectedCommit ? `${context.expectedCommit.slice(0, 7)} 父仓库锁定提交` : '不可用',
    hasChanges: false,
    ahead: 0,
    localUserName: '',
    localUserEmail: '',
    effectiveUserName: '',
    effectiveUserEmail: '',
    remoteAlignment: createEmptyRemoteAlignment('unknown', '子模块尚未初始化或本地目录不存在')
  }
}

async function scanRepository(localPath: string, context: RepositoryScanContext = {}): Promise<RepositoryScanResult | null> {
  const normalizedPath = resolve(expandHomePath(localPath))

  if (!existsSync(join(normalizedPath, '.git'))) {
    return context.repositoryKind === 'submodule' ? createUnavailableRepositoryScan(normalizedPath, context) : null
  }

  const git = simpleGit(normalizedPath)
  const [status, log, gitRemotes, branchInfo, localUserName, localUserEmail, effectiveUserName, effectiveUserEmail, branchName, checkedOutCommit] = await Promise.all([
    git.status(),
    git.log({ maxCount: 1 }).catch(() => ({ latest: undefined })),
    git.getRemotes(true),
    listRepositoryBranches(normalizedPath),
    runGitInPath(normalizedPath, ['config', '--local', 'user.name']),
    runGitInPath(normalizedPath, ['config', '--local', 'user.email']),
    runGitInPath(normalizedPath, ['config', 'user.name']),
    runGitInPath(normalizedPath, ['config', 'user.email']),
    runGitInPath(normalizedPath, ['symbolic-ref', '--short', '-q', 'HEAD']),
    runGitInPath(normalizedPath, ['rev-parse', 'HEAD'])
  ])
  const latest = log.latest
  const remotes = gitRemotes.map((remote) => ({
    name: remote.name,
    fetchUrl: remote.refs.fetch ?? '',
    pushUrl: remote.refs.push ?? ''
  }))
  const origin = remotes.find((remote) => remote.name === 'origin') ?? remotes[0]
  const currentBranch = branchName || status.current || 'detached'
  const defaultBranch = status.tracking ? status.tracking.replace(/^[^/]+\//, '') : currentBranch
  const [remoteAlignment, pushTargets] = await Promise.all([
    inspectRemoteAlignment(normalizedPath, remotes, currentBranch, defaultBranch),
    inspectRepositoryPushTargets(normalizedPath, remotes, currentBranch)
  ])

  return {
    id: normalizedPath,
    name: context.submoduleName || basename(normalizedPath),
    repositoryKind: context.repositoryKind ?? 'root',
    parentRepositoryId: context.parentRepositoryId ?? '',
    relativePath: context.relativePath ?? basename(normalizedPath),
    submoduleName: context.submoduleName ?? '',
    submoduleUrl: context.submoduleUrl ?? '',
    expectedCommit: context.expectedCommit ?? '',
    checkedOutCommit,
    isDetached: !branchName,
    submoduleState: getSubmoduleState(context, true, status.files.length > 0, checkedOutCommit),
    available: true,
    scanError: '',
    active: true,
    localPath: normalizedPath,
    remoteUrl: origin?.fetchUrl ?? origin?.pushUrl ?? '',
    remotes,
    remoteCount: remotes.length,
    localBranchCount: branchInfo.branches.length,
    remoteBranchCount: branchInfo.remoteBranches.length,
    branches: branchInfo.branches,
    remoteBranches: branchInfo.remoteBranches,
    pushTargets,
    defaultBranch,
    currentBranch,
    latestCommit: latest ? `${latest.hash.slice(0, 7)} ${latest.message}` : 'No commits yet',
    hasChanges: status.files.length > 0,
    ahead: status.ahead,
    localUserName,
    localUserEmail,
    effectiveUserName,
    effectiveUserEmail,
    remoteAlignment
  }
}

type ParsedGitCommit = {
  hash: string
  parentHashes: string[]
  refs: string[]
  authorName: string
  authorEmail: string
  committedAt: string
  message: string
  branchName: string
  additions: number
  deletions: number
  filesChanged: number
}

function parseGitLog(output: string): ParsedGitCommit[] {
  const commits: ParsedGitCommit[] = []
  let current: ParsedGitCommit | null = null

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('__FORGEDESK_COMMIT__')) {
      if (current) {
        commits.push(current)
      }

      const [, hash, parents, refs, authorName, authorEmail, committedAt, message] = line.replace('__FORGEDESK_COMMIT__', '').split('\u001f')
      current = {
        hash: hash ?? '',
        parentHashes: parents ? parents.split(' ').filter(Boolean) : [],
        refs: parseRefs(refs ?? ''),
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        committedAt: committedAt ?? '',
        message: message ?? '',
        branchName: '',
        additions: 0,
        deletions: 0,
        filesChanged: 0
      }
      continue
    }

    if (!current || !line.trim()) {
      continue
    }

    const [additions, deletions] = line.split('\t')
    current.filesChanged += 1

    if (additions !== '-' && deletions !== '-') {
      current.additions += Number(additions) || 0
      current.deletions += Number(deletions) || 0
    }
  }

  if (current) {
    commits.push(current)
  }

  return commits.filter((commit) => commit.hash)
}

function emptyProjectSummary(projectId: string, status: ProjectGitSummary['status'] = 'not-analyzed', errorMessage = ''): ProjectGitSummary {
  return {
    projectId,
    status,
    lastAnalyzedAt: '',
    errorMessage,
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

function getProjectSummary(projectId: string, range?: { startDate?: string; endDate?: string }): ProjectGitSummary {
  const db = getDatabase()
  const run = db.prepare('SELECT * FROM analysis_runs WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined
  const conditions = ['c.project_id = ?']
  const params: unknown[] = [projectId]

  if (range?.startDate) {
    conditions.push('c.committed_at >= ?')
    params.push(`${range.startDate}T00:00:00.000Z`)
  }

  if (range?.endDate) {
    conditions.push('c.committed_at <= ?')
    params.push(`${range.endDate}T23:59:59.999Z`)
  }

  const commits = db
    .prepare(
      `
      SELECT c.*, r.name AS repository_name
      FROM git_commits c
      LEFT JOIN repositories r ON r.id = c.repository_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.committed_at ASC
    `
    )
    .all(...params) as Array<Record<string, unknown>>

  if (!run && commits.length === 0) {
    return emptyProjectSummary(projectId)
  }

  const daily = new Map<string, DailyGitMetric>()
  const contributors = new Map<string, ContributorSummary & { days: Set<string> }>()
  const repositoryContributions = new Map<string, RepositoryContribution>()
  const people = listProjectPeople(projectId)
  const peopleByIdentity = new Map<string, ProjectPersonRecord>()
  const peopleByEmail = new Map<string, ProjectPersonRecord>()
  const peopleByName = new Map<string, ProjectPersonRecord>()
  const activeDays = new Set<string>()

  for (const person of people) {
    for (const identity of person.identities) {
      peopleByIdentity.set(identityKey(identity.name, identity.email), person)
      if (identity.email) {
        peopleByEmail.set(emailIdentityKey(identity.email), person)
      }
      if (identity.name && !identity.email) {
        peopleByName.set(nameIdentityKey(identity.name), person)
      }
    }
  }

  for (const commit of commits) {
    const date = String(commit.committed_at).slice(0, 10)
    const additions = Number(commit.additions ?? 0)
    const deletions = Number(commit.deletions ?? 0)
    const filesChanged = Number(commit.files_changed ?? 0)
    const email = String(commit.author_email ?? '')
    const authorName = String(commit.author_name ?? '')
    const mappedPerson = peopleByIdentity.get(identityKey(authorName, email)) ?? (email ? peopleByEmail.get(emailIdentityKey(email)) : undefined) ?? peopleByName.get(nameIdentityKey(authorName))
    const contributorKey = mappedPerson?.id ?? (email || authorName)
    const repositoryId = String(commit.repository_id)

    activeDays.add(date)

    const dayMetric = daily.get(date) ?? { date, commits: 0, additions: 0, deletions: 0 }
    dayMetric.commits += 1
    dayMetric.additions += additions
    dayMetric.deletions += deletions
    daily.set(date, dayMetric)

    const contributor = contributors.get(contributorKey) ?? {
      personId: mappedPerson?.id ?? '',
      name: mappedPerson?.displayName ?? authorName,
      email: mappedPerson ? mappedPerson.identities.find((identity) => identity.email)?.email ?? email : email,
      commits: 0,
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      activeDays: 0,
      days: new Set<string>()
    }
    contributor.commits += 1
    contributor.additions += additions
    contributor.deletions += deletions
    contributor.filesChanged += filesChanged
    contributor.days.add(date)
    contributor.activeDays = contributor.days.size
    contributors.set(contributorKey, contributor)

    const repository = repositoryContributions.get(repositoryId) ?? {
      repositoryId,
      repositoryName: String(commit.repository_name ?? basename(repositoryId)),
      commits: 0,
      additions: 0,
      deletions: 0
    }
    repository.commits += 1
    repository.additions += additions
    repository.deletions += deletions
    repositoryContributions.set(repositoryId, repository)
  }

  return {
    projectId,
    status: ((run?.status as ProjectGitSummary['status'] | undefined) ?? 'ready') || 'ready',
    lastAnalyzedAt: String(run?.last_analyzed_at ?? ''),
    errorMessage: String(run?.error_message ?? ''),
    totalCommits: commits.length,
    contributorCount: contributors.size,
    totalAdditions: commits.reduce((sum, commit) => sum + Number(commit.additions ?? 0), 0),
    totalDeletions: commits.reduce((sum, commit) => sum + Number(commit.deletions ?? 0), 0),
    activeDays: activeDays.size,
    dailyMetrics: Array.from(daily.values()),
    contributors: Array.from(contributors.values())
      .map(({ days: _days, ...contributor }) => contributor)
      .sort((a, b) => b.commits - a.commits || b.additions + b.deletions - (a.additions + a.deletions)),
    repositories: Array.from(repositoryContributions.values()).sort((a, b) => b.commits - a.commits)
  }
}

function listProjectContributorIdentities(projectId: string): GitContributorIdentity[] {
  const db = getDatabase()
  const commits = db
    .prepare(
      `
      SELECT author_name, author_email, additions, deletions, files_changed, committed_at
      FROM git_commits
      WHERE project_id = ?
      ORDER BY author_name ASC, author_email ASC
    `
    )
    .all(projectId) as Array<Record<string, unknown>>
  const people = listProjectPeople(projectId)
  const peopleByIdentity = new Map<string, ProjectPersonRecord>()
  const peopleByEmail = new Map<string, ProjectPersonRecord>()
  const peopleByName = new Map<string, ProjectPersonRecord>()
  const identities = new Map<string, GitContributorIdentity & { days: Set<string> }>()

  for (const person of people) {
    for (const identity of person.identities) {
      peopleByIdentity.set(identityKey(identity.name, identity.email), person)
      if (identity.email) {
        peopleByEmail.set(emailIdentityKey(identity.email), person)
      }
      if (identity.name && !identity.email) {
        peopleByName.set(nameIdentityKey(identity.name), person)
      }
    }
  }

  for (const commit of commits) {
    const name = String(commit.author_name ?? '')
    const email = String(commit.author_email ?? '')
    const key = identityKey(name, email)
    const mappedPerson = peopleByIdentity.get(key) ?? (email ? peopleByEmail.get(emailIdentityKey(email)) : undefined) ?? peopleByName.get(nameIdentityKey(name))
    const current = identities.get(key) ?? {
      name,
      email,
      commits: 0,
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      activeDays: 0,
      mappedPersonId: mappedPerson?.id ?? '',
      mappedPersonName: mappedPerson?.displayName ?? '',
      days: new Set<string>()
    }

    current.commits += 1
    current.additions += Number(commit.additions ?? 0)
    current.deletions += Number(commit.deletions ?? 0)
    current.filesChanged += Number(commit.files_changed ?? 0)
    current.days.add(String(commit.committed_at).slice(0, 10))
    current.activeDays = current.days.size
    current.mappedPersonId = mappedPerson?.id ?? current.mappedPersonId
    current.mappedPersonName = mappedPerson?.displayName ?? current.mappedPersonName
    identities.set(key, current)
  }

  return Array.from(identities.values())
    .map(({ days: _days, ...identity }) => identity)
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name))
}

async function createMonthlyPerformancePreview(input: MonthlyPerformancePreviewInput): Promise<MonthlyPerformancePreview> {
  const project = getProjectOrThrow(input.projectId)
  const range = createMonthlyPerformanceRange(input.month)
  const summary = getProjectSummary(project.id, range)
  const people = listProjectPeople(project.id)
  const sourceWarnings: string[] = []
  let workItems: MonthlyPerformanceWorkItemSource[] = []

  if (summary.totalCommits === 0) {
    sourceWarnings.push('本月没有 Git 提交数据')
  }

  try {
    const planeContent = await getPlaneProjectContent(getDatabase(), project.id)
    workItems = planeContent.workItems
  } catch (error) {
    sourceWarnings.push(`Plane 数据未参与：${getUnknownErrorMessage(error, '读取 Plane 数据失败')}`)
  }

  const sourceRows = createMonthlyPerformanceSourceRows({
    contributors: summary.contributors,
    people,
    workItems,
    startDate: range.startDate,
    endDate: range.endDate
  })
  const settings = await readAiSettingsFile(app.getPath('userData'))

  return requestMonthlyPerformancePreview({
    settings,
    projectId: project.id,
    projectName: project.name,
    month: input.month,
    startDate: range.startDate,
    endDate: range.endDate,
    instruction: input.instruction,
    totalCommits: summary.totalCommits,
    totalAdditions: summary.totalAdditions,
    totalDeletions: summary.totalDeletions,
    activeDays: summary.activeDays,
    contributorCount: summary.contributorCount,
    sourceRows,
    sourceWarnings
  })
}

function sanitizeExcelFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || '月度绩效'
}

async function exportMonthlyPerformanceWorkbook(input: MonthlyPerformanceExportInput): Promise<MonthlyPerformanceExportResult> {
  const preview = input.preview
  const defaultPath = join(app.getPath('documents'), `${sanitizeExcelFileName(preview.projectName)}-${preview.month}-月度绩效.xlsx`)
  const result = await dialog.showSaveDialog({
    title: '保存月度绩效 Excel',
    defaultPath,
    filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
  })

  if (result.canceled || !result.filePath) {
    return { filePath: null }
  }

  await writeMonthlyPerformanceWorkbook(preview, result.filePath)
  return { filePath: result.filePath }
}

function createMonthlyPerformanceSessionRecord(input: MonthlyPerformanceSessionCreateInput): MonthlyPerformanceSession {
  const project = getProjectOrThrow(input.projectId)
  createMonthlyPerformanceRange(input.month)

  return createMonthlyPerformanceSession(getDatabase(), {
    projectId: project.id,
    projectName: project.name,
    month: input.month
  })
}

function updateMonthlyPerformanceSessionScopeRecord(input: { sessionId: string; projectId: string; month: string }): MonthlyPerformanceSession {
  const project = getProjectOrThrow(input.projectId)
  createMonthlyPerformanceRange(input.month)

  return updateMonthlyPerformanceSessionScope(getDatabase(), {
    sessionId: input.sessionId,
    projectId: project.id,
    projectName: project.name,
    month: input.month
  })
}

async function sendMonthlyPerformanceSessionMessage(input: MonthlyPerformanceSessionMessageInput): Promise<MonthlyPerformanceSession> {
  let session = updateMonthlyPerformanceSessionScopeRecord(input)
  session = appendMonthlyPerformanceMessages(getDatabase(), session.id, [{ role: 'user', content: input.content }])

  const settings = await readAiSettingsFile(app.getPath('userData'))
  const assistantContent = await requestMonthlyPerformanceChat({
    settings,
    projectName: session.projectName,
    month: session.month,
    messages: session.messages
  })

  return appendMonthlyPerformanceMessages(getDatabase(), session.id, [{ role: 'assistant', content: assistantContent }])
}

async function confirmMonthlyPerformanceSession(input: { sessionId: string; projectId: string; month: string }): Promise<MonthlyPerformanceSession> {
  const session = updateMonthlyPerformanceSessionScopeRecord(input)
  const instruction = session.messages.map((message) => `${message.role === 'user' ? '用户' : 'AI'}：${message.content}`).join('\n')
  const preview = await createMonthlyPerformancePreview({
    projectId: session.projectId,
    month: session.month,
    instruction
  })

  return saveMonthlyPerformanceSessionPreview(getDatabase(), session.id, preview)
}

async function exportMonthlyPerformanceSession(input: MonthlyPerformanceSessionExportInput): Promise<MonthlyPerformanceSession> {
  const session = getMonthlyPerformanceSession(getDatabase(), input.sessionId)

  if (!session) {
    throw new Error('月度绩效会话不存在')
  }

  if (!session.preview) {
    throw new Error('请先确认生成数据后再导出 Excel')
  }

  const result = await exportMonthlyPerformanceWorkbook({ preview: session.preview })

  if (!result.filePath) {
    return session
  }

  return saveMonthlyPerformanceSessionExport(getDatabase(), session.id, result.filePath)
}

function mapCommitRecord(
  commit: ParsedGitCommit & { repositoryId: string; repositoryName: string; branchName: string },
  authorLookup?: GitAuthorLookup
): GitCommitRecord {
  const authorDisplay = authorLookup
    ? resolveGitAuthorDisplay(
        {
          authorName: commit.authorName,
          authorEmail: commit.authorEmail
        },
        authorLookup
      )
    : {
        authorDisplayName: commit.authorName,
        authorDisplayEmail: commit.authorEmail,
        mappedPersonId: ''
      }

  return {
    id: `${commit.repositoryId}:${commit.hash}`,
    repositoryId: commit.repositoryId,
    repositoryName: commit.repositoryName,
    hash: commit.hash,
    shortHash: commit.hash.slice(0, 7),
    parentHashes: commit.parentHashes,
    refs: commit.refs,
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    authorDisplayName: authorDisplay.authorDisplayName,
    authorDisplayEmail: authorDisplay.authorDisplayEmail,
    mappedPersonId: authorDisplay.mappedPersonId,
    committedAt: commit.committedAt,
    message: commit.message,
    branchName: commit.branchName,
    additions: commit.additions,
    deletions: commit.deletions,
    filesChanged: commit.filesChanged
  }
}

async function getCommitBaseRef(localPath: string, commitHash: string): Promise<string> {
  const parentsLine = await runGitInPathOptional(localPath, ['rev-list', '--parents', '-n', '1', commitHash])
  const [, firstParent] = parentsLine.trim().split(/\s+/)
  return firstParent || '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
}

function parseNumstat(output: string): Map<string, { additions: number; deletions: number; binary: boolean }> {
  const stats = new Map<string, { additions: number; deletions: number; binary: boolean }>()

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const [additions, deletions, ...paths] = line.split('\t')
    const path = paths[paths.length - 1] ?? ''

    if (!path) {
      continue
    }

    stats.set(path, {
      additions: additions === '-' ? 0 : Number(additions) || 0,
      deletions: deletions === '-' ? 0 : Number(deletions) || 0,
      binary: additions === '-' || deletions === '-'
    })
  }

  return stats
}

async function listRepositoryCommitFiles(repositoryId: string, commitHash: string): Promise<GitCommitFileChange[]> {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  const baseRef = await getCommitBaseRef(repository.localPath, commitHash)
  const [nameStatusOutput, numstatOutput] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['diff', '--name-status', '-M', baseRef, commitHash]),
    runGitInPathStrict(repository.localPath, ['diff', '--numstat', '-M', baseRef, commitHash])
  ])
  const stats = parseNumstat(numstatOutput)

  return nameStatusOutput
    .split(/\r?\n/)
    .map((line): GitCommitFileChange | null => {
      if (!line.trim()) {
        return null
      }

      const [rawStatus, firstPath, secondPath] = line.split('\t')
      const status = rawStatus.charAt(0)
      const path = secondPath || firstPath || ''
      const oldPath = secondPath ? firstPath : ''
      const stat = stats.get(path) ?? stats.get(firstPath ?? '') ?? { additions: 0, deletions: 0, binary: false }

      return {
        id: `${commitHash}:${path}:${oldPath}`,
        status,
        path,
        oldPath,
        additions: stat.additions,
        deletions: stat.deletions,
        binary: stat.binary
      }
    })
    .filter((change): change is GitCommitFileChange => Boolean(change))
}

async function getRepositoryCommitDiff(repositoryId: string, commitHash: string, filePath: string, oldPath = '', status = ''): Promise<GitCommitDiff> {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  const baseRef = await getCommitBaseRef(repository.localPath, commitHash)
  const patch = await runGitInPathOptional(repository.localPath, ['diff', '--find-renames', baseRef, commitHash, '--', oldPath || filePath, filePath])
  const [oldContent, newContent] = await Promise.all([
    oldPath || status !== 'A' ? runGitInPathOptional(repository.localPath, ['show', `${baseRef}:${oldPath || filePath}`]) : Promise.resolve(''),
    status !== 'D' ? runGitInPathOptional(repository.localPath, ['show', `${commitHash}:${filePath}`]) : Promise.resolve('')
  ])

  return {
    commitHash,
    filePath,
    oldPath,
    status,
    patch,
    oldContent,
    newContent,
    binary: patch.includes('Binary files') || (!oldContent && !newContent && Boolean(filePath))
  }
}

function getRepositoryOrThrow(repositoryId: string): RepositoryRecord {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  if (!existsSync(join(repository.localPath, '.git'))) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return repository
}

async function rescanRepositoryRecord(repository: RepositoryRecord): Promise<RepositoryRecord> {
  const scanned = await scanRepository(repository.localPath, {
    repositoryKind: repository.repositoryKind,
    parentRepositoryId: repository.parentRepositoryId,
    relativePath: repository.relativePath,
    submoduleName: repository.submoduleName,
    submoduleUrl: repository.submoduleUrl,
    expectedCommit: repository.expectedCommit
  })

  if (!scanned) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return upsertRepository(repository.projectId, scanned)
}

async function listGitRemoteNames(localPath: string): Promise<string[]> {
  return parseBranchList(await runGitInPathStrict(localPath, ['remote']))
}

function normalizeRemoteUrl(value: string, fieldName: string): string {
  const url = value.trim()

  if (!url) {
    throw new Error(`请输入${fieldName}`)
  }

  return url
}

async function saveRepositoryRemote(input: RepositoryRemoteInput): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(input.repositoryId)
  const currentName = input.currentName ? validateRepositoryRemoteName(input.currentName) : ''
  const nextName = validateRepositoryRemoteName(input.name)
  const fetchUrl = normalizeRemoteUrl(input.fetchUrl, 'Fetch URL')
  const pushUrl = normalizeRemoteUrl(input.pushUrl || input.fetchUrl, 'Push URL')
  const remoteNames = await listGitRemoteNames(repository.localPath)

  if (currentName && !remoteNames.includes(currentName)) {
    throw new Error(`远端 ${currentName} 不存在`)
  }

  if (!currentName && remoteNames.includes(nextName)) {
    throw new Error(`远端 ${nextName} 已存在`)
  }

  if (currentName && currentName !== nextName && remoteNames.includes(nextName)) {
    throw new Error(`远端 ${nextName} 已存在`)
  }

  if (!currentName) {
    await runGitInPathStrict(repository.localPath, ['remote', 'add', nextName, fetchUrl])
  } else if (currentName !== nextName) {
    await runGitInPathStrict(repository.localPath, ['remote', 'rename', currentName, nextName])
  }

  await runGitInPathStrict(repository.localPath, ['remote', 'set-url', nextName, fetchUrl])
  await runGitInPathStrict(repository.localPath, ['remote', 'set-url', '--push', nextName, pushUrl])

  return rescanRepositoryRecord(repository)
}

async function deleteRepositoryRemote(repositoryId: string, remoteName: string): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(repositoryId)
  const name = validateRepositoryRemoteName(remoteName)
  const remoteNames = await listGitRemoteNames(repository.localPath)

  if (!remoteNames.includes(name)) {
    throw new Error(`远端 ${name} 不存在`)
  }

  await runGitInPathStrict(repository.localPath, ['remote', 'remove', name])
  return rescanRepositoryRecord(repository)
}

function formatRemoteFetchFailures(results: Array<{ remoteName: string; result: GitCommandResult }>): string {
  const failures = results.filter(({ result }) => !result.ok)
  const successes = results.filter(({ result }) => result.ok).map(({ remoteName }) => remoteName)
  const failedNames = failures.map(({ remoteName }) => remoteName).join(', ')
  const heading = successes.length > 0
    ? `部分远端 Fetch 失败。成功：${successes.join(', ')}；失败：${failedNames}。`
    : `全部远端 Fetch 失败：${failedNames}。`
  const details = failures.map(({ remoteName, result }) => {
    const output = result.stderr || result.stdout || 'Git 没有返回更多错误信息'
    return `${remoteName}: ${output}`
  })

  return [heading, ...details].join('\n')
}

async function fetchRepositoryRemote(repositoryId: string, remoteName?: string, operationId?: string): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(repositoryId)

  await withSavedSshPassphrases(async (env) => {
    if (isGitOperationCancelled(operationId)) {
      throw new Error('Git 操作已终止')
    }

    if (remoteName) {
      const name = validateRepositoryRemoteName(remoteName)
      await runGitInPathStrict(repository.localPath, ['fetch', name, '--prune'], { env, operationId })
      return
    }

    const remoteNames = await listGitRemoteNames(repository.localPath)

    if (remoteNames.length === 0) {
      throw new Error('当前仓库没有远端配置')
    }

    const results: Array<{ remoteName: string; result: GitCommandResult }> = []

    for (const name of remoteNames) {
      if (isGitOperationCancelled(operationId)) {
        throw new Error('Git 操作已终止')
      }

      results.push({
        remoteName: name,
        result: await runGitInPathResult(repository.localPath, ['fetch', name, '--prune'], { env, operationId })
      })
    }

    if (results.some(({ result }) => !result.ok)) {
      throw new Error(formatRemoteFetchFailures(results))
    }
  })

  return rescanRepositoryRecord(repository)
}

async function switchRepositoryBranch(repositoryId: string, input: GitBranchSwitchInput): Promise<RepositoryRecord> {
  const repository = getRepositoryOrThrow(repositoryId)

  await runGitInPathStrict(repository.localPath, buildGitSwitchBranchArgs(input))

  return rescanRepositoryRecord(repository)
}

const serviceMonitorIntervalMs = 5 * 60 * 1000
const serviceMonitorRetentionDays = 30
let serviceMonitorTimer: NodeJS.Timeout | null = null
let serviceMonitorRunning = false

function getServiceMonitorCutoffIso(): string {
  return new Date(Date.now() - serviceMonitorRetentionDays * 24 * 60 * 60 * 1000).toISOString()
}

async function checkProjectServicesNow(projectId?: string): Promise<ProjectServiceRecord[]> {
  const db = getDatabase()
  const services = projectId ? listProjectServiceRecords(db, projectId) : listAllProjectServiceRecords(db)

  for (const service of services) {
    if (!service.enabled) {
      continue
    }

    for (const domain of service.domains) {
      if (!isMonitorableServiceDomain(domain, service.provider)) {
        continue
      }

      const result = await checkServiceDomain(domain)
      recordServiceMonitorCheck(db, {
        projectId: projectId ?? '',
        serviceId: service.id,
        domainId: domain.id,
        ...result
      })
    }
  }

  deleteOldServiceMonitorHistory(db, getServiceMonitorCutoffIso())
  return projectId ? listProjectServiceRecords(db, projectId) : listAllProjectServiceRecords(db)
}

async function runServiceMonitorSweep(projectId?: string): Promise<void> {
  if (serviceMonitorRunning) {
    return
  }

  serviceMonitorRunning = true

  try {
    await checkProjectServicesNow(projectId)
  } catch (error) {
    console.error('Service monitor sweep failed', error)
  } finally {
    serviceMonitorRunning = false
  }
}

function startServiceMonitorScheduler(): void {
  if (serviceMonitorTimer) {
    return
  }

  serviceMonitorTimer = setInterval(() => {
    runServiceMonitorSweep().catch((error) => console.error('Service monitor sweep failed', error))
  }, serviceMonitorIntervalMs)
  serviceMonitorTimer.unref?.()
  setTimeout(() => runServiceMonitorSweep().catch((error) => console.error('Service monitor sweep failed', error)), 10000).unref?.()
}

async function runRepositoryGitCommand(input: GitCommandRequest): Promise<GitCommandResult> {
  const repository = getRepositoryOrThrow(input.repositoryId)
  const args = parseControlledGitCommand(input.command)
  const result = args[0] === 'fetch'
    ? await withSavedSshPassphrases((env) => runGitInPathResult(repository.localPath, args, { env }))
    : await runGitInPathResult(repository.localPath, args)

  if (result.ok && args[0] === 'fetch') {
    await rescanRepositoryRecord(repository)
  }

  return result
}

function resolveRepositoryFilePath(repository: RepositoryRecord, filePath: string): string {
  const normalizedPath = resolve(repository.localPath, filePath)
  const relativePath = relative(repository.localPath, normalizedPath)

  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('只能处理当前仓库内的文件')
  }

  return normalizedPath
}

async function getRepositoryWorkspaceStatus(repositoryId: string): Promise<GitWorkspaceStatus> {
  const repository = getRepositoryOrThrow(repositoryId)
  const [statusOutput, branch] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['status', '--porcelain=v1', '-z'], { preserveOutput: true }),
    runGitInPath(repository.localPath, ['branch', '--show-current'])
  ])
  const files = parsePorcelainStatus(statusOutput)
  const currentBranch = branch || repository.currentBranch
  const pushTargets = await inspectRepositoryPushTargets(repository.localPath, repository.remotes, currentBranch)
  const conflicts = await Promise.all(
    files
      .filter((file) => file.conflict)
      .map(async (file) => {
        const content = await readFile(resolveRepositoryFilePath(repository, file.path), 'utf8')
        return {
          path: file.path,
          content,
          sections: extractConflictSections(content)
        }
      })
  )

  return { repositoryId, branch, files, conflicts, pushTargets }
}

function parseGitCount(output: string): number {
  const count = Number.parseInt(output.trim(), 10)
  return Number.isFinite(count) ? count : 0
}

function mergeTreeCheckIsUnsupported(result: GitCommandResult): boolean {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return output.includes('unknown option') || output.includes('usage:') || output.includes('not a git command')
}

async function analyzeRepositoryMerge(repositoryId: string, input: GitMergeAnalysisInput): Promise<GitMergeAnalysis> {
  const repository = getRepositoryOrThrow(repositoryId)
  const status = await getRepositoryWorkspaceStatus(repositoryId)
  const currentBranch = status.branch || repository.currentBranch || 'HEAD'
  const source = input.source.trim()
  const target = input.target.trim()
  const issues: string[] = []
  const warnings: string[] = []

  if (!source) {
    issues.push('请选择要合并进来的分支')
  }

  if (!target) {
    issues.push('请选择要合并到的目标分支')
  }

  if (source && target && source === target) {
    issues.push('合并双方不能是同一个分支')
  }

  if (target && target !== currentBranch) {
    issues.push(`当前工作区停在 ${currentBranch}，目标分支必须是当前分支。请先切到 ${target} 后再合并。`)
  }

  if (status.files.length > 0) {
    issues.push('当前工作区还有未提交改动，请先提交或暂存后再合并')
  }

  let sourceExists = false
  let targetExists = false
  let incomingCommits = 0
  let localOnlyCommits = 0
  let fastForward = false
  let mergeBase = ''

  if (source) {
    try {
      const sourceRefResult = await runGitInPathResult(repository.localPath, buildGitVerifyRefArgs(source))
      sourceExists = sourceRefResult.ok

      if (!sourceRefResult.ok) {
        issues.push(`找不到要合并进来的分支：${source}`)
      }
    } catch (error) {
      issues.push(getErrorText(error))
    }
  }

  if (target) {
    try {
      const targetRefResult = await runGitInPathResult(repository.localPath, buildGitVerifyRefArgs(target))
      targetExists = targetRefResult.ok

      if (!targetRefResult.ok) {
        issues.push(`找不到目标分支：${target}`)
      }
    } catch (error) {
      issues.push(getErrorText(error))
    }
  }

  if (sourceExists && targetExists && source !== target) {
    const [incomingResult, localResult, mergeBaseResult, fastForwardResult, mergeTreeResult] = await Promise.all([
      runGitInPathResult(repository.localPath, buildGitRevListCountArgs(target, source)),
      runGitInPathResult(repository.localPath, buildGitRevListCountArgs(source, target)),
      runGitInPathResult(repository.localPath, buildGitMergeBaseArgs({ source, target })),
      runGitInPathResult(repository.localPath, buildGitFastForwardCheckArgs({ source, target })),
      runGitInPathResult(repository.localPath, buildGitMergeTreeArgs({ source, target }))
    ])

    incomingCommits = incomingResult.ok ? parseGitCount(incomingResult.stdout) : 0
    localOnlyCommits = localResult.ok ? parseGitCount(localResult.stdout) : 0
    mergeBase = mergeBaseResult.ok ? mergeBaseResult.stdout.trim() : ''
    fastForward = fastForwardResult.ok

    if (!incomingResult.ok || !localResult.ok || !mergeBaseResult.ok) {
      issues.push('无法读取双方分支的提交关系，请检查本地仓库状态')
    }

    if (incomingResult.ok && incomingCommits === 0) {
      issues.push(`${target} 已经包含 ${source} 的提交，不需要合并`)
    }

    if (localOnlyCommits > 0 && !fastForward) {
      warnings.push(`${target} 也有 ${localOnlyCommits} 个独有提交，本次会创建一次普通合并`)
    }

    if (!mergeTreeResult.ok) {
      if (mergeTreeCheckIsUnsupported(mergeTreeResult)) {
        warnings.push('当前 Git 版本无法做冲突预检查，真实合并前仍会二次确认')
      } else {
        issues.push('预检查发现这次合并可能产生冲突，请确认双方改动后再合并')
      }
    }
  }

  return {
    repositoryId,
    ok: issues.length === 0,
    source,
    target,
    currentBranch,
    incomingCommits,
    localOnlyCommits,
    fastForward,
    mergeBase,
    issues,
    warnings
  }
}

async function runRepositoryWriteOperation(repositoryId: string, args: string[], options: GitExecutionOptions = {}): Promise<GitOperationResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const result = await runGitInPathResult(repository.localPath, args, options)
  if (isGitOperationCancelled(options.operationId)) {
    throw new Error('Git 操作已终止')
  }

  const rescannedRepository = await rescanRepositoryRecord(repository)
  const status = await getRepositoryWorkspaceStatus(repositoryId)

  return {
    ok: result.ok,
    repository: rescannedRepository,
    status,
    stdout: result.stdout,
    stderr: result.stderr
  }
}

async function commitRepositoryChanges(repositoryId: string, input: GitCommitInput): Promise<GitOperationResult> {
  const tagName = input.tagName?.trim() ?? ''
  const tagArgs = tagName ? buildGitTagArgs(tagName) : null
  const commitResult = await runRepositoryWriteOperation(repositoryId, buildGitCommitArgs(input))

  if (!commitResult.ok || !tagArgs) {
    return commitResult
  }

  const repository = getRepositoryOrThrow(repositoryId)
  const tagResult = await runGitInPathResult(repository.localPath, tagArgs)
  const rescannedRepository = await rescanRepositoryRecord(repository)
  const status = await getRepositoryWorkspaceStatus(repositoryId)

  return {
    ok: tagResult.ok,
    repository: rescannedRepository,
    status,
    stdout: [commitResult.stdout, tagResult.stdout].filter(Boolean).join('\n'),
    stderr: tagResult.ok ? commitResult.stderr : tagResult.stderr || tagResult.stdout || 'Tag 创建失败'
  }
}

async function pushRepositoryChanges(repositoryId: string, input: GitPushInput, operationId?: string): Promise<GitOperationResult> {
  return withSavedSshPassphrases(async (env) => {
    const operationArgs = buildGitPushOperationArgs(input)

    if (operationArgs.length === 1) {
      return runRepositoryWriteOperation(repositoryId, operationArgs[0], { env, operationId })
    }

    const repository = getRepositoryOrThrow(repositoryId)
    const results = []

    for (const args of operationArgs) {
      if (isGitOperationCancelled(operationId)) {
        throw new Error('Git 操作已终止')
      }

      results.push(await runGitInPathResult(repository.localPath, args, { env, operationId }))
    }

    if (isGitOperationCancelled(operationId)) {
      throw new Error('Git 操作已终止')
    }

    const rescannedRepository = await rescanRepositoryRecord(repository)
    const status = await getRepositoryWorkspaceStatus(repositoryId)
    const failedResult = results.find((result) => !result.ok)

    return {
      ok: results.every((result) => result.ok),
      repository: rescannedRepository,
      status,
      stdout: results.map((result) => result.stdout).filter(Boolean).join('\n'),
      stderr: failedResult ? failedResult.stderr || failedResult.stdout || '部分远端推送失败' : results.map((result) => result.stderr).filter(Boolean).join('\n')
    }
  })
}

/**
 * Project tasks only need the result of the push itself.  The regular push
 * handler rescans the repository and builds the complete workspace status for
 * the interactive modal, which can involve many git processes and conflict
 * file reads.  Keep that work out of the background task's IPC call so a
 * native Electron/V8 failure in the rescan path cannot take down the app
 * before the task is persisted.
 */
async function pushRepositoryTaskChanges(repositoryId: string, input: GitPushInput, operationId: string): Promise<GitPushTaskResult> {
  return withSavedSshPassphrases(async (env) => {
    const repository = getRepositoryOrThrow(repositoryId)
    const operationArgs = buildGitPushOperationArgs(input)
    const results: GitCommandResult[] = []

    for (const args of operationArgs) {
      if (isGitOperationCancelled(operationId)) {
        throw new Error('Git 操作已终止')
      }

      results.push(await runGitInPathResult(repository.localPath, args, { env, operationId }))
    }

    if (isGitOperationCancelled(operationId)) {
      throw new Error('Git 操作已终止')
    }

    const failedResult = results.find((result) => !result.ok)
    return {
      ok: results.every((result) => result.ok),
      branch: input.branch,
      pushTargets: repository.pushTargets.map((target) => ({
        remote: target.remote,
        branch: target.branch,
        ahead: target.branch === input.branch && operationArgs.some((args) => args[1] === target.remote) && !failedResult ? 0 : target.ahead,
        hasRemoteBranch: target.hasRemoteBranch
      })),
      stdout: results.map((result) => result.stdout).filter(Boolean).join('\n'),
      stderr: failedResult ? failedResult.stderr || failedResult.stdout || '部分远端推送失败' : results.map((result) => result.stderr).filter(Boolean).join('\n')
    }
  })
}

function getRepositoryDeploymentApprovalConfig(repositoryId: string): DeploymentApprovalConfig | null {
  getRepositoryOrThrow(repositoryId)
  return getDeploymentApprovalConfig(getDatabase(), repositoryId)
}

function saveRepositoryDeploymentApprovalConfig(input: DeploymentApprovalConfig): DeploymentApprovalConfig {
  getRepositoryOrThrow(input.repositoryId)
  return saveDeploymentApprovalConfig(getDatabase(), input)
}

async function analyzeRepositoryDeploymentApproval(
  repositoryId: string,
  input: { manualBaselineSha?: string } = {}
): Promise<DeploymentApprovalAnalysis> {
  const repository = getRepositoryOrThrow(repositoryId)
  return withSavedSshPassphrases((env) =>
    analyzeDeploymentApproval({
      db: getDatabase(),
      repositoryId,
      localPath: repository.localPath,
      manualBaselineSha: input.manualBaselineSha,
      env
    })
  )
}

async function executeRepositoryDeploymentApproval(
  repositoryId: string,
  input: { reviewedHeadSha: string; baselineSha: string }
): Promise<DeploymentApprovalExecutionResult & { repository: RepositoryRecord }> {
  const repository = getRepositoryOrThrow(repositoryId)
  const result = await withSavedSshPassphrases((env) =>
    executeDeploymentApproval({
      db: getDatabase(),
      repositoryId,
      localPath: repository.localPath,
      reviewedHeadSha: input.reviewedHeadSha,
      baselineSha: input.baselineSha,
      tempRoot: tmpdir(),
      env
    })
  )
  return { ...result, repository: await rescanRepositoryRecord(repository) }
}

function listRepositoryDeploymentApprovals(repositoryId: string): DeploymentApprovalHistory[] {
  getRepositoryOrThrow(repositoryId)
  return listDeploymentApprovals(getDatabase(), repositoryId)
}

async function suggestRepositoryConflictResolution(repositoryId: string, filePath: string): Promise<ConflictResolutionSuggestion> {
  const repository = getRepositoryOrThrow(repositoryId)
  const content = await readFile(resolveRepositoryFilePath(repository, filePath), 'utf8')
  const settings = await readAiSettingsFile(app.getPath('userData'))

  return requestConflictResolutionSuggestion({
    settings,
    repositoryName: repository.name,
    filePath,
    conflictedContent: content
  })
}

async function suggestRepositoryCommitMessage(repositoryId: string, input: GitCommitMessageInput): Promise<CommitMessageSuggestion> {
  const repository = getRepositoryOrThrow(repositoryId)
  const settings = await readAiSettingsFile(app.getPath('userData'))
  const paths = input.paths

  if (paths.length === 0) {
    throw new Error('请选择要生成提交信息的文件')
  }

  const [status, diffSummaryResult] = await Promise.all([
    getRepositoryWorkspaceStatus(repositoryId),
    runGitInPathResult(repository.localPath, buildGitDiffStatArgs(paths))
  ])
  const selectedPaths = new Set(paths)
  const files = status.files
    .filter((file) => selectedPaths.has(file.path))
    .map((file) => ({
      path: file.path,
      status: `${file.indexStatus}${file.worktreeStatus}`.trim() || 'changed'
    }))

  if (files.length === 0) {
    throw new Error('选中文件没有可用于提交的改动')
  }

  return requestCommitMessageSuggestion({
    settings,
    repositoryName: repository.name,
    files,
    diffSummary: diffSummaryResult.stdout
  })
}

async function readRepositoryPackageJson(localPath: string): Promise<{ version: string; scripts: Record<string, string>; raw: Record<string, unknown> }> {
  const packagePath = join(localPath, 'package.json')

  if (!existsSync(packagePath)) {
    throw new Error('当前仓库没有 package.json，无法按项目脚本发布')
  }

  const raw = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>
  const scripts = raw.scripts && typeof raw.scripts === 'object' ? raw.scripts as Record<string, string> : {}

  return {
    version: String(raw.version ?? '').trim(),
    scripts,
    raw
  }
}

async function writeRepositoryPackageVersion(localPath: string, version: string): Promise<void> {
  const packagePath = join(localPath, 'package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>

  packageJson.version = version
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

function hasNextConfigFile(localPath: string): boolean {
  return ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts'].some((fileName) => existsSync(join(localPath, fileName)))
}

function detectPackageManager(localPath: string): RepositoryReleasePreparation['packageManager'] {
  if (existsSync(join(localPath, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (existsSync(join(localPath, 'yarn.lock'))) {
    return 'yarn'
  }

  return 'npm'
}

async function readRepositoryRemoteTagCommit(localPath: string, tagName: string): Promise<string> {
  return withSavedSshPassphrases(async (env) => {
    const result = await runGitInPathResult(localPath, ['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`, `refs/tags/${tagName}^{}`], { env })

    if (!result.ok) {
      return ''
    }

    const rows = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const peeled = rows.find((line) => line.endsWith(`refs/tags/${tagName}^{}`))
    const selected = peeled ?? rows.find((line) => line.endsWith(`refs/tags/${tagName}`))

    return selected?.split(/\s+/)[0] ?? ''
  })
}

async function recommendRepositoryReleaseTag(repositoryId: string): Promise<RepositoryReleaseTagRecommendation> {
  const repository = getRepositoryOrThrow(repositoryId)
  const [packageInfo, tagOutput] = await Promise.all([
    readRepositoryPackageJson(repository.localPath).catch(() => ({ version: '', scripts: {}, raw: {} })),
    runGitInPathOptional(repository.localPath, ['tag', '--list'])
  ])

  return createReleaseVersionRecommendation({
    currentVersion: packageInfo.version,
    tagNames: tagOutput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  })
}

async function readRepositoryDocumentation(localPath: string): Promise<{ context: string; sources: string[] }> {
  const chunks: string[] = []
  const sources: string[] = []
  const maxFileChars = 4000
  const maxTotalChars = 12000

  async function appendTextSource(relativePath: string): Promise<void> {
    const fullPath = join(localPath, relativePath)

    if (!existsSync(fullPath)) {
      return
    }

    try {
      const content = await readFile(fullPath, 'utf8')
      sources.push(relativePath)
      chunks.push(`## ${relativePath}\n${content.slice(0, maxFileChars)}`)
    } catch {
      // Documentation is useful context, but missing or unreadable docs should not block publishing.
    }
  }

  await appendTextSource('README.md')
  await appendTextSource('readme.md')

  const docsPath = join(localPath, 'docs')
  if (existsSync(docsPath)) {
    try {
      const entries = await readdir(docsPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue
        }

        const relativePath = join('docs', entry.name)

        if (/\.(md|txt)$/i.test(entry.name)) {
          await appendTextSource(relativePath)
        } else if (/\.pdf$/i.test(entry.name)) {
          sources.push(relativePath)
        }
      }
    } catch {
      // Ignore optional docs scan failures.
    }
  }

  return {
    context: chunks.join('\n\n').slice(0, maxTotalChars),
    sources: Array.from(new Set(sources))
  }
}

async function prepareRepositoryRelease(repositoryId: string, input: RepositoryReleasePrepareInput = {}): Promise<RepositoryReleasePreparation> {
  const repository = getRepositoryOrThrow(repositoryId)
  const packageInfo = await readRepositoryPackageJson(repository.localPath)
  const targetVersion = input.targetVersion?.trim() || packageInfo.version
  const tagName = createReleaseTagName(targetVersion)
  const [headCommit, status, localTagCommit, remoteTagCommit, docs, recentCommitsOutput] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['rev-parse', 'HEAD']),
    getRepositoryWorkspaceStatus(repositoryId),
    runGitInPathOptional(repository.localPath, ['rev-parse', '-q', '--verify', `${tagName}^{}`]),
    readRepositoryRemoteTagCommit(repository.localPath, tagName),
    readRepositoryDocumentation(repository.localPath),
    runGitInPathOptional(repository.localPath, ['log', '-n', '20', '--pretty=format:%s'])
  ])
  const plan = createReleasePlan({
    repositoryName: repository.name,
    currentVersion: packageInfo.version,
    targetVersion: input.targetVersion,
    provider: input.provider,
    headCommit,
    statusFileCount: status.files.length,
    localTagCommit,
    remoteTagCommit,
    scripts: packageInfo.scripts,
    documentationSources: docs.sources
  })

  return {
    repositoryId,
    packageManager: detectPackageManager(repository.localPath),
    localPath: repository.localPath,
    documentationContext: docs.context,
    recentCommits: recentCommitsOutput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    plan
  }
}

async function suggestRepositoryRelease(repositoryId: string, input: RepositoryReleaseSuggestionInput = {}): Promise<ReleaseSuggestion> {
  const preparation = await prepareRepositoryRelease(repositoryId, input)
  const settings = await readAiSettingsFile(app.getPath('userData'))

  return requestReleaseSuggestion({
    settings,
    repositoryName: preparation.plan.repositoryName,
    currentVersion: preparation.plan.currentVersion,
    suggestedVersion: preparation.plan.suggestedVersion,
    suggestedTagName: preparation.plan.suggestedTagName,
    recentCommits: preparation.recentCommits,
    documentationContext: preparation.documentationContext
  })
}

function getReleaseScriptCommand(packageManager: RepositoryReleasePreparation['packageManager'], scriptName: ReleaseScriptName): string {
  if (!scriptName) {
    throw new Error('没有可执行的发布脚本')
  }

  if (packageManager === 'yarn') {
    return `yarn ${scriptName}`
  }

  return `${packageManager} run ${scriptName}`
}

async function runReleaseScript(
  localPath: string,
  packageManager: RepositoryReleasePreparation['packageManager'],
  scriptName: ReleaseScriptName,
  env: NodeJS.ProcessEnv,
  callbacks: ReleasePublishCallbacks = {}
): Promise<Pick<RepositoryReleasePublishResult, 'ok' | 'stdout' | 'stderr' | 'exitCode'>> {
  const command = getReleaseScriptCommand(packageManager, scriptName)
  const scriptEnv = await createScriptExecutionEnv(env)
  const maxOutputLength = 1024 * 1024
  let stdout = ''
  let stderr = ''

  function appendOutput(current: string, chunk: Buffer): string {
    const next = current + chunk.toString()
    return next.length > maxOutputLength ? next.slice(next.length - maxOutputLength) : next
  }

  return new Promise((resolveResult) => {
    const child = spawn('/bin/zsh', ['-lc', command], {
      cwd: localPath,
      env: scriptEnv,
      detached: true
    })
    callbacks.onProcess?.(child)

    child.stdout.on('data', (chunk: Buffer) => {
      callbacks.onOutput?.('stdout', chunk.toString())
      stdout = appendOutput(stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      callbacks.onOutput?.('stderr', chunk.toString())
      stderr = appendOutput(stderr, chunk)
    })
    child.on('error', (error) => {
      callbacks.onOutput?.('stderr', error.message)
      stderr = appendOutput(stderr, Buffer.from(error.message))
      resolveResult({ ok: false, stdout, stderr, exitCode: null })
    })
    child.on('exit', (exitCode) => {
      resolveResult({ ok: exitCode === 0, stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode })
    })
  })
}

async function runReleaseProcess(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
  callbacks: ReleasePublishCallbacks = {}
): Promise<Pick<RepositoryReleasePublishResult, 'ok' | 'stdout' | 'stderr' | 'exitCode'>> {
  const processEnv = await createScriptExecutionEnv(options.env ?? {})
  const maxOutputLength = 1024 * 1024
  let stdout = ''
  let stderr = ''

  function appendOutput(current: string, chunk: Buffer | string): string {
    const text = typeof chunk === 'string' ? chunk : chunk.toString()
    const next = current + text
    return next.length > maxOutputLength ? next.slice(next.length - maxOutputLength) : next
  }

  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: processEnv,
      detached: true
    })
    callbacks.onProcess?.(child)

    child.stdout.on('data', (chunk: Buffer) => {
      callbacks.onOutput?.('stdout', chunk.toString())
      stdout = appendOutput(stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      callbacks.onOutput?.('stderr', chunk.toString())
      stderr = appendOutput(stderr, chunk)
    })
    child.on('error', (error) => {
      callbacks.onOutput?.('stderr', error.message)
      stderr = appendOutput(stderr, error.message)
      resolveResult({ ok: false, stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode: null })
    })
    child.on('exit', (exitCode) => {
      resolveResult({ ok: exitCode === 0, stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode })
    })
  })
}

function throwIfReleaseProcessFailed(
  result: Pick<RepositoryReleasePublishResult, 'ok' | 'stdout' | 'stderr' | 'exitCode'>,
  fallback: string
): void {
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || fallback)
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function copyIfExists(source: string, destination: string): Promise<boolean> {
  if (!(await pathExists(source))) {
    return false
  }

  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
  return true
}

async function copyDirectoryContents(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    await cp(join(source, entry.name), join(destination, entry.name), { recursive: true, force: true })
  }
}

async function copyNextjsConfigFiles(localPath: string, stagingPath: string): Promise<void> {
  const entries = await readdir(localPath, { withFileTypes: true })
  const fileNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) =>
      fileName === 'package.json' ||
      fileName === 'package-lock.json' ||
      fileName === 'pnpm-lock.yaml' ||
      fileName === 'yarn.lock' ||
      /^next\.config\.(js|mjs|cjs|ts)$/.test(fileName)
    )

  for (const fileName of fileNames) {
    await copyIfExists(join(localPath, fileName), join(stagingPath, fileName))
  }
}

async function createNextjsReleasePackage(
  localPath: string,
  repositoryName: string,
  version: string,
  callbacks: ReleasePublishCallbacks = {}
): Promise<{ artifactName: string; artifactPath: string; releaseName: string; sizeInBytes: number; standalone: boolean }> {
  const artifactName = createNextjsPm2ArtifactName(repositoryName, version)
  const releaseName = artifactName.replace(/\.tar\.gz$/, '')
  const workPath = await mkdtemp(join(tmpdir(), 'forgedesk-nextjs-release-'))
  const stagingPath = join(workPath, 'package')
  const artifactPath = join(workPath, artifactName)
  const standalonePath = join(localPath, '.next', 'standalone')
  const standalone = await pathExists(standalonePath)

  try {
    await mkdir(stagingPath, { recursive: true })

    if (standalone) {
      callbacks.onLog?.('检测到 .next/standalone，将按 standalone 模式打包')
      await copyDirectoryContents(standalonePath, stagingPath)
      await copyIfExists(join(localPath, '.next', 'static'), join(stagingPath, '.next', 'static'))
      await copyIfExists(join(localPath, 'public'), join(stagingPath, 'public'))
    } else {
      callbacks.onLog?.('未检测到 .next/standalone，将打包 .next 并在远端安装生产依赖')
      await copyNextjsConfigFiles(localPath, stagingPath)
      await copyIfExists(join(localPath, '.next'), join(stagingPath, '.next'))
      await rm(join(stagingPath, '.next', 'cache'), { recursive: true, force: true })
      await copyIfExists(join(localPath, 'public'), join(stagingPath, 'public'))
    }

    if (!(await pathExists(join(stagingPath, '.next'))) && !(await pathExists(join(stagingPath, 'server.js')))) {
      throw new Error('没有找到可部署的 Next.js 构建产物，请确认 build 已生成 .next 或 .next/standalone')
    }

    const tarResult = await runReleaseProcess('tar', ['-czf', artifactPath, '-C', stagingPath, '.'], {}, callbacks)
    throwIfReleaseProcessFailed(tarResult, '创建 Next.js 发布包失败')

    const artifactStats = await stat(artifactPath)
    callbacks.onLog?.(`发布包已生成：${artifactName}`)

    return {
      artifactName,
      artifactPath,
      releaseName,
      sizeInBytes: artifactStats.size,
      standalone
    }
  } catch (error) {
    await rm(workPath, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

function parseGithubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  const trimmed = remoteUrl.trim()
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  const match = sshMatch ?? httpsMatch

  if (!match) {
    return null
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  }
}

async function resolveGithubReleaseToken(input: RepositoryReleasePublishInput): Promise<string> {
  const tokenId = input.githubTokenId?.trim()

  if (tokenId) {
    return getGithubTokenSecret(app.getPath('userData'), tokenId)
  }

  return input.githubToken?.trim() || ''
}

function getReleaseProvider(input: RepositoryReleasePublishInput): ReleasePublishProvider {
  if (input.provider === 'codemagic' || input.provider === 'firebase' || input.provider === 'nextjs-pm2') {
    return input.provider
  }

  return 'github'
}

function normalizeReleaseLabels(labels: string[] | undefined): string[] {
  return Array.from(new Set((labels ?? []).map((label) => label.trim()).filter(Boolean)))
}

function createCodemagicBuildUrl(appId: string, buildId: string): string {
  return appId && buildId ? `https://codemagic.io/app/${encodeURIComponent(appId)}/build/${encodeURIComponent(buildId)}` : ''
}

function mapCodemagicArtifactForRelease(artifact: CodemagicArtifact): ReleasePublishArtifact {
  return {
    name: artifact.name,
    type: artifact.type,
    sizeInBytes: artifact.sizeInBytes,
    downloadUrl: artifact.downloadUrl,
    versionCode: artifact.versionCode || undefined,
    versionName: artifact.versionName || undefined
  }
}

type ResolvedCodemagicReleaseConfig = {
  token: string
  tokenId: string
  teamId: string
  appId: string
  appName: string
  workflowId: string
  workflowName: string
  defaultBranch: string
  labels: string[]
}

async function resolveCodemagicReleaseConfig(repository: RepositoryRecord, input: RepositoryReleasePublishInput): Promise<ResolvedCodemagicReleaseConfig> {
  const existingBinding = getCodemagicRepositoryBindingRecord(getDatabase(), repository.id)
  const tokenId = (input.codemagicTokenId || existingBinding?.tokenId || '').trim()
  const appId = (input.codemagicAppId || existingBinding?.appId || '').trim()
  const workflowId = (input.codemagicWorkflowId || existingBinding?.workflowId || '').trim()
  const teamId = (input.codemagicTeamId ?? existingBinding?.teamId ?? '').trim()
  const appName = (input.codemagicAppName ?? existingBinding?.appName ?? '').trim()
  const workflowName = (input.codemagicWorkflowName ?? existingBinding?.workflowName ?? '').trim()
  const defaultBranch = (input.codemagicDefaultBranch ?? existingBinding?.defaultBranch ?? repository.currentBranch ?? repository.defaultBranch ?? '').trim()
  const labels = normalizeReleaseLabels(input.codemagicLabels?.length ? input.codemagicLabels : existingBinding?.labels)

  if (!tokenId) {
    throw new Error('请先选择 Codemagic Token')
  }

  if (!appId) {
    throw new Error('请先绑定 Codemagic App ID')
  }

  if (!workflowId) {
    throw new Error('请先绑定 Codemagic Workflow ID')
  }

  if (input.saveCodemagicBinding) {
    saveCodemagicRepositoryBindingRecord(getDatabase(), {
      repositoryId: repository.id,
      tokenId,
      teamId,
      appId,
      appName,
      workflowId,
      workflowName,
      defaultBranch,
      labels
    })
  }

  return {
    token: await getCodemagicTokenSecret(app.getPath('userData'), tokenId),
    tokenId,
    teamId,
    appId,
    appName,
    workflowId,
    workflowName,
    defaultBranch,
    labels
  }
}

async function updateGithubReleaseDetails(repository: RepositoryRecord, input: RepositoryReleasePublishInput, token: string): Promise<string> {
  const githubRepository = parseGithubRemote(repository.remoteUrl || repository.remotes.find((remote) => remote.name === 'origin')?.fetchUrl || '')

  if (!token || !githubRepository) {
    return ''
  }

  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28'
  }
  const tagName = input.tagName.trim()
  const releaseResponse = await fetch(`https://api.github.com/repos/${githubRepository.owner}/${githubRepository.repo}/releases/tags/${encodeURIComponent(tagName)}`, { headers })

  if (!releaseResponse.ok) {
    return `GitHub Release ${tagName} 暂未更新说明：HTTP ${releaseResponse.status}`
  }

  const release = await releaseResponse.json() as { id?: number }

  if (!release.id) {
    return `GitHub Release ${tagName} 暂未更新说明：无法读取 Release ID`
  }

  const patchResponse = await fetch(`https://api.github.com/repos/${githubRepository.owner}/${githubRepository.repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: input.releaseTitle.trim() || tagName,
      body: input.releaseNotes.trim() || `发布 ${tagName}`
    })
  })

  if (!patchResponse.ok) {
    return `GitHub Release ${tagName} 暂未更新说明：HTTP ${patchResponse.status}`
  }

  return `GitHub Release ${tagName} 标题和说明已更新`
}

function getUnresolvedReleaseIssues(plan: ReleasePlan, releaseActions: ReleasePublishActionKey[] = []): string[] {
  const selectedActionSet = new Set(releaseActions)
  const selectedIssueSet = new Set(plan.availableActions.filter((action) => selectedActionSet.has(action.key)).map((action) => action.issue))
  return plan.issues.filter((issue) => !selectedIssueSet.has(issue))
}

function throwIfReleaseCancelled(callbacks: ReleasePublishCallbacks): void {
  if (callbacks.shouldCancel?.()) {
    throw new Error('发布任务已终止')
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

function isCodemagicBuildActive(status: string): boolean {
  return ['initializing', 'queued', 'preparing', 'fetching', 'testing', 'building', 'publishing', 'finishing'].includes(status.trim().toLowerCase())
}

function isCodemagicBuildSuccessful(status: string): boolean {
  return status.trim().toLowerCase() === 'finished'
}

function getReleaseProviderLabel(provider: ReleasePublishProvider): string {
  if (provider === 'codemagic') {
    return 'Codemagic'
  }

  if (provider === 'firebase') {
    return 'Firebase App Distribution'
  }

  if (provider === 'nextjs-pm2') {
    return 'Next.js PM2'
  }

  return 'GitHub Releases'
}

async function publishRepositoryCodemagicRelease(
  repositoryId: string,
  input: RepositoryReleasePublishInput,
  callbacks: ReleasePublishCallbacks = {}
): Promise<RepositoryReleasePublishResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const version = input.version.trim()
  const tagName = input.tagName.trim()
  const expectedTagName = createReleaseTagName(version)
  const releaseActions = input.releaseActions ?? []
  const selectedActionSet = new Set(releaseActions)
  const phaseTotal = 7

  callbacks.onPhase?.('准备 Codemagic 发布参数', 1, phaseTotal)
  callbacks.onLog?.(`准备 Codemagic 构建 ${repository.name} ${tagName}`)
  throwIfReleaseCancelled(callbacks)
  const codemagic = await resolveCodemagicReleaseConfig(repository, input)

  if (tagName !== expectedTagName) {
    throw new Error(`Tag 应为 ${expectedTagName}`)
  }

  callbacks.onPhase?.('检查发布计划', 2, phaseTotal)
  callbacks.onLog?.('检查 Codemagic 发布计划')
  throwIfReleaseCancelled(callbacks)
  const initialPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version, provider: 'codemagic' })
  const initialIssues = getUnresolvedReleaseIssues(initialPreparation.plan, releaseActions)

  if (!initialPreparation.plan.canPublish && initialIssues.length > 0) {
    throw new Error(initialIssues.join('\n') || '发布前检查未通过')
  }

  const shouldCommitWorkspaceChanges = selectedActionSet.has('commit-workspace-changes')
  const shouldReplaceLocalTag = selectedActionSet.has('replace-local-tag')

  callbacks.onPhase?.('写入版本并创建提交', 3, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.(`写入 package.json 版本：${initialPreparation.plan.currentVersion} -> ${version}`)
    await writeRepositoryPackageVersion(repository.localPath, version)
  }

  if (shouldCommitWorkspaceChanges) {
    callbacks.onLog?.('暂存当前工作区全部改动')
    await runGitInPathStrict(repository.localPath, ['add', '--all'])
  } else if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.('暂存 package.json 版本改动')
    await runGitInPathStrict(repository.localPath, ['add', 'package.json'])
  }

  if (initialPreparation.plan.currentVersion !== version || shouldCommitWorkspaceChanges) {
    callbacks.onLog?.(`创建版本提交：${input.commitMessage.trim() || `chore: release ${tagName}`}`)
    await runGitInPathStrict(repository.localPath, ['commit', '-m', input.commitMessage.trim() || `chore: release ${tagName}`])
  } else {
    callbacks.onLog?.('版本提交已是最新，跳过提交')
  }

  callbacks.onPhase?.('处理版本 Tag', 4, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (shouldReplaceLocalTag) {
    callbacks.onLog?.(`删除本地旧 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', '-d', tagName])
  }

  const finalPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version, provider: 'codemagic' })
  const finalIssues = getUnresolvedReleaseIssues(finalPreparation.plan, releaseActions)

  if (!finalPreparation.plan.canPublish && finalIssues.length > 0) {
    throw new Error(finalIssues.join('\n') || '版本提交后发布前检查未通过')
  }

  const localTagCommit = await runGitInPathOptional(repository.localPath, ['rev-parse', '-q', '--verify', `${tagName}^{}`])

  if (!localTagCommit) {
    callbacks.onLog?.(`创建本地 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', tagName])
  } else {
    callbacks.onLog?.(`本地 Tag ${tagName} 已在当前提交上`)
  }

  callbacks.onPhase?.('推送分支和 Tag', 5, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  const branch = await runGitInPath(repository.localPath, ['branch', '--show-current'])

  await withSavedSshPassphrases(async (env) => {
    if (branch) {
      callbacks.onLog?.(`推送当前分支到 origin/${branch}`)
      await runGitInPathStrict(repository.localPath, ['push', 'origin', branch], { env })
    } else {
      callbacks.onLog?.('当前不在命名分支上，跳过分支推送')
    }

    callbacks.onLog?.(`推送 Tag 到 origin/${tagName}`)
    await runGitInPathStrict(repository.localPath, ['push', 'origin', tagName], { env })
  })

  callbacks.onPhase?.('启动 Codemagic 构建', 6, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  callbacks.onLog?.(`启动 Codemagic workflow：${codemagic.workflowName || codemagic.workflowId}`)
  const started = await startCodemagicBuild(codemagic.token, {
    appId: codemagic.appId,
    workflowId: codemagic.workflowId,
    tag: tagName,
    labels: ['forgedesk', repository.name, ...codemagic.labels]
  })
  const externalBuildUrl = createCodemagicBuildUrl(codemagic.appId, started.buildId)
  callbacks.onLog?.(`Codemagic Build ID：${started.buildId}`)
  callbacks.onExternalCancel?.(() => cancelCodemagicBuild(codemagic.token, started.buildId))

  callbacks.onPhase?.('等待 Codemagic 构建完成', 7, phaseTotal)
  let latestBuild: CodemagicBuild | null = null
  let lastStatus = ''

  while (true) {
    throwIfReleaseCancelled(callbacks)
    latestBuild = await getCodemagicBuild(codemagic.token, started.buildId)
    callbacks.onCodemagicBuild?.(latestBuild, externalBuildUrl)

    if (latestBuild.status !== lastStatus) {
      callbacks.onLog?.(`Codemagic 状态：${latestBuild.status}`)
      lastStatus = latestBuild.status
    }

    if (!isCodemagicBuildActive(latestBuild.status)) {
      break
    }

    await delay(5000)
  }

  const ok = isCodemagicBuildSuccessful(latestBuild.status)
  const artifacts = latestBuild.artifacts.map(mapCodemagicArtifactForRelease)
  const artifactSummary = artifacts.length
    ? artifacts.map((artifact) => `${artifact.name}${artifact.versionName ? ` (${artifact.versionName})` : ''}`).join('\n')
    : ''

  callbacks.onLog?.(ok ? 'Codemagic 构建完成' : `Codemagic 构建未成功完成：${latestBuild.status}`)

  return {
    ok,
    provider: 'codemagic',
    repository: await rescanRepositoryRecord(repository),
    plan: finalPreparation.plan,
    stdout: artifactSummary,
    stderr: ok ? '' : `Codemagic build ${latestBuild.status}`,
    exitCode: ok ? 0 : 1,
    externalBuildId: latestBuild.id || started.buildId,
    externalBuildUrl,
    externalStatus: latestBuild.status,
    externalWorkflow: latestBuild.workflowName || codemagic.workflowName || codemagic.workflowId,
    externalBranch: latestBuild.branch || branch || codemagic.defaultBranch,
    externalTag: latestBuild.tag || tagName,
    artifacts
  }
}

async function publishRepositoryFirebaseRelease(
  repositoryId: string,
  input: RepositoryReleasePublishInput,
  callbacks: ReleasePublishCallbacks = {}
): Promise<RepositoryReleasePublishResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const settings = resolveProjectFirebaseReleaseSettings(getDatabase(), repository.projectId)
  const version = input.version.trim()
  const tagName = input.tagName.trim()
  const expectedTagName = createReleaseTagName(version)
  const releaseActions = input.releaseActions ?? []
  const selectedActionSet = new Set(releaseActions)
  const phaseTotal = 7
  const buildScript = settings.buildScript.trim()
  const supportedBuildScripts = new Set<ReleaseScriptName>(['package:android', 'build:android', 'build'])

  callbacks.onPhase?.('准备 Firebase 发布参数', 1, phaseTotal)
  callbacks.onLog?.(`准备 Firebase App Distribution：${repository.name} ${tagName}`)
  throwIfReleaseCancelled(callbacks)

  if (tagName !== expectedTagName) {
    throw new Error(`Tag 应为 ${expectedTagName}`)
  }

  if (buildScript && !supportedBuildScripts.has(buildScript as ReleaseScriptName)) {
    throw new Error('Firebase 构建脚本只支持 package:android、build:android 或 build')
  }

  callbacks.onPhase?.('检查发布计划', 2, phaseTotal)
  callbacks.onLog?.('检查 Firebase 发布计划')
  throwIfReleaseCancelled(callbacks)
  const initialPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version, provider: 'firebase' })
  const initialIssues = getUnresolvedReleaseIssues(initialPreparation.plan, releaseActions)

  if (!initialPreparation.plan.canPublish && initialIssues.length > 0) {
    throw new Error(initialIssues.join('\n') || '发布前检查未通过')
  }

  const shouldCommitWorkspaceChanges = selectedActionSet.has('commit-workspace-changes')
  const shouldReplaceLocalTag = selectedActionSet.has('replace-local-tag')

  callbacks.onPhase?.('写入版本并创建提交', 3, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.(`写入 package.json 版本：${initialPreparation.plan.currentVersion} -> ${version}`)
    await writeRepositoryPackageVersion(repository.localPath, version)
  }

  if (shouldCommitWorkspaceChanges) {
    callbacks.onLog?.('暂存当前工作区全部改动')
    await runGitInPathStrict(repository.localPath, ['add', '--all'])
  } else if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.('暂存 package.json 版本改动')
    await runGitInPathStrict(repository.localPath, ['add', 'package.json'])
  }

  if (initialPreparation.plan.currentVersion !== version || shouldCommitWorkspaceChanges) {
    callbacks.onLog?.(`创建版本提交：${input.commitMessage.trim() || `chore: release ${tagName}`}`)
    await runGitInPathStrict(repository.localPath, ['commit', '-m', input.commitMessage.trim() || `chore: release ${tagName}`])
  } else {
    callbacks.onLog?.('版本提交已是最新，跳过提交')
  }

  callbacks.onPhase?.('处理版本 Tag 并推送', 4, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (shouldReplaceLocalTag) {
    callbacks.onLog?.(`删除本地旧 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', '-d', tagName])
  }

  const finalPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version, provider: 'firebase' })
  const finalIssues = getUnresolvedReleaseIssues(finalPreparation.plan, releaseActions)

  if (!finalPreparation.plan.canPublish && finalIssues.length > 0) {
    throw new Error(finalIssues.join('\n') || '版本提交后发布前检查未通过')
  }

  const localTagCommit = await runGitInPathOptional(repository.localPath, ['rev-parse', '-q', '--verify', `${tagName}^{}`])

  if (!localTagCommit) {
    callbacks.onLog?.(`创建本地 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', tagName])
  } else {
    callbacks.onLog?.(`本地 Tag ${tagName} 已在当前提交上`)
  }

  const branch = await runGitInPath(repository.localPath, ['branch', '--show-current'])

  await withSavedSshPassphrases(async (env) => {
    if (branch) {
      callbacks.onLog?.(`推送当前分支到 origin/${branch}`)
      await runGitInPathStrict(repository.localPath, ['push', 'origin', branch], { env })
    }

    callbacks.onLog?.(`推送 Tag 到 origin/${tagName}`)
    await runGitInPathStrict(repository.localPath, ['push', 'origin', tagName], { env })
  })

  callbacks.onPhase?.('构建应用产物', 5, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  let buildOutput = ''
  let buildError = ''

  if (buildScript) {
    callbacks.onLog?.(`执行 Firebase 构建脚本：${getReleaseScriptCommand(initialPreparation.packageManager, buildScript as ReleaseScriptName)}`)
    const buildResult = await runReleaseScript(repository.localPath, initialPreparation.packageManager, buildScript as ReleaseScriptName, {}, callbacks)
    throwIfReleaseProcessFailed(buildResult, 'Firebase 应用构建失败')
    buildOutput = buildResult.stdout
    buildError = buildResult.stderr
  } else {
    callbacks.onLog?.('项目设置未配置构建脚本，直接使用已有产物')
  }

  const artifactPathInput = expandHomePath(settings.artifactPath)
  const project = getProjectOrThrow(repository.projectId)
  const artifactCandidates = isAbsolute(artifactPathInput)
    ? [artifactPathInput]
    : [resolve(repository.localPath, artifactPathInput), resolve(project.workspacePath, artifactPathInput)]
  let artifactPath = artifactCandidates[0]
  let artifactStats = await stat(artifactPath).catch(() => null)

  if (!artifactStats?.isFile() && artifactCandidates[1]) {
    artifactPath = artifactCandidates[1]
    artifactStats = await stat(artifactPath).catch(() => null)
  }

  if (!artifactStats?.isFile()) {
    throw new Error(`找不到 Firebase 构建产物：${settings.artifactPath}`)
  }

  callbacks.onPhase?.('上传到 Firebase App Distribution', 6, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  const keyDirectory = await mkdtemp(join(tmpdir(), 'forgedesk-firebase-'))
  const keyPath = join(keyDirectory, 'service-account.json')

  try {
    await writeFile(keyPath, settings.serviceAccountKey, { encoding: 'utf8', mode: 0o600 })
    const firebaseArgs = [
      'appdistribution:distribute',
      artifactPath,
      '--app',
      settings.appId,
      '--project',
      settings.serviceAccountProjectId,
      '--release-notes',
      input.releaseNotes.trim() || `发布 ${tagName}`
    ]

    if (settings.groups.length > 0) {
      firebaseArgs.push('--groups', settings.groups.join(','))
    }

    if (settings.testers.length > 0) {
      firebaseArgs.push('--testers', settings.testers.join(','))
    }

    callbacks.onLog?.(`上传构建产物：${settings.artifactPath}`)
    const uploadResult = await runReleaseProcess('firebase', firebaseArgs, {
      cwd: repository.localPath,
      env: { GOOGLE_APPLICATION_CREDENTIALS: keyPath }
    }, callbacks)
    throwIfReleaseProcessFailed(uploadResult, '上传到 Firebase App Distribution 失败')
    callbacks.onLog?.('Firebase App Distribution 上传完成')

    return {
      ok: true,
      provider: 'firebase',
      repository: await rescanRepositoryRecord(repository),
      plan: finalPreparation.plan,
      stdout: [buildOutput, uploadResult.stdout].filter(Boolean).join('\n'),
      stderr: [buildError, uploadResult.stderr].filter(Boolean).join('\n'),
      exitCode: 0,
      externalStatus: 'distributed',
      externalWorkflow: settings.appId,
      externalBranch: branch,
      externalTag: tagName,
      artifacts: [{
        name: basename(artifactPath),
        type: artifactPath.toLowerCase().endsWith('.ipa') ? 'ipa' : artifactPath.toLowerCase().endsWith('.aab') ? 'aab' : 'apk',
        sizeInBytes: artifactStats.size,
        downloadUrl: `file://${artifactPath}`,
        versionName: version
      }]
    }
  } finally {
    await rm(keyDirectory, { recursive: true, force: true }).catch(() => undefined)
  }
}

function resolveNextjsPm2DeployConfig(repository: RepositoryRecord, input: RepositoryReleasePublishInput): NextjsPm2DeployConfig {
  const configInput: NextjsPm2DeployConfigInput = {
    sshHost: input.nextjsPm2SshHost,
    remotePath: input.nextjsPm2RemotePath,
    uploadPath: input.nextjsPm2UploadPath,
    appName: input.nextjsPm2AppName,
    port: input.nextjsPm2Port,
    startCommand: input.nextjsPm2StartCommand,
    installCommand: input.nextjsPm2InstallCommand
  }

  return normalizeNextjsPm2DeployConfig(configInput, repository.name)
}

async function runNextjsPm2SshCommand(
  config: NextjsPm2DeployConfig,
  script: string,
  callbacks: ReleasePublishCallbacks = {}
): Promise<Pick<RepositoryReleasePublishResult, 'ok' | 'stdout' | 'stderr' | 'exitCode'>> {
  return withSavedSshPassphrases((env) => runReleaseProcess('ssh', [config.sshHost, script], { env }, callbacks))
}

async function uploadNextjsPm2Artifact(
  config: NextjsPm2DeployConfig,
  artifactPath: string,
  artifactName: string,
  callbacks: ReleasePublishCallbacks = {}
): Promise<Pick<RepositoryReleasePublishResult, 'ok' | 'stdout' | 'stderr' | 'exitCode'>> {
  return withSavedSshPassphrases((env) =>
    runReleaseProcess('scp', [artifactPath, `${config.sshHost}:${config.uploadPath}/${artifactName}`], { env }, callbacks)
  )
}

async function publishRepositoryNextjsPm2Release(
  repositoryId: string,
  input: RepositoryReleasePublishInput,
  callbacks: ReleasePublishCallbacks = {}
): Promise<RepositoryReleasePublishResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const version = input.version.trim()
  const tagName = input.tagName.trim()
  const expectedTagName = createReleaseTagName(version)
  const releaseActions = input.releaseActions ?? []
  const selectedActionSet = new Set(releaseActions)
  const phaseTotal = 9

  callbacks.onPhase?.('准备 Next.js PM2 发布参数', 1, phaseTotal)
  callbacks.onLog?.(`准备部署 ${repository.name} ${tagName}`)
  throwIfReleaseCancelled(callbacks)
  const config = resolveNextjsPm2DeployConfig(repository, input)
  const packageInfo = await readRepositoryPackageJson(repository.localPath)

  if (tagName !== expectedTagName) {
    throw new Error(`Tag 应为 ${expectedTagName}`)
  }

  if (!isNextjsProject(packageInfo, hasNextConfigFile(repository.localPath))) {
    throw new Error('当前仓库未检测到 Next.js 依赖、配置或 next build 脚本')
  }

  callbacks.onPhase?.('检查发布计划', 2, phaseTotal)
  callbacks.onLog?.('检查 Next.js PM2 发布计划')
  throwIfReleaseCancelled(callbacks)
  const initialPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version, provider: 'nextjs-pm2' })
  const initialIssues = getUnresolvedReleaseIssues(initialPreparation.plan, releaseActions)

  if (!initialPreparation.plan.canPublish && initialIssues.length > 0) {
    throw new Error(initialIssues.join('\n') || '发布前检查未通过')
  }

  const shouldCommitWorkspaceChanges = selectedActionSet.has('commit-workspace-changes')
  const shouldReplaceLocalTag = selectedActionSet.has('replace-local-tag')

  callbacks.onPhase?.('写入版本并暂存改动', 3, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.(`写入 package.json 版本：${initialPreparation.plan.currentVersion} -> ${version}`)
    await writeRepositoryPackageVersion(repository.localPath, version)
  }

  if (shouldCommitWorkspaceChanges) {
    callbacks.onLog?.('暂存当前工作区全部改动')
    await runGitInPathStrict(repository.localPath, ['add', '--all'])
  } else if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.('暂存 package.json 版本改动')
    await runGitInPathStrict(repository.localPath, ['add', 'package.json'])
  }

  callbacks.onPhase?.('创建版本提交', 4, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (initialPreparation.plan.currentVersion !== version || shouldCommitWorkspaceChanges) {
    callbacks.onLog?.(`创建版本提交：${input.commitMessage.trim() || `chore: release ${tagName}`}`)
    await runGitInPathStrict(repository.localPath, ['commit', '-m', input.commitMessage.trim() || `chore: release ${tagName}`])
  } else {
    callbacks.onLog?.('版本提交已是最新，跳过提交')
  }

  callbacks.onPhase?.('处理本地 Tag', 5, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (shouldReplaceLocalTag) {
    callbacks.onLog?.(`删除本地旧 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', '-d', tagName])
  }

  const finalPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version, provider: 'nextjs-pm2' })
  const finalIssues = getUnresolvedReleaseIssues(finalPreparation.plan, releaseActions)

  if (!finalPreparation.plan.canPublish && finalIssues.length > 0) {
    throw new Error(finalIssues.join('\n') || '版本提交后发布前检查未通过')
  }

  const localTagCommit = await runGitInPathOptional(repository.localPath, ['rev-parse', '-q', '--verify', `${tagName}^{}`])

  if (!localTagCommit) {
    callbacks.onLog?.(`创建本地 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', tagName])
  } else {
    callbacks.onLog?.(`本地 Tag ${tagName} 已存在`)
  }

  callbacks.onPhase?.('本地构建 Next.js', 6, phaseTotal)
  callbacks.onLog?.(`执行构建脚本：${getReleaseScriptCommand(finalPreparation.packageManager, finalPreparation.plan.selectedScript)}`)
  throwIfReleaseCancelled(callbacks)
  const buildResult = await runReleaseScript(repository.localPath, finalPreparation.packageManager, finalPreparation.plan.selectedScript, process.env, callbacks)
  throwIfReleaseProcessFailed(buildResult, 'Next.js 构建失败')

  callbacks.onPhase?.('打包版本产物', 7, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  const packageResult = await createNextjsReleasePackage(repository.localPath, repository.name, version, callbacks)

  callbacks.onPhase?.('上传到服务器', 8, phaseTotal)
  callbacks.onLog?.(`准备远端目录：${config.sshHost}:${config.remotePath}`)
  throwIfReleaseCancelled(callbacks)
  const prepareRemoteResult = await runNextjsPm2SshCommand(config, createNextjsPm2RemotePrepareScript(config), callbacks)
  throwIfReleaseProcessFailed(prepareRemoteResult, '准备远端目录失败')

  callbacks.onLog?.(`上传发布包：${packageResult.artifactName}`)
  const uploadResult = await uploadNextjsPm2Artifact(config, packageResult.artifactPath, packageResult.artifactName, callbacks)
  throwIfReleaseProcessFailed(uploadResult, '上传 Next.js 发布包失败')

  callbacks.onPhase?.('远端 PM2 启动', 9, phaseTotal)
  throwIfReleaseCancelled(callbacks)
  const deployScript = createNextjsPm2RemoteDeployScript({
    config,
    packageManager: finalPreparation.packageManager,
    archiveName: packageResult.artifactName,
    releaseName: packageResult.releaseName,
    standalone: packageResult.standalone
  })
  const deployResult = await runNextjsPm2SshCommand(config, deployScript, callbacks)
  throwIfReleaseProcessFailed(deployResult, '远端 PM2 部署失败')

  const branch = await runGitInPath(repository.localPath, ['branch', '--show-current'])
  const stdout = [
    buildResult.stdout,
    `发布包：${packageResult.artifactName}`,
    `远端目录：${config.remotePath}/current`,
    `PM2 应用：${config.appName}`,
    deployResult.stdout
  ].filter(Boolean).join('\n')

  callbacks.onLog?.(`Next.js PM2 部署完成：${config.appName}`)

  return {
    ok: true,
    provider: 'nextjs-pm2',
    repository: await rescanRepositoryRecord(repository),
    plan: finalPreparation.plan,
    stdout,
    stderr: [buildResult.stderr, deployResult.stderr].filter(Boolean).join('\n'),
    exitCode: 0,
    externalStatus: 'deployed',
    externalWorkflow: config.appName,
    externalBranch: branch,
    externalTag: tagName,
    artifacts: [
      {
        name: packageResult.artifactName,
        type: packageResult.standalone ? 'nextjs-standalone-tar.gz' : 'nextjs-tar.gz',
        sizeInBytes: packageResult.sizeInBytes,
        downloadUrl: `file://${packageResult.artifactPath}`,
        versionName: version
      }
    ]
  }
}

async function publishRepositoryRelease(
  repositoryId: string,
  input: RepositoryReleasePublishInput,
  callbacks: ReleasePublishCallbacks = {}
): Promise<RepositoryReleasePublishResult> {
  if (getReleaseProvider(input) === 'codemagic') {
    return publishRepositoryCodemagicRelease(repositoryId, input, callbacks)
  }

  if (getReleaseProvider(input) === 'firebase') {
    return publishRepositoryFirebaseRelease(repositoryId, input, callbacks)
  }

  if (getReleaseProvider(input) === 'nextjs-pm2') {
    return publishRepositoryNextjsPm2Release(repositoryId, input, callbacks)
  }

  const repository = getRepositoryOrThrow(repositoryId)
  const version = input.version.trim()
  const tagName = input.tagName.trim()
  const expectedTagName = createReleaseTagName(version)
  const releaseActions = input.releaseActions ?? []
  const selectedActionSet = new Set(releaseActions)
  callbacks.onPhase?.('准备发布参数', 1, releasePublishPhaseTotal)
  callbacks.onLog?.(`准备发布 ${repository.name} ${tagName}`)
  throwIfReleaseCancelled(callbacks)
  const githubToken = await resolveGithubReleaseToken(input)

  if (tagName !== expectedTagName) {
    throw new Error(`Tag 应为 ${expectedTagName}`)
  }

  callbacks.onPhase?.('检查发布计划', 2, releasePublishPhaseTotal)
  callbacks.onLog?.('检查发布计划')
  throwIfReleaseCancelled(callbacks)
  const initialPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version })
  const initialIssues = getUnresolvedReleaseIssues(initialPreparation.plan, releaseActions)

  if (!initialPreparation.plan.canPublish && initialIssues.length > 0) {
    throw new Error(initialIssues.join('\n') || '发布前检查未通过')
  }

  if (initialPreparation.plan.selectedScript === 'publish:mac' && !githubToken) {
    throw new Error('发布到 GitHub Releases 需要选择或填写 GitHub Token')
  }

  const shouldCommitWorkspaceChanges = selectedActionSet.has('commit-workspace-changes')
  const shouldReplaceLocalTag = selectedActionSet.has('replace-local-tag')

  callbacks.onPhase?.('写入版本并暂存改动', 3, releasePublishPhaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.(`写入 package.json 版本：${initialPreparation.plan.currentVersion} -> ${version}`)
    await writeRepositoryPackageVersion(repository.localPath, version)
  }

  if (shouldCommitWorkspaceChanges) {
    callbacks.onLog?.('暂存当前工作区全部改动')
    await runGitInPathStrict(repository.localPath, ['add', '--all'])
  } else if (initialPreparation.plan.currentVersion !== version) {
    callbacks.onLog?.('暂存 package.json 版本改动')
    await runGitInPathStrict(repository.localPath, ['add', 'package.json'])
  }

  callbacks.onPhase?.('创建版本提交', 4, releasePublishPhaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (initialPreparation.plan.currentVersion !== version || shouldCommitWorkspaceChanges) {
    callbacks.onLog?.(`创建版本提交：${input.commitMessage.trim() || `chore: release ${tagName}`}`)
    await runGitInPathStrict(repository.localPath, ['commit', '-m', input.commitMessage.trim() || `chore: release ${tagName}`])
  } else {
    callbacks.onLog?.('版本提交已是最新，跳过提交')
  }

  callbacks.onPhase?.('处理本地 Tag', 5, releasePublishPhaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (shouldReplaceLocalTag) {
    callbacks.onLog?.(`删除本地旧 Tag：${tagName}`)
    await runGitInPathStrict(repository.localPath, ['tag', '-d', tagName])
  } else {
    callbacks.onLog?.('无需重建本地 Tag')
  }

  callbacks.onPhase?.('发布前最终检查', 6, releasePublishPhaseTotal)
  callbacks.onLog?.('重新检查发布条件')
  throwIfReleaseCancelled(callbacks)
  const finalPreparation = await prepareRepositoryRelease(repositoryId, { targetVersion: version })
  const finalIssues = getUnresolvedReleaseIssues(finalPreparation.plan, releaseActions)

  if (!finalPreparation.plan.canPublish && finalIssues.length > 0) {
    throw new Error(finalIssues.join('\n') || '版本提交后发布前检查未通过')
  }

  const branch = await runGitInPath(repository.localPath, ['branch', '--show-current'])

  callbacks.onPhase?.('推送当前分支', 7, releasePublishPhaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (branch) {
    callbacks.onLog?.(`推送当前分支到 origin/${branch}`)
    await withSavedSshPassphrases((env) => runGitInPathStrict(repository.localPath, ['push', 'origin', branch], { env }))
  } else {
    callbacks.onLog?.('当前不在命名分支上，跳过分支推送')
  }

  callbacks.onPhase?.('执行发布脚本', 8, releasePublishPhaseTotal)
  callbacks.onLog?.(`执行发布脚本：${getReleaseScriptCommand(finalPreparation.packageManager, finalPreparation.plan.selectedScript)}`)
  throwIfReleaseCancelled(callbacks)
  const scriptResult = await withSavedSshPassphrases((env) =>
    runReleaseScript(repository.localPath, finalPreparation.packageManager, finalPreparation.plan.selectedScript, {
      ...env,
      GH_TOKEN: githubToken || process.env.GH_TOKEN || '',
      GITHUB_TOKEN: githubToken || process.env.GITHUB_TOKEN || ''
    }, callbacks)
  )
  let stdout = scriptResult.stdout
  let stderr = scriptResult.stderr

  callbacks.onPhase?.('更新 Release 并刷新状态', 9, releasePublishPhaseTotal)
  throwIfReleaseCancelled(callbacks)
  if (scriptResult.ok && finalPreparation.plan.selectedScript === 'publish:mac') {
    callbacks.onLog?.('更新 GitHub Release 标题和发布说明')
    const releaseUpdateMessage = await updateGithubReleaseDetails(repository, input, githubToken)

    if (releaseUpdateMessage) {
      stdout = [stdout, releaseUpdateMessage].filter(Boolean).join('\n')
      callbacks.onLog?.(releaseUpdateMessage)
    }
  }

  callbacks.onLog?.('刷新仓库状态')
  return {
    ok: scriptResult.ok,
    provider: 'github',
    repository: await rescanRepositoryRecord(repository),
    plan: finalPreparation.plan,
    stdout,
    stderr,
    exitCode: scriptResult.exitCode,
    artifacts: []
  }
}

function listRepositoryReleasePublishTasks(repositoryId?: string): RepositoryReleasePublishTaskSnapshot[] {
  const tasksById = new Map<string, RepositoryReleasePublishTaskSnapshot>()

  for (const task of listStoredReleasePublishTasks<ReleasePlan, RepositoryRecord>(getDatabase(), repositoryId) as RepositoryReleasePublishTaskSnapshot[]) {
    tasksById.set(task.id, task)
  }

  for (const task of releasePublishTasks.values()) {
    if (!repositoryId || task.repositoryId === repositoryId) {
      tasksById.set(task.id, task)
    }
  }

  return Array.from(tasksById.values())
    .filter((task) => !repositoryId || task.repositoryId === repositoryId)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .map(getReleaseTaskSnapshot)
}

function getRepositoryReleasePublishTask(taskId: string): RepositoryReleasePublishTaskSnapshot | null {
  const task = releasePublishTasks.get(taskId) ?? getStoredReleasePublishTask<ReleasePlan, RepositoryRecord>(getDatabase(), taskId) as RepositoryReleasePublishTaskSnapshot | null
  return task ? getReleaseTaskSnapshot(task) : null
}

async function runRepositoryReleasePublishTask(task: RepositoryReleasePublishTaskSnapshot, input: RepositoryReleasePublishInput): Promise<void> {
  try {
    const result = await publishRepositoryRelease(task.repositoryId, input, {
      onLog: (line) => appendReleaseTaskLog(task, line),
      onOutput: (stream, chunk) => appendReleaseTaskOutput(task, stream, chunk),
      onPhase: (phase, phaseIndex, phaseTotal) => setReleaseTaskPhase(task, phase, phaseIndex, phaseTotal),
      onProcess: (child) => {
        releasePublishTaskProcesses.set(task.id, child)
        updateReleaseTask(task, { processPid: child.pid })
      },
      onCodemagicBuild: (build, externalBuildUrl) => {
        updateReleaseTask(task, {
          externalBuildId: build.id || task.externalBuildId,
          externalBuildUrl,
          externalStatus: build.status,
          externalWorkflow: build.workflowName || build.workflowId,
          externalBranch: build.branch,
          externalTag: build.tag,
          artifacts: build.artifacts.map(mapCodemagicArtifactForRelease)
        })
      },
      onExternalCancel: (cancel) => {
        releasePublishTaskExternalCancelers.set(task.id, cancel)
      },
      shouldCancel: () => task.status === 'cancelled'
    })
    const finishedAt = new Date().toISOString()

    if (task.status === 'cancelled') {
      updateReleaseTask(task, {
        finishedAt,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      })
      appendReleaseTaskLog(task, `${task.tagName} 发布任务已终止`)
      return
    }

    updateReleaseTask(task, {
      status: result.ok ? 'succeeded' : 'failed',
      finishedAt,
      phase: result.ok
        ? result.provider === 'codemagic'
          ? 'Codemagic 构建完成'
          : result.provider === 'firebase'
            ? 'Firebase App Distribution 分发完成'
            : result.provider === 'nextjs-pm2'
              ? 'Next.js PM2 部署完成'
              : '发布完成'
        : '发布失败',
      phaseIndex: task.phaseTotal || releasePublishPhaseTotal,
      phaseTotal: task.phaseTotal || releasePublishPhaseTotal,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      plan: result.plan,
      repository: result.repository,
      selectedScript: result.plan.selectedScript,
      provider: result.provider,
      externalBuildId: result.externalBuildId,
      externalBuildUrl: result.externalBuildUrl,
      externalStatus: result.externalStatus,
      externalWorkflow: result.externalWorkflow,
      externalBranch: result.externalBranch,
      externalTag: result.externalTag,
      artifacts: result.artifacts ?? []
    })
    appendReleaseTaskLog(task, result.ok ? `${task.tagName} ${getReleaseProviderLabel(result.provider)} 发布流程已完成` : `${task.tagName} 发布任务未成功完成`)
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = getUnknownErrorMessage(error, '发布失败')

    if (task.status === 'cancelled') {
      updateReleaseTask(task, {
        finishedAt,
        phase: '发布已终止',
        hint: task.provider === 'firebase'
          ? '发布任务已经终止。重试前请检查本地 Tag 和 Firebase App Distribution 是否留下版本。'
          : task.provider === 'nextjs-pm2'
            ? '发布任务已经终止。重试前请检查本地 Tag、远端发布包和 PM2 进程状态。'
            : '发布任务已经终止。重试前请检查本地 Tag、远端 Tag 和 GitHub Releases 是否留下半成品。',
        stderr: task.stderr || errorMessage
      })
      appendReleaseTaskLog(task, '发布任务已终止')
      return
    }

    updateReleaseTask(task, {
      status: 'failed',
      finishedAt,
      phase: '发布失败',
      phaseIndex: Math.max(task.phaseIndex, 1),
      phaseTotal: task.phaseTotal || releasePublishPhaseTotal,
      error: errorMessage,
      stderr: task.stderr || errorMessage,
      exitCode: task.exitCode
    })
    appendReleaseTaskLog(task, `发布失败：${errorMessage}`)
  } finally {
    releasePublishTaskProcesses.delete(task.id)
    releasePublishTaskExternalCancelers.delete(task.id)
    pruneReleaseTaskHistory()
  }
}

function stopReleaseTaskProcess(task: RepositoryReleasePublishTaskSnapshot): void {
  const child = releasePublishTaskProcesses.get(task.id)
  const pid = child?.pid ?? task.processPid

  if (!pid) {
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      return
    }
  }

  setTimeout(() => {
    if (task.status !== 'cancelled') {
      return
    }

    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // The process may already have exited after SIGTERM.
      }
    }
  }, 5000)
}

async function cancelRepositoryReleasePublishTask(taskId: string): Promise<RepositoryReleasePublishTaskSnapshot> {
  const task = releasePublishTasks.get(taskId)

  if (!task) {
    throw new Error('发布任务不存在')
  }

  if (task.status !== 'running') {
    return getReleaseTaskSnapshot(task)
  }

  updateReleaseTask(task, {
    status: 'cancelled',
    phase: '正在终止发布',
    hint: task.provider === 'codemagic'
      ? '已请求终止 Codemagic 构建。可能已经创建了 Tag 或部分构建产物，重试前请检查 Codemagic。'
      : task.provider === 'firebase'
        ? '已请求终止 Firebase 分发。可能已经创建了 Tag 或部分上传版本，重试前请检查 Firebase App Distribution。'
      : task.provider === 'nextjs-pm2'
        ? '已请求终止部署进程。可能已经创建了 Tag、上传包或远端 release 目录，重试前请检查服务器和 PM2。'
        : '已请求终止发布进程。可能已经创建了 Tag、Release 或部分上传资产，重试前请检查 GitHub Releases。',
    finishedAt: new Date().toISOString()
  })
  appendReleaseTaskLog(task, task.provider === 'codemagic' ? '已请求终止 Codemagic 构建' : task.provider === 'firebase' ? '已请求终止 Firebase 分发进程' : '已请求终止发布进程')

  if (task.provider === 'codemagic') {
    const externalCancel = releasePublishTaskExternalCancelers.get(task.id)

    if (externalCancel) {
      try {
        await externalCancel()
        appendReleaseTaskLog(task, 'Codemagic 取消请求已提交')
      } catch (error) {
        appendReleaseTaskLog(task, `Codemagic 取消请求提交失败：${getUnknownErrorMessage(error)}`)
      }
    } else {
      appendReleaseTaskLog(task, 'Codemagic 构建 ID 尚未生成，已停止本地轮询')
    }
  } else {
    stopReleaseTaskProcess(task)
  }

  return getReleaseTaskSnapshot(task)
}

function startRepositoryReleasePublishTask(repositoryId: string, input: RepositoryReleasePublishInput): RepositoryReleasePublishTaskSnapshot {
  const repository = getRepositoryOrThrow(repositoryId)
  const runningTask = Array.from(releasePublishTasks.values()).find((task) => task.repositoryId === repositoryId && task.status === 'running')
  const provider = getReleaseProvider(input)

  if (runningTask) {
    appendReleaseTaskLog(runningTask, '已有发布任务正在运行，已返回当前任务')
    return getReleaseTaskSnapshot(runningTask)
  }

  const now = new Date().toISOString()
  const task: RepositoryReleasePublishTaskSnapshot = {
    id: randomUUID(),
    repositoryId,
    repositoryName: repository.name,
    provider,
    version: input.version.trim(),
    tagName: input.tagName.trim(),
    releaseTitle: input.releaseTitle.trim(),
    selectedScript: '',
    status: 'running',
    phase: '等待后台任务启动',
    phaseIndex: 0,
    phaseTotal: provider === 'codemagic' || provider === 'firebase' ? 7 : releasePublishPhaseTotal,
    hint: '后台任务已创建，马上开始检查发布条件。',
    lastOutputAt: now,
    startedAt: now,
    updatedAt: now,
    log: '',
    stdout: '',
    stderr: '',
    exitCode: null,
    artifacts: []
  }

  releasePublishTasks.set(task.id, task)
  appendReleaseTaskLog(task, '发布任务已进入后台')
  void runRepositoryReleasePublishTask(task, input)

  return getReleaseTaskSnapshot(task)
}

function getProjectDeploymentInspection(repositoryId: string): Promise<DeploymentInspection> {
  const repository = getRepositoryOrThrow(repositoryId)

  return inspectProjectDeploymentContext({
    repositoryId: repository.id,
    repositoryName: repository.name,
    localPath: repository.localPath,
    currentBranch: repository.currentBranch,
    defaultBranch: repository.defaultBranch,
    branches: repository.branches,
    remoteBranches: repository.remoteBranches,
    remoteUrl: repository.remoteUrl || repository.remotes[0]?.fetchUrl || repository.remotes[0]?.pushUrl || ''
  })
}

async function suggestProjectDeployment(
  repositoryId: string,
  input: { provider: DeploymentProviderType; sourceMode: DeploymentSourceMode }
): Promise<ProjectDeploymentSuggestion> {
  const inspection = await getProjectDeploymentInspection(repositoryId)
  const settings = await readAiSettingsFile(app.getPath('userData'))

  return requestProjectDeploymentSuggestion({
    settings,
    inspection,
    provider: input.provider,
    sourceMode: input.sourceMode
  })
}

async function prepareProjectDeployment(input: {
  targetId?: string
  repositoryId: string
  provider: DeploymentProviderType
  sourceMode: DeploymentSourceMode
  config?: Partial<ProjectDeploymentConfig>
}): Promise<ProjectDeploymentPreparation> {
  const inspection = await getProjectDeploymentInspection(input.repositoryId)
  const target = input.targetId ? getProjectDeploymentTarget(getDatabase(), input.targetId) : null
  const defaultConfig = getDefaultDeploymentConfig(inspection, input.provider, input.sourceMode)
  const config: ProjectDeploymentConfig = {
    ...defaultConfig,
    ...(target?.config ?? {}),
    ...(input.config ?? {}),
    repositoryId: input.repositoryId,
    provider: input.provider,
    sourceMode: input.sourceMode
  }
  const validation = validateProjectDeploymentConfig(config, inspection, target)

  return {
    target,
    config,
    capabilities: getDeploymentProviderCapabilities(input.provider),
    issues: validation.issues,
    warnings: validation.warnings,
    previewCommand: validation.previewCommand,
    ready: validation.issues.length === 0
  }
}

function trimProjectDeploymentLog(value: string): string {
  return value.length > releaseTaskMaxLogLength ? value.slice(value.length - releaseTaskMaxLogLength) : value
}

function persistProjectDeploymentTask(task: ProjectDeploymentTaskSnapshot): void {
  saveProjectDeploymentTask(getDatabase(), task)
}

function updateProjectDeploymentTask(task: ProjectDeploymentTaskSnapshot, patch: Partial<ProjectDeploymentTaskSnapshot>): void {
  Object.assign(task, patch, { updatedAt: new Date().toISOString() })
  persistProjectDeploymentTask(task)
}

function appendProjectDeploymentTaskLog(task: ProjectDeploymentTaskSnapshot, message: string): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  updateProjectDeploymentTask(task, { log: trimProjectDeploymentLog([task.log, `[${time}] ${message}`].filter(Boolean).join('\n')) })
}

function appendProjectDeploymentTaskOutput(task: ProjectDeploymentTaskSnapshot, stream: 'stdout' | 'stderr', chunk: string): void {
  const next = trimProjectDeploymentLog((stream === 'stdout' ? task.stdout : task.stderr) + chunk)
  updateProjectDeploymentTask(task, stream === 'stdout' ? { stdout: next } : { stderr: next })
  chunk.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => appendProjectDeploymentTaskLog(task, `${stream}: ${line}`))
}

function setProjectDeploymentTaskPhase(task: ProjectDeploymentTaskSnapshot, phase: string, phaseIndex: number, phaseTotal = 5): void {
  updateProjectDeploymentTask(task, { phase, phaseIndex, phaseTotal })
  appendProjectDeploymentTaskLog(task, `当前步骤 ${phaseIndex}/${phaseTotal}：${phase}`)
}

function inferVercelGitSource(remoteUrl: string, branch: string): ServiceDeploymentActionInput['gitSource'] {
  const match = remoteUrl.trim().match(/(?:git@|https?:\/\/)(github\.com|gitlab\.com|bitbucket\.org)[:/]([^/]+\/[^/]+?)(?:\.git)?$/i)
  if (!match) return undefined
  const host = match[1].toLowerCase()
  const type = host === 'github.com' ? 'github' : host === 'gitlab.com' ? 'gitlab' : 'bitbucket'
  return { type, repo: match[2], ...(branch.trim() ? { ref: branch.trim() } : {}) }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function resolveDeploymentRoot(repository: RepositoryRecord, config: ProjectDeploymentConfig): string {
  const root = resolve(repository.localPath, config.rootDirectory || '.')
  const relativeRoot = relative(repository.localPath, root)

  if (relativeRoot.startsWith('..') || isAbsolute(relativeRoot)) {
    throw new Error('发布 Root Directory 必须位于仓库目录内')
  }

  return root
}

async function collectVercelStaticDeploymentFiles(outputRoot: string): Promise<Array<{ file: string; sha: string; size: number; content: Uint8Array }>> {
  const files: Array<{ file: string; sha: string; size: number; content: Uint8Array }> = []
  let totalBytes = 0

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = resolve(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }
      if (!entry.isFile()) continue

      const content = await readFile(absolutePath)
      totalBytes += content.byteLength
      if (files.length >= 5000 || totalBytes > 64 * 1024 * 1024) {
        throw new Error('Vercel 静态产物超过单次发布的文件数量或大小上限')
      }
      files.push({
        file: relative(outputRoot, absolutePath).replaceAll('\\', '/'),
        sha: createHash('sha1').update(content).digest('hex'),
        size: content.byteLength,
        content
      })
    }
  }

  await walk(outputRoot)
  return files
}

async function executeLocalProjectDeployment(
  task: ProjectDeploymentTaskSnapshot,
  repository: RepositoryRecord,
  target: ProjectDeploymentTarget,
  config: ProjectDeploymentConfig,
  callbacks: ReleasePublishCallbacks
): Promise<{ stdout: string; stderr: string; exitCode: number | null; artifactPath?: string; externalDeploymentId?: string; externalDeploymentUrl?: string; externalStatus?: string }> {
  const root = resolveDeploymentRoot(repository, config)
  let stdout = ''
  let stderr = ''

  const runCommand = async (command: string, label: string): Promise<void> => {
    if (!command.trim()) return
    appendProjectDeploymentTaskLog(task, `${label}：${command}`)
    const result = await runReleaseProcess('/bin/sh', ['-lc', command], { cwd: root }, callbacks)
    stdout = [stdout, result.stdout].filter(Boolean).join('\n')
    stderr = [stderr, result.stderr].filter(Boolean).join('\n')
    if (!result.ok) throw new Error(result.stderr || result.stdout || `${label}失败`)
  }

  setProjectDeploymentTaskPhase(task, '安装依赖', 1)
  await runCommand(config.installCommand, '执行安装命令')
  setProjectDeploymentTaskPhase(task, '执行本地构建', 2)
  await runCommand(config.buildCommand, '执行构建命令')

  if (config.provider === 'ssh-pm2') {
    const archivePath = join(tmpdir(), `${task.id}.tar.gz`)
    setProjectDeploymentTaskPhase(task, '打包发布产物', 3)
    const archiveResult = await runReleaseProcess('tar', ['-czf', archivePath, '-C', root, '.'], {}, callbacks)
    if (!archiveResult.ok) throw new Error(archiveResult.stderr || '打包发布产物失败')
    const prepareUploadResult = await withSavedSshPassphrases((env) =>
      runReleaseProcess('ssh', [config.remoteHost, `mkdir -p ${shellQuote(config.uploadPath)}`], { env }, callbacks)
    )
    if (!prepareUploadResult.ok) throw new Error(prepareUploadResult.stderr || '创建远程上传目录失败')
    setProjectDeploymentTaskPhase(task, '上传到远程主机', 4)
    const uploadResult = await withSavedSshPassphrases((env) => runReleaseProcess('scp', [archivePath, `${config.remoteHost}:${config.uploadPath}/${task.id}.tar.gz`], { env }, callbacks))
    if (!uploadResult.ok) throw new Error(uploadResult.stderr || '上传发布产物失败')
    const remoteScript = [
      `mkdir -p ${shellQuote(config.remotePath)} ${shellQuote(config.uploadPath)}`,
      `mkdir -p ${shellQuote(`${config.remotePath}/current`)}`,
      `tar -xzf ${shellQuote(`${config.uploadPath}/${task.id}.tar.gz`)} -C ${shellQuote(`${config.remotePath}/current`)}`,
      config.startCommand.trim() ? `cd ${shellQuote(`${config.remotePath}/current`)} && ${config.startCommand.trim()}` : ''
    ].filter(Boolean).join(' && ')
    setProjectDeploymentTaskPhase(task, '远程启动应用', 5)
    const remoteResult = await withSavedSshPassphrases((env) => runReleaseProcess('ssh', [config.remoteHost, remoteScript], { env }, callbacks))
    if (!remoteResult.ok) throw new Error(remoteResult.stderr || '远程启动应用失败')
    stdout = [stdout, remoteResult.stdout].filter(Boolean).join('\n')
    stderr = [stderr, remoteResult.stderr].filter(Boolean).join('\n')
    await rm(archivePath, { force: true }).catch(() => undefined)
    return { stdout, stderr, exitCode: 0, artifactPath: archivePath }
  }

  if (config.provider === 'vercel') {
    if (!target.serviceId) throw new Error('Vercel 本地静态发布需要先绑定平台项目')
    const outputRoot = resolve(root, config.outputDirectory || '.')
    const outputRelative = relative(root, outputRoot)
    if (outputRelative.startsWith('..') || isAbsolute(outputRelative)) throw new Error('Output Directory 必须位于 Root Directory 内')
    setProjectDeploymentTaskPhase(task, '上传静态产物到 Vercel', 3)
    const files = await collectVercelStaticDeploymentFiles(outputRoot)
    if (files.length === 0) throw new Error('Output Directory 中没有可发布的文件')
    const deployment = await deployVercelStaticProjectForService(getDatabase(), target.serviceId, {
      name: config.appName || task.targetName,
      files,
      framework: config.framework
    })
    setProjectDeploymentTaskPhase(task, 'Vercel 部署已提交', 4)
    setProjectDeploymentTaskPhase(task, '发布完成', 5)
    return {
      stdout,
      stderr,
      exitCode: 0,
      externalDeploymentId: deployment.id,
      externalDeploymentUrl: deployment.url,
      externalStatus: deployment.state
    }
  }

  const archivePath = join(tmpdir(), `${task.id}.tar.gz`)
  setProjectDeploymentTaskPhase(task, '上传 Docker 构建上下文', 3)
  const archiveResult = await runReleaseProcess('tar', ['-czf', archivePath, '-C', root, '.'], {}, callbacks)
  if (!archiveResult.ok) throw new Error(archiveResult.stderr || '打包 Docker 构建上下文失败')
  const prepareRemoteResult = await withSavedSshPassphrases((env) =>
    runReleaseProcess('ssh', [config.remoteHost, `mkdir -p ${shellQuote(config.remotePath)}`], { env }, callbacks)
  )
  if (!prepareRemoteResult.ok) throw new Error(prepareRemoteResult.stderr || '创建远程 Docker 目录失败')
  const uploadResult = await withSavedSshPassphrases((env) => runReleaseProcess('scp', [archivePath, `${config.remoteHost}:${config.remotePath}/${task.id}.tar.gz`], { env }, callbacks))
  if (!uploadResult.ok) throw new Error(uploadResult.stderr || '上传 Docker 构建上下文失败')
  const composeCommand = config.composeFile.trim()
    ? `docker compose -f ${shellQuote(`${config.remotePath}/${config.composeFile}`)} ${config.composeService.trim() ? `up -d --build ${shellQuote(config.composeService)}` : 'up -d --build'}`
    : `docker build -f ${shellQuote(`${config.remotePath}/${config.dockerfile || 'Dockerfile'}`)} -t ${shellQuote(config.appName || task.targetName)} ${shellQuote(config.remotePath)}`
  const remoteScript = [
    `mkdir -p ${shellQuote(config.remotePath)}`,
    `tar -xzf ${shellQuote(`${config.remotePath}/${task.id}.tar.gz`)} -C ${shellQuote(config.remotePath)}`,
    composeCommand
  ].join(' && ')
  setProjectDeploymentTaskPhase(task, '远程构建并启动容器', 4)
  const remoteResult = await withSavedSshPassphrases((env) => runReleaseProcess('ssh', [config.remoteHost, remoteScript], { env }, callbacks))
  if (!remoteResult.ok) throw new Error(remoteResult.stderr || '远程 Docker/Compose 发布失败')
  setProjectDeploymentTaskPhase(task, '发布完成', 5)
  stdout = [stdout, remoteResult.stdout].filter(Boolean).join('\n')
  stderr = [stderr, remoteResult.stderr].filter(Boolean).join('\n')
  await rm(archivePath, { force: true }).catch(() => undefined)
  return { stdout, stderr, exitCode: 0, artifactPath: archivePath }
}

async function runProjectDeploymentTask(task: ProjectDeploymentTaskSnapshot): Promise<void> {
  const target = getProjectDeploymentTarget(getDatabase(), task.targetId)
  const repository = getRepositoryOrThrow(task.repositoryId)

  if (!target) {
    updateProjectDeploymentTask(task, { status: 'failed', phase: '发布失败', error: '发布目标不存在', finishedAt: new Date().toISOString() })
    return
  }

  try {
    const inspection = await getProjectDeploymentInspection(repository.id)
    const validation = validateProjectDeploymentConfig(task.config, inspection, target)
    if (validation.issues.length > 0) throw new Error(validation.issues.join('\n'))
    appendProjectDeploymentTaskLog(task, '发布前检查通过')

    if (task.config.provider === 'vercel' || task.config.provider === 'railway') {
      if (!target.serviceId) throw new Error('当前目标还没有绑定已同步的平台服务，请先在服务中心同步并选择目标')
      setProjectDeploymentTaskPhase(task, '触发平台部署', 3)
      const action = task.config.provider === 'railway' ? 'deploy' : target.latestDeploymentId ? 'redeploy' : 'deploy'
      const deploymentId = target.latestDeploymentId || undefined
      const service = await runServiceDeploymentActionRecord(getDatabase(), target.serviceId, {
        action,
        deploymentId,
        environmentId: target.externalEnvironmentId || undefined,
        gitSource: action === 'deploy' && task.config.provider === 'vercel' ? inferVercelGitSource(repository.remoteUrl, task.config.branch) : undefined
      })
      const environment = service.environments.find((item) => item.name === target.externalEnvironmentName) ?? service.environments[0]
      updateProjectDeploymentTask(task, {
        status: 'succeeded',
        phase: '发布完成',
        phaseIndex: 5,
        phaseTotal: 5,
        hint: '平台已接受发布请求。',
        exitCode: 0,
        externalDeploymentId: environment?.latestDeploymentId,
        externalDeploymentUrl: environment?.latestDeploymentUrl,
        externalStatus: environment?.deploymentStatus,
        finishedAt: new Date().toISOString()
      })
      saveProjectDeploymentTarget(getDatabase(), {
        ...target,
        projectId: target.projectId,
        repositoryId: target.repositoryId,
        provider: target.provider,
        config: task.config,
        latestDeploymentId: environment?.latestDeploymentId ?? target.latestDeploymentId,
        latestDeploymentUrl: environment?.latestDeploymentUrl ?? target.latestDeploymentUrl,
        lastStatus: environment?.deploymentStatus ?? 'submitted',
        lastError: ''
      })
      appendProjectDeploymentTaskLog(task, `${task.targetName} 平台部署已提交`)
      return
    }

    const result = await executeLocalProjectDeployment(task, repository, target, task.config, {
      onOutput: (stream, chunk) => appendProjectDeploymentTaskOutput(task, stream, chunk),
      onLog: (line) => appendProjectDeploymentTaskLog(task, line),
      onPhase: (phase, index, total) => setProjectDeploymentTaskPhase(task, phase, index, total),
      onProcess: (child) => projectDeploymentTaskProcesses.set(task.id, child),
      shouldCancel: () => task.status === 'cancelled'
    })
    if (task.status === 'cancelled') return
    updateProjectDeploymentTask(task, {
      status: 'succeeded',
      phase: '发布完成',
      phaseIndex: task.phaseTotal || 5,
      phaseTotal: task.phaseTotal || 5,
      hint: '本地构建和远程发布已完成。',
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      externalDeploymentId: result.externalDeploymentId,
      externalDeploymentUrl: result.externalDeploymentUrl,
      externalStatus: result.externalStatus,
      artifactPath: result.artifactPath,
      finishedAt: new Date().toISOString()
    })
    saveProjectDeploymentTarget(getDatabase(), {
      ...target,
      projectId: target.projectId,
      repositoryId: target.repositoryId,
      provider: target.provider,
      config: task.config,
      status: 'ready',
      latestDeploymentId: result.externalDeploymentId ?? target.latestDeploymentId,
      latestDeploymentUrl: result.externalDeploymentUrl ?? target.latestDeploymentUrl,
      lastStatus: result.externalStatus ?? 'succeeded',
      lastError: ''
    })
    appendProjectDeploymentTaskLog(task, `${task.targetName} 发布完成`)
  } catch (error) {
    const errorMessage = getUnknownErrorMessage(error, '项目发布失败')
    updateProjectDeploymentTask(task, {
      status: task.status === 'cancelled' ? 'cancelled' : 'failed',
      phase: task.status === 'cancelled' ? '发布已终止' : '发布失败',
      hint: task.status === 'cancelled' ? '发布任务已终止，可能留下部分远程文件或容器。' : '发布失败，请查看日志和预检提示。',
      error: errorMessage,
      stderr: task.stderr || errorMessage,
      finishedAt: new Date().toISOString()
    })
    saveProjectDeploymentTarget(getDatabase(), { ...target, projectId: target.projectId, repositoryId: target.repositoryId, provider: target.provider, config: task.config, status: 'attention', lastStatus: 'failed', lastError: errorMessage })
    appendProjectDeploymentTaskLog(task, errorMessage)
  } finally {
    projectDeploymentTaskProcesses.delete(task.id)
  }
}

async function startProjectDeploymentTask(input: { projectId: string; targetId: string; config?: Partial<ProjectDeploymentConfig> }): Promise<ProjectDeploymentTaskSnapshot> {
  const target = getProjectDeploymentTarget(getDatabase(), input.targetId)
  if (!target || target.projectId !== input.projectId) throw new Error('发布目标不存在')
  const running = Array.from(projectDeploymentTasks.values()).find((item) => item.targetId === target.id && item.status === 'running')
  if (running) return { ...running }
  const config = { ...target.config, ...(input.config ?? {}), repositoryId: target.repositoryId, provider: target.provider }
  const resolvedTarget = { ...target, config }

  if ((config.provider === 'vercel' || config.provider === 'railway') && !resolvedTarget.serviceId) {
    throw new Error(`当前目标还没有绑定 ${config.provider === 'vercel' ? 'Vercel' : 'Railway'} 服务，请先在项目设置 / 服务配置中绑定已有平台项目或服务`)
  }

  const task = createProjectDeploymentTask({ projectId: input.projectId, target: resolvedTarget, config })
  projectDeploymentTasks.set(task.id, task)
  persistProjectDeploymentTask(task)
  appendProjectDeploymentTaskLog(task, '项目发布任务已进入后台')
  void runProjectDeploymentTask(task)
  return { ...task }
}

function cancelProjectDeploymentTask(taskId: string): ProjectDeploymentTaskSnapshot {
  const task = projectDeploymentTasks.get(taskId) ?? getProjectDeploymentTask(getDatabase(), taskId)
  if (!task) throw new Error('项目发布任务不存在')
  if (task.status !== 'running') return { ...task }
  updateProjectDeploymentTask(task, { status: 'cancelled', phase: '正在终止发布', hint: '已请求终止发布任务。', finishedAt: new Date().toISOString() })
  const child = projectDeploymentTaskProcesses.get(task.id)
  const pid = child?.pid
  if (pid) {
    try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch { /* already exited */ } }
  }
  appendProjectDeploymentTaskLog(task, '已请求终止项目发布')
  return { ...task }
}

async function applyRepositoryConflictResolution(repositoryId: string, filePath: string, content: string): Promise<GitOperationResult> {
  const repository = getRepositoryOrThrow(repositoryId)
  const normalizedPath = resolveRepositoryFilePath(repository, filePath)

  if (hasConflictMarkers(content)) {
    throw new Error('AI 建议仍包含冲突标记，请重新生成或手动处理')
  }

  await writeFile(normalizedPath, content, 'utf8')

  return runRepositoryWriteOperation(repositoryId, buildGitAddArgs({ mode: 'paths', paths: [filePath] }))
}

async function listRepositoryCommits(
  repositoryId: string,
  options: { startDate?: string; endDate?: string; branchName?: string } = {}
): Promise<GitCommitRecord[]> {
  const repository = listRepositories().find((item) => item.id === repositoryId)

  if (!repository) {
    throw new Error('仓库不存在')
  }

  const headResult = await runGitInPathResult(repository.localPath, ['rev-parse', '--verify', 'HEAD'])

  if (!headResult.ok) {
    const headError = headResult.stderr || headResult.stdout

    if (isEmptyRepositoryHeadError(headError)) {
      return []
    }

    throw new Error(headError || '无法读取仓库 HEAD')
  }

  const since = options.startDate ? `${options.startDate}T00:00:00.000Z` : undefined
  const output = await runGitLog(repository.localPath, { sinceDate: since, branchName: options.branchName, allRefs: !options.branchName })
  const endTime = options.endDate ? new Date(`${options.endDate}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY
  const authorLookup = buildGitAuthorLookup(listProjectPeople(repository.projectId))

  return parseGitLog(output)
    .filter((commit) => new Date(commit.committedAt).getTime() <= endTime)
    .map((commit) =>
      mapCommitRecord({
        ...commit,
        repositoryId: repository.id,
        repositoryName: repository.name,
        branchName: options.branchName || '全部引用'
      }, authorLookup)
    )
}

async function syncRepositoryRemote(repositoryId: string): Promise<RepositoryRecord> {
  const existing = listRepositories().find((repository) => repository.id === repositoryId)

  if (!existing) {
    throw new Error('仓库不存在')
  }

  await withSavedSshPassphrases((env) => runGitInPathStrict(existing.localPath, ['fetch', '--all', '--prune'], { env }))

  const scanned = await scanRepository(existing.localPath)

  if (!scanned) {
    throw new Error('仓库已不存在或不是 Git 仓库')
  }

  return upsertRepository(existing.projectId, scanned)
}

async function analyzeProjectGit(projectId: string): Promise<ProjectGitSummary> {
  const db = getDatabase()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined

  if (!project) {
    throw new Error('项目不存在')
  }

  const repositories = listRepositories(projectId)
  const now = new Date().toISOString()

  try {
    const allCommits: Array<ParsedGitCommit & { repositoryId: string }> = []

    for (const repository of repositories) {
      if (!existsSync(join(repository.localPath, '.git'))) {
        continue
      }

      const output = await runGitLog(repository.localPath, { allRefs: true })
      allCommits.push(...parseGitLog(output).map((commit) => ({ ...commit, repositoryId: repository.id, branchName: '全部引用' })))
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM git_commits WHERE project_id = ?').run(projectId)

      const insertCommit = db.prepare(`
        INSERT OR REPLACE INTO git_commits (
          id, project_id, repository_id, hash, author_name, author_email, committed_at, message,
          branch_name, additions, deletions, files_changed
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const commit of allCommits) {
        insertCommit.run(
          `${commit.repositoryId}:${commit.hash}`,
          projectId,
          commit.repositoryId,
          commit.hash,
          commit.authorName,
          commit.authorEmail,
          commit.committedAt,
          commit.message,
          commit.branchName,
          commit.additions,
          commit.deletions,
          commit.filesChanged
        )
      }

      db.prepare(
        `
        INSERT INTO analysis_runs (project_id, status, last_analyzed_at, error_message)
        VALUES (?, 'ready', ?, '')
        ON CONFLICT(project_id) DO UPDATE SET
          status = 'ready',
          last_analyzed_at = excluded.last_analyzed_at,
          error_message = ''
      `
      ).run(projectId, now)
    })

    transaction()
    return getProjectSummary(projectId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Git 分析失败'
    db.prepare(
      `
      INSERT INTO analysis_runs (project_id, status, last_analyzed_at, error_message)
      VALUES (?, 'failed', ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        status = 'failed',
        last_analyzed_at = excluded.last_analyzed_at,
        error_message = excluded.error_message
    `
    ).run(projectId, now, message)
    return getProjectSummary(projectId)
  }
}

async function findGitRepositories(rootPath: string): Promise<string[]> {
  const normalizedRoot = resolve(expandHomePath(rootPath))
  const repositories = new Set<string>()
  const queue: Array<{ path: string; depth: number }> = [{ path: normalizedRoot, depth: 0 }]
  const maxDepth = 4

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current) {
      continue
    }

    if (existsSync(join(current.path, '.git'))) {
      repositories.add(current.path)
    }

    if (current.depth >= maxDepth) {
      continue
    }

    let entries

    try {
      entries = await readdir(current.path, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }

      queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 })
    }
  }

  return Array.from(repositories)
}

function createRepositoryScanContext(rootPath: string, localPath: string, repositoryPaths: string[]): RepositoryScanContext {
  const relativePath = relative(rootPath, localPath)

  return {
    repositoryKind: 'root',
    relativePath: relativePath || '.',
    parentRepositoryId: findNearestRepositoryParent(localPath, repositoryPaths)
  }
}

async function scanRepositoryTree(rootPath: string): Promise<RepositoryScanResult[]> {
  const normalizedRoot = resolve(expandHomePath(rootPath))
  const repositoryPaths = await findGitRepositories(normalizedRoot)
  const targets = new Map<string, RepositoryScanContext>()

  for (const repositoryPath of repositoryPaths) {
    const normalizedRepositoryPath = resolve(repositoryPath)
    targets.set(normalizedRepositoryPath, createRepositoryScanContext(normalizedRoot, normalizedRepositoryPath, repositoryPaths))
  }

  for (const repositoryPath of repositoryPaths) {
    const normalizedRepositoryPath = resolve(repositoryPath)
    const submodules = await discoverSubmoduleTree(normalizedRepositoryPath, normalizedRoot, runGitInPath)

    for (const submodule of submodules) {
      targets.set(submodule.localPath, {
        repositoryKind: 'submodule',
        parentRepositoryId: submodule.parentRepositoryId,
        relativePath: submodule.relativePath,
        submoduleName: submodule.name,
        submoduleUrl: submodule.url,
        expectedCommit: submodule.expectedCommit,
        statusMarker: submodule.statusMarker
      })
    }
  }

  const results = await Promise.all(Array.from(targets.entries()).map(([localPath, context]) => scanRepository(localPath, context)))
  return results.filter((result): result is RepositoryScanResult => Boolean(result))
}

async function scanRepositoryTrees(paths: string[]): Promise<RepositoryScanResult[]> {
  const results = await Promise.all(paths.map((path) => scanRepositoryTree(path)))
  const unique = new Map<string, RepositoryScanResult>()

  for (const result of results.flat()) {
    unique.set(result.id, result)
  }

  return Array.from(unique.values())
}

async function rescanProjectRepositories(projectId: string): Promise<WorkspaceSnapshot> {
  const project = getProjectOrThrow(projectId)
  const scanned = await scanRepositoryTree(project.workspacePath)
  const db = getDatabase()
  const scannedIds = new Set(scanned.map((repository) => repository.id))

  const transaction = db.transaction(() => {
    db.prepare(
      `UPDATE repositories
       SET active = 0, available = 0, scan_error = '当前扫描未发现该仓库', updated_at = ?
       WHERE project_id = ?`
    ).run(new Date().toISOString(), projectId)

    for (const repository of scanned) {
      if (scannedIds.has(repository.id)) {
        upsertRepository(projectId, repository)
      }
    }
  })

  transaction()
  return getWorkspaceSnapshot()
}

async function initializeProjectRepository(projectId: string): Promise<WorkspaceSnapshot> {
  const project = getProjectOrThrow(projectId)
  const workspacePath = resolve(expandHomePath(project.workspacePath))

  let workspaceStats

  try {
    workspaceStats = await stat(workspacePath)
  } catch {
    throw new Error('项目目录不存在，无法初始化本地仓库')
  }

  if (!workspaceStats.isDirectory()) {
    throw new Error('项目目录不是文件夹，无法初始化本地仓库')
  }

  await runGitInPathStrict(workspacePath, ['init'])
  return rescanProjectRepositories(projectId)
}

function readSshFingerprint(path: string, content: string): Promise<string> {
  return new Promise((resolveFingerprint) => {
    execFile('ssh-keygen', ['-lf', path], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolveFingerprint(content.trim().slice(0, 80))
        return
      }

      resolveFingerprint(stdout.trim())
    })
  })
}

async function getGitSetupStatus(): Promise<GitSetupStatus> {
  const [gitVersion, userName, userEmail, passphrasePaths, gpgVersionOutput, gpgSecretKeyOutput, gitSigningKey, gitCommitGpgSign] = await Promise.all([
    runGit(['--version']),
    runGit(['config', '--global', 'user.name']),
    runGit(['config', '--global', 'user.email']),
    listSshPassphrasePaths(app.getPath('userData')),
    runGpg(['--version']),
    runGpg(['--list-secret-keys', '--keyid-format=long', '--with-colons']),
    runGit(['config', '--global', 'user.signingkey']),
    runGit(['config', '--global', 'commit.gpgsign'])
  ])
  const sshKeys = await readSshKeyInventory(sshDirectory, readSshFingerprint, passphrasePaths)
  const gpgVersion = gpgVersionOutput.split(/\r?\n/)[0] || ''

  return {
    gitAvailable: gitVersion.length > 0,
    gitVersion,
    userName,
    userEmail,
    gpgAvailable: gpgVersion.length > 0,
    gpgVersion,
    gpgKeys: parseGpgSecretKeys(gpgSecretKeyOutput),
    gitSigningKey,
    gitCommitGpgSign: gitCommitGpgSign.trim().toLowerCase() === 'true',
    sshPublicKeys: sshKeys.sshPublicKeys,
    sshPrivateKeys: sshKeys.sshPrivateKeys
  }
}

function registerGitIpc<TResult>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const result = await handler(event, ...args)
    return serializeGitIpcPayload(channel, result)
  })
}

registerGitIpc('repositories:scan', async (_event, paths: string[]) => {
  return scanRepositoryTrees(paths)
})

registerGitIpc('repositories:scan-workspace', async (_event, rootPath: string) => {
  return scanRepositoryTree(rootPath)
})

registerGitIpc('projects:list', async (): Promise<WorkspaceSnapshot> => getWorkspaceSnapshot())

ipcMain.handle('project-groups:list', async (): Promise<ProjectGroupRecord[]> => listProjectGroups(getDatabase()))

ipcMain.handle('project-group:save', async (_event, input: ProjectGroupInput): Promise<ProjectGroupRecord> => saveProjectGroup(getDatabase(), input))

ipcMain.handle('project-group:delete', async (_event, groupId: string): Promise<ProjectGroupRecord[]> => deleteProjectGroup(getDatabase(), groupId))

ipcMain.handle('project-groups:reorder', async (_event, groupIds: string[]): Promise<ProjectGroupRecord[]> => reorderProjectGroups(getDatabase(), groupIds))

registerGitIpc('project:group:set', async (_event, input: { projectId: string; groupId: string | null }): Promise<WorkspaceSnapshot> => {
  setProjectGroup(getDatabase(), input.projectId, input.groupId)
  return getWorkspaceSnapshot()
})

ipcMain.handle('codex-project-link:list', async (): Promise<CodexProjectLink[]> => listCodexProjectLinks(getDatabase()))

ipcMain.handle('codex-project-link:save', async (_event, input: CodexProjectLinkInput): Promise<CodexProjectLink> => {
  const saved = saveCodexProjectLink(getDatabase(), input)
  await refreshCodexProjectMonitor()
  return saved
})

ipcMain.handle('codex-project-link:delete', async (_event, cwd: string): Promise<void> => {
  deleteCodexProjectLink(getDatabase(), cwd)
  await refreshCodexProjectMonitor()
})

registerGitIpc(
  'projects:create',
  async (_event, input: { name: string; workspacePath: string; repositories: RepositoryScanResult[] }): Promise<WorkspaceSnapshot> => {
    const name = input.name.trim()
    const workspacePath = resolve(expandHomePath(input.workspacePath.trim()))

    if (!name) {
      throw new Error('请输入项目名称')
    }

    if (!workspacePath) {
      throw new Error('请选择项目目录')
    }

    const now = new Date().toISOString()
    const projectId = createProjectId(name)
    const db = getDatabase()
    const transaction = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO projects (id, name, description, status, owner, workspace_path, created_at, updated_at)
        VALUES (?, ?, '', 'ready', '', ?, ?, ?)
      `
      ).run(projectId, name, workspacePath, now, now)

      for (const repository of input.repositories) {
        upsertRepository(projectId, repository)
      }
    })

    transaction()
    return getWorkspaceSnapshot()
  }
)

registerGitIpc(
  'projects:create-empty',
  async (_event, input: { name: string; parentPath: string }): Promise<WorkspaceSnapshot> => {
    const name = String(input.name || '').trim()
    const parentPathInput = String(input.parentPath || '').trim()

    if (!name) {
      throw new Error('请输入项目名称')
    }

    if (name === '.' || name === '..' || /[\\/]/.test(name)) {
      throw new Error('项目名称不能包含路径分隔符')
    }

    if (!parentPathInput) {
      throw new Error('请选择项目父目录')
    }

    const parentPath = resolve(expandHomePath(parentPathInput))
    const parentStats = await stat(parentPath).catch(() => null)
    if (!parentStats?.isDirectory()) {
      throw new Error('项目父目录不存在或不是文件夹')
    }

    const workspacePath = resolve(join(parentPath, name))
    if (await pathExists(workspacePath)) {
      throw new Error(`目标目录已存在：${workspacePath}`)
    }

    let createdDirectory = false
    try {
      await mkdir(workspacePath)
      createdDirectory = true

      const now = new Date().toISOString()
      const projectId = createProjectId(name)
      getDatabase().prepare(
        `
        INSERT INTO projects (id, name, description, status, owner, workspace_path, created_at, updated_at)
        VALUES (?, ?, '', 'ready', '', ?, ?, ?)
      `
      ).run(projectId, name, workspacePath, now, now)

      return getWorkspaceSnapshot()
    } catch (error) {
      if (createdDirectory) {
        const contents = await readdir(workspacePath).catch(() => [])
        if (contents.length === 0) {
          await rm(workspacePath, { recursive: true, force: true })
        }
      }
      throw error
    }
  }
)

registerGitIpc(
  'projects:create-from-remote',
  async (_event, input: RemoteProjectCreateInput): Promise<WorkspaceSnapshot> => {
    const name = input.name.trim()
    const remoteUrl = input.remoteUrl.trim()

    if (!name) {
      throw new Error('请输入项目名称')
    }

    if (!remoteUrl) {
      throw new Error('请输入远程仓库地址')
    }

    if (!input.parentPath.trim()) {
      throw new Error('请选择本地父目录')
    }

    const parentPath = resolve(expandHomePath(input.parentPath.trim()))

    let parentStats

    try {
      parentStats = await stat(parentPath)
    } catch {
      throw new Error('本地父目录不存在')
    }

    if (!parentStats.isDirectory()) {
      throw new Error('本地父目录不是文件夹')
    }

    const repositoryName = deriveRemoteRepositoryName(remoteUrl)
    const workspacePath = resolveRemoteCloneTarget(parentPath, remoteUrl)

    if (repositoryName !== basename(workspacePath)) {
      throw new Error('远程仓库目标目录无效')
    }

    if (await pathExists(workspacePath)) {
      throw new Error(`目标目录已存在：${workspacePath}`)
    }

    let targetDirectoryCreated = false

    try {
      await mkdir(workspacePath)
      targetDirectoryCreated = true
      await cloneRemoteRepository(remoteUrl, workspacePath)
      const scanned = await scanRepositoryTree(workspacePath)

      if (scanned.length === 0) {
        throw new Error('远程仓库克隆完成，但未扫描到 Git 仓库')
      }

      const now = new Date().toISOString()
      const projectId = createProjectId(name)
      const db = getDatabase()
      const transaction = db.transaction(() => {
        db.prepare(
          `
          INSERT INTO projects (id, name, description, status, owner, workspace_path, created_at, updated_at)
          VALUES (?, ?, '', 'ready', '', ?, ?, ?)
        `
        ).run(projectId, name, workspacePath, now, now)

        for (const repository of scanned) {
          upsertRepository(projectId, repository)
        }
      })

      transaction()
      return getWorkspaceSnapshot()
    } catch (error) {
      if (targetDirectoryCreated) {
        await rm(workspacePath, { recursive: true, force: true })
      }
      throw error
    }
  }
)

registerGitIpc(
  'projects:update',
  async (_event, input: { id: string; name?: string; workspacePath?: string; description?: string; owner?: string }): Promise<WorkspaceSnapshot> => {
    const existing = getDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(input.id) as Record<string, unknown> | undefined

    if (!existing) {
      throw new Error('项目不存在')
    }

    getDatabase()
      .prepare(
        `
        UPDATE projects
        SET name = ?, workspace_path = ?, description = ?, owner = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(
        input.name?.trim() || String(existing.name),
        input.workspacePath ? resolve(expandHomePath(input.workspacePath.trim())) : String(existing.workspace_path),
        input.description ?? String(existing.description ?? ''),
        input.owner ?? String(existing.owner ?? ''),
        new Date().toISOString(),
        input.id
      )

    return getWorkspaceSnapshot()
  }
)

registerGitIpc(
  'projects:favorite',
  async (_event, input: { id: string; isFavorite: boolean }): Promise<WorkspaceSnapshot> => {
    getProjectOrThrow(input.id)

    getDatabase()
      .prepare(
        `
        UPDATE projects
        SET is_favorite = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(input.isFavorite ? 1 : 0, new Date().toISOString(), input.id)

    return getWorkspaceSnapshot()
  }
)

registerGitIpc('projects:delete', async (_event, projectId: string): Promise<WorkspaceSnapshot> => deleteProject(projectId))

registerGitIpc('project:repositories:rescan', async (_event, projectId: string): Promise<WorkspaceSnapshot> => rescanProjectRepositories(projectId))

registerGitIpc('project:repository:init', async (_event, projectId: string): Promise<WorkspaceSnapshot> => initializeProjectRepository(projectId))

registerGitIpc('repositories:list', async (_event, projectId?: string): Promise<RepositoryRecord[]> => listRepositories(projectId))

registerGitIpc('repository:detail', async (_event, repositoryId: string): Promise<RepositoryRecord> => {
  const existing = listRepositories().find((repository) => repository.id === repositoryId)

  if (!existing) {
    throw new Error('仓库不存在')
  }

  return rescanRepositoryRecord(existing)
})

registerGitIpc(
  'repository:commits',
  async (_event, repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }): Promise<GitCommitRecord[]> =>
    listRepositoryCommits(repositoryId, options)
)

registerGitIpc(
  'repository:commit-graph',
  async (_event, repositoryId: string, options?: { startDate?: string; endDate?: string; branchName?: string }): Promise<GitCommitRecord[]> =>
    listRepositoryCommits(repositoryId, options)
)

registerGitIpc('repository:sync-remote', async (_event, repositoryId: string): Promise<RepositoryRecord> => syncRepositoryRemote(repositoryId))

registerGitIpc('repository:remote:save', async (_event, input: RepositoryRemoteInput): Promise<RepositoryRecord> => saveRepositoryRemote(input))

registerGitIpc('repository:remote:delete', async (_event, repositoryId: string, remoteName: string): Promise<RepositoryRecord> => deleteRepositoryRemote(repositoryId, remoteName))

registerGitIpc('repository:remote:fetch', async (_event, repositoryId: string, remoteName?: string, operationId?: string): Promise<RepositoryRecord> => fetchRepositoryRemote(repositoryId, remoteName, operationId))

registerGitIpc('repository:branch:switch', async (_event, repositoryId: string, input: GitBranchSwitchInput): Promise<RepositoryRecord> => switchRepositoryBranch(repositoryId, input))

registerGitIpc('repository:git-command', async (_event, input: GitCommandRequest): Promise<GitCommandResult> => runRepositoryGitCommand(input))

registerGitIpc('repository:workspace-status', async (_event, repositoryId: string): Promise<GitWorkspaceStatus> => getRepositoryWorkspaceStatus(repositoryId))

registerGitIpc('repository:git-add', async (_event, repositoryId: string, input: GitAddInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitAddArgs(input))
)

registerGitIpc('repository:git-commit', async (_event, repositoryId: string, input: GitCommitInput): Promise<GitOperationResult> =>
  commitRepositoryChanges(repositoryId, input)
)

registerGitIpc('repository:git-push', async (_event, repositoryId: string, input: GitPushInput, operationId?: string): Promise<GitOperationResult> =>
  pushRepositoryChanges(repositoryId, input, operationId)
)

registerGitIpc('repository:git-push-task', async (_event, repositoryId: string, input: GitPushInput, operationId: string): Promise<GitPushTaskResult> => {
  return pushRepositoryTaskChanges(repositoryId, input, operationId)
})

registerGitIpc('repository:git-operation:cancel', async (_event, operationId: string): Promise<boolean> => cancelRepositoryGitOperation(operationId))

registerGitIpc('project:git-tasks:list', async (_event, projectId?: string): Promise<ProjectGitTaskLog[]> => listProjectGitTasks(getDatabase(), projectId))

registerGitIpc('project:git-task:get', async (_event, taskId: string): Promise<ProjectGitTaskLog | null> => getProjectGitTask(getDatabase(), taskId))

registerGitIpc('project:git-task:save', async (_event, task: ProjectGitTaskLog): Promise<ProjectGitTaskLog> => {
  const saved = saveProjectGitTask(getDatabase(), task)
  sendProjectGitTaskEvent(saved)
  return saved
})

ipcMain.handle('project:git-task:delete', async (_event, taskId: string): Promise<void> => {
  deleteProjectGitTask(getDatabase(), taskId)
})

ipcMain.handle('project:git-tasks:clear', async (): Promise<void> => {
  clearProjectGitTasks(getDatabase())
})

registerGitIpc('repository:deployment-approval:config:get', async (_event, repositoryId: string): Promise<DeploymentApprovalConfig | null> =>
  getRepositoryDeploymentApprovalConfig(repositoryId)
)

registerGitIpc('repository:deployment-approval:config:save', async (_event, input: DeploymentApprovalConfig): Promise<DeploymentApprovalConfig> =>
  saveRepositoryDeploymentApprovalConfig(input)
)

registerGitIpc(
  'repository:deployment-approval:analyze',
  async (_event, repositoryId: string, input?: { manualBaselineSha?: string }): Promise<DeploymentApprovalAnalysis> =>
    analyzeRepositoryDeploymentApproval(repositoryId, input)
)

registerGitIpc(
  'repository:deployment-approval:execute',
  async (_event, repositoryId: string, input: { reviewedHeadSha: string; baselineSha: string }): Promise<DeploymentApprovalExecutionResult & { repository: RepositoryRecord }> =>
    executeRepositoryDeploymentApproval(repositoryId, input)
)

registerGitIpc('repository:deployment-approvals:list', async (_event, repositoryId: string): Promise<DeploymentApprovalHistory[]> =>
  listRepositoryDeploymentApprovals(repositoryId)
)

registerGitIpc('repository:merge-analysis', async (_event, repositoryId: string, input: GitMergeAnalysisInput): Promise<GitMergeAnalysis> =>
  analyzeRepositoryMerge(repositoryId, input)
)

registerGitIpc('repository:git-merge', async (_event, repositoryId: string, input: GitMergeInput): Promise<GitOperationResult> =>
  runRepositoryWriteOperation(repositoryId, buildGitMergeArgs(input))
)

registerGitIpc('repository:conflict:suggest', async (_event, repositoryId: string, filePath: string): Promise<ConflictResolutionSuggestion> =>
  suggestRepositoryConflictResolution(repositoryId, filePath)
)

registerGitIpc('repository:commit-message:suggest', async (_event, repositoryId: string, input: GitCommitMessageInput): Promise<CommitMessageSuggestion> =>
  suggestRepositoryCommitMessage(repositoryId, input)
)

registerGitIpc('repository:release:prepare', async (_event, repositoryId: string, input?: RepositoryReleasePrepareInput): Promise<RepositoryReleasePreparation> =>
  prepareRepositoryRelease(repositoryId, input)
)

registerGitIpc('repository:release-tag:recommend', async (_event, repositoryId: string): Promise<RepositoryReleaseTagRecommendation> =>
  recommendRepositoryReleaseTag(repositoryId)
)

registerGitIpc('repository:release:suggest', async (_event, repositoryId: string, input?: RepositoryReleaseSuggestionInput): Promise<ReleaseSuggestion> =>
  suggestRepositoryRelease(repositoryId, input)
)

registerGitIpc('repository:release:publish', async (_event, repositoryId: string, input: RepositoryReleasePublishInput): Promise<RepositoryReleasePublishResult> =>
  publishRepositoryRelease(repositoryId, input)
)

registerGitIpc('repository:release-publish-task:start', async (_event, repositoryId: string, input: RepositoryReleasePublishInput): Promise<RepositoryReleasePublishTaskSnapshot> =>
  startRepositoryReleasePublishTask(repositoryId, input)
)

registerGitIpc('repository:release-publish-tasks:list', async (_event, repositoryId?: string): Promise<RepositoryReleasePublishTaskSnapshot[]> =>
  listRepositoryReleasePublishTasks(repositoryId)
)

registerGitIpc('repository:release-publish-task:get', async (_event, taskId: string): Promise<RepositoryReleasePublishTaskSnapshot | null> =>
  getRepositoryReleasePublishTask(taskId)
)

registerGitIpc('repository:release-publish-task:cancel', async (_event, taskId: string): Promise<RepositoryReleasePublishTaskSnapshot> =>
  cancelRepositoryReleasePublishTask(taskId)
)

registerGitIpc('repository:codemagic-binding:get', async (_event, repositoryId: string): Promise<CodemagicRepositoryBinding | null> =>
  getCodemagicRepositoryBindingRecord(getDatabase(), repositoryId)
)

registerGitIpc('repository:codemagic-binding:save', async (_event, input: CodemagicRepositoryBindingInput): Promise<CodemagicRepositoryBinding> =>
  saveCodemagicRepositoryBindingRecord(getDatabase(), input)
)

ipcMain.handle('repository:codemagic-binding:delete', async (_event, repositoryId: string): Promise<void> =>
  deleteCodemagicRepositoryBindingRecord(getDatabase(), repositoryId)
)

registerGitIpc('repository:conflict:apply', async (_event, repositoryId: string, filePath: string, content: string): Promise<GitOperationResult> =>
  applyRepositoryConflictResolution(repositoryId, filePath, content)
)

registerGitIpc('repository:commit-files', async (_event, repositoryId: string, commitHash: string): Promise<GitCommitFileChange[]> =>
  listRepositoryCommitFiles(repositoryId, commitHash)
)

registerGitIpc(
  'repository:commit-diff',
  async (_event, repositoryId: string, commitHash: string, filePath: string, oldPath?: string, status?: string): Promise<GitCommitDiff> =>
    getRepositoryCommitDiff(repositoryId, commitHash, filePath, oldPath, status)
)

registerGitIpc('project:summary', async (_event, projectId: string, range?: { startDate?: string; endDate?: string }): Promise<ProjectGitSummary> => getProjectSummary(projectId, range))

registerGitIpc('project:analyze-git', async (_event, projectId: string): Promise<ProjectGitSummary> => analyzeProjectGit(projectId))

registerGitIpc('project:people', async (_event, projectId: string): Promise<ProjectPersonRecord[]> => listProjectPeople(projectId))

registerGitIpc('project:contributor-identities', async (_event, projectId: string): Promise<GitContributorIdentity[]> => listProjectContributorIdentities(projectId))

registerGitIpc('project:branch-tags', async (_event, projectId: string): Promise<ProjectBranchTagRecord[]> => listProjectBranchTagRecords(getDatabase(), projectId))

registerGitIpc('project:branch-tag:save', async (_event, input: ProjectBranchTagInput): Promise<ProjectBranchTagRecord> => saveProjectBranchTagRecord(getDatabase(), input))

registerGitIpc('project:branch-tag:delete', async (_event, projectId: string, tagId: string): Promise<ProjectBranchTagRecord[]> =>
  deleteProjectBranchTagRecord(getDatabase(), projectId, tagId)
)

ipcMain.handle('project:terminal-commands:list', async (_event, projectId: string): Promise<ProjectTerminalCommandRecord[]> =>
  listProjectTerminalCommandRecords(getDatabase(), projectId)
)

ipcMain.handle('project:terminal-command:save', async (_event, input: ProjectTerminalCommandInput): Promise<ProjectTerminalCommandRecord> =>
  saveProjectTerminalCommandRecord(getDatabase(), input)
)

ipcMain.handle('project:terminal-command:delete', async (_event, projectId: string, commandId: string): Promise<ProjectTerminalCommandRecord[]> =>
  deleteProjectTerminalCommandRecord(getDatabase(), projectId, commandId)
)

ipcMain.handle('plane:settings:get', async () => getPlaneSettings(getDatabase()))

ipcMain.handle('plane:settings:save', async (_event, input: PlaneSettingsInput) => savePlaneSettings(getDatabase(), input))

ipcMain.handle('plane:settings:test', async (_event, input?: PlaneSettingsInput) => testPlaneConnection(getDatabase(), input))

ipcMain.handle('plane:projects:list', async (_event, workspaceSlug: string) => listPlaneProjects(getDatabase(), workspaceSlug))

ipcMain.handle('plane:binding:get', async (_event, projectId: string) => getProjectPlaneBinding(getDatabase(), projectId))

ipcMain.handle('plane:binding:save', async (_event, input: PlaneProjectBindingInput) => saveProjectPlaneBinding(getDatabase(), input))

ipcMain.handle('plane:binding:delete', async (_event, projectId: string): Promise<void> => deleteProjectPlaneBindingRecord(getDatabase(), projectId))

ipcMain.handle('plane:project-content:get', async (_event, projectId: string) => getPlaneProjectContent(getDatabase(), projectId))

ipcMain.handle('plane:open', async (_event, projectId?: string): Promise<void> => {
  await shell.openExternal(projectId ? getPlaneProjectWebUrl(getDatabase(), projectId) : getPlaneSettings(getDatabase()).webBaseUrl)
})

ipcMain.handle('project:cloudflare:settings:get', async (_event, projectId: string): Promise<ProjectCloudflareSettings | null> =>
  getProjectCloudflareSettings(getDatabase(), projectId)
)

ipcMain.handle('project:cloudflare:settings:save', async (_event, input: ProjectCloudflareSettingsInput): Promise<ProjectCloudflareSettings> =>
  saveProjectCloudflareSettings(getDatabase(), input)
)

ipcMain.handle('project:cloudflare:settings:delete', async (_event, projectId: string): Promise<void> =>
  deleteProjectCloudflareSettings(getDatabase(), projectId)
)

ipcMain.handle(
  'project:cloudflare:settings:test',
  async (_event, projectId: string, input?: ProjectCloudflareSettingsInput): Promise<CloudflareConnectionTestResult> =>
    testProjectCloudflareConnection(getDatabase(), projectId, input)
)

ipcMain.handle('project:cloudflare:dns-records:list', async (_event, projectId: string): Promise<CloudflareDnsRecord[]> =>
  listProjectCloudflareDnsRecords(getDatabase(), projectId)
)

ipcMain.handle(
  'project:cloudflare:dns-record:save',
  async (_event, projectId: string, input: CloudflareDnsRecordInput): Promise<CloudflareDnsRecord[]> =>
    saveProjectCloudflareDnsRecord(getDatabase(), projectId, input)
)

ipcMain.handle('project:cloudflare:dns-record:delete', async (_event, projectId: string, recordId: string): Promise<CloudflareDnsRecord[]> =>
  deleteProjectCloudflareDnsRecord(getDatabase(), projectId, recordId)
)

ipcMain.handle('project:firebase-release:settings:get', async (_event, projectId: string): Promise<ProjectFirebaseReleaseSettings | null> =>
  getProjectFirebaseReleaseSettings(getDatabase(), projectId)
)

ipcMain.handle('project:firebase-release:settings:save', async (_event, input: ProjectFirebaseReleaseSettingsInput): Promise<ProjectFirebaseReleaseSettings> =>
  saveProjectFirebaseReleaseSettings(getDatabase(), input)
)

ipcMain.handle('project:firebase-release:settings:delete', async (_event, projectId: string): Promise<void> =>
  deleteProjectFirebaseReleaseSettings(getDatabase(), projectId)
)

ipcMain.handle('data-source:connections:list', async (): Promise<DataSourceConnectionRecord[]> => listDataSourceConnectionRecords(getDatabase()))

ipcMain.handle('data-source:connection:save', async (_event, input: DataSourceConnectionInput): Promise<DataSourceConnectionRecord> =>
  saveDataSourceConnectionRecord(getDatabase(), input)
)

ipcMain.handle('data-source:connection:delete', async (_event, connectionId: string): Promise<DataSourceConnectionRecord[]> =>
  deleteDataSourceConnectionRecord(getDatabase(), connectionId)
)

ipcMain.handle('data-source:connection:test', async (_event, connectionId: string): Promise<DataSourceConnectionTestResult> =>
  testDataSourceConnectionRecord(getDatabase(), connectionId)
)

ipcMain.handle('data-source:database:tables', async (_event, connectionId: string): Promise<DataSourceDatabaseTable[]> =>
  listDataSourceDatabaseTables(getDatabase(), connectionId)
)

ipcMain.handle(
  'data-source:database:preview',
  async (_event, connectionId: string, input: { schema?: string; table: string; limit?: number; offset?: number }): Promise<DataSourceTabularResult> =>
    previewDataSourceDatabaseTable(getDatabase(), connectionId, input)
)

ipcMain.handle(
  'data-source:database:sql',
  async (_event, connectionId: string, input: { sql: string; limit?: number }): Promise<DataSourceTabularResult> =>
    runDataSourceSqlQuery(getDatabase(), connectionId, input)
)

ipcMain.handle(
  'data-source:redis:keys',
  async (_event, connectionId: string, input?: { pattern?: string; cursor?: string; limit?: number }): Promise<DataSourceRedisScanResult> =>
    scanDataSourceRedisKeys(getDatabase(), connectionId, input)
)

ipcMain.handle(
  'data-source:redis:value',
  async (_event, connectionId: string, input: { key: string; limit?: number }): Promise<DataSourceRedisValuePreview> =>
    previewDataSourceRedisValue(getDatabase(), connectionId, input)
)

ipcMain.handle(
  'data-source:s3:objects',
  async (_event, connectionId: string, input?: { prefix?: string; continuationToken?: string; limit?: number }): Promise<DataSourceS3ListResult> =>
    listDataSourceS3Objects(getDatabase(), connectionId, input)
)

ipcMain.handle(
  'data-source:s3:object',
  async (_event, connectionId: string, input: { key: string }): Promise<DataSourceS3ObjectPreview> =>
    previewDataSourceS3Object(getDatabase(), connectionId, input)
)

ipcMain.handle('service:connections:list', async (): Promise<ServiceConnectionRecord[]> => listServiceConnectionRecords(getDatabase()))

ipcMain.handle('service:connection:save', async (_event, input: ServiceConnectionInput): Promise<ServiceConnectionRecord> => saveServiceConnectionRecord(getDatabase(), input))

ipcMain.handle('service:connection:delete', async (_event, connectionId: string): Promise<ServiceConnectionRecord[]> =>
  deleteServiceConnectionRecord(getDatabase(), connectionId)
)

ipcMain.handle(
  'service:connection:test',
  async (_event, connectionId: string): Promise<{ ok: boolean; message: string; serviceCount: number }> => {
    const services = await syncServiceConnection(getDatabase(), connectionId)

    return {
      ok: true,
      message: `读取到 ${services.length} 个服务`,
      serviceCount: services.length
    }
  }
)

ipcMain.handle('service:services:list', async (): Promise<ProjectServiceRecord[]> => listAllProjectServiceRecords(getDatabase()))

ipcMain.handle('project:services:list', async (_event, projectId: string): Promise<ProjectServiceRecord[]> => listProjectServiceRecords(getDatabase(), projectId))

ipcMain.handle('project:service:save', async (_event, input: ProjectServiceInput): Promise<ProjectServiceRecord> => saveProjectServiceRecord(getDatabase(), input))

ipcMain.handle('service:external-project:alias:save', async (_event, input: ServiceExternalProjectAliasInput): Promise<ProjectServiceRecord[]> =>
  saveServiceExternalProjectAliasRecord(getDatabase(), input)
)

ipcMain.handle('project:service:bind', async (_event, input: { projectId: string; serviceId: string; repositoryId?: string }): Promise<ProjectServiceRecord[]> =>
  bindProjectServiceRecord(getDatabase(), input)
)

ipcMain.handle('project:services:sync', async (_event, connectionId?: string): Promise<ProjectServiceRecord[]> => {
  const connections = connectionId
    ? listServiceConnectionRecords(getDatabase()).filter((connection) => connection.id === connectionId)
    : listServiceConnectionRecords(getDatabase())

  for (const connection of connections) {
    await syncServiceConnection(getDatabase(), connection.id)
  }

  return listAllProjectServiceRecords(getDatabase())
})

ipcMain.handle('service:monitor:check', async (_event, projectId?: string): Promise<ProjectServiceRecord[]> => checkProjectServicesNow(projectId))

ipcMain.handle('service:monitor:latest', async (_event, projectId: string): Promise<ServiceMonitorCheckRecord[]> => listLatestServiceMonitorCheckRecords(getDatabase(), projectId))

ipcMain.handle('service:monitor:history', async (_event, projectId: string): Promise<ServiceMonitorCheckRecord[]> => listServiceMonitorHistoryRecords(getDatabase(), projectId))

ipcMain.handle('service:monitor:history:all', async (): Promise<ServiceMonitorCheckRecord[]> => listAllServiceMonitorHistoryRecords(getDatabase()))

ipcMain.handle('service:environment:logs', async (_event, serviceId: string, environmentName: string): Promise<ServiceEnvironmentLogRecord[]> =>
  listServiceEnvironmentLogRecords(getDatabase(), serviceId, environmentName)
)

ipcMain.handle(
  'service:deployments:list',
  async (_event, serviceId: string, options?: ServiceDeploymentListOptions): Promise<ServiceDeploymentSummary[]> =>
    listServiceDeploymentRecords(getDatabase(), serviceId, options)
)

ipcMain.handle(
  'service:deployments:cached:list',
  async (_event, serviceId: string, options?: ServiceDeploymentListOptions): Promise<ServiceDeploymentSummary[]> =>
    listCachedServiceDeploymentRecords(getDatabase(), serviceId, options)
)

ipcMain.handle(
  'service:deployment:action',
  async (_event, serviceId: string, input: ServiceDeploymentActionInput): Promise<ProjectServiceRecord> =>
    runServiceDeploymentActionRecord(getDatabase(), serviceId, input)
)

ipcMain.handle('service:env:list', async (_event, serviceId: string): Promise<ServiceEnvVarRecord[]> => listServiceEnvVarRecords(getDatabase(), serviceId))

ipcMain.handle(
  'service:env:reveal',
  async (_event, serviceId: string, envVarId: string): Promise<ServiceEnvVarRecord> => revealServiceEnvVarRecord(getDatabase(), serviceId, envVarId)
)

ipcMain.handle(
  'service:env:save',
  async (_event, serviceId: string, input: VercelEnvVarInput): Promise<ServiceEnvVarRecord> => saveServiceEnvVarRecord(getDatabase(), serviceId, input)
)

ipcMain.handle('service:env:delete', async (_event, serviceId: string, envVarId: string): Promise<void> =>
  deleteServiceEnvVarRecord(getDatabase(), serviceId, envVarId)
)

ipcMain.handle(
  'service:domain:add',
  async (_event, serviceId: string, input: VercelDomainInput): Promise<ProjectServiceRecord> => addServiceDomainRecord(getDatabase(), serviceId, input)
)

ipcMain.handle(
  'service:domain:remove',
  async (_event, serviceId: string, domain: string, removeRedirects?: boolean): Promise<ProjectServiceRecord> =>
    removeServiceDomainRecord(getDatabase(), serviceId, domain, removeRedirects)
)

ipcMain.handle('service:domain:verify', async (_event, serviceId: string, domain: string): Promise<ProjectServiceRecord> =>
  verifyServiceDomainRecord(getDatabase(), serviceId, domain)
)

ipcMain.handle('service:domain:config', async (_event, serviceId: string, domain: string): Promise<VercelDomainConfig> =>
  inspectServiceDomainConfigRecord(getDatabase(), serviceId, domain)
)

ipcMain.handle('service:runtime:logs', async (_event, serviceId: string, environmentName: string): Promise<ServiceEnvironmentLogRecord[]> =>
  listServiceRuntimeLogRecords(getDatabase(), serviceId, environmentName)
)

ipcMain.handle(
  'project:deployment:context:inspect',
  async (_event, repositoryId: string): Promise<DeploymentInspection> => getProjectDeploymentInspection(repositoryId)
)

ipcMain.handle(
  'project:deployment:suggest',
  async (_event, repositoryId: string, input: { provider: DeploymentProviderType; sourceMode: DeploymentSourceMode }): Promise<ProjectDeploymentSuggestion> =>
    suggestProjectDeployment(repositoryId, input)
)

ipcMain.handle(
  'project:deployment:targets:list',
  async (_event, projectId: string): Promise<ProjectDeploymentTarget[]> => listProjectDeploymentTargets(getDatabase(), projectId)
)

ipcMain.handle(
  'project:deployment:target:save',
  async (_event, input: ProjectDeploymentTargetInput): Promise<ProjectDeploymentTarget> => saveProjectDeploymentTarget(getDatabase(), input)
)

ipcMain.handle(
  'project:deployment:target:delete',
  async (_event, projectId: string, targetId: string): Promise<ProjectDeploymentTarget[]> => deleteProjectDeploymentTarget(getDatabase(), projectId, targetId)
)

ipcMain.handle(
  'project:deployment:prepare',
  async (_event, input: { targetId?: string; repositoryId: string; provider: DeploymentProviderType; sourceMode: DeploymentSourceMode; config?: Partial<ProjectDeploymentConfig> }): Promise<ProjectDeploymentPreparation> =>
    prepareProjectDeployment(input)
)

ipcMain.handle(
  'project:deployment:task:start',
  async (_event, input: { projectId: string; targetId: string; config?: Partial<ProjectDeploymentConfig> }): Promise<ProjectDeploymentTaskSnapshot> =>
    startProjectDeploymentTask(input)
)

ipcMain.handle(
  'project:deployment:tasks:list',
  async (_event, projectId?: string): Promise<ProjectDeploymentTaskSnapshot[]> => listProjectDeploymentTasks(getDatabase(), projectId)
)

ipcMain.handle(
  'project:deployment:task:get',
  async (_event, taskId: string): Promise<ProjectDeploymentTaskSnapshot | null> => projectDeploymentTasks.get(taskId) ?? getProjectDeploymentTask(getDatabase(), taskId)
)

ipcMain.handle(
  'project:deployment:task:cancel',
  async (_event, taskId: string): Promise<ProjectDeploymentTaskSnapshot> => cancelProjectDeploymentTask(taskId)
)

ipcMain.handle(
  'project:person:save',
  async (
    _event,
    input: { id?: string; projectId: string; displayName: string; role?: string; identities: Array<{ name: string; email: string }> }
  ): Promise<ProjectPersonRecord> => saveProjectPerson(input)
)

ipcMain.handle('project:person:delete', async (_event, projectId: string, personId: string): Promise<ProjectPersonRecord[]> => deleteProjectPerson(projectId, personId))

registerGitIpc(
  'repository:configure-identity',
  async (_event, localPath: string, identity: { userName: string; userEmail: string }): Promise<RepositoryScanResult> => {
    const normalizedPath = resolve(expandHomePath(localPath))
    const userName = identity.userName.trim()
    const userEmail = identity.userEmail.trim()

    if (!existsSync(join(normalizedPath, '.git'))) {
      throw new Error('这不是一个 Git 仓库')
    }

    if (!userName || !userEmail) {
      throw new Error('请填写本仓库的提交用户名和邮箱')
    }

    await runGitInPathStrict(normalizedPath, ['config', '--local', 'user.name', userName])
    await runGitInPathStrict(normalizedPath, ['config', '--local', 'user.email', userEmail])

    const existingRecord = listRepositories().find((item) => item.id === normalizedPath)
    const repository = await scanRepository(normalizedPath, existingRecord ? {
      repositoryKind: existingRecord.repositoryKind,
      parentRepositoryId: existingRecord.parentRepositoryId,
      relativePath: existingRecord.relativePath,
      submoduleName: existingRecord.submoduleName,
      submoduleUrl: existingRecord.submoduleUrl,
      expectedCommit: existingRecord.expectedCommit
    } : {})

    if (!repository) {
      throw new Error('仓库设置已保存，但重新读取失败')
    }

    const existing = getDatabase().prepare('SELECT project_id FROM repositories WHERE id = ?').get(repository.id) as Record<string, unknown> | undefined

    if (existing?.project_id) {
      upsertRepository(String(existing.project_id), repository)
    }

    return repository
  }
)

registerGitIpc('repository:clear-identity', async (_event, localPath: string): Promise<RepositoryScanResult> => {
  const normalizedPath = resolve(expandHomePath(localPath))

  if (!existsSync(join(normalizedPath, '.git'))) {
    throw new Error('这不是一个 Git 仓库')
  }

  await runGitInPath(normalizedPath, ['config', '--local', '--unset', 'user.name'])
  await runGitInPath(normalizedPath, ['config', '--local', '--unset', 'user.email'])

  const existingRecord = listRepositories().find((item) => item.id === normalizedPath)
  const repository = await scanRepository(normalizedPath, existingRecord ? {
    repositoryKind: existingRecord.repositoryKind,
    parentRepositoryId: existingRecord.parentRepositoryId,
    relativePath: existingRecord.relativePath,
    submoduleName: existingRecord.submoduleName,
    submoduleUrl: existingRecord.submoduleUrl,
    expectedCommit: existingRecord.expectedCommit
  } : {})

  if (!repository) {
    throw new Error('仓库设置已清除，但重新读取失败')
  }

  const existing = getDatabase().prepare('SELECT project_id FROM repositories WHERE id = ?').get(repository.id) as Record<string, unknown> | undefined

  if (existing?.project_id) {
    upsertRepository(String(existing.project_id), repository)
  }

  return repository
})

ipcMain.handle('dialog:select-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a workspace or Git repository folder',
    properties: ['openDirectory']
  })

  return result.canceled ? null : result.filePaths[0]
})

registerGitIpc('git:setup-status', async (): Promise<GitSetupStatus> => getGitSetupStatus())

registerGitIpc('git:configure-identity', async (_event, identity: { userName: string; userEmail: string }): Promise<GitSetupStatus> => {
  const userName = identity.userName.trim()
  const userEmail = identity.userEmail.trim()

  if (!userName || !userEmail) {
    throw new Error('请填写 Git 用户名和邮箱')
  }

  await runGitStrict(['config', '--global', 'user.name', userName])
  await runGitStrict(['config', '--global', 'user.email', userEmail])

  return getGitSetupStatus()
})

registerGitIpc('gpg:import-bundle', async (_event, input: { sourcePath: string }): Promise<GitSetupStatus> => {
  const sourcePath = resolve(expandHomePath(String(input.sourcePath || '')))
  const sourceInfo = await stat(sourcePath)
  let importRoot = sourcePath
  let temporaryDirectory = ''

  try {
    if (sourceInfo.isFile() && sourcePath.toLowerCase().endsWith('.zip')) {
      temporaryDirectory = await mkdtemp(join(tmpdir(), 'forgedesk-gpg-import-'))
      await unzipToDirectory(sourcePath, temporaryDirectory)
      importRoot = temporaryDirectory
    }

    const plan = await createGpgImportPlan(importRoot)

    if (plan.keyFiles.length === 0 && plan.ownerTrustFiles.length === 0) {
      throw new Error('没有在这个 GPG 包中找到 .asc/.gpg/.pgp 密钥或 ownertrust 文件')
    }

    for (const keyFile of plan.keyFiles) {
      await runGpgStrict(['--import', keyFile])
    }

    for (const ownerTrustFile of plan.ownerTrustFiles) {
      await runGpgStrict(['--import-ownertrust', ownerTrustFile])
    }

    return getGitSetupStatus()
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
})

registerGitIpc('gpg:install', async (): Promise<GpgInstallResult> => installGpgWithBrew())

ipcMain.handle('gpg:copy-public-key', async (_event, fingerprint: string): Promise<void> => {
  const normalizedFingerprint = String(fingerprint || '').trim()

  if (!normalizedFingerprint) {
    throw new Error('请选择要复制的 GPG 密钥')
  }

  const publicKey = await runGpgStrict(['--armor', '--export', normalizedFingerprint])

  if (!publicKey.trim()) {
    throw new Error('无法导出 GPG 公钥')
  }

  clipboard.writeText(`${publicKey.trim()}\n`)
})

registerGitIpc('gpg:configure-git-signing', async (_event, fingerprint: string): Promise<GitSetupStatus> => {
  const normalizedFingerprint = String(fingerprint || '').trim()

  if (!normalizedFingerprint) {
    throw new Error('请选择要用于 Git 签名的 GPG 密钥')
  }

  await runGitStrict(['config', '--global', 'user.signingkey', normalizedFingerprint])
  await runGitStrict(['config', '--global', 'commit.gpgsign', 'true'])
  await runGitStrict(['config', '--global', 'gpg.program', 'gpg'])

  return getGitSetupStatus()
})

ipcMain.handle('settings:ai:get', async (): Promise<RedactedAiSettings> => getRedactedAiSettings(await readAiSettingsFile(app.getPath('userData'))))

ipcMain.handle('settings:ai:connect-codex-api', async (): Promise<RedactedAiSettings> => {
  const service = await getCodexApiServiceIntegrationSettings(app.getPath('userData'))
  const current = await readAiSettingsFile(app.getPath('userData'))
  const settings = await writeAiSettingsFile(app.getPath('userData'), {
    ...current,
    enabled: true,
    provider: 'codex-local-api',
    baseUrl: service.baseUrl,
    apiKey: service.apiKey,
    model: service.model
  })
  return getRedactedAiSettings(settings)
})

ipcMain.handle('settings:ai:sync-codex-api', async (): Promise<RedactedAiSettings> => {
  const service = await getCodexApiServiceIntegrationSettings(app.getPath('userData'))
  const current = await readAiSettingsFile(app.getPath('userData'))
  const settings = await writeAiSettingsFile(app.getPath('userData'), {
    ...current,
    provider: 'codex-local-api',
    baseUrl: service.baseUrl,
    apiKey: service.apiKey,
    model: service.model
  })
  return getRedactedAiSettings(settings)
})

ipcMain.handle('initialization:get', async (): Promise<InitializationSnapshot> => {
  const projects = listProjects().map((project) => ({
    id: project.id,
    name: project.name,
    workspacePath: project.workspacePath
  }))
  return getInitializationSnapshot(app.getPath('userData'), projects)
})

ipcMain.handle('ai-providers:list', async (): Promise<AiProviderRuntimeSnapshot[]> => listAiProviderRuntimeSnapshots(app.getPath('userData')))

ipcMain.handle(
  'ai-providers:open',
  async (_event, input: { providerId: 'codex'; projectPath?: string }): Promise<{
    mode: 'app' | 'cli' | 'download'
    runtime: AiProviderRuntimeSnapshot
    session?: TerminalSession
  }> => {
    getAiProviderAdapter(input.providerId)

    const runtime = await detectCodexProvider(app.getPath('userData'))
    if (runtime.appPath) {
      const error = await shell.openPath(runtime.appPath)
      if (error) throw new Error(error)
      return { mode: 'app', runtime }
    }

    if (runtime.command) {
      const projectPath = resolve(expandHomePath(String(input.projectPath || '').trim() || homedir()))
      const projectStats = await stat(projectPath).catch(() => null)
      if (!projectStats?.isDirectory()) {
        throw new Error('当前项目目录不存在，无法启动 Codex CLI')
      }

      const codexHome = await resolveCodexHome(app.getPath('userData'))
      const session = terminalService.create({
        cwd: projectPath,
        directCommand: { args: [], file: runtime.command },
        env: { ...process.env, CODEX_HOME: codexHome, NO_COLOR: '1' },
        reuseKey: `codex-project:${projectPath}`,
        title: `Codex · ${basename(projectPath)}`
      })
      return { mode: 'cli', runtime, session }
    }

    await shell.openExternal(codexInstallUrl)
    return { mode: 'download', runtime }
  }
)

ipcMain.handle(
  'ai-providers:quota',
  async (_event, input: { providerId: 'codex'; accountId?: string; refresh?: boolean }): Promise<QuotaSnapshot> => {
    return getAiProviderAdapter(input.providerId).getQuota(app.getPath('userData'), input.accountId, { refresh: Boolean(input.refresh) })
  }
)

ipcMain.handle(
  'ai-providers:account-snapshots',
  async (_event, input: { providerId: 'codex'; refresh?: boolean }): Promise<AiProviderAccountSnapshot[]> =>
    getAiProviderAdapter(input.providerId).getAccountSnapshots(app.getPath('userData'), { refresh: Boolean(input.refresh) })
)

ipcMain.handle(
  'project-ai-bindings:get',
  async (_event, input: { projectId: string; providerId: string }): Promise<ProjectAiBinding | null> =>
    getProjectAiBinding(getDatabase(), String(input.projectId || ''), String(input.providerId || 'codex'))
)

ipcMain.handle(
  'project-ai-bindings:save',
  async (_event, input: ProjectAiBindingInput): Promise<ProjectAiBinding> => saveProjectAiBinding(getDatabase(), input)
)

ipcMain.handle('codex:account:get', async (): Promise<CodexAccountInfo> => getActiveCodexAccountInfo(app.getPath('userData')))

ipcMain.handle('codex:accounts:list', async (): Promise<CodexAccountRegistryView> => listCodexAccounts(app.getPath('userData')))

ipcMain.handle('codex:accounts:import', async (_event, input: CodexAccountImportInput): Promise<CodexAccountRegistryView> =>
  importCodexAccount(app.getPath('userData'), input))

ipcMain.handle('codex:accounts:create', async (_event, input?: CodexAccountCreateInput): Promise<CodexAccountRegistryView> =>
  createCodexAccount(app.getPath('userData'), input))

ipcMain.handle('codex:accounts:activate', async (_event, accountId: string): Promise<CodexAccountRegistryView> =>
  activateCodexAccount(app.getPath('userData'), accountId))

ipcMain.handle('codex:accounts:remove', async (_event, accountId: string): Promise<CodexAccountRegistryView> =>
  removeCodexAccount(app.getPath('userData'), accountId))

ipcMain.handle('codex:api-service:get', async (): Promise<CodexApiServiceView> => getCodexApiService(app.getPath('userData')))

ipcMain.handle('codex:api-service:start', async (_event, input?: Partial<CodexApiServiceSettings>): Promise<CodexApiServiceView> =>
  startCodexApiService(app.getPath('userData'), input))

ipcMain.handle('codex:api-service:stop', async (): Promise<CodexApiServiceView> => stopCodexApiService(app.getPath('userData')))

ipcMain.handle('codex:api-service:rotate-key', async (): Promise<CodexApiServiceView> => rotateCodexApiKey(app.getPath('userData')))

ipcMain.handle('codex:api-service:health', async (): Promise<{ ok: boolean; message: string }> => {
  const service = await getCodexApiService(app.getPath('userData'))
  if (!service.running) {
    return { ok: false, message: '本地 Codex API 服务未运行' }
  }

  try {
    const integration = await getCodexApiServiceIntegrationSettings(app.getPath('userData'))
    const response = await fetch(`${service.baseUrl.replace(/\/$/, '')}/models`, {
      headers: integration.apiKey ? { Authorization: `Bearer ${integration.apiKey}` } : undefined
    })
    return response.ok
      ? { ok: true, message: `API 服务正常（HTTP ${response.status}）` }
      : { ok: false, message: `API 服务返回 HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'API 健康检查失败' }
  }
})

ipcMain.handle('settings:ai:status', async (_event, verify = false): Promise<AiRuntimeStatus> =>
  inspectAiRuntime(await readAiSettingsFile(app.getPath('userData')), Boolean(verify)))

ipcMain.handle('codex:accounts:verify', async (_event, accountId: string): Promise<AiRuntimeStatus> =>
  inspectCodexRuntime(true, await resolveCodexHome(app.getPath('userData'), accountId)))

ipcMain.handle('codex:accounts:login-terminal', async (_event, accountId: string): Promise<TerminalSession> => {
  const codexHome = await resolveCodexHome(app.getPath('userData'), accountId)
  const environment = { ...process.env, CODEX_HOME: codexHome, NO_COLOR: '1' }
  const command = await findLocalAiCommand('codex-cli', { env: environment })
  if (!command) throw new Error('未检测到 Codex CLI，请先安装或打开 ChatGPT 桌面应用')
  return terminalService.create({
    cwd: codexHome,
    directCommand: { args: ['login'], file: command },
    env: environment,
    reuseKey: `codex-login:${accountId}`,
    title: `Codex 登录 · ${accountId}`
  })
})

ipcMain.handle('codex:runtime:status', async (_event, verify = false): Promise<AiRuntimeStatus> =>
  inspectCodexRuntime(Boolean(verify), await resolveCodexHome(app.getPath('userData'))))

function sendManagedTaskEvent(task: ManagedTask): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('managed-tasks:event', task)
}

function managedTaskTitle(task: ManagedTask): string {
  return `[${managedTaskStageLabels[task.stage]}] ${task.title.replace(/^\[[^\]]+\]\s*/, '')}`
}

async function getManagedCodexThreadService(): Promise<CodexAppServerThreadService> {
  if (managedCodexThreadService) return managedCodexThreadService
  const codexHome = await resolveCodexHome(app.getPath('userData'))
  const command = await findLocalAiCommand('codex-cli', { env: { ...process.env, CODEX_HOME: codexHome } })
  if (!command) throw new Error('未检测到可用的 Codex App Server')
  managedCodexThreadService = new CodexAppServerThreadService({
    command,
    codexHome,
    onNotification: (notification: CodexAppServerNotification) => {
      if (!notification.method.startsWith('turn/') && !notification.method.startsWith('thread/')) return
      void syncManagedCodexThreads().catch(() => undefined)
    }
  })
  return managedCodexThreadService
}

async function mirrorManagedTaskTitle(task: ManagedTask): Promise<void> {
  if (!task.codexThreadId) return
  const codex = await getManagedCodexThreadService()
  await codex.renameThread(task.codexThreadId, managedTaskTitle(task))
}

async function advanceManagedTaskExecution(taskId: string): Promise<ManagedTask> {
  const task = managedTaskService.get(taskId)
  if (!task) throw new Error('任务不存在')
  if (task.stage !== 'executing') return task
  const repository = getRepositoryOrThrow(task.repositoryId)
  if (task.subtasks.some((item) => item.runStatus === 'running')) return task
  const nextSubtask = task.subtasks.find((item) => item.runStatus === 'idle' && item.dependencyIds.every((dependencyId) => task.subtasks.find((candidate) => candidate.id === dependencyId)?.runStatus === 'completed'))
  if (!nextSubtask) {
    if (task.subtasks.length > 0 && task.subtasks.every((item) => item.runStatus === 'completed')) {
      const workspace = await getRepositoryWorkspaceStatus(repository.id)
      const completed = managedTaskService.completeExecution(task.id, workspace.files.length > 0)
      await mirrorManagedTaskTitle(completed)
      return completed
    }
    return task
  }
  const codex = await getManagedCodexThreadService()
  const thread = await codex.startThread({ cwd: repository.localPath, title: `${task.title} · ${nextSubtask.title}`, sandbox: 'workspace-write' })
  const started = managedTaskService.startSubtask(task.id, nextSubtask.id, { id: thread.id, title: thread.name, cwd: repository.localPath, status: 'running', updatedAt: thread.updatedAt })
  await codex.startTurn({
    threadId: thread.id,
    cwd: repository.localPath,
    approvalPolicy: 'never',
    text: `在分支 ${started.branch} 上执行以下 ForgeDesk 子任务。只处理当前子任务；完成后说明改动、测试和未完成项。\n\n父任务：${started.title}\n子任务：${nextSubtask.title}\n说明：${nextSubtask.description}\n验收标准：${nextSubtask.acceptance}`
  })
  await mirrorManagedTaskTitle(started)
  return started
}

function managedThreadStatusFromSession(status: CodexSessionSummary['status']): string {
  if (status === 'aborted') return 'failed'
  return status
}

async function syncManagedCodexThreads(): Promise<ManagedTask[]> {
  const sessionSnapshot = await codexSessionService.list()
  let appThreads: Awaited<ReturnType<CodexAppServerThreadService['listThreads']>> = []
  try {
    appThreads = await (await getManagedCodexThreadService()).listThreads()
  } catch (error) {
    // The on-disk Codex session snapshot remains useful even when App Server is
    // temporarily unavailable. Only fail if neither source can provide data.
    if (!sessionSnapshot.available) throw error
  }

  // App Server fills gaps for ForgeDesk-created threads. The local snapshot is
  // authoritative for native desktop/CLI sessions and overwrites stale status,
  // title, cwd, and timestamp for the same thread id.
  const threads = new Map<string, ManagedTaskImportedThread>()
  for (const thread of appThreads) {
    threads.set(thread.id, { id: thread.id, title: thread.name, cwd: thread.cwd, status: thread.status, updatedAt: thread.updatedAt })
  }
  for (const session of sessionSnapshot.sessions) {
    threads.set(session.id, {
      id: session.id,
      title: session.title,
      cwd: session.cwd,
      status: managedThreadStatusFromSession(session.status),
      updatedAt: session.updatedAt
    })
  }

  const repositories = listRepositories()
  const result = new Map<string, ManagedTask>()
  for (const imported of threads.values()) {
    const repository = imported.cwd ? repositories.find((item) => resolve(item.localPath) === resolve(imported.cwd)) : undefined
    const binding = getDatabase().prepare('SELECT task_id, role FROM managed_task_thread_bindings WHERE codex_thread_id = ?').get(imported.id) as { task_id?: string; role?: string } | undefined
    const previous = managedTaskService.get(binding?.task_id || '')
    const task = previous ? managedTaskService.updateBinding(imported) : managedTaskService.importThread(imported, repository?.projectId || '', repository?.id || '')
    if (!task) continue
    if (previous?.stage === 'executing' && binding?.role === 'subtask' && ['completed', 'idle'].includes(imported.status) && repository) {
      result.set(task.id, await advanceManagedTaskExecution(task.id))
    } else {
      result.set(task.id, task)
    }
  }
  const tasks = [...result.values()]
  for (const task of tasks) sendManagedTaskEvent(task)
  return tasks
}

ipcMain.handle('managed-tasks:list', async (_event, projectId?: string): Promise<ManagedTask[]> => managedTaskService.list(projectId))

ipcMain.handle('managed-tasks:sync', async (): Promise<ManagedTask[]> => syncManagedCodexThreads())

ipcMain.handle('managed-tasks:cancel', async (_event, taskId: string): Promise<ManagedTask> => {
  const task = managedTaskService.get(taskId)
  if (!task) throw new Error('任务不存在')
  if (['completed', 'completed-no-changes', 'failed', 'cancelled'].includes(task.stage)) return task

  const threadIds = [...new Set([
    task.codexThreadId,
    ...task.bindings.map((binding) => binding.codexThreadId),
    ...task.subtasks.filter((subtask) => subtask.runStatus === 'running').map((subtask) => subtask.codexThreadId)
  ].filter(Boolean))]

  if (threadIds.length > 0) {
    try {
      const codex = await getManagedCodexThreadService()
      for (const threadId of threadIds) await codex.interruptRunningTurns(threadId)
    } catch (error) {
      // Running tasks must not be marked cancelled until Codex confirms the
      // interrupt request. Idle tasks can still be closed when App Server is
      // unavailable because they have no live execution to terminate.
      if (task.runStatus === 'running') throw error
    }
  }

  const cancelled = managedTaskService.cancel(task.id)
  try { await mirrorManagedTaskTitle(cancelled) } catch (error) { console.warn('Failed to mirror cancelled task title', error) }
  sendManagedTaskEvent(cancelled)
  return cancelled
})

ipcMain.handle('managed-tasks:import-legacy', async (_event, legacyTasks: ManagedTaskLegacyImport[]): Promise<ManagedTask[]> => {
  const repositories = listRepositories()
  const imported = legacyTasks.map((legacy) => {
    const repository = legacy.projectId ? repositories.find((item) => item.projectId === legacy.projectId) : undefined
    return managedTaskService.importLegacy(legacy, repository?.id, repository?.localPath)
  })
  for (const task of imported) sendManagedTaskEvent(task)
  return imported
})

ipcMain.handle('managed-tasks:create', async (_event, input: Omit<ManagedTaskCreateInput, 'codexThreadId' | 'cwd'>): Promise<ManagedTask> => {
  const repository = getRepositoryOrThrow(input.repositoryId)
  if (repository.projectId !== input.projectId) throw new Error('所选仓库不属于该项目')
  const codex = await getManagedCodexThreadService()
  const thread = await codex.startThread({ cwd: repository.localPath, title: input.title.trim(), sandbox: 'workspace-write' })
  const task = managedTaskService.create({ ...input, cwd: repository.localPath, codexThreadId: thread.id })
  const planning = managedTaskService.beginPlanning(task.id)
  try {
    await codex.startTurn({
      threadId: thread.id,
      cwd: repository.localPath,
      text: `请分析并拆分以下 ForgeDesk 任务。只输出可执行的子任务计划、依赖和验收标准，不要修改文件或运行命令。\n\n任务：${task.title}\n${task.description}`,
      outputSchema: { type: 'object', properties: { subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, acceptance: { type: 'string' }, dependencyIndexes: { type: 'array', items: { type: 'integer' } } }, required: ['title'] } } }, required: ['subtasks'] }
    })
    await mirrorManagedTaskTitle(planning)
    sendManagedTaskEvent(planning)
    return planning
  } catch (error) {
    const failed = managedTaskService.fail(task.id, error instanceof Error ? error.message : String(error))
    sendManagedTaskEvent(failed)
    return failed
  }
})

ipcMain.handle('managed-tasks:plan', async (_event, input: { taskId: string; subtasks: ManagedTaskPlanItem[] }): Promise<ManagedTask> => {
  const task = managedTaskService.setPlan(input.taskId, input.subtasks)
  await mirrorManagedTaskTitle(task)
  sendManagedTaskEvent(task)
  return task
})

ipcMain.handle('managed-tasks:execute', async (_event, input: { taskId: string; baseBranch?: string }): Promise<ManagedTask> => {
  const task = managedTaskService.get(input.taskId)
  if (!task) throw new Error('任务不存在')
  const repository = getRepositoryOrThrow(task.repositoryId)
  const baseBranch = input.baseBranch?.trim() || repository.defaultBranch || repository.currentBranch
  if (!baseBranch) throw new Error('请先选择任务基线分支')
  const slug = task.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'task'
  const branch = `codex/${task.id.replace('managed-task-', '').slice(0, 8)}-${slug}`
  const baselineSha = await runGitInPathStrict(repository.localPath, ['rev-parse', baseBranch])
  let next = managedTaskService.beginBranch(task.id, { branch, baseBranch, baselineSha })
  sendManagedTaskEvent(next)
  try {
    await switchRepositoryBranch(repository.id, { branchName: branch, create: true, startPoint: baseBranch })
    next = managedTaskService.startExecution(task.id)
    next = await advanceManagedTaskExecution(task.id)
    sendManagedTaskEvent(next)
    return next
  } catch (error) {
    next = managedTaskService.fail(task.id, error instanceof Error ? error.message : String(error))
    sendManagedTaskEvent(next)
    return next
  }
})

ipcMain.handle('managed-tasks:review:approve', async (_event, taskId: string): Promise<ManagedTask> => {
  const task = managedTaskService.approveReview(taskId); await mirrorManagedTaskTitle(task); sendManagedTaskEvent(task); return task
})

ipcMain.handle('managed-tasks:commit', async (_event, input: { taskId: string; message?: string }): Promise<ManagedTask> => {
  const task = managedTaskService.get(input.taskId); if (!task) throw new Error('任务不存在')
  const repository = getRepositoryOrThrow(task.repositoryId)
  const workspace = await getRepositoryWorkspaceStatus(repository.id)
  if (workspace.files.length > 0) {
    const message = input.message?.trim(); if (!message) throw new Error('检测到未提交变更，请填写提交信息')
    const committed = await commitRepositoryChanges(repository.id, { message })
    if (!committed.ok) throw new Error(committed.stderr || '提交失败')
  }
  const sha = await runGitInPathStrict(repository.localPath, ['rev-parse', 'HEAD'])
  const next = managedTaskService.recordCommit(task.id, sha); await mirrorManagedTaskTitle(next); sendManagedTaskEvent(next); return next
})

ipcMain.handle('managed-tasks:publish', async (_event, input: { taskId: string; targetBranch: 'develop' | 'preview' }): Promise<ManagedTask> => {
  const task = managedTaskService.get(input.taskId); if (!task) throw new Error('任务不存在')
  const repository = getRepositoryOrThrow(task.repositoryId)
  let next = managedTaskService.beginMerge(task.id, input.targetBranch); sendManagedTaskEvent(next)
  try {
    await switchRepositoryBranch(repository.id, { branchName: input.targetBranch })
    const analysis = await analyzeRepositoryMerge(repository.id, { source: task.branch, target: input.targetBranch })
    if (!analysis.ok) throw new Error(analysis.issues.join('；') || '合并预检失败')
    const merged = await runRepositoryWriteOperation(repository.id, buildGitMergeArgs({ source: task.branch }))
    if (!merged.ok) throw new Error(merged.stderr || '合并失败')
    next = managedTaskService.merged(task.id, merged.stdout)
    next = managedTaskService.beginPush(task.id); sendManagedTaskEvent(next)
    const pushed = await pushRepositoryChanges(repository.id, { branch: input.targetBranch })
    if (!pushed.ok) throw new Error(pushed.stderr || '推送失败')
    next = managedTaskService.completePublish(task.id, pushed.stdout); await mirrorManagedTaskTitle(next); sendManagedTaskEvent(next); return next
  } catch (error) {
    next = managedTaskService.fail(task.id, error instanceof Error ? error.message : String(error)); sendManagedTaskEvent(next); return next
  }
})

ipcMain.handle('codex:activity:snapshot', async (): Promise<CodexActivitySnapshot> => codexActivityService.snapshot())

ipcMain.handle('codex:sessions:list', async (): Promise<CodexSessionsSnapshot> => codexSessionService.list())

ipcMain.handle('codex:sessions:get', async (_event, sessionId: string): Promise<CodexSessionDetail> => codexSessionService.get(sessionId))

ipcMain.handle('codex:sessions:pin', async (_event, sessionId: string): Promise<CodexSessionSummary> => codexSessionService.togglePin(sessionId))

ipcMain.handle('codex:sessions:send', async (_event, input: CodexSessionMessageInput): Promise<CodexSessionDetail> => codexSessionService.sendMessage(input))

ipcMain.handle('codex:sessions:cancel', async (_event, sessionId: string): Promise<CodexSessionDetail> => codexSessionService.cancel(sessionId))

// A manual/page refresh is also the freshest monitor state for the title bar
// and any other open renderer. Broadcast it so separate polling intervals
// cannot leave different parts of the UI showing different run counts.
registerGitIpc('codex:project-monitor:snapshot', async (): Promise<CodexProjectMonitorSnapshot> => refreshCodexProjectMonitor())

ipcMain.handle('codex:sites:list', async (): Promise<CodexSite[]> => codexSiteService.list())

ipcMain.handle('codex:sites:create', async (_event, input: CodexSiteCreateInput): Promise<CodexSite> => codexSiteService.create(input))

ipcMain.handle('codex:sites:update', async (_event, input: CodexSiteUpdateInput): Promise<CodexSite> => codexSiteService.update(input))

ipcMain.handle('codex:sites:delete', async (_event, siteId: string): Promise<CodexSite[]> => codexSiteService.delete(siteId))

ipcMain.handle('codex:sites:preview:start', async (_event, siteId: string): Promise<CodexSite> => codexSiteService.startPreview(siteId))

ipcMain.handle('codex:sites:preview:stop', async (_event, siteId: string): Promise<CodexSite | null> => codexSiteService.stopPreview(siteId))

ipcMain.handle('codex:tasks:list', async (): Promise<CodexTaskRecord[]> => codexTaskService.list())

ipcMain.handle('codex:tasks:create', async (_event, input?: CodexTaskCreateInput): Promise<CodexTaskRecord> =>
  codexTaskService.create(input))

ipcMain.handle('codex:tasks:rename', async (_event, input: CodexTaskRenameInput): Promise<CodexTaskRecord> =>
  codexTaskService.rename(input))

ipcMain.handle('codex:tasks:send', async (_event, input: CodexTaskMessageInput): Promise<CodexTaskRecord> =>
  codexTaskService.sendMessage(input))

ipcMain.handle('codex:tasks:cancel', async (_event, taskId: string): Promise<CodexTaskRecord> =>
  codexTaskService.cancel(taskId))

ipcMain.handle('codex:tasks:delete', async (_event, taskId: string): Promise<CodexTaskRecord[]> =>
  codexTaskService.delete(taskId))

ipcMain.handle('codex:tasks:environment', async (_event, taskId: string): Promise<CodexTaskEnvironment> =>
  codexTaskService.environment(taskId))

ipcMain.handle('settings:ai:models:openrouter', async (): Promise<OpenRouterModel[]> => listOpenRouterModels())

ipcMain.handle('settings:ai:save', async (_event, input: Partial<AiSettings>): Promise<RedactedAiSettings> => {
  const currentSettings = await readAiSettingsFile(app.getPath('userData'))
  const nextSettings = await writeAiSettingsFile(app.getPath('userData'), {
    ...currentSettings,
    ...input,
    apiKey: input.apiKey === undefined ? currentSettings.apiKey : input.apiKey
  })

  return getRedactedAiSettings(nextSettings)
})

ipcMain.handle('overview:snapshot:get', async (): Promise<OverviewSnapshot> => readOverviewSnapshot(app.getPath('userData')))

ipcMain.handle('market-data:snapshot', async (_event, period?: MarketPeriod) => getMarketDataSnapshot(app.getPath('userData'), period ?? '1M'))

ipcMain.handle('overview:news:refresh', async (): Promise<OverviewNewsReport> => {
  const settings = await readAiSettingsFile(app.getPath('userData'))
  return refreshOverviewNews(app.getPath('userData'), settings)
})

ipcMain.handle('overview:projects:refresh', async (): Promise<OverviewProjectReport> => {
  const projects = listProjects()
  const contexts = await Promise.all(
    projects.map(async (project) => {
      const projectRepositories = listRepositories(project.id)
      const fetchFailures: string[] = []
      const refreshedRepositories = await Promise.all(
        projectRepositories.map(async (repository) => {
          if (repository.remotes.length === 0) return repository
          try {
            return await fetchRepositoryRemote(repository.id)
          } catch (error) {
            fetchFailures.push(`${repository.name}: ${error instanceof Error ? error.message : String(error)}`)
            return getRepositoryOrThrow(repository.id)
          }
        })
      )

      return {
        projectId: project.id,
        projectName: project.name,
        repositoryCount: refreshedRepositories.length,
        changedRepositories: refreshedRepositories.filter((repository) => repository.hasChanges).length,
        aheadRepositories: refreshedRepositories.filter((repository) => repository.ahead > 0).length,
        fetchFailures,
        repositories: refreshedRepositories.map((repository) => ({
          name: repository.name,
          branch: repository.currentBranch,
          latestCommit: repository.latestCommit,
          hasChanges: repository.hasChanges,
          ahead: repository.ahead
        }))
      }
    })
  )
  const settings = await readAiSettingsFile(app.getPath('userData'))
  return summarizeOverviewProjects(app.getPath('userData'), settings, contexts)
})

ipcMain.handle('system-monitor:snapshot', async (): Promise<SystemMonitorSnapshot> =>
  collectSystemMonitorSnapshot({
    appPath: app.getAppPath(),
    isDevelopmentBuild: !app.isPackaged,
    isDevServer: isDev,
    isPackaged: app.isPackaged,
    projectRoot: resolveForgeDeskProjectRoot(),
    version: app.getVersion()
  })
)

ipcMain.handle('system-resource:processes:current', async () => {
  const stored = listLatestProcesses(getDatabase())
  return stored.length > 0 ? stored : collectResourceProcesses()
})

ipcMain.handle('system-resource:history', async (_event, range?: { from?: string; to?: string }) => {
  const to = range?.to || new Date().toISOString()
  const from = range?.from || new Date(Date.now() - 24 * 3600_000).toISOString()
  return listResourceHistory(getDatabase(), from, to)
})

ipcMain.handle('system-resource:history:import', async (_event, points: Array<{ checkedAt: string; cpuLoadPercent: number; memoryUsagePercent: number; storageUsagePercent: number }>) =>
  importLegacyResourceHistory(getDatabase(), (Array.isArray(points) ? points : []).map((point) => ({
    capturedAt: String(point.checkedAt), cpuPercent: Number(point.cpuLoadPercent), memoryUsagePercent: Number(point.memoryUsagePercent),
    memoryUsedBytes: 0, swapUsedBytes: 0, storageUsagePercent: Number(point.storageUsagePercent)
  }))))

ipcMain.handle('system-resource:process:history', async (_event, identityKey: string, range?: { from?: string; to?: string }) => {
  const to = range?.to || new Date().toISOString()
  const from = range?.from || new Date(Date.now() - 24 * 3600_000).toISOString()
  return listProcessHistory(getDatabase(), String(identityKey), from, to)
})

ipcMain.handle('system-resource:analysis', async (_event, range?: { from?: string; to?: string }) => {
  const to = range?.to || new Date().toISOString()
  const from = range?.from || new Date(Date.now() - 7 * 86400_000).toISOString()
  return listProcessAnalysis(getDatabase(), from, to)
})

ipcMain.handle('system-resource:retention', async () => getResourceRetentionStatus(getDatabase()))

ipcMain.handle('system-resource:process:signal', async (_event, pid: number, force = false): Promise<void> => {
  await signalResourceProcess(getDatabase(), Number(pid), Boolean(force))
})

ipcMain.handle('system-resource:process:reveal', async (_event, path: string): Promise<void> => {
  const normalized = resolve(String(path || ''))
  if (!isAbsolute(normalized) || !existsSync(normalized)) throw new Error('进程路径不存在')
  shell.showItemInFolder(normalized)
})

ipcMain.handle('system-resource:analysis:export', async (_event, input: { format: 'csv' | 'json'; range?: { from?: string; to?: string } }) => {
  const to = input.range?.to || new Date().toISOString()
  const from = input.range?.from || new Date(Date.now() - 7 * 86400_000).toISOString()
  const rows = listProcessAnalysis(getDatabase(), from, to)
  const format = input.format === 'json' ? 'json' : 'csv'
  const result = await dialog.showSaveDialog({
    title: '导出资源分析',
    defaultPath: join(app.getPath('documents'), `ForgeDesk-resource-analysis-${new Date().toISOString().slice(0, 10)}.${format}`),
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true, path: '' }
  const content = format === 'json' ? JSON.stringify(rows, null, 2) : exportProcessAnalysisCsv(rows as ProcessAnalysis[])
  await writeFile(result.filePath, content, 'utf8')
  return { canceled: false, path: result.filePath }
})

ipcMain.handle('storage-governance:overview', async () => getStorageOverview(getDatabase()))

ipcMain.handle('storage-governance:directories:list', async (_event, query?: StorageDirectoryQuery) => listStorageDirectories(getDatabase(), query ?? {}))

ipcMain.handle('storage-governance:root:select', async () => {
  const result = await dialog.showOpenDialog({ title: '选择存储扫描目录', properties: ['openDirectory', 'multiSelections'] })
  if (!result.canceled) for (const path of result.filePaths) saveStorageRoot(getDatabase(), path)
  return getStorageOverview(getDatabase())
})

ipcMain.handle('storage-governance:root:save', async (_event, input: { path: string; label?: string; source?: 'manual' | 'project' | 'category' }) => {
  saveStorageRoot(getDatabase(), input.path, input.label, input.source)
  return getStorageOverview(getDatabase())
})

ipcMain.handle('storage-governance:root:delete', async (_event, rootId: string) => {
  deleteStorageRoot(getDatabase(), rootId)
  return getStorageOverview(getDatabase())
})

ipcMain.handle('storage-governance:category:set', async (_event, category: CleanupCategory, enabled: boolean) => {
  setCleanupCategoryAuthorization(getDatabase(), category, enabled)
  return getStorageOverview(getDatabase())
})

ipcMain.handle('storage-governance:scan:start', async (_event, mode: 'quick' | 'deep') =>
  startStorageScan(getDatabase(), mode === 'deep' ? 'deep' : 'quick', (progress: StorageScanProgress) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('storage-governance:scan:progress', progress)
  }))

ipcMain.handle('storage-governance:scan:pause', async (_event, scanId: string, paused: boolean): Promise<void> => pauseStorageScan(scanId, paused))
ipcMain.handle('storage-governance:duplicate:verify', async (_event, itemId: string) => verifyDuplicateGroup(getDatabase(), itemId))
ipcMain.handle('storage-governance:cleanup:preview', async (_event, itemIds: string[]) => previewCleanup(getDatabase(), itemIds))
ipcMain.handle('storage-governance:cleanup:execute', async (_event, itemIds: string[]) =>
  executeCleanupToTrash(getDatabase(), itemIds, (path) => shell.trashItem(path)))
ipcMain.handle('storage-governance:audit', async () => listCleanupAudit(getDatabase()))
ipcMain.handle('storage-governance:external:previews', async () => listExternalCleanupPreviews(getDatabase()))
ipcMain.handle('storage-governance:external:execute', async (_event, key: 'docker-images' | 'docker-containers' | 'docker-build-cache') => executeExternalCleanup(getDatabase(), key))

ipcMain.handle('system-resource:settings', async () => {
  const settings = getDatabase().prepare('SELECT * FROM system_monitor_settings WHERE id = 1').get() as Record<string, unknown>
  return { sampleIntervalSeconds: Number(settings.sample_interval_seconds), rawRetentionDays: Number(settings.raw_retention_days),
    fiveMinuteRetentionDays: Number(settings.five_minute_retention_days), loginStartEnabled: Number(settings.login_start_enabled) === 1 }
})

ipcMain.handle('system-resource:login-start:set', async (_event, enabled: boolean) => {
  getDatabase().prepare('UPDATE system_monitor_settings SET login_start_enabled = ? WHERE id = 1').run(enabled ? 1 : 0)
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: enabled })
  return { enabled }
})

ipcMain.handle('settings:oa:get', async (): Promise<RedactedOaSettings> => getRedactedOaSettings(await readOaSettingsFile(app.getPath('userData'))))

ipcMain.handle('settings:oa:save', async (_event, input: Partial<OaSettings>): Promise<RedactedOaSettings> => {
  const currentSettings = await readOaSettingsFile(app.getPath('userData'))
  const nextSettings = await writeOaSettingsFile(app.getPath('userData'), {
    ...currentSettings,
    ...input,
    larkAppSecret: input.larkAppSecret === undefined ? currentSettings.larkAppSecret : input.larkAppSecret,
    larkBotAdminToken: input.larkBotAdminToken === undefined ? currentSettings.larkBotAdminToken : input.larkBotAdminToken
  })

  return getRedactedOaSettings(nextSettings)
})

ipcMain.handle('settings:oa:open-docs', async (): Promise<void> => {
  const settings = await readOaSettingsFile(app.getPath('userData'))
  await shell.openExternal(settings.docsHomeUrl)
})

ipcMain.handle('settings:oa:documents:list', async (): Promise<LarkDocumentList> => listLarkDocuments(await readOaSettingsFile(app.getPath('userData'))))

ipcMain.handle('settings:oa:document:tasks', async (_event, document: LarkDocumentRecord): Promise<LarkDocumentTaskList> =>
  getLarkDocumentTasks(await readOaSettingsFile(app.getPath('userData')), document)
)

ipcMain.handle('settings:oa:bitable:get', async (_event, tableId?: string, viewId?: string): Promise<LarkBitableSnapshot> =>
  getLarkBitableSnapshot(await readOaSettingsFile(app.getPath('userData')), tableId, viewId)
)

ipcMain.handle('settings:oa:bitable:record:save', async (_event, input: { tableId: string; recordId?: string; fields: Record<string, unknown> }) =>
  saveLarkBitableRecord(await readOaSettingsFile(app.getPath('userData')), input)
)

ipcMain.handle('settings:oa:bitable:record:delete', async (_event, input: { tableId: string; recordId: string }): Promise<void> =>
  deleteLarkBitableRecord(await readOaSettingsFile(app.getPath('userData')), input)
)

ipcMain.handle('settings:oa:lark-bot:dashboard', async (): Promise<LarkBotDashboard> =>
  getLarkBotDashboard(await readOaSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:oa:lark-bot:tasks', async (_event, query?: { q?: string; status?: string }): Promise<LarkBotTask[]> =>
  listLarkBotTasks(await readOaSettingsFile(app.getPath('userData')), query)
)

ipcMain.handle('settings:oa:lark-bot:notifications', async (): Promise<LarkBotNotification[]> =>
  listLarkBotNotifications(await readOaSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:oa:lark-bot:settings:get', async (): Promise<LarkBotRuntimeSettings> =>
  getLarkBotSettings(await readOaSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:oa:lark-bot:settings:save', async (_event, input: Partial<LarkBotRuntimeSettings>): Promise<LarkBotRuntimeSettings> =>
  saveLarkBotSettings(await readOaSettingsFile(app.getPath('userData')), input)
)

ipcMain.handle('settings:oa:lark-bot:sync', async (): Promise<Record<string, unknown>> =>
  syncLarkBot(await readOaSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:oa:lark-bot:test-message', async (): Promise<void> =>
  sendLarkBotTestMessage(await readOaSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:oa:lark-bot:reminder', async (): Promise<void> =>
  sendLarkBotReminder(await readOaSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:github-tokens:list', async (): Promise<GithubTokenView[]> => listGithubTokens(app.getPath('userData')))

ipcMain.handle('settings:github-tokens:save', async (_event, input: GithubTokenInput): Promise<GithubTokenView[]> => saveGithubToken(app.getPath('userData'), input))

ipcMain.handle('settings:github-tokens:refresh', async (_event, tokenId: string): Promise<GithubTokenView[]> => refreshGithubToken(app.getPath('userData'), tokenId))

ipcMain.handle('settings:github-tokens:delete', async (_event, tokenId: string): Promise<GithubTokenView[]> => deleteGithubToken(app.getPath('userData'), tokenId))

ipcMain.handle('settings:codemagic-tokens:list', async (): Promise<CodemagicTokenView[]> => listCodemagicTokens(app.getPath('userData')))

ipcMain.handle('settings:codemagic-tokens:save', async (_event, input: CodemagicTokenInput): Promise<CodemagicTokenView[]> => saveCodemagicToken(app.getPath('userData'), input))

ipcMain.handle('settings:codemagic-tokens:refresh', async (_event, tokenId: string): Promise<CodemagicTokenView[]> => refreshCodemagicToken(app.getPath('userData'), tokenId))

ipcMain.handle('settings:codemagic-tokens:delete', async (_event, tokenId: string): Promise<CodemagicTokenView[]> => deleteCodemagicToken(app.getPath('userData'), tokenId))

ipcMain.handle('codemagic:teams:list', async (_event, tokenId: string) =>
  listCodemagicTeams(await getCodemagicTokenSecret(app.getPath('userData'), tokenId))
)

ipcMain.handle('codemagic:apps:list', async (_event, input: CodemagicAppListInput): Promise<CodemagicApp[]> =>
  listCodemagicApps(await getCodemagicTokenSecret(app.getPath('userData'), input.tokenId), {
    teamId: input.teamId,
    name: input.name
  })
)

ipcMain.handle('codemagic:artifact:public-url', async (_event, input: CodemagicArtifactPublicUrlInput): Promise<{ url: string; expiresAt: string }> =>
  createCodemagicArtifactPublicUrl(
    await getCodemagicTokenSecret(app.getPath('userData'), input.tokenId),
    input.secureFilename,
    input.expiresAt ?? Math.floor(Date.now() / 1000) + 60 * 60
  )
)

registerGitIpc('ssh:generate-key', async (_event, input: string | SshKeyGenerationInput): Promise<GitSetupStatus['sshPublicKeys'][number]> => {
  const comment = (typeof input === 'string' ? input : input.email).trim()

  if (!comment) {
    throw new Error('请先填写用于 SSH 公钥备注的邮箱')
  }

  await mkdir(sshDirectory, { recursive: true, mode: 0o700 })

  const keyPath =
    typeof input === 'string' || !input.keyName?.trim()
      ? await findAvailableSshKeyPath()
      : join(sshDirectory, normalizeSshKeyFileName(input.keyName, 'private'))

  if (existsSync(keyPath) || existsSync(`${keyPath}.pub`)) {
    throw new Error('同名 SSH 密钥已经存在，请换一个文件名')
  }

  await runSshKeygen(['-t', 'ed25519', '-C', comment, '-f', keyPath, '-N', ''])

  const publicKeyPath = `${keyPath}.pub`
  const keys = await readSshKeyInventory(sshDirectory, readSshFingerprint)
  const createdKey = keys.sshPublicKeys.find((key) => key.path === publicKeyPath)

  if (!createdKey) {
    throw new Error('SSH 公钥已生成，但读取失败，请重新检测')
  }

  return createdKey
})

ipcMain.handle('ssh:copy-public-key', async (_event, publicKeyPath: string): Promise<void> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(publicKeyPath), 'public')

  clipboard.writeText((await readFile(normalizedPath, 'utf8')).trim())
})

ipcMain.handle('ssh:copy-key-path', async (_event, path: string, kind: 'private' | 'public'): Promise<void> => {
  clipboard.writeText(resolveSshKeyFilePath(sshDirectory, expandHomePath(path), kind))
})

registerGitIpc('ssh:import-key', async (_event, input: SshKeyImportInput): Promise<GitSetupStatus> => {
  await importSshKeyFile(sshDirectory, input)
  return getGitSetupStatus()
})

registerGitIpc('ssh:delete-key', async (_event, path: string, kind: 'private' | 'public'): Promise<GitSetupStatus> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(path), kind)
  await deleteSshKeyFile(sshDirectory, normalizedPath, kind)

  if (kind === 'private') {
    await clearSshPassphrase(app.getPath('userData'), normalizedPath)
  }

  return getGitSetupStatus()
})

registerGitIpc('ssh:save-private-key-passphrase', async (_event, path: string, passphrase: string): Promise<GitSetupStatus> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(path), 'private')
  await saveSshPassphrase(app.getPath('userData'), normalizedPath, passphrase)
  return getGitSetupStatus()
})

registerGitIpc('ssh:clear-private-key-passphrase', async (_event, path: string): Promise<GitSetupStatus> => {
  const normalizedPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(path), 'private')
  await clearSshPassphrase(app.getPath('userData'), normalizedPath)
  return getGitSetupStatus()
})

registerGitIpc('ssh:fix-private-key-permissions', async (_event, path: string): Promise<GitSetupStatus> => {
  await fixSshPrivateKeyPermissions(sshDirectory, expandHomePath(path))
  return getGitSetupStatus()
})

registerGitIpc('ssh:derive-public-key', async (_event, privateKeyPath: string): Promise<GitSetupStatus> => {
  const normalizedPrivateKeyPath = resolveSshKeyFilePath(sshDirectory, expandHomePath(privateKeyPath), 'private')
  const publicKeyContent = await withSavedSshPassphrases((env) => runSshKeygen(['-y', '-f', normalizedPrivateKeyPath], env))

  if (!publicKeyContent.trim()) {
    throw new Error('无法从私钥生成公钥')
  }

  await writeFile(`${normalizedPrivateKeyPath}.pub`, `${publicKeyContent.trim()}\n`, { encoding: 'utf8', mode: 0o644 })
  return getGitSetupStatus()
})

ipcMain.handle('dialog:select-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a file',
    properties: ['openFile']
  })

  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:select-image', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg'] }],
    properties: ['openFile']
  })

  return result.canceled ? null : result.filePaths[0]
})

const imageMimeTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

async function readLocalImageData(imagePath: string): Promise<string | null> {
  if (!isAbsolute(imagePath)) return null
  const normalizedPath = resolve(imagePath)
  const extension = normalizedPath.slice(normalizedPath.lastIndexOf('.')).toLowerCase()
  const mimeType = imageMimeTypes[extension]
  if (!mimeType) return null
  const metadata = await stat(normalizedPath)
  if (metadata.size > 16 * 1024 * 1024) return null
  const contents = await readFile(normalizedPath)
  return `data:${mimeType};base64,${contents.toString('base64')}`
}

ipcMain.handle('clipboard:read-image', async (): Promise<string | null> => {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  const directory = join(tmpdir(), 'forgedesk-clipboard-images')
  await mkdir(directory, { recursive: true })
  const imagePath = join(directory, `clipboard-${Date.now()}-${randomUUID()}.png`)
  await writeFile(imagePath, image.toPNG())
  return imagePath
})

ipcMain.handle('file:read-image-data', async (_event, imagePath: string): Promise<string | null> => {
  try {
    return await readLocalImageData(imagePath)
  } catch {
    return null
  }
})

registerGitIpc('ssh:read-config', async (): Promise<SshConfigFile> => readSshConfigFile(sshDirectory))

registerGitIpc('ssh:write-config', async (_event, content: string): Promise<SshConfigFile> => writeSshConfigFile(sshDirectory, content))

ipcMain.handle('ssh:open-directory', async (): Promise<void> => {
  await mkdir(sshDirectory, { recursive: true, mode: 0o700 })
  await shell.openPath(sshDirectory)
})

registerAppUpdateIpc()

ipcMain.handle('app:runtime-info', (): AppRuntimeInfo => createAppRuntimeInfo())

ipcMain.handle('quick-build:start', async (_event, input?: QuickBuildStartInput): Promise<QuickBuildTaskSnapshot> => startQuickBuildTask(input))

ipcMain.handle('quick-build:get', async (): Promise<QuickBuildTaskSnapshot | null> => getQuickBuildTaskSnapshot())

ipcMain.handle('quick-build:cancel', async (): Promise<QuickBuildTaskSnapshot> => cancelQuickBuildTask())

ipcMain.handle('quick-build:restart-app', async (_event, input?: QuickBuildRestartInput): Promise<QuickBuildRestartResult> => restartQuickBuildApp(input))

ipcMain.handle('tools:rsa-private-keys:list', async (): Promise<RsaPrivateKeyRecord[]> => listRsaPrivateKeyRecords(getDatabase()))

ipcMain.handle('tools:rsa-private-keys:create', async (_event, input: RsaPrivateKeyCreateInput): Promise<RsaPrivateKeyRecord> => {
  return createRsaPrivateKeyRecord(getDatabase(), input)
})

ipcMain.handle('tools:rsa-private-keys:update', async (_event, input: RsaPrivateKeyUpdateInput): Promise<RsaPrivateKeyRecord> => {
  return updateRsaPrivateKeyRecord(getDatabase(), input)
})

ipcMain.handle('tools:rsa-private-keys:delete', async (_event, id: string): Promise<RsaPrivateKeyRecord[]> => {
  return deleteRsaPrivateKeyRecord(getDatabase(), id)
})

ipcMain.handle('tools:cli-environment:inspect', async (): Promise<CliEnvironmentSnapshot> => inspectCliEnvironment())

ipcMain.handle('tools:cli-environment:repair', async (): Promise<CliEnvironmentRepairResult> => repairCliEnvironment())

ipcMain.handle('tools:monthly-performance:preview', async (_event, input: MonthlyPerformancePreviewInput): Promise<MonthlyPerformancePreview> => {
  return createMonthlyPerformancePreview(input)
})

ipcMain.handle('tools:monthly-performance:export', async (_event, input: MonthlyPerformanceExportInput): Promise<MonthlyPerformanceExportResult> => {
  return exportMonthlyPerformanceWorkbook(input)
})

ipcMain.handle('tools:monthly-performance:sessions:list', async (): Promise<MonthlyPerformanceSession[]> => {
  return listMonthlyPerformanceSessions(getDatabase())
})

ipcMain.handle('tools:monthly-performance:sessions:create', async (_event, input: MonthlyPerformanceSessionCreateInput): Promise<MonthlyPerformanceSession> => {
  return createMonthlyPerformanceSessionRecord(input)
})

ipcMain.handle('tools:monthly-performance:sessions:message', async (_event, input: MonthlyPerformanceSessionMessageInput): Promise<MonthlyPerformanceSession> => {
  return sendMonthlyPerformanceSessionMessage(input)
})

ipcMain.handle('tools:monthly-performance:sessions:confirm', async (_event, input: { sessionId: string; projectId: string; month: string }): Promise<MonthlyPerformanceSession> => {
  return confirmMonthlyPerformanceSession(input)
})

ipcMain.handle('tools:monthly-performance:sessions:export', async (_event, input: MonthlyPerformanceSessionExportInput): Promise<MonthlyPerformanceSession> => {
  return exportMonthlyPerformanceSession(input)
})

ipcMain.handle('terminal:remote-groups:list', async (): Promise<TerminalRemoteGroupRecord[]> => listTerminalRemoteGroupRecords(getDatabase()))

ipcMain.handle('terminal:remote-group:save', async (_event, input: TerminalRemoteGroupInput): Promise<TerminalRemoteGroupRecord> => {
  return saveTerminalRemoteGroupRecord(getDatabase(), input)
})

ipcMain.handle('terminal:remote-group:delete', async (_event, groupId: string): Promise<TerminalRemoteGroupRecord[]> => {
  return deleteTerminalRemoteGroupRecord(getDatabase(), groupId)
})

ipcMain.handle('terminal:remote-hosts:list', async (): Promise<TerminalRemoteHostRecord[]> => listTerminalRemoteHostRecords(getDatabase()))

ipcMain.handle('terminal:remote-host:save', async (_event, input: TerminalRemoteHostInput): Promise<TerminalRemoteHostRecord> => {
  return saveTerminalRemoteHostRecord(getDatabase(), input)
})

ipcMain.handle('terminal:remote-host:delete', async (_event, hostId: string): Promise<TerminalRemoteHostRecord[]> => {
  return deleteTerminalRemoteHostRecord(getDatabase(), hostId)
})

ipcMain.handle('terminal:remote-host:ssh-command', async (_event, hostId: string): Promise<string> => {
  const host = listTerminalRemoteHostRecords(getDatabase()).find((item) => item.id === hostId)

  if (!host) {
    throw new Error('远程快捷连接不存在')
  }

  return buildTerminalRemoteSshCommand(host)
})

registerTerminalIpc(ipcMain, terminalService)
registerDockerIpc(ipcMain, createDockerIpcService(() => getDatabase(), () => BrowserWindow.getAllWindows()))

ipcMain.handle('external:open-git-download', async (): Promise<void> => {
  await shell.openExternal('https://git-scm.com/downloads')
})

ipcMain.handle('external:open-app-releases', async (): Promise<void> => {
  await shell.openExternal('https://github.com/IEatLemons/ForgeDesk/releases')
})

ipcMain.handle('external:open-url', async (_event, url: string): Promise<void> => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('只允许打开 HTTP 或 HTTPS 链接')
  await shell.openExternal(parsed.toString())
})

function startStorageGovernanceScheduler(): void {
  if (storageGovernanceTimer) return
  const check = async (): Promise<void> => {
    const db = getDatabase()
    const roots = db.prepare('SELECT COUNT(*) count FROM storage_roots WHERE enabled = 1').get() as { count?: number }
    if (!Number(roots.count)) return
    const settings = db.prepare('SELECT last_quick_scan_at, last_deep_scan_at FROM system_monitor_settings WHERE id = 1').get() as Record<string, unknown>
    const lastQuick = Date.parse(String(settings.last_quick_scan_at || '')) || 0
    const lastDeep = Date.parse(String(settings.last_deep_scan_at || '')) || 0
    const now = Date.now()
    const progress = (event: StorageScanProgress): void => BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('storage-governance:scan:progress', event))
    if (now - lastDeep >= 7 * 86400_000 && !powerMonitor.isOnBatteryPower() && powerMonitor.getSystemIdleTime() >= 300) await startStorageScan(db, 'deep', progress)
    else if (now - lastQuick >= 86400_000) await startStorageScan(db, 'quick', progress)
  }
  storageGovernanceTimer = setInterval(() => void check().catch((error) => console.warn('Scheduled storage scan skipped', error)), 3600_000)
  storageGovernanceTimer.unref?.()
  setTimeout(() => void check().catch((error) => console.warn('Initial storage scan skipped', error)), 30_000).unref?.()
}

app.whenReady().then(async () => {
  await syncActiveCodexHome(app.getPath('userData')).catch((error) => console.warn('Failed to sync active Codex account', error))

  if (process.platform === 'darwin' && existsSync(appIconPath)) {
    app.dock?.setIcon(appIconPath)
  }

  menuBarManagerService = new MenuBarManagerService({
    app,
    getWindows: () => BrowserWindow.getAllWindows(),
    globalShortcut,
    ipcMain,
    resourcesPath: process.resourcesPath,
    shell
  })
  await menuBarManagerService.initialize().catch((error) => console.warn('Failed to initialize menu bar manager', error))

  const codexApiService = await getCodexApiService(app.getPath('userData'))
  if (codexApiService.enabled) {
    await startCodexApiService(app.getPath('userData')).catch((error) => console.warn('Failed to start Codex API service', error))
  }

  installApplicationMenu()
  const openedAsHidden = app.isPackaged && app.getLoginItemSettings().wasOpenedAsHidden
  createWindow(!openedAsHidden)
  void refreshCodexProjectMonitor(false).catch((error) => console.warn('Initial Codex project monitor check skipped', error))
  startServiceMonitorScheduler()
  resourceMonitorService.start()
  startStorageGovernanceScheduler()
  const monitorSettings = getDatabase().prepare('SELECT login_start_enabled FROM system_monitor_settings WHERE id = 1').get() as { login_start_enabled?: number }
  if (app.isPackaged && Number(monitorSettings.login_start_enabled) === 1) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
  }

  app.on('activate', () => {
    showOrCreatePrimaryWindow()
  })
})

if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    showOrCreatePrimaryWindow()
  })
}

app.on('before-quit', (event) => {
  if (forceQuitRequested || isAppUpdateQuitRequested()) {
    return
  }

  event.preventDefault()
  void requestAppQuit()
})

app.on('will-quit', () => {
  releaseSingleProcessFileLock?.()
  void menuBarManagerService?.shutdown().catch((error) => console.warn('Failed to stop menu bar helper', error))
  resourceMonitorService.stop()
  if (storageGovernanceTimer) clearInterval(storageGovernanceTimer)
  void stopCodexApiService(app.getPath('userData'), false).catch((error) => console.warn('Failed to stop Codex API service', error))
  runResourceRetention(getDatabase())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
