import type { ProjectWorkItem, ProgressPlanDraft, WorkStatus, ProgressEntity, ProgressKeyResult, ProgressRelation } from '../../shared/project-progress.js'

export const workStatusLabels: Record<WorkStatus,string> = { todo:'待办',doing:'进行中',review:'待验收',done:'已完成',cancelled:'已取消' }
export const workStatusColors: Record<WorkStatus,string> = { todo:'default',doing:'processing',review:'warning',done:'success',cancelled:'default' }
export const progressEventLabels: Record<string,string> = {created:'创建任务',migrated:'迁移历史任务',update:'更新资料与日期',move:'调整归属与范围',start:'开始任务',review:'提交验收',accept:'验收通过',reopen:'重新打开',cancel:'取消任务',archive:'归档',unarchive:'恢复归档',dependencies:'调整前置依赖',block:'记录阻塞',unblock:'解除阻塞',saved:'更新目标或计划','scope-reopened':'范围变化，重新等待达成确认','plan-drafted':'保存计划草稿','plan-applied':'应用计划','plan-removed':'从计划中移出','plan-discarded':'放弃草稿','execution-created':'创建 AI 执行','execution-state':'更新执行状态','execution-started':'开始 AI 执行','project-removed':'项目删除，工作项保留到收件箱'}
export type WorkTreeRow = ProjectWorkItem & { children?: WorkTreeRow[] }
Object.assign(progressEventLabels, {
  'key-result-saved':'保存关键结果', 'key-result-measured':'记录结果测量', 'key-result-accept':'关键结果验收通过',
  'key-result-reopen':'重开关键结果', 'key-result-cancel':'取消关键结果', 'relations-changed':'调整交付关联', 'goal-upgraded':'升级目标衡量口径'
})
export type WorkFilters = { query: string; status: string; scopeId: string; inbox: boolean; archived: boolean }

// Relationships explain delivery provenance; they never expand a version's task scope.
export function relatedDeliveryGoalIds(entity: Pick<ProgressEntity,'id'|'kind'>, items: ProjectWorkItem[], results: Pick<ProgressKeyResult,'id'|'goalId'>[], relations: ProgressRelation[]): string[] {
  const milestones=new Set(entity.kind==='milestone'?[entity.id]:relations.filter(link=>link.kind==='version_milestone'&&link.sourceId===entity.id).map(link=>link.targetId))
  const resultIds=new Set(relations.filter(link=>link.kind==='milestone_result'&&milestones.has(link.sourceId)).map(link=>link.targetId))
  return [...new Set([...items.filter(task=>milestones.has(task.milestoneId||'')||(entity.kind==='version'&&task.versionId===entity.id)).map(task=>task.goalId),...results.filter(result=>resultIds.has(result.id)).map(result=>result.goalId)].filter((id):id is string=>!!id))]
}

export function filterProgressItems(items: ProjectWorkItem[], filters: WorkFilters): WorkTreeRow[] {
  const matches = (item: ProjectWorkItem): boolean => (!filters.status || item.status === filters.status) && (!filters.query || `${item.title} ${item.description} ${item.ownerRef} ${item.tags.join(' ')}`.toLowerCase().includes(filters.query.toLowerCase()))
  return items.filter(item=>!item.parentId && (filters.archived || !item.archivedAt) && (filters.inbox ? item.trackingState === 'inbox' : item.trackingState === 'tracked') && (!filters.scopeId || [item.goalId,item.keyResultId,item.milestoneId,item.versionId].includes(filters.scopeId)))
    .flatMap(root=>{
      const children = items.filter(item=>item.parentId===root.id && (filters.archived || !item.archivedAt))
      const selected = children.filter(matches)
      const visible = matches(root) && !filters.status ? children : selected
      return matches(root) || selected.length ? [{...root,children:visible.length ? visible : undefined}] : []
    })
}

export function describePlanChanges(items: ProjectWorkItem[], draft: ProgressPlanDraft) {
  const previous=items.filter(item=>item.parentId===draft.workItemId)
  const retained=new Set(draft.items.map(item=>item.existingWorkItemId).filter(Boolean))
  return {
    added:draft.items.filter(item=>!item.existingWorkItemId),
    changed:draft.items.filter(item=>item.existingWorkItemId && previous.some(old=>old.id===item.existingWorkItemId && (old.title!==item.title || old.description!==item.description || old.acceptanceText!==item.acceptanceText || JSON.stringify([...old.dependencyIds].sort())!==JSON.stringify(item.dependencyIds.map(id=>draft.items.find(node=>node.id===id)?.existingWorkItemId||id).sort())))),
    removed:previous.filter(item=>!retained.has(item.id) && item.status!=='cancelled')
  }
}

export function progressTimeline(items: WorkTreeRow[]) {
  const dates=items.flatMap(item=>[item.startDate,item.dueDate,...(item.children??[]).flatMap(child=>[child.startDate,child.dueDate])]).filter((value):value is string=>!!value).sort()
  if(!dates.length)return null
  const start=Date.parse(`${dates[0]}T00:00:00Z`),end=Date.parse(`${dates.at(-1)}T00:00:00Z`),days=Math.max(1,Math.round((end-start)/86400000)+1)
  return {startDate:dates[0],endDate:dates.at(-1)!,days,rows:items.flatMap(item=>[item,...(item.children??[])]).map(item=>{
    const first=item.startDate||item.dueDate,last=item.dueDate||item.startDate
    return {item,offset:first?(Date.parse(`${first}T00:00:00Z`)-start)/86400000:0,duration:first&&last?Math.max(1,(Date.parse(`${last}T00:00:00Z`)-Date.parse(`${first}T00:00:00Z`))/86400000+1):0}
  })}
}
