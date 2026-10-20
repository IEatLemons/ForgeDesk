import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describePlanChanges, filterProgressItems, progressTimeline, relatedDeliveryGoalIds, type WorkFilters } from './project-progress-view.js'
import type { ProjectWorkItem, ProgressPlanDraft } from '../../shared/project-progress.js'

function item(id:string,patch:Partial<ProjectWorkItem>={}):ProjectWorkItem{
  return {id,title:id,projectId:'p',parentId:null,sortOrder:0,trackingState:'tracked',goalId:null,keyResultId:null,milestoneId:null,versionId:null,description:'',acceptanceText:'',status:'todo',priority:'medium',ownerRef:'',startDate:null,dueDate:null,tags:[],dependencyIds:[],blockers:[],origin:'native',authority:'native',completionBasis:null,startedAt:null,completedAt:null,cancelledAt:null,archivedAt:null,scopeRevision:1,rowVersion:1,createdAt:'2026-10-15T00:00:00Z',updatedAt:'2026-10-15T00:00:00Z',...patch}
}
const filters:WorkFilters={query:'',status:'',scopeId:'',inbox:false,archived:false}
describe('project progress views',()=>{
  it('keeps root context when searching a matching child, without including unrelated children',()=>{
    const rows=filterProgressItems([item('parent'),item('one',{parentId:'parent',tags:['关键']}),item('two',{parentId:'parent'})],{...filters,query:'关键'})
    assert.equal(rows[0].id,'parent');assert.deepEqual(rows[0].children?.map(child=>child.id),['one'])
  })
  it('uses explicit inbox and archive filters without discarding stored data',()=>{
    const items=[item('tracked'),item('inbox',{trackingState:'inbox'}),item('archived',{archivedAt:'2026-10-15T00:00:00Z'})]
    assert.deepEqual(filterProgressItems(items,filters).map(item=>item.id),['tracked'])
    assert.deepEqual(filterProgressItems(items,{...filters,inbox:true}).map(item=>item.id),['inbox'])
    assert.equal(filterProgressItems(items,{...filters,archived:true}).length,2)
  })
  it('filters child status while keeping the parent as context',()=>{
    const rows=filterProgressItems([item('root',{status:'done'}),item('done',{parentId:'root',status:'done'}),item('cancelled',{parentId:'root',status:'cancelled'})],{...filters,status:'done'})
    assert.deepEqual(rows[0].children?.map(item=>item.id),['done'])
  })
  it('filters supporting tasks by outcome without duplicating parent and child projections',()=>{
    const rows=filterProgressItems([item('root',{goalId:'g',keyResultId:'kr'}),item('child',{parentId:'root',goalId:'g',keyResultId:'kr'}),item('other',{goalId:'g'})],{...filters,scopeId:'kr'})
    assert.equal(rows.length,1);assert.equal(rows[0].children?.length,1)
  })
  it('traces release goals through milestone tasks and outcomes without expanding task membership',()=>{
    const items=[item('direct',{goalId:'g1',versionId:'v'}),item('milestone-task',{goalId:'g2',milestoneId:'m'}),item('unrelated',{goalId:'g4'})]
    const results=[{id:'kr',goalId:'g3'}]
    const relations=[{kind:'version_milestone' as const,sourceId:'v',targetId:'m',projectId:'p'},{kind:'milestone_result' as const,sourceId:'m',targetId:'kr',projectId:'p'}]
    assert.deepEqual(relatedDeliveryGoalIds({id:'v',kind:'version'},items,results,relations),['g1','g2','g3'])
    assert.deepEqual(filterProgressItems(items,{...filters,scopeId:'v'}).map(task=>task.id),['direct'])
  })
  it('uses calendar days across daylight-saving transitions and includes unscheduled work',()=>{
    const rows=filterProgressItems([item('root',{startDate:'2026-03-07',dueDate:'2026-03-09'}),item('unscheduled',{parentId:'root'})],filters)
    const timeline=progressTimeline(rows)!
    assert.equal(timeline.days,3);assert.equal(timeline.rows[0].duration,3);assert.equal(timeline.rows[1].duration,0)
    assert.equal(progressTimeline([item('no-dates')]),null)
  })
  it('detects dependency-only plan changes and preserves explicitly mapped node identities',()=>{
    const items=[item('root'),item('a',{parentId:'root'}),item('b',{parentId:'root'})]
    const draft:ProgressPlanDraft={id:'draft',workItemId:'root',executionId:null,baseScopeRevision:1,draftVersion:1,status:'draft',createdAt:'',appliedAt:null,items:[{id:'draft-a',existingWorkItemId:'a',title:'a',description:'',acceptanceText:'',dependencyIds:[]},{id:'draft-b',existingWorkItemId:'b',title:'b',description:'',acceptanceText:'',dependencyIds:['draft-a']}]}
    const changes=describePlanChanges(items,draft)
    assert.equal(changes.added.length,0);assert.equal(changes.removed.length,0);assert.equal(changes.changed[0]?.existingWorkItemId,'b')
  })
})
