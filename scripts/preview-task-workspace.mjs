// Isolated development preview: all database writes go to a temporary database.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import Database from 'better-sqlite3'
import { mkdir, mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'

const { build } = createRequire(createRequire(import.meta.url).resolve('vite'))('esbuild')
const port = Number(process.env.FORGEDESK_TASK_PREVIEW_PORT || 5178)
const root = process.cwd(), output = resolve(root, '.cache/task-preview/service.cjs')
await mkdir(resolve(root, '.cache/task-preview'), { recursive: true })
await build({ entryPoints: [resolve(root, 'src/main/task-workspace.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3', 'dayjs', 'dayjs/*'] })
const { TaskWorkspaceService } = createRequire(import.meta.url)(output)
const temporary = await mkdtemp(join(tmpdir(), 'forgedesk-task-preview-'))
const database = new Database(join(temporary, 'preview.db'))
const service = new TaskWorkspaceService(database)
service.initialize(temporary)
const command = input => service.command({ ...input, commandId: randomUUID() }).entityId
if (!process.argv.includes('--empty')) {
  const folder = command({ type: 'save-folder', input: { title: '工作计划' } })
  const list = command({ type: 'save-list', input: { title: '产品迭代', folderId: folder } })
  command({ type: 'save-group', input: { title: '待定', scope: list } })
  const group = command({ type: 'save-group', input: { title: '本周计划', scope: list } })
  for (const [index, title] of ['整理产品需求', '设计任务工作台', '验证多视图数据一致性', '完成发布前检查'].entries()) command({ type: 'save-task', input: { title, links: [{ listId: list, groupId: group, order: index }], priority: index === 0 ? 'high' : 'medium', startDate: '2026-11-10', dueDate: `2026-11-${11 + index}`, description: index === 0 ? '<p>记录目标和需要验证的操作。</p>' : '' } })
}
const server = await createServer({ configFile: false, root, cacheDir: resolve(root, '.cache/task-preview/vite'), server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root, await realpath(resolve(root, 'node_modules'))] } }, plugins: [react(), {
  name: 'isolated-task-preview', configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (request.url === '/task-preview-entry.tsx') { response.setHeader('Content-Type', 'application/javascript'); const transformed = await server.transformRequest('/src/renderer/src/task-workspace-preview.tsx'); response.end(transformed?.code ?? ''); return }
      if (request.url === '/__tasks' && request.method === 'POST') {
        try { let body = ''; for await (const chunk of request) body += chunk; const { method, args = [] } = JSON.parse(body); let result
          if (method === 'initializeTaskWorkspace') result = null
          else if (method === 'getTaskWorkspace') result = service.snapshot()
          else if (method === 'runTaskCommand') result = service.command(args[0])
          else if (method === 'getTaskHistory') result = service.history(args[0])
          else if (method === 'readTaskAttachment') result = null
          else throw new Error('附件操作请在桌面应用中验证')
          response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ result }))
        } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: error.message })) } return
      }
      if (request.url === '/favicon.ico') { response.statusCode = 204; response.end(); return }
      if (request.url === '/' || request.url?.startsWith('/?')) { response.setHeader('Content-Type', 'text/html'); response.end(await server.transformIndexHtml('/', '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ForgeDesk · 任务验证</title></head><body><div id="root"></div><script type="module" src="/src/renderer/src/task-workspace-preview.tsx"></script></body></html>')); return }
      next()
    })
  }
}] })
await server.listen()
console.log(`Task workspace preview: http://127.0.0.1:${port} (isolated database: ${temporary})`)
