# Git Workflow AI Conflict Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe Git add, commit, push, and merge workflows to ForgeDesk, plus an AI-assisted merge-conflict resolver configured from public settings.

**Architecture:** Keep dangerous Git writes out of the existing free-form command console. Add small main-process modules for AI settings, Git workspace operations, and conflict parsing; expose them through explicit IPC methods; then add a public AI settings module and a project-level Git workspace panel in the current Ant Design UI.

**Tech Stack:** Electron main/preload IPC, React 18, TypeScript, Ant Design, Node `node:test`, Git CLI through `execFile`, OpenAI-compatible Chat Completions over `fetch`.

---

## Current Context

- Current workspace: `/Users/stone/Dev/ForgeDesk`
- Current branch: `codex/info-architecture-settings`
- Existing changed files must be preserved and extended; do not revert unrelated work.
- Existing Git features:
  - `src/main/git-controls.ts` parses safe read-only Git commands and `fetch`.
  - `src/main/index.ts` already has repository scanning, remote management, commit graph reads, and Git/SSH IPC handlers.
  - `src/renderer/src/App.tsx` contains settings, project settings, repository table, remote manager, and command console UI.
- The local shell does not expose `node` or `npm` directly. Use:
  - Node: `/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`
  - Run scripts with bundled Node and local binaries: `PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run <script>`

## File Structure

- Create `scripts/run-tests.mjs`: transpile TypeScript source/spec files into a temporary directory and run Node's built-in test runner against emitted `.spec.js` files.
- Modify `package.json`: add `test` script and bump version to `1.0.0` in the final release task.
- Modify `package-lock.json`: keep package metadata aligned with `package.json` after the version bump.
- Create `src/main/ai-settings.ts`: read, validate, redact, and save OpenAI-compatible AI settings under Electron `userData`.
- Create `src/main/ai-settings.spec.ts`: unit tests for defaults, redaction, validation, and file persistence.
- Create `src/main/merge-conflicts.ts`: parse conflict markers and format conflict sections for AI prompts.
- Create `src/main/merge-conflicts.spec.ts`: unit tests for single and multiple conflict sections.
- Create `src/main/git-workspace.ts`: validate Git refs/pathspecs and build/parse add, commit, push, merge, status, and conflict operations.
- Create `src/main/git-workspace.spec.ts`: unit tests for safe argument building and porcelain status parsing.
- Create `src/main/ai-conflict-assistant.ts`: build the conflict-resolution prompt, call an OpenAI-compatible endpoint, and normalize the suggested merged content.
- Create `src/main/ai-conflict-assistant.spec.ts`: unit tests using injected fake `fetch`.
- Modify `src/main/index.ts`: wire new modules into IPC handlers and rescan repositories after successful writes.
- Modify `src/preload/index.ts`: expose AI settings and Git workspace IPC methods.
- Modify `src/renderer/src/data.ts`: add renderer-facing types for AI settings, Git workspace state, operations, conflicts, and AI suggestions.
- Modify `src/renderer/src/vite-env.d.ts`: add matching global `window.forgeDesk` method signatures.
- Modify `src/renderer/src/App.tsx`: add AI settings module and Git workspace/conflict assistant panel.
- Modify `src/renderer/src/styles.css`: add compact, work-focused styles for the new settings module and Git workspace panel.

## Task 1: Make Tests Runnable

**Files:**
- Create: `scripts/run-tests.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing test-runner expectation**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: FAIL because `package.json` has no `test` script.

- [x] **Step 2: Create the TypeScript test runner**

Add `scripts/run-tests.mjs` with this behavior:

```js
import { mkdtemp, rm, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { spawn } from 'node:child_process'
import ts from 'typescript'

const root = process.cwd()
const outDir = await mkdtemp(join(tmpdir(), 'forgedesk-tests-'))
const sourceRoots = ['src/main', 'src/renderer/src']

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

try {
  const files = (await Promise.all(sourceRoots.map((item) => walk(join(root, item))))).flat()
  const specFiles = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true
      },
      fileName: file
    })
    const outputPath = join(outDir, relative(root, file).replace(/\.(ts|tsx)$/, '.js'))
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, result.outputText)
    if (file.endsWith('.spec.ts') || file.endsWith('.spec.tsx')) specFiles.push(outputPath)
  }

  const child = spawn(process.execPath, ['--test', ...specFiles], { stdio: 'inherit' })
  const exitCode = await new Promise((resolve) => child.on('exit', resolve))
  process.exit(exitCode ?? 1)
} finally {
  await rm(outDir, { recursive: true, force: true })
}
```

- [x] **Step 3: Add the script**

Change `package.json` scripts to include:

```json
"test": "node scripts/run-tests.mjs"
```

- [x] **Step 4: Verify tests run**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: existing specs pass or expose pre-existing failures that must be fixed before continuing.

## Task 2: AI Public Settings Storage

**Files:**
- Create: `src/main/ai-settings.ts`
- Create: `src/main/ai-settings.spec.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/data.ts`
- Modify: `src/renderer/src/vite-env.d.ts`

- [x] **Step 1: Write failing tests for AI settings**

Create `src/main/ai-settings.spec.ts`:

```ts
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { getRedactedAiSettings, readAiSettingsFile, writeAiSettingsFile } from './ai-settings.js'

describe('ai settings', () => {
  it('returns safe defaults when settings file is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ai-settings-'))
    try {
      const settings = await readAiSettingsFile(directory)
      assert.equal(settings.provider, 'openai-compatible')
      assert.equal(settings.baseUrl, 'https://api.openai.com/v1')
      assert.equal(settings.model, 'gpt-4.1-mini')
      assert.equal(settings.apiKey, '')
      assert.equal(settings.enabled, false)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists settings and redacts the api key for renderer reads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forgedesk-ai-settings-'))
    try {
      const saved = await writeAiSettingsFile(directory, {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'sk-secret-value',
        model: 'gpt-test',
        temperature: 0.2
      })
      const raw = JSON.parse(await readFile(join(directory, 'ai-settings.json'), 'utf8'))
      assert.equal(raw.apiKey, 'sk-secret-value')
      assert.equal(saved.enabled, true)
      assert.deepEqual(getRedactedAiSettings(saved), {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKeyConfigured: true,
        model: 'gpt-test',
        temperature: 0.2
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
```

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: FAIL because `src/main/ai-settings.ts` does not exist.

- [x] **Step 2: Implement AI settings module**

Create `src/main/ai-settings.ts` with:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AiSettings = {
  enabled: boolean
  provider: 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export type RedactedAiSettings = Omit<AiSettings, 'apiKey'> & {
  apiKeyConfigured: boolean
}

const defaultAiSettings: AiSettings = {
  enabled: false,
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4.1-mini',
  temperature: 0.2
}

function getAiSettingsPath(userDataPath: string): string {
  return join(userDataPath, 'ai-settings.json')
}

export function normalizeAiSettings(input: Partial<AiSettings>): AiSettings {
  return {
    ...defaultAiSettings,
    ...input,
    provider: 'openai-compatible',
    enabled: Boolean(input.enabled),
    baseUrl: (input.baseUrl || defaultAiSettings.baseUrl).trim().replace(/\/+$/, ''),
    apiKey: (input.apiKey || '').trim(),
    model: (input.model || defaultAiSettings.model).trim(),
    temperature: Math.min(1, Math.max(0, Number(input.temperature ?? defaultAiSettings.temperature)))
  }
}

export async function readAiSettingsFile(userDataPath: string): Promise<AiSettings> {
  try {
    const content = await readFile(getAiSettingsPath(userDataPath), 'utf8')
    return normalizeAiSettings(JSON.parse(content) as Partial<AiSettings>)
  } catch {
    return defaultAiSettings
  }
}

export async function writeAiSettingsFile(userDataPath: string, input: Partial<AiSettings>): Promise<AiSettings> {
  const settings = normalizeAiSettings(input)
  await mkdir(userDataPath, { recursive: true })
  await writeFile(getAiSettingsPath(userDataPath), `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
  return settings
}

export function getRedactedAiSettings(settings: AiSettings): RedactedAiSettings {
  const { apiKey, ...rest } = settings
  return { ...rest, apiKeyConfigured: Boolean(apiKey) }
}
```

- [x] **Step 3: Add IPC handlers**

In `src/main/index.ts`, import the module and add handlers:

```ts
ipcMain.handle('settings:ai:get', async (): Promise<RedactedAiSettings> =>
  getRedactedAiSettings(await readAiSettingsFile(app.getPath('userData')))
)

ipcMain.handle('settings:ai:save', async (_event, input: Partial<AiSettings>): Promise<RedactedAiSettings> =>
  getRedactedAiSettings(await writeAiSettingsFile(app.getPath('userData'), input))
)
```

- [x] **Step 4: Expose renderer types and preload methods**

Add `AiSettingsInput` and `AiSettingsView` to `src/renderer/src/data.ts` and `src/renderer/src/vite-env.d.ts`, then expose:

```ts
getAiSettings: () => ipcRenderer.invoke('settings:ai:get'),
saveAiSettings: (input: AiSettingsInput) => ipcRenderer.invoke('settings:ai:save', input),
```

- [x] **Step 5: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
```

Expected: PASS.

## Task 3: Git Workspace Operation Model

**Files:**
- Create: `src/main/git-workspace.ts`
- Create: `src/main/git-workspace.spec.ts`

- [x] **Step 1: Write failing tests for Git operation argument safety**

Create `src/main/git-workspace.spec.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildGitAddArgs,
  buildGitCommitArgs,
  buildGitMergeArgs,
  buildGitPushArgs,
  parsePorcelainStatus
} from './git-workspace.js'

describe('git workspace operations', () => {
  it('builds safe git add args', () => {
    assert.deepEqual(buildGitAddArgs({ mode: 'all', paths: [] }), ['add', '--all'])
    assert.deepEqual(buildGitAddArgs({ mode: 'paths', paths: ['src/main/index.ts'] }), ['add', '--', 'src/main/index.ts'])
    assert.throws(() => buildGitAddArgs({ mode: 'paths', paths: ['src/main/index.ts;rm'] }), /不支持的文件路径/)
  })

  it('builds safe commit, push, and merge args', () => {
    assert.deepEqual(buildGitCommitArgs({ message: 'feat: add git workflow' }), ['commit', '-m', 'feat: add git workflow'])
    assert.deepEqual(buildGitPushArgs({ remote: 'origin', branch: 'main' }), ['push', 'origin', 'main'])
    assert.deepEqual(buildGitMergeArgs({ source: 'origin/main' }), ['merge', '--no-edit', 'origin/main'])
    assert.throws(() => buildGitCommitArgs({ message: '' }), /请输入提交信息/)
    assert.throws(() => buildGitPushArgs({ remote: 'bad/name', branch: 'main' }), /远端名称/)
    assert.throws(() => buildGitMergeArgs({ source: 'main;rm' }), /不支持的分支/)
  })

  it('parses porcelain status rows', () => {
    assert.deepEqual(parsePorcelainStatus(' M src/App.tsx\nA  README.md\nUU src/conflict.ts\n'), [
      { path: 'src/App.tsx', oldPath: '', indexStatus: ' ', worktreeStatus: 'M', conflict: false },
      { path: 'README.md', oldPath: '', indexStatus: 'A', worktreeStatus: ' ', conflict: false },
      { path: 'src/conflict.ts', oldPath: '', indexStatus: 'U', worktreeStatus: 'U', conflict: true }
    ])
  })
})
```

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: FAIL because `src/main/git-workspace.ts` does not exist.

- [x] **Step 2: Implement argument builders and parser**

Create `src/main/git-workspace.ts` with:

```ts
const SAFE_PATH_PATTERN = /^[^\0\r\n;&|<>`$\\]+$/
const SAFE_REF_PATTERN = /^[A-Za-z0-9._/@:+-]+$/
const REMOTE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/
const CONFLICT_STATUSES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

export type GitAddInput = { mode: 'all' | 'paths'; paths: string[] }
export type GitCommitInput = { message: string }
export type GitPushInput = { remote: string; branch: string }
export type GitMergeInput = { source: string }
export type GitStatusFile = { path: string; oldPath: string; indexStatus: string; worktreeStatus: string; conflict: boolean }

function assertSafePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed || !SAFE_PATH_PATTERN.test(trimmed) || trimmed.startsWith('/')) throw new Error(`不支持的文件路径：${path}`)
  return trimmed
}

function assertSafeRef(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed || !SAFE_REF_PATTERN.test(trimmed)) throw new Error(`不支持的${label}：${value}`)
  return trimmed
}

function assertRemoteName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || !REMOTE_NAME_PATTERN.test(trimmed)) throw new Error('远端名称只能包含字母、数字、点、下划线和短横线')
  return trimmed
}

export function buildGitAddArgs(input: GitAddInput): string[] {
  if (input.mode === 'all') return ['add', '--all']
  const paths = input.paths.map(assertSafePath)
  if (paths.length === 0) throw new Error('请选择要暂存的文件')
  return ['add', '--', ...paths]
}

export function buildGitCommitArgs(input: GitCommitInput): string[] {
  const message = input.message.trim()
  if (!message) throw new Error('请输入提交信息')
  return ['commit', '-m', message]
}

export function buildGitPushArgs(input: GitPushInput): string[] {
  return ['push', assertRemoteName(input.remote), assertSafeRef(input.branch, '分支')]
}

export function buildGitMergeArgs(input: GitMergeInput): string[] {
  return ['merge', '--no-edit', assertSafeRef(input.source, '分支')]
}

export function parsePorcelainStatus(output: string): GitStatusFile[] {
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const indexStatus = line[0] || ' '
    const worktreeStatus = line[1] || ' '
    const rawPath = line.slice(3)
    const [oldPath, path] = rawPath.includes(' -> ') ? rawPath.split(' -> ') : ['', rawPath]
    return {
      path,
      oldPath,
      indexStatus,
      worktreeStatus,
      conflict: CONFLICT_STATUSES.has(`${indexStatus}${worktreeStatus}`)
    }
  })
}
```

- [x] **Step 3: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
```

Expected: PASS.

## Task 4: Merge Conflict Parser

**Files:**
- Create: `src/main/merge-conflicts.ts`
- Create: `src/main/merge-conflicts.spec.ts`

- [x] **Step 1: Write failing conflict parser tests**

Create `src/main/merge-conflicts.spec.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractConflictSections, hasConflictMarkers } from './merge-conflicts.js'

describe('merge conflicts', () => {
  it('extracts one conflict section', () => {
    const content = ['before', '<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature', 'after'].join('\n')
    assert.equal(hasConflictMarkers(content), true)
    assert.deepEqual(extractConflictSections(content), [
      {
        index: 1,
        currentLabel: 'HEAD',
        incomingLabel: 'feature',
        currentContent: 'ours',
        incomingContent: 'theirs',
        rawContent: ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature'].join('\n')
      }
    ])
  })

  it('returns an empty list for normal text', () => {
    assert.equal(hasConflictMarkers('const value = 1\n'), false)
    assert.deepEqual(extractConflictSections('const value = 1\n'), [])
  })
})
```

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: FAIL because `src/main/merge-conflicts.ts` does not exist.

- [x] **Step 2: Implement conflict parser**

Create `src/main/merge-conflicts.ts` with:

```ts
export type ConflictSection = {
  index: number
  currentLabel: string
  incomingLabel: string
  currentContent: string
  incomingContent: string
  rawContent: string
}

export function hasConflictMarkers(content: string): boolean {
  return content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>')
}

export function extractConflictSections(content: string): ConflictSection[] {
  const lines = content.split(/\r?\n/)
  const sections: ConflictSection[] = []
  let index = 0

  while (index < lines.length) {
    if (!lines[index].startsWith('<<<<<<<')) {
      index += 1
      continue
    }

    const start = index
    const currentLabel = lines[index].replace(/^<<<<<<<\s*/, '').trim()
    index += 1
    const current: string[] = []
    const incoming: string[] = []

    while (index < lines.length && !lines[index].startsWith('=======')) current.push(lines[index++])
    index += 1
    while (index < lines.length && !lines[index].startsWith('>>>>>>>')) incoming.push(lines[index++])
    const incomingLabel = (lines[index] || '').replace(/^>>>>>>>\s*/, '').trim()
    const end = index
    sections.push({
      index: sections.length + 1,
      currentLabel,
      incomingLabel,
      currentContent: current.join('\n'),
      incomingContent: incoming.join('\n'),
      rawContent: lines.slice(start, end + 1).join('\n')
    })
    index += 1
  }

  return sections
}
```

- [x] **Step 3: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
```

Expected: PASS.

## Task 5: AI Conflict Assistant

**Files:**
- Create: `src/main/ai-conflict-assistant.ts`
- Create: `src/main/ai-conflict-assistant.spec.ts`

- [x] **Step 1: Write failing AI assistant tests**

Create `src/main/ai-conflict-assistant.spec.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requestConflictResolutionSuggestion } from './ai-conflict-assistant.js'

describe('ai conflict assistant', () => {
  it('calls an OpenAI-compatible endpoint and returns suggested content', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fakeFetch = async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'const value = "merged"\n' } }]
      }), { status: 200 })
    }

    const suggestion = await requestConflictResolutionSuggestion({
      settings: {
        enabled: true,
        provider: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'secret',
        model: 'gpt-test',
        temperature: 0.2
      },
      repositoryName: 'ForgeDesk',
      filePath: 'src/example.ts',
      conflictedContent: '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature\n',
      fetchImpl: fakeFetch as typeof fetch
    })

    assert.equal(suggestion.suggestedContent, 'const value = "merged"\n')
    assert.equal(calls[0].url, 'https://llm.example.com/v1/chat/completions')
  })

  it('rejects disabled or incomplete settings', async () => {
    await assert.rejects(() => requestConflictResolutionSuggestion({
      settings: { enabled: false, provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-test', temperature: 0.2 },
      repositoryName: 'repo',
      filePath: 'file.ts',
      conflictedContent: '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> feature\n'
    }), /请先在公共设置里启用 AI/)
  })
})
```

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: FAIL because `src/main/ai-conflict-assistant.ts` does not exist.

- [x] **Step 2: Implement assistant**

Create `src/main/ai-conflict-assistant.ts` with:

```ts
import type { AiSettings } from './ai-settings.js'

export type ConflictResolutionSuggestion = {
  filePath: string
  suggestedContent: string
}

export async function requestConflictResolutionSuggestion(input: {
  settings: AiSettings
  repositoryName: string
  filePath: string
  conflictedContent: string
  fetchImpl?: typeof fetch
}): Promise<ConflictResolutionSuggestion> {
  if (!input.settings.enabled || !input.settings.apiKey) throw new Error('请先在公共设置里启用 AI 并填写 API Key')
  if (!input.conflictedContent.includes('<<<<<<<')) throw new Error('当前文件没有检测到冲突标记')

  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(`${input.settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.settings.apiKey}`
    },
    body: JSON.stringify({
      model: input.settings.model,
      temperature: input.settings.temperature,
      messages: [
        {
          role: 'system',
          content: 'You resolve Git merge conflicts. Return only the full resolved file content, with no markdown fences and no explanation.'
        },
        {
          role: 'user',
          content: `Repository: ${input.repositoryName}\nFile: ${input.filePath}\n\nResolve this conflicted file:\n${input.conflictedContent}`
        }
      ]
    })
  })

  if (!response.ok) throw new Error(`AI 请求失败：HTTP ${response.status}`)
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const suggestedContent = payload.choices?.[0]?.message?.content ?? ''
  if (!suggestedContent.trim()) throw new Error('AI 没有返回可用的合并内容')
  return { filePath: input.filePath, suggestedContent }
}
```

- [x] **Step 3: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
```

Expected: PASS.

## Task 6: Main Process Git Workspace IPC

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/data.ts`
- Modify: `src/renderer/src/vite-env.d.ts`

- [x] **Step 1: Add shared types**

Add these renderer/main-aligned types:

```ts
type GitWorkspaceStatus = {
  repositoryId: string
  branch: string
  files: GitStatusFile[]
  conflicts: GitConflictFile[]
}

type GitConflictFile = {
  path: string
  sections: ConflictSection[]
  content: string
}

type GitOperationResult = {
  ok: boolean
  repository: RepositoryRecord
  status: GitWorkspaceStatus
  stdout: string
  stderr: string
}

type AiConflictSuggestion = {
  filePath: string
  suggestedContent: string
}
```

- [x] **Step 2: Add main helpers**

In `src/main/index.ts`, add helpers that call `runGitInPathResult` and read/write conflict files:

```ts
async function getRepositoryWorkspaceStatus(repositoryId: string): Promise<GitWorkspaceStatus> {
  const repository = getRepositoryOrThrow(repositoryId)
  const [statusOutput, branch] = await Promise.all([
    runGitInPathStrict(repository.localPath, ['status', '--porcelain']),
    runGitInPath(repository.localPath, ['branch', '--show-current'])
  ])
  const files = parsePorcelainStatus(statusOutput)
  const conflicts = await Promise.all(files.filter((file) => file.conflict).map(async (file) => {
    const content = await readFile(join(repository.localPath, file.path), 'utf8')
    return { path: file.path, content, sections: extractConflictSections(content) }
  }))
  return { repositoryId, branch, files, conflicts }
}
```

- [x] **Step 3: Add IPC handlers**

Add handlers:

```ts
ipcMain.handle('repository:workspace-status', async (_event, repositoryId: string) => getRepositoryWorkspaceStatus(repositoryId))
ipcMain.handle('repository:git-add', async (_event, repositoryId: string, input: GitAddInput) => runRepositoryWriteOperation(repositoryId, buildGitAddArgs(input)))
ipcMain.handle('repository:git-commit', async (_event, repositoryId: string, input: GitCommitInput) => runRepositoryWriteOperation(repositoryId, buildGitCommitArgs(input)))
ipcMain.handle('repository:git-push', async (_event, repositoryId: string, input: GitPushInput) => runRepositoryWriteOperation(repositoryId, buildGitPushArgs(input)))
ipcMain.handle('repository:git-merge', async (_event, repositoryId: string, input: GitMergeInput) => runRepositoryWriteOperation(repositoryId, buildGitMergeArgs(input)))
ipcMain.handle('repository:conflict:suggest', async (_event, repositoryId: string, filePath: string) => suggestRepositoryConflictResolution(repositoryId, filePath))
ipcMain.handle('repository:conflict:apply', async (_event, repositoryId: string, filePath: string, content: string) => applyRepositoryConflictResolution(repositoryId, filePath, content))
```

`runRepositoryWriteOperation` must return the command result even if Git exits non-zero so merge conflicts can still surface in the UI. It must rescan and return the latest repository/status after each write.

- [x] **Step 4: Expose preload methods**

Add:

```ts
getRepositoryWorkspaceStatus: (repositoryId: string) => ipcRenderer.invoke('repository:workspace-status', repositoryId),
gitAdd: (repositoryId: string, input: GitAddInput) => ipcRenderer.invoke('repository:git-add', repositoryId, input),
gitCommit: (repositoryId: string, input: GitCommitInput) => ipcRenderer.invoke('repository:git-commit', repositoryId, input),
gitPush: (repositoryId: string, input: GitPushInput) => ipcRenderer.invoke('repository:git-push', repositoryId, input),
gitMerge: (repositoryId: string, input: GitMergeInput) => ipcRenderer.invoke('repository:git-merge', repositoryId, input),
suggestConflictResolution: (repositoryId: string, filePath: string) => ipcRenderer.invoke('repository:conflict:suggest', repositoryId, filePath),
applyConflictResolution: (repositoryId: string, filePath: string, content: string) => ipcRenderer.invoke('repository:conflict:apply', repositoryId, filePath, content),
```

- [x] **Step 5: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
```

Expected: PASS.

## Task 7: AI Settings UI

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [x] **Step 1: Extend settings state**

In `App.tsx`:

```ts
type SettingsModuleKey = 'overview' | 'git' | 'private' | 'public' | 'config' | 'ai'

type AiSettingsForm = {
  enabled: boolean
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}
```

Add `const [aiSettingsForm] = Form.useForm<AiSettingsForm>()`, `aiSettings`, `loadingAiSettings`, and `savingAiSettings` states.

- [x] **Step 2: Load and save AI settings**

Add:

```ts
async function refreshAiSettings(): Promise<void> {
  if (!window.forgeDesk) return
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
  } finally {
    setLoadingAiSettings(false)
  }
}

async function saveAiSettings(): Promise<void> {
  const values = await aiSettingsForm.validateFields()
  if (!window.forgeDesk) return
  setSavingAiSettings(true)
  try {
    const settings = await window.forgeDesk.saveAiSettings(values)
    setAiSettings(settings)
    aiSettingsForm.setFieldValue('apiKey', '')
    message.success('AI 设置已保存')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    setSavingAiSettings(false)
  }
}
```

- [x] **Step 3: Add the module card and form**

Add an `AI 助手` card to `settingsModules`, route `case 'ai'`, and render a form with:

- Enable switch using `Segmented` or `Select` with enabled/disabled.
- Base URL input.
- API Key password input; blank means keep empty only if user saves blank.
- Model input.
- Temperature numeric input.
- Save button.

- [x] **Step 4: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
```

Expected: PASS.

## Task 8: Git Workspace UI and Conflict Assistant

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [x] **Step 1: Add `GitWorkspacePanel` component**

Create a component in `App.tsx` near `GitCommandConsole`:

```tsx
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
  const selectedRepository = repositories.find((repository) => repository.id === repositoryId) ?? repositories[0] ?? null
}
```

- [x] **Step 2: Implement status refresh and operations**

Add functions:

```ts
async function refreshWorkspaceStatus(): Promise<void> {
  if (!selectedRepository || !window.forgeDesk) return
  const nextStatus = await window.forgeDesk.getRepositoryWorkspaceStatus(selectedRepository.id)
  setStatus(nextStatus)
  setPushBranch(nextStatus.branch)
}

async function runGitWrite(action: () => Promise<GitOperationResult>, successText: string): Promise<void> {
  setWorking(true)
  try {
    const result = await action()
    updateRepository(result.repository)
    setStatus(result.status)
    if (result.ok) message.success(successText)
    else message.warning(result.stderr || result.stdout || 'Git 操作需要处理')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    setWorking(false)
  }
}
```

Wire buttons:

- `暂存全部`: `window.forgeDesk.gitAdd(id, { mode: 'all', paths: [] })`
- `暂存选中文件`: `window.forgeDesk.gitAdd(id, { mode: 'paths', paths: selectedPaths })`
- `提交`: `window.forgeDesk.gitCommit(id, { message: commitMessage })`
- `推送`: `window.forgeDesk.gitPush(id, { remote: pushRemote, branch: pushBranch })`
- `合并`: `window.forgeDesk.gitMerge(id, { source: mergeSource })`

- [x] **Step 3: Add conflict assistant UI**

When `status.conflicts.length > 0`, render conflict files with:

- File path.
- Conflict section count.
- Button `AI 生成合并建议`.
- Modal preview with readonly text area.
- Button `应用建议并暂存`.

Apply flow:

```ts
const suggestion = await window.forgeDesk.suggestConflictResolution(selectedRepository.id, conflict.path)
setPreviewSuggestion(suggestion)
```

Then:

```ts
const result = await window.forgeDesk.applyConflictResolution(selectedRepository.id, suggestion.filePath, suggestion.suggestedContent)
updateRepository(result.repository)
setStatus(result.status)
message.success('已应用 AI 建议并暂存文件')
```

- [x] **Step 4: Place panel before command console**

In `ProjectSettingsPanel`, change:

```tsx
<div className="advanced-settings-stack">
  <RepositoryRemoteManager repositories={repositories} />
  <GitWorkspacePanel repositories={repositories} />
  <GitCommandConsole repositories={repositories} />
</div>
```

- [x] **Step 5: Update command console description**

Change the command console alert to say write operations are available in `Git 工作区`, and keep the console for safe inspection commands.

- [x] **Step 6: Verify**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
```

Expected: PASS.

## Task 9: Visual Polish and Build Verification

**Files:**
- Modify: `src/renderer/src/styles.css`

- [x] **Step 1: Add styles**

Add classes:

```css
.git-workspace-panel {
  display: grid;
  gap: 14px;
}

.git-workspace-toolbar,
.git-operation-row,
.conflict-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.git-file-table-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-settings-grid,
.git-operation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .ai-settings-grid,
  .git-operation-grid {
    grid-template-columns: 1fr;
  }
}
```

- [x] **Step 2: Verify full build**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run build
```

Expected: PASS.

## Task 10: Release Commit, Push, and v1.0.0 Tag

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Bump app version**

Change both top-level package metadata files from `0.1.0` to `1.0.0`.

- [x] **Step 2: Final verification**

Run:

```bash
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run test
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run lint
PATH=/Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:node_modules/.bin:$PATH /Users/stone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --run build
```

Expected: PASS.

- [x] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: changes include the existing uncommitted feature work plus the new Git workflow, AI settings, tests, plan, and version bump.

- [x] **Step 4: Commit**

Run:

```bash
git add .
git commit -m "feat: add git workflow and AI conflict assistant"
```

Expected: commit succeeds.

- [ ] **Step 5: Push branch**

Run:

```bash
git push -u origin codex/info-architecture-settings
```

Expected: branch push succeeds. If the remote name or branch differs, inspect `git remote -v` and `git branch --show-current`, then push the current branch to the appropriate remote.

- [ ] **Step 6: Tag v1.0.0 and push tag**

Run:

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

Expected: tag push succeeds. If `v1.0.0` already exists locally or remotely, stop and report the exact existing tag target before changing it.

- [ ] **Step 7: Close the automation**

After branch push and tag push both succeed, delete the recurring automation named `ForgeDesk Git AI development loop`.

## Completion Criteria

- Public settings includes an `AI 助手` module.
- Project advanced settings includes a `Git 工作区` panel with add, commit, push, merge.
- Merge conflicts are detected after failed merge operations and listed in the UI.
- AI conflict suggestions use the public AI settings and require explicit user confirmation before writing.
- Applying an AI suggestion writes the resolved file and stages that file.
- Existing remote management, SSH settings, Git log tree, and safe command console continue to work.
- `node --run test`, `node --run lint`, and `node --run build` pass using bundled Node and local binaries.
- Version metadata is `1.0.0`.
- A commit is created, the branch is pushed, annotated tag `v1.0.0` is created and pushed.
- The recurring automation is deleted after successful push/tag push.
