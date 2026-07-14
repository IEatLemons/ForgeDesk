import type { BrowserWindow, GlobalShortcut, IpcMain, Shell, App } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { release } from 'node:os'
import { dirname, join } from 'node:path'

export type MenuBarItemSection = 'visible' | 'hidden' | 'always-hidden'

export type MenuBarHotkeySettings = {
  toggleHidden: {
    enabled: boolean
    accelerator: string
  }
}

export type MenuBarManagerSettings = {
  enabled: boolean
  showOnHover: boolean
  autoRehideMs: number
  hiddenItemKeys: string[]
  alwaysHiddenItemKeys: string[]
  orderedItemKeys: string[]
  hotkeys: MenuBarHotkeySettings
}

export type MenuBarManagerItem = {
  key: string
  displayName: string
  bundleIdentifier: string
  ownerName: string
  title: string
  section: MenuBarItemSection
  canMove: boolean
  frame?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type MenuBarManagerSupport = {
  supported: boolean
  platform: NodeJS.Platform
  macosMajorVersion: number | null
  reason?: 'unsupported-platform' | 'unsupported-version'
  message: string
}

export type MenuBarManagerStatus = {
  available: boolean
  running: boolean
  supported: boolean
  platform: NodeJS.Platform
  macosMajorVersion: number | null
  helperPath: string
  helperAvailable: boolean
  accessibilityTrusted: boolean
  sectionVisible: boolean
  hotkeyRegistered: boolean
  hotkeyError: string
  message: string
  settings: MenuBarManagerSettings
  items: MenuBarManagerItem[]
}

type HelperEnvelope = {
  id?: string
  method?: string
  params?: unknown
  result?: unknown
  error?: string | { message?: string }
}

type MenuBarHelperEvent =
  | { method: 'ready'; params?: unknown }
  | { method: 'statusChanged'; params?: unknown }
  | { method: 'itemsChanged'; params?: unknown }
  | { method: 'sectionChanged'; params?: unknown }
  | { method: 'permissionChanged'; params?: unknown }
  | { method: 'error'; params?: unknown }
  | { method: string; params?: unknown }

type PendingHelperRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export type MenuBarManagerOptions = {
  app: Pick<App, 'getPath' | 'getAppPath' | 'isPackaged'>
  ipcMain: IpcMain
  globalShortcut: Pick<GlobalShortcut, 'register' | 'unregister' | 'isRegistered'>
  shell: Pick<Shell, 'openExternal'>
  getWindows: () => BrowserWindow[]
  resourcesPath: string
  platform?: NodeJS.Platform
  osRelease?: string
  helperPath?: string
  requestTimeoutMs?: number
}

export const defaultMenuBarManagerSettings: MenuBarManagerSettings = {
  enabled: false,
  showOnHover: false,
  autoRehideMs: 5000,
  hiddenItemKeys: [],
  alwaysHiddenItemKeys: [],
  orderedItemKeys: [],
  hotkeys: {
    toggleHidden: {
      enabled: false,
      accelerator: 'CommandOrControl+Option+M'
    }
  }
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const trimmed = value.trim()

    if (!trimmed || seen.has(trimmed)) {
      continue
    }

    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

function clampAutoRehideMs(value: unknown): number {
  const nextValue = Number(value ?? defaultMenuBarManagerSettings.autoRehideMs)

  if (!Number.isFinite(nextValue)) {
    return defaultMenuBarManagerSettings.autoRehideMs
  }

  return Math.min(60_000, Math.max(1000, Math.round(nextValue)))
}

export function normalizeMenuBarManagerSettings(input: Partial<MenuBarManagerSettings> = {}): MenuBarManagerSettings {
  const hotkeys = input.hotkeys ?? defaultMenuBarManagerSettings.hotkeys
  const toggleHidden = hotkeys.toggleHidden ?? defaultMenuBarManagerSettings.hotkeys.toggleHidden
  const hiddenItemKeys = uniqueStrings(input.hiddenItemKeys)
  const alwaysHiddenItemKeys = uniqueStrings(input.alwaysHiddenItemKeys).filter((key) => !hiddenItemKeys.includes(key))

  return {
    enabled: Boolean(input.enabled),
    showOnHover: Boolean(input.showOnHover),
    autoRehideMs: clampAutoRehideMs(input.autoRehideMs),
    hiddenItemKeys,
    alwaysHiddenItemKeys,
    orderedItemKeys: uniqueStrings(input.orderedItemKeys),
    hotkeys: {
      toggleHidden: {
        enabled: Boolean(toggleHidden.enabled),
        accelerator: (toggleHidden.accelerator || defaultMenuBarManagerSettings.hotkeys.toggleHidden.accelerator).trim()
      }
    }
  }
}

function getMenuBarSettingsPath(userDataPath: string): string {
  return join(userDataPath, 'menu-bar-settings.json')
}

export async function readMenuBarManagerSettingsFile(userDataPath: string): Promise<MenuBarManagerSettings> {
  try {
    const content = await readFile(getMenuBarSettingsPath(userDataPath), 'utf8')
    return normalizeMenuBarManagerSettings(JSON.parse(content) as Partial<MenuBarManagerSettings>)
  } catch {
    return defaultMenuBarManagerSettings
  }
}

export async function writeMenuBarManagerSettingsFile(userDataPath: string, input: Partial<MenuBarManagerSettings>): Promise<MenuBarManagerSettings> {
  const settings = normalizeMenuBarManagerSettings(input)
  const settingsPath = getMenuBarSettingsPath(userDataPath)

  await mkdir(dirname(settingsPath), { recursive: true })
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })

  return settings
}

export function createMenuBarPlatformSupport(platform: NodeJS.Platform = process.platform, osRelease: string = release()): MenuBarManagerSupport {
  if (platform !== 'darwin') {
    return {
      supported: false,
      platform,
      macosMajorVersion: null,
      reason: 'unsupported-platform',
      message: '菜单栏整理只支持 macOS。'
    }
  }

  const darwinMajor = Number.parseInt(osRelease.split('.')[0] ?? '', 10)
  const macosMajorVersion = Number.isFinite(darwinMajor) ? darwinMajor - 9 : null

  if (!macosMajorVersion || macosMajorVersion < 14) {
    return {
      supported: false,
      platform,
      macosMajorVersion,
      reason: 'unsupported-version',
      message: '菜单栏整理需要 macOS 14 或更高版本。'
    }
  }

  return {
    supported: true,
    platform,
    macosMajorVersion,
    message: '菜单栏整理可用。'
  }
}

export function resolveMenuBarHelperExecutablePath(options: {
  appPath: string
  isPackaged: boolean
  resourcesPath: string
}): string {
  const helperRelativePath = join('MenuBarHelper', 'ForgeDeskMenuBarHelper.app', 'Contents', 'MacOS', 'ForgeDeskMenuBarHelper')

  return options.isPackaged ? join(options.resourcesPath, helperRelativePath) : join(options.appPath, 'resources', helperRelativePath)
}

export function parseMenuBarHelperLine(line: string): HelperEnvelope {
  const trimmed = line.trim()

  if (!trimmed) {
    throw new Error('Empty helper message')
  }

  const parsed = JSON.parse(trimmed) as HelperEnvelope

  if (!parsed.id && !parsed.method) {
    throw new Error('Helper message must include an id or method')
  }

  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '菜单栏整理操作失败')
}

function parseHelperStatus(value: unknown): Partial<MenuBarManagerStatus> {
  if (!isRecord(value)) {
    return {}
  }

  const items = Array.isArray(value.items) ? value.items.filter(isRecord).map((item): MenuBarManagerItem => ({
    key: String(item.key ?? ''),
    displayName: String(item.displayName ?? item.ownerName ?? item.title ?? 'Unknown'),
    bundleIdentifier: String(item.bundleIdentifier ?? ''),
    ownerName: String(item.ownerName ?? ''),
    title: String(item.title ?? ''),
    section: item.section === 'hidden' || item.section === 'always-hidden' ? item.section : 'visible',
    canMove: item.canMove !== false,
    frame: isRecord(item.frame)
      ? {
          x: Number(item.frame.x ?? 0),
          y: Number(item.frame.y ?? 0),
          width: Number(item.frame.width ?? 0),
          height: Number(item.frame.height ?? 0)
        }
      : undefined
  })).filter((item) => item.key) : []

  return {
    accessibilityTrusted: Boolean(value.accessibilityTrusted),
    sectionVisible: Boolean(value.sectionVisible),
    items
  }
}

class MenuBarHelperClient {
  private process: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<string, PendingHelperRequest>()
  private buffer = ''

  constructor(
    private readonly helperPath: string,
    private readonly timeoutMs: number,
    private readonly onEvent: (event: MenuBarHelperEvent) => void,
    private readonly onExit: (message: string) => void
  ) {}

  get running(): boolean {
    return Boolean(this.process && !this.process.killed)
  }

  start(): void {
    if (this.process) {
      return
    }

    const child = spawn(this.helperPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORGEDESK_MENU_BAR_HELPER: '1'
      }
    })

    this.process = child
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.readStdout(chunk))
    child.stderr.on('data', (chunk: string) => {
      const message = chunk.trim()

      if (message) {
        this.onEvent({ method: 'error', params: { message } })
      }
    })
    child.on('error', (error) => {
      this.rejectAll(error)
      this.process = null
      this.onExit(getErrorMessage(error))
    })
    child.on('exit', (code, signal) => {
      this.rejectAll(new Error(`Helper exited (${signal ?? code ?? 'unknown'})`))
      this.process = null
      this.onExit(`菜单栏 helper 已退出（${signal ?? code ?? 'unknown'}）。`)
    })
  }

  async stop(): Promise<void> {
    const child = this.process

    if (!child) {
      return
    }

    try {
      await this.request('helper.shutdown')
    } catch {
      // The process may already be going away.
    }

    if (!child.killed) {
      child.kill()
    }

    this.process = null
    this.rejectAll(new Error('Helper stopped'))
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (!this.process || !this.process.stdin.writable) {
      return Promise.reject(new Error('菜单栏 helper 尚未运行'))
    }

    const id = randomUUID()
    const payload = `${JSON.stringify({ id, method, params })}\n`

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`菜单栏 helper 请求超时：${method}`))
      }, this.timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      this.process?.stdin.write(payload, 'utf8', (error) => {
        if (!error) {
          return
        }

        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
      })
    })
  }

  private readStdout(chunk: string): void {
    this.buffer += chunk

    while (true) {
      const newlineIndex = this.buffer.indexOf('\n')

      if (newlineIndex === -1) {
        return
      }

      const line = this.buffer.slice(0, newlineIndex)
      this.buffer = this.buffer.slice(newlineIndex + 1)
      this.handleLine(line)
    }
  }

  private handleLine(line: string): void {
    let envelope: HelperEnvelope

    try {
      envelope = parseMenuBarHelperLine(line)
    } catch (error) {
      this.onEvent({ method: 'error', params: { message: getErrorMessage(error) } })
      return
    }

    if (envelope.id) {
      const pending = this.pending.get(envelope.id)

      if (!pending) {
        return
      }

      clearTimeout(pending.timer)
      this.pending.delete(envelope.id)

      if (envelope.error) {
        pending.reject(new Error(typeof envelope.error === 'string' ? envelope.error : envelope.error.message || '菜单栏 helper 操作失败'))
      } else {
        pending.resolve(envelope.result)
      }

      return
    }

    if (envelope.method) {
      this.onEvent({ method: envelope.method, params: envelope.params })
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }

    this.pending.clear()
  }
}

export class MenuBarManagerService {
  private readonly userDataPath: string
  private readonly helperPath: string
  private readonly support: MenuBarManagerSupport
  private helper: MenuBarHelperClient | null = null
  private settings: MenuBarManagerSettings = defaultMenuBarManagerSettings
  private items: MenuBarManagerItem[] = []
  private accessibilityTrusted = false
  private sectionVisible = false
  private hotkeyRegistered = false
  private hotkeyError = ''
  private statusMessage = ''
  private initialized = false

  constructor(private readonly options: MenuBarManagerOptions) {
    this.userDataPath = options.app.getPath('userData')
    this.helperPath = options.helperPath ?? resolveMenuBarHelperExecutablePath({
      appPath: options.app.getAppPath(),
      isPackaged: options.app.isPackaged,
      resourcesPath: options.resourcesPath
    })
    this.support = createMenuBarPlatformSupport(options.platform ?? process.platform, options.osRelease ?? release())
    this.statusMessage = this.support.message
  }

  async initialize(): Promise<MenuBarManagerStatus> {
    if (this.initialized) {
      return this.getStatus()
    }

    this.initialized = true
    this.settings = await readMenuBarManagerSettingsFile(this.userDataPath)
    await this.syncRuntime()
    this.registerIpc()
    return this.getStatus()
  }

  async shutdown(): Promise<void> {
    this.unregisterHotkey()

    if (this.helper) {
      await this.helper.stop()
      this.helper = null
    }
  }

  getStatus(): MenuBarManagerStatus {
    const helperAvailable = existsSync(this.helperPath)
    const supported = this.support.supported

    return {
      available: supported && helperAvailable,
      running: Boolean(this.helper?.running),
      supported,
      platform: this.support.platform,
      macosMajorVersion: this.support.macosMajorVersion,
      helperPath: this.helperPath,
      helperAvailable,
      accessibilityTrusted: this.accessibilityTrusted,
      sectionVisible: this.sectionVisible,
      hotkeyRegistered: this.hotkeyRegistered,
      hotkeyError: this.hotkeyError,
      message: this.getStatusMessage(supported, helperAvailable),
      settings: this.settings,
      items: this.items
    }
  }

  private getStatusMessage(supported: boolean, helperAvailable: boolean): string {
    if (!supported) {
      return this.support.message
    }

    if (!helperAvailable) {
      return '菜单栏 helper 尚未构建，请运行 build:menu-bar-helper。'
    }

    if (!this.settings.enabled) {
      return '菜单栏整理已关闭。'
    }

    if (!this.accessibilityTrusted) {
      return '需要在 macOS 辅助功能里允许 ForgeDesk 控制菜单栏。'
    }

    return this.statusMessage || '菜单栏整理已启用。'
  }

  private registerIpc(): void {
    this.options.ipcMain.handle('menu-bar-manager:status', async (): Promise<MenuBarManagerStatus> => this.refreshStatus())
    this.options.ipcMain.handle('menu-bar-manager:settings:save', async (_event, input: Partial<MenuBarManagerSettings>): Promise<MenuBarManagerStatus> => {
      this.settings = await writeMenuBarManagerSettingsFile(this.userDataPath, {
        ...this.settings,
        ...input,
        hotkeys: {
          ...this.settings.hotkeys,
          ...(input.hotkeys ?? {}),
          toggleHidden: {
            ...this.settings.hotkeys.toggleHidden,
            ...(input.hotkeys?.toggleHidden ?? {})
          }
        }
      })
      await this.syncRuntime()
      return this.publish()
    })
    this.options.ipcMain.handle('menu-bar-manager:permission:request', async (): Promise<MenuBarManagerStatus> => {
      await this.ensureHelper()
      await this.helper?.request('permission.requestAccessibility')
      return this.refreshStatus()
    })
    this.options.ipcMain.handle('menu-bar-manager:items:refresh', async (): Promise<MenuBarManagerStatus> => {
      await this.ensureHelper()
      const result = await this.helper?.request('items.refresh')
      this.applyHelperStatus(result)
      return this.publish()
    })
    this.options.ipcMain.handle('menu-bar-manager:section:show', async (): Promise<MenuBarManagerStatus> => this.runSectionCommand('section.show'))
    this.options.ipcMain.handle('menu-bar-manager:section:hide', async (): Promise<MenuBarManagerStatus> => this.runSectionCommand('section.hide'))
    this.options.ipcMain.handle('menu-bar-manager:section:toggle', async (): Promise<MenuBarManagerStatus> => this.runSectionCommand('section.toggle'))
  }

  private async refreshStatus(): Promise<MenuBarManagerStatus> {
    if (this.settings.enabled && this.support.supported && existsSync(this.helperPath)) {
      await this.ensureHelper()
      try {
        this.applyHelperStatus(await this.helper?.request('status.get'))
      } catch (error) {
        this.statusMessage = getErrorMessage(error)
      }
    }

    return this.publish()
  }

  private async runSectionCommand(method: 'section.show' | 'section.hide' | 'section.toggle'): Promise<MenuBarManagerStatus> {
    await this.ensureHelper()
    const result = await this.helper?.request(method)
    this.applyHelperStatus(result)
    return this.publish()
  }

  private async syncRuntime(): Promise<void> {
    this.syncHotkey()

    if (!this.settings.enabled) {
      await this.helper?.stop()
      this.helper = null
      this.statusMessage = '菜单栏整理已关闭。'
      return
    }

    if (!this.support.supported || !existsSync(this.helperPath)) {
      this.statusMessage = this.getStatusMessage(this.support.supported, existsSync(this.helperPath))
      return
    }

    await this.ensureHelper()
    await this.applySettingsToHelper()
  }

  private async ensureHelper(): Promise<void> {
    if (!this.support.supported) {
      throw new Error(this.support.message)
    }

    if (!existsSync(this.helperPath)) {
      throw new Error('菜单栏 helper 尚未构建')
    }

    if (!this.helper) {
      this.helper = new MenuBarHelperClient(
        this.helperPath,
        this.options.requestTimeoutMs ?? 4000,
        (event) => this.handleHelperEvent(event),
        (message) => {
          this.statusMessage = message
          this.helper = null
          void this.publish()
        }
      )
      this.helper.start()
    }
  }

  private async applySettingsToHelper(): Promise<void> {
    if (!this.helper?.running) {
      return
    }

    try {
      const result = await this.helper.request('settings.apply', this.settings)
      this.applyHelperStatus(result)
      this.statusMessage = '菜单栏整理已启用。'
    } catch (error) {
      this.statusMessage = getErrorMessage(error)
    }
  }

  private handleHelperEvent(event: MenuBarHelperEvent): void {
    if (event.method === 'error') {
      this.statusMessage = isRecord(event.params) ? String(event.params.message ?? '菜单栏 helper 出错') : '菜单栏 helper 出错'
      void this.publish()
      return
    }

    if (event.method === 'ready') {
      void this.applySettingsToHelper().then(() => this.publish())
      return
    }

    this.applyHelperStatus(event.params)
    void this.publish()
  }

  private applyHelperStatus(value: unknown): void {
    const patch = parseHelperStatus(value)

    if (patch.accessibilityTrusted !== undefined) {
      this.accessibilityTrusted = patch.accessibilityTrusted
    }

    if (patch.sectionVisible !== undefined) {
      this.sectionVisible = patch.sectionVisible
    }

    if (patch.items) {
      this.items = this.mergeItemsWithSettings(patch.items)
    }
  }

  private mergeItemsWithSettings(items: MenuBarManagerItem[]): MenuBarManagerItem[] {
    const order = new Map(this.settings.orderedItemKeys.map((key, index) => [key, index]))

    return items
      .map((item) => ({
        ...item,
        section: this.settings.alwaysHiddenItemKeys.includes(item.key)
          ? 'always-hidden'
          : this.settings.hiddenItemKeys.includes(item.key)
            ? 'hidden'
            : item.section
      }))
      .sort((left, right) => {
        const leftOrder = order.get(left.key) ?? Number.MAX_SAFE_INTEGER
        const rightOrder = order.get(right.key) ?? Number.MAX_SAFE_INTEGER

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        return left.displayName.localeCompare(right.displayName, 'zh-Hans-CN')
      })
  }

  private syncHotkey(): void {
    this.unregisterHotkey()
    this.hotkeyError = ''

    const hotkey = this.settings.hotkeys.toggleHidden

    if (!this.settings.enabled || !hotkey.enabled || !hotkey.accelerator) {
      return
    }

    const registered = this.options.globalShortcut.register(hotkey.accelerator, () => {
      void this.runSectionCommand('section.toggle').catch((error) => {
        this.statusMessage = getErrorMessage(error)
        void this.publish()
      })
    })

    if (!registered) {
      this.hotkeyError = `无法注册快捷键 ${hotkey.accelerator}`
      this.hotkeyRegistered = false
      return
    }

    this.hotkeyRegistered = true
  }

  private unregisterHotkey(): void {
    const accelerator = this.settings.hotkeys.toggleHidden.accelerator

    if (accelerator && this.hotkeyRegistered && this.options.globalShortcut.isRegistered(accelerator)) {
      this.options.globalShortcut.unregister(accelerator)
    }

    this.hotkeyRegistered = false
  }

  private publish(): MenuBarManagerStatus {
    const status = this.getStatus()

    for (const window of this.options.getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('menu-bar-manager:changed', status)
      }
    }

    return status
  }
}

