export type WorkStatus = 'todo' | 'doing' | 'review' | 'done' | 'cancelled'
export type ProgressPriority = 'low' | 'medium' | 'high'
export type ProgressScopeKind = 'goal' | 'milestone' | 'version'
export type ExecutionStatus = 'queued' | 'running' | 'waiting' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled' | 'unknown'
export type ExecutionPurpose = 'planning' | 'implementation' | 'review' | 'verification'

export type WorkBlocker = {
  id: string
  reason: string
  ownerRef: string
  nextAction: string
  createdAt: string
  resolvedAt: string | null
  resolution: string
}

export type ProjectWorkItem = {
  id: string
  projectId: string | null
  parentId: string | null
  sortOrder: number
  trackingState: 'inbox' | 'tracked'
  goalId: string | null
  keyResultId: string | null
  milestoneId: string | null
  versionId: string | null
  title: string
  description: string
  acceptanceText: string
  status: WorkStatus
  priority: ProgressPriority
  ownerRef: string
  startDate: string | null
  dueDate: string | null
  tags: string[]
  dependencyIds: string[]
  blockers: WorkBlocker[]
  origin: 'native' | 'legacy_todo' | 'managed_task' | 'ai_conversation' | 'external'
  authority: 'native' | 'external'
  completionBasis: 'manual_acceptance' | 'legacy_user_marked' | null
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  archivedAt: string | null
  scopeRevision: number
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export type ProgressEntity = {
  id: string
  kind: ProgressScopeKind
  projectId: string
  title: string
  description: string
  criteriaText: string
  ownerRef: string
  targetDate: string | null
  status: 'draft' | 'active' | 'achieved' | 'cancelled' | 'planned' | 'closed' | 'archived'
  progressMode?: 'legacy_tasks' | 'key_results'
  completedAt: string | null
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export type ProgressKeyResult = {
  id: string
  projectId: string
  goalId: string
  title: string
  measurement: 'numeric' | 'deliverable'
  criteriaText: string
  ownerRef: string
  targetDate: string | null
  baselineValue: number | null
  currentValue: number | null
  targetValue: number | null
  direction: 'increase' | 'decrease'
  unit: string
  status: 'active' | 'achieved' | 'cancelled'
  evidence: string
  completedAt: string | null
  rowVersion: number
  createdAt: string
  updatedAt: string
}
export type KeyResultInput = Pick<ProgressKeyResult, 'projectId' | 'goalId' | 'title' | 'measurement'> & Partial<Pick<ProgressKeyResult, 'id' | 'criteriaText' | 'ownerRef' | 'targetDate' | 'baselineValue' | 'currentValue' | 'targetValue' | 'direction' | 'unit'>>
export type ProgressRelation = { kind: 'milestone_result' | 'version_milestone'; projectId: string; sourceId: string; targetId: string }
export type GoalResultStats = { total: number; achieved: number; percent: number | null; readyForAcceptance: boolean; unfinishedTasks: number; overdue: number; blocked: number }
export type KeyResultStats = { percent: number; readyForAcceptance: boolean; support: ProgressStats }
export type ProgressDeliveryStats = { tasksTotal: number; tasksAccepted: number; checkpointsTotal: number; checkpointsAccepted: number; readyForAcceptance: boolean }
export type ProgressObject = { kind: 'task' | 'key_result' | ProgressScopeKind; id: string }

export type ProgressEvent = {
  id: string
  projectId: string | null
  entityId: string
  entityType: 'task' | 'key_result' | ProgressScopeKind | 'execution'
  eventType: string
  actorType: 'user' | 'system' | 'migration'
  before: unknown
  after: unknown
  commandId: string
  occurredAt: string
}

export type ProgressExecution = {
  id: string
  workItemId: string
  purpose: ExecutionPurpose
  provider: string
  repositoryId: string
  cwd: string
  status: ExecutionStatus
  phase: string
  legacyStage: string
  attemptNo: number
  commandId: string
  managedTaskId: string | null
  threadId: string | null
  providerTurnId: string | null
  scopeRevision: number
  planSnapshot: unknown
  resultSummary: string
  errorMessage: string
  startedAt: string | null
  finishedAt: string | null
  lastObservedAt: string
  historyCompleteness: 'complete' | 'summary'
  createdAt: string
  delivery?: { branch: string; baseBranch: string; baselineSha: string; commitSha: string; targetBranch: string; events: Array<{stage:string;message:string;detail:string;createdAt:string}> }
  threadLinks?: Array<{threadId:string;role:string}>
}

export type ProgressPlanItem = {
  id: string
  existingWorkItemId?: string
  title: string
  description: string
  acceptanceText: string
  dependencyIds: string[]
}

export type ProgressPlanDraft = {
  id: string
  workItemId: string
  executionId: string | null
  baseScopeRevision: number
  draftVersion: number
  items: ProgressPlanItem[]
  status: 'draft' | 'applied' | 'discarded'
  createdAt: string
  appliedAt: string | null
}

export type ProgressStats = {
  total: number
  done: number
  todo: number
  doing: number
  review: number
  blocked: number
  overdue: number
  dueToday: number
  rootTasks: number
  awaitingParentAcceptance: number
  inbox: number
  percent: number | null
}

export type MigrationIssue = { sourceId: string; message: string; severity: 'warning' | 'error' }
export type ProgressMigration = {
  id: string
  inputHash: string
  status: 'prepared' | 'activated' | 'failed'
  legacyCount: number
  managedCount: number
  workItemCount: number
  duplicateCount: number
  reviewCount: number
  issues: MigrationIssue[]
  createdAt: string
  activatedAt: string | null
  backupPath: string | null
}

export type ProgressSnapshotQuery = {
  projectId?: string
  includeArchivedProjects?: boolean
  scopeId?: string
  asOf?: string
  timezone?: string
}
export type ProgressSourceLink = {sourceSystem:string;sourceScope:string;sourceType:string;sourceId:string;workItemId:string}

export type ProjectProgressSnapshot = {
  active: boolean
  items: ProjectWorkItem[]
  entities: ProgressEntity[]
  keyResults: ProgressKeyResult[]
  relations: ProgressRelation[]
  goalStats: Record<string, GoalResultStats>
  keyResultStats: Record<string, KeyResultStats>
  deliveryStats: Record<string, ProgressDeliveryStats>
  executions: ProgressExecution[]
  drafts: ProgressPlanDraft[]
  events: ProgressEvent[]
  sourceLinks: ProgressSourceLink[]
  stats: ProgressStats
  scopeStats: Record<string, ProgressStats>
  migration: ProgressMigration | null
  asOf: string
  timezone: string
}

export type WorkItemFields = Pick<ProjectWorkItem, 'title' | 'description' | 'acceptanceText' | 'priority' | 'ownerRef' | 'startDate' | 'dueDate' | 'tags'>
export type WorkScopeFields = Pick<ProjectWorkItem, 'projectId' | 'goalId' | 'milestoneId' | 'versionId'> & { keyResultId?: string | null }
export type ProgressCommand = { commandId: string } & (
  | { type: 'create'; input: Partial<WorkItemFields & WorkScopeFields> & { title: string; parentId?: string | null } }
  | { type: 'update'; id: string; expectedVersion: number; patch: Partial<WorkItemFields> }
  | { type: 'move'; id: string; expectedVersion: number; scope: WorkScopeFields }
  | { type: 'transition'; id: string; expectedVersion: number; action: 'start' | 'review' | 'accept' | 'reopen' | 'cancel' | 'archive' | 'unarchive'; reason?: string }
  | { type: 'dependencies'; id: string; expectedVersion: number; dependencyIds: string[] }
  | { type: 'block'; id: string; expectedVersion: number; reason: string; ownerRef?: string; nextAction?: string }
  | { type: 'unblock'; id: string; expectedVersion: number; blockerId: string; resolution: string }
  | { type: 'save-entity'; kind: ProgressScopeKind; input: Pick<ProgressEntity, 'projectId' | 'title'> & Partial<Pick<ProgressEntity, 'id' | 'description' | 'criteriaText' | 'ownerRef' | 'targetDate' | 'status'>>; expectedVersion?: number }
  | { type: 'transition-entity'; id: string; kind: ProgressScopeKind; expectedVersion: number; action: 'accept' | 'reopen' | 'cancel' | 'archive'; reason?: string }
  | { type: 'save-key-result'; input: KeyResultInput; expectedVersion?: number }
  | { type: 'measure-key-result'; id: string; expectedVersion: number; value: number; evidence: string }
  | { type: 'transition-key-result'; id: string; expectedVersion: number; action: 'accept' | 'reopen' | 'cancel'; evidence: string }
  | { type: 'set-progress-relations'; id: string; expectedVersion: number; kind: ProgressRelation['kind']; targetIds: string[] }
  | { type: 'upgrade-goal'; id: string; expectedVersion: number; keyResults: KeyResultInput[] }
  | { type: 'save-draft'; id: string; expectedVersion: number; items: ProgressPlanItem[]; executionId?: string }
  | { type: 'apply-draft'; draftId: string; expectedVersion: number; draftVersion: number }
  | { type: 'discard-draft'; id: string; expectedVersion: number; draftId: string; draftVersion: number }
)

export type ProgressCommandResult = { entityId: string }
export type ProgressAiInput = {
  action: 'plan' | 'execute' | 'cancel' | 'read-plan' | 'sync'
  workItemId: string
  repositoryId?: string
  executionId?: string
  commandId: string
}

export type ProjectProgressApi = {
  getProjectProgress: (query?: ProgressSnapshotQuery) => Promise<ProjectProgressSnapshot>
  getProjectProgressHistory: (query: ProgressHistoryQuery) => Promise<ProgressHistoryPage>
  runProjectProgressCommand: (command: ProgressCommand) => Promise<ProgressCommandResult>
  previewProjectProgressMigration: (input: { legacyRaw: string | null }) => Promise<ProgressMigration>
  activateProjectProgressMigration: (input: { batchId: string; inputHash: string; legacyRaw: string | null }) => Promise<ProgressMigration>
  runProjectProgressAi: (input: ProgressAiInput) => Promise<ProgressExecution | ProgressPlanDraft | null>
  onProjectProgressUpdated: (listener: () => void) => () => void
}

export type ProgressHistoryQuery = { object: ProgressObject; projectId?: string | null; cursor?: string; limit?: number }
export type ProgressHistoryPage = { events: ProgressEvent[]; nextCursor: string | null }

export function keyResultPercent(result: ProgressKeyResult): number {
  if (result.measurement === 'deliverable') return result.status === 'achieved' ? 100 : 0
  const { baselineValue: baseline, currentValue: current, targetValue: target } = result
  if (baseline === null || current === null || target === null || target === baseline) return 0
  const span = target - baseline
  const ratio = Number.isFinite(span) ? (current - baseline) / span : (current / 2 - baseline / 2) / (target / 2 - baseline / 2)
  return Math.max(0, Math.min(100, ratio * 100))
}
export function keyResultReached(result: ProgressKeyResult): boolean {
  return result.measurement === 'deliverable' ? result.status === 'achieved' : result.currentValue !== null && result.targetValue !== null && (result.direction === 'increase' ? result.currentValue >= result.targetValue : result.currentValue <= result.targetValue)
}
