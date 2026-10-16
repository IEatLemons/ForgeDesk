// Prototype-only domain. Nothing in this module reads a workspace, store or IPC API.
export const DEMO_TODAY = '2026-10-15'
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'cancelled'
export const TASK_STATUSES: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: '待开始', color: 'default' }, { key: 'doing', label: '进行中', color: 'blue' },
  { key: 'review', label: '待验收', color: 'orange' }, { key: 'done', label: '已完成', color: 'green' },
  { key: 'cancelled', label: '已取消', color: 'default' }
]
export type DemoProject = { id: string; name: string; description: string; repository?: string; archived?: boolean }
export type DemoTask = {
  id: string; projectId: string; title: string; description: string; status: TaskStatus; owner: string
  due: string; start: string; goalId?: string; milestoneId?: string; versionId?: string; parentId?: string
  blocked?: string; sessionId?: string; acceptance: string; events: string[]
}
export type DemoPlan = { id: string; projectId: string; kind: 'goal' | 'milestone' | 'version'; title: string; description: string; due: string }
export type DemoSession = { id: string; projectId?: string; taskId?: string; tool: 'Codex' | 'Cursor' | '通用助手'; title: string; status: string; cwd: string }
export type DemoMessage = { role: 'user' | 'assistant'; content: string }
export type DemoDeployment = { id: string; projectId: string; environment: string; target: string; version: string; status: string; time: string }
export type DemoData = {
  projects: DemoProject[]; tasks: DemoTask[]; plans: DemoPlan[]; sessions: DemoSession[]
  messages: Record<string, DemoMessage[]>; deployments: DemoDeployment[]; commits: { id: string; projectId: string; title: string; time: string }[]
  activeAccount: string
}

export function createDemoData(): DemoData {
  return {
    projects: [
      { id: 'forgedesk', name: 'ForgeDesk', description: '把项目进度、代码与线上运行放在同一条工作流里。', repository: 'forgedesk-app' },
      { id: 'atlas', name: 'Atlas API', description: '面向业务系统的统一接口服务。', repository: 'atlas-api' },
      { id: 'idea', name: '新产品探索 · 尚未绑定仓库与线上环境', description: '从目标和任务开始，不需要预先配置任何外部系统。' }
    ],
    plans: [
      { id: 'g-navigation', projectId: 'forgedesk', kind: 'goal', title: '让每个功能都有明确的位置', description: '优先按项目组织日常工作，减少平铺入口。', due: '2026-10-25' },
      { id: 'm-prototype', projectId: 'forgedesk', kind: 'milestone', title: '目录原型验收', description: '确认目录归属和核心跳转，随后才接入真实功能。', due: '2026-10-18' },
      { id: 'v-next', projectId: 'forgedesk', kind: 'version', title: '下一版本 · 导航重构', description: '版本计划，不等同于 Git 标签或线上发布。', due: '2026-10-30' },
      { id: 'g-api', projectId: 'atlas', kind: 'goal', title: '完成账户接口升级', description: '提供稳定的鉴权与配额服务。', due: '2026-10-22' }
    ],
    tasks: [
      { id: 'FD-101', projectId: 'forgedesk', title: '验收项目分层导航', description: '确认项目内的进度、代码、运行分区是否符合日常使用习惯。', status: 'review', owner: 'Stone', start: '2026-10-12', due: '2026-10-18', goalId: 'g-navigation', milestoneId: 'm-prototype', versionId: 'v-next', sessionId: 'session-navigation', acceptance: '能够从项目进入任务、仓库和部署；辅助功能不再占据主导航。', events: ['人工创建业务任务', 'AI 执行完成，已提交演示交付物', '业务状态进入待验收，尚未人工确认'] },
      { id: 'FD-102', projectId: 'forgedesk', title: '整理任务详情的信息层级', description: '将概况、子任务、AI 执行和历史分开，保留轻量预览。', status: 'doing', owner: 'Stone', start: '2026-10-14', due: '2026-10-20', goalId: 'g-navigation', versionId: 'v-next', acceptance: '无需滚动长抽屉即可找到任务内容和验收入口。', events: ['人工创建业务任务', '已开始'] },
      { id: 'FD-103', projectId: 'forgedesk', title: '确认线上环境的发布权限', description: '由项目负责人确认生产环境的发布授权。', status: 'todo', owner: 'Stone', start: '2026-10-10', due: '2026-10-14', goalId: 'g-navigation', blocked: '等待确认生产环境发布权限', acceptance: '配置项和日常部署操作有明确边界。', events: ['人工创建业务任务', '记录阻塞：等待发布权限'] },
      { id: 'FD-104', projectId: 'forgedesk', title: '梳理已有导航入口', description: '完成旧功能到新目录的映射。', status: 'done', owner: 'Stone', start: '2026-10-10', due: '2026-10-13', goalId: 'g-navigation', milestoneId: 'm-prototype', acceptance: '所有现有入口均有归属。', events: ['人工创建业务任务', '人工验收完成'] },
      { id: 'FD-101-1', projectId: 'forgedesk', parentId: 'FD-101', title: '检查窄窗口目录', description: '小窗口仍能进入全部目录。', status: 'done', owner: 'Stone', start: '2026-10-13', due: '2026-10-16', goalId: 'g-navigation', acceptance: '目录可收起，不遮挡任务操作。', events: ['子任务创建', '人工验收完成'] },
      { id: 'AT-201', projectId: 'atlas', title: '验收新的鉴权接口', description: '核对接口契约与失败重试。', status: 'review', owner: 'Stone', start: '2026-10-11', due: '2026-10-16', goalId: 'g-api', sessionId: 'session-api', acceptance: '关键接口通过验收用例。', events: ['人工创建业务任务', 'AI 执行已结束，等待验收'] },
      { id: 'IN-001', projectId: '', title: '整理下一个项目的想法', description: '尚未归属项目的收件箱任务。', status: 'todo', owner: 'Stone', start: DEMO_TODAY, due: '', acceptance: '确认所属项目和目标。', events: ['加入收件箱'] }
    ],
    sessions: [
      { id: 'session-navigation', projectId: 'forgedesk', taskId: 'FD-101', tool: 'Codex', title: '实现项目分层导航原型', status: '执行已结束 · 待人工验收', cwd: '/demo/ForgeDesk' },
      { id: 'session-api', projectId: 'atlas', taskId: 'AT-201', tool: 'Cursor', title: '账户鉴权接口升级', status: '等待确认', cwd: '/demo/atlas-api' },
      { id: 'session-general', tool: '通用助手', title: '讨论一个新的产品想法', status: '普通会话 · 未创建业务任务', cwd: '未关联工作目录' }
    ],
    messages: {
      'session-navigation': [{ role: 'user', content: '请实现分层导航的可点击原型，先不接真实数据。' }, { role: 'assistant', content: '演示执行已结束。业务任务仍为待验收，需要人工确认；会话结束不代表项目任务完成。' }],
      'session-api': [{ role: 'user', content: '检查鉴权接口的边界情况。' }, { role: 'assistant', content: '这是演示会话。可以进入关联任务查看验收标准，再返回此处。' }],
      'session-general': [{ role: 'user', content: '我想讨论一个新想法。' }, { role: 'assistant', content: '普通会话不会自动变成项目任务。确认目标后，再显式创建任务。' }]
    },
    deployments: [
      { id: 'deploy-1', projectId: 'forgedesk', environment: '生产', target: '自有服务器 · SSH / PM2', version: '演示构建 42', status: '运行正常', time: '10-15 09:30' },
      { id: 'deploy-2', projectId: 'forgedesk', environment: '预览', target: '托管平台 · Vercel', version: '演示构建 43', status: '待检查', time: '10-15 10:20' },
      { id: 'deploy-3', projectId: 'atlas', environment: '生产', target: '托管平台 · Railway', version: '演示构建 18', status: '运行正常', time: '10-14 16:40' }
    ],
    commits: [{ id: 'demo-a12f', projectId: 'forgedesk', title: 'feat: 建立原生任务基础', time: '10-14 16:20' }, { id: 'demo-b83e', projectId: 'forgedesk', title: 'fix: 分离 AI 执行和业务验收', time: '10-13 11:10' }, { id: 'demo-c920', projectId: 'atlas', title: 'feat: 账户鉴权接口', time: '10-14 09:10' }],
    activeAccount: '个人账号（演示）'
  }
}

export function isOverdue(task: DemoTask): boolean {
  return !!task.due && task.due < DEMO_TODAY && task.status !== 'done' && task.status !== 'cancelled'
}

export function summarizeTasks(tasks: DemoTask[]): { total: number; done: number; review: number; blocked: number; overdue: number; percent: number } {
  const roots = tasks.filter(task => !task.parentId && task.status !== 'cancelled')
  const done = roots.filter(task => task.status === 'done').length
  return { total: roots.length, done, review: roots.filter(task => task.status === 'review').length, blocked: roots.filter(task => !!task.blocked && task.status !== 'done').length, overdue: roots.filter(isOverdue).length, percent: roots.length ? Math.round(done / roots.length * 100) : 0 }
}

export function tasksForPlan(tasks: DemoTask[], plan: DemoPlan): DemoTask[] {
  const key = plan.kind === 'goal' ? 'goalId' : plan.kind === 'milestone' ? 'milestoneId' : 'versionId'
  return tasks.filter(task => task.projectId === plan.projectId && task[key] === plan.id)
}

export function acceptDemoTask(data: DemoData, taskId: string): { data: DemoData; error?: string } {
  const task = data.tasks.find(item => item.id === taskId)
  if (!task || task.status !== 'review') return { data, error: '只有待验收任务可以确认完成。' }
  if (task.blocked || data.tasks.some(item => item.parentId === task.id && item.status !== 'done' && item.status !== 'cancelled')) return { data, error: '请先解除阻塞，并完成或取消未完成的子任务。' }
  return { data: { ...data, tasks: data.tasks.map(item => item.id === taskId ? { ...item, status: 'done', events: [...item.events, '人工验收通过（仅演示）'] } : item) } }
}
