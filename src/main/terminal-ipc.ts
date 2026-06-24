import type { TerminalCreateInput, TerminalSession } from './terminal-service'

export type TerminalIpcMain = {
  handle: (channel: string, listener: (event: unknown, ...args: any[]) => unknown) => void
}

export type TerminalIpcService = {
  create: (input?: TerminalCreateInput) => TerminalSession
  write: (sessionId: string, data: string) => void
  resize: (sessionId: string, cols: number, rows: number) => void
  close: (sessionId: string) => void
}

export function registerTerminalIpc(ipcMain: TerminalIpcMain, service: TerminalIpcService): void {
  ipcMain.handle('terminal:create', (_event, input?: TerminalCreateInput) => service.create(input))
  ipcMain.handle('terminal:write', (_event, sessionId: string, data: string) => service.write(sessionId, data))
  ipcMain.handle('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => service.resize(sessionId, cols, rows))
  ipcMain.handle('terminal:close', (_event, sessionId: string) => service.close(sessionId))
}
