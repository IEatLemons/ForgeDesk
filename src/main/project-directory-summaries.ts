import type { ProjectOperations } from '../shared/project-operations'
import type { DirectoryTaskSummary, ProjectDirectorySummary } from '../shared/project-directory'

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
type Readers = {
  projectExists: (id: string) => boolean
  tasks: (ids: string[]) => Record<string, DirectoryTaskSummary>
  operations: (id: string) => ProjectOperations
  servers: (id: string) => ProjectDirectorySummary['servers']
}

export function readProjectDirectorySummaries(input: { projectIds: string[] }, readers: Readers): ProjectDirectorySummary[] {
  if (!input || !Array.isArray(input.projectIds) || input.projectIds.some(id => typeof id !== 'string' || !id)) throw new Error('请提供有效的项目 ID')
  const ids = [...new Set(input.projectIds)].filter(id => readers.projectExists(id))
  let tasks: Record<string, DirectoryTaskSummary> = {}, tasksError = ''
  try { tasks = readers.tasks(ids) } catch (error) { tasksError = errorText(error) }
  return ids.map(projectId => {
    const result: ProjectDirectorySummary = { projectId, tasks: tasks[projectId] ?? { active: false, counts: null, updatedAt: '', error: tasksError || '任务摘要读取失败' }, operations: null, operationsError: '', servers: [], serversError: '' }
    try {
      const operations = readers.operations(projectId)
      // Only the latest deployment per environment travels to the directory;
      // the platform production pointer stays separate from deployment history.
      result.operations = { ...operations, deployments: Object.fromEntries(Object.entries(operations.deployments).map(([id, deployments]) => {
        const latest = new Map<string, typeof deployments[number]>()
        for (const deployment of deployments) if (!latest.has(deployment.target) || Date.parse(deployment.createdAt) > Date.parse(latest.get(deployment.target)!.createdAt)) latest.set(deployment.target, deployment)
        return [id, [...latest.values()]]
      })) }
    } catch (error) { result.operationsError = errorText(error) }
    try { result.servers = readers.servers(projectId) } catch (error) { result.serversError = errorText(error) }
    return result
  })
}
