# Terminal Remote Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grouped SSH remote shortcuts to full-window command-line mode.

**Architecture:** Store groups and hosts in SQLite through a focused main-process module, expose CRUD operations through preload IPC, and render a left remote shortcut panel beside the existing `TerminalWorkspace`. Terminal connections reuse the existing terminal service with a new `startupCommand` field that writes an SSH command into the newly created shell.

**Tech Stack:** Electron main/preload IPC, better-sqlite3, React 18, Ant Design, xterm-backed `TerminalWorkspace`, Node test runner, TypeScript.

---

## File Structure

- Create `src/main/terminal-remote-shortcuts.ts`: migration, validation, storage CRUD, SSH command builder.
- Create `src/main/terminal-remote-shortcuts.spec.ts`: storage and command-generation tests.
- Modify `src/main/index.ts`: run migration and register IPC handlers.
- Modify `src/main/terminal-service.ts`: add optional `startupCommand` to terminal creation and write it to new pty sessions.
- Modify `src/main/terminal-service.spec.ts`: verify startup command write behavior.
- Modify `src/preload/index.ts`: expose remote shortcut APIs.
- Modify `src/renderer/src/vite-env.d.ts`: add remote shortcut and startup command types.
- Modify `src/renderer/src/terminal-panel-events.ts`: add `startupCommand` to terminal open requests.
- Modify `src/renderer/src/terminal-panel.tsx`: pass `startupCommand` into `openTerminal`.
- Create `src/renderer/src/terminal-remote-shortcuts-view.ts`: grouping and filtering helpers.
- Create `src/renderer/src/terminal-remote-shortcuts-view.spec.ts`: renderer helper tests.
- Modify `src/renderer/src/App.tsx`: render remote shortcut panel in terminal mode.
- Modify `src/renderer/src/styles.css`: style the terminal remote sidebar.

### Task 1: Main Storage Contract

**Files:**
- Create: `src/main/terminal-remote-shortcuts.spec.ts`
- Create: `src/main/terminal-remote-shortcuts.ts`

- [ ] **Step 1: Write failing storage tests**

Test cases:

```ts
it('migrates tables and creates the default group')
it('saves groups and hosts ordered by group and name')
it('moves hosts to the default group when deleting a custom group')
it('builds a quoted ssh command without storing passwords')
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/main/terminal-remote-shortcuts.spec.ts`

Expected: FAIL because `terminal-remote-shortcuts.ts` does not exist.

- [ ] **Step 3: Implement storage module**

Add exports:

```ts
export const DEFAULT_TERMINAL_REMOTE_GROUP_ID = 'remote-group-default'
export function migrateTerminalRemoteShortcutTables(db: Database.Database): void
export function listTerminalRemoteGroups(db: Database.Database): TerminalRemoteGroupRecord[]
export function saveTerminalRemoteGroup(db: Database.Database, input: TerminalRemoteGroupInput): TerminalRemoteGroupRecord
export function deleteTerminalRemoteGroup(db: Database.Database, groupId: string): TerminalRemoteGroupRecord[]
export function listTerminalRemoteHosts(db: Database.Database): TerminalRemoteHostRecord[]
export function saveTerminalRemoteHost(db: Database.Database, input: TerminalRemoteHostInput): TerminalRemoteHostRecord
export function deleteTerminalRemoteHost(db: Database.Database, hostId: string): TerminalRemoteHostRecord[]
export function buildTerminalRemoteSshCommand(host: TerminalRemoteHostRecord): string
```

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/main/terminal-remote-shortcuts.spec.ts`

Expected: PASS for the new storage suite.

### Task 2: Terminal Startup Command

**Files:**
- Modify: `src/main/terminal-service.spec.ts`
- Modify: `src/main/terminal-service.ts`

- [ ] **Step 1: Write failing terminal service test**

Add a test that creates a terminal with `startupCommand: "ssh example\r"` and asserts the fake pty receives that write after creation.

- [ ] **Step 2: Run test and verify red**

Run: `npm test -- src/main/terminal-service.spec.ts`

Expected: FAIL because `startupCommand` is ignored.

- [ ] **Step 3: Implement startup command**

Add `startupCommand?: string` to `TerminalCreateInput`. In `TerminalService.create`, after the record is stored and listeners are registered, write `input.startupCommand` to the pty when it is non-empty.

- [ ] **Step 4: Run test and verify green**

Run: `npm test -- src/main/terminal-service.spec.ts`

Expected: PASS.

### Task 3: IPC And Renderer Types

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/vite-env.d.ts`
- Modify: `src/renderer/src/terminal-panel-events.ts`
- Modify: `src/renderer/src/terminal-panel.tsx`

- [ ] **Step 1: Wire IPC handlers in main**

Expose list/save/delete for groups and hosts, plus `buildTerminalRemoteSshCommand` through host connection usage in the renderer by returning host records only.

- [ ] **Step 2: Wire preload and TypeScript global types**

Add `listTerminalRemoteGroups`, `saveTerminalRemoteGroup`, `deleteTerminalRemoteGroup`, `listTerminalRemoteHosts`, `saveTerminalRemoteHost`, and `deleteTerminalRemoteHost`.

- [ ] **Step 3: Pass startup commands through terminal requests**

Add `startupCommand?: string` to `TerminalOpenRequest` and pass it into `window.forgeDesk.openTerminal`.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 4: Renderer Grouping Helpers

**Files:**
- Create: `src/renderer/src/terminal-remote-shortcuts-view.ts`
- Create: `src/renderer/src/terminal-remote-shortcuts-view.spec.ts`

- [ ] **Step 1: Write failing renderer helper tests**

Test grouping hosts under groups, filtering by name/host/user, and formatting `user@host:port`.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/renderer/src/terminal-remote-shortcuts-view.spec.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement helper module**

Add `createTerminalRemoteGroupSections`, `filterTerminalRemoteHosts`, and `formatTerminalRemoteTarget`.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/renderer/src/terminal-remote-shortcuts-view.spec.ts`

Expected: PASS.

### Task 5: Terminal Mode UI

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Build remote shortcut state and loading**

In `App`, load remote groups and hosts when terminal mode is entered.

- [ ] **Step 2: Render the remote sidebar**

Add a dark sidebar with search, add group, add host, group sections, and host rows.

- [ ] **Step 3: Add create/edit/delete modals**

Use Ant Design `Modal` + `Form`. Host form includes group, name, host, user, port, identity file, notes. Identity file options come from `getGitSetupStatus().sshPrivateKeys`.

- [ ] **Step 4: Connect host to terminal**

Build a `TerminalOpenRequest` with `title`, `reuseKey`, and `startupCommand` generated client-side from the saved host fields with shell quoting mirrored from the storage module.

- [ ] **Step 5: Style terminal remote sidebar**

Use dark, dense terminal-adjacent styling. Keep text readable and avoid white panels.

- [ ] **Step 6: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 6: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run rendered QA if feasible**

Use the local renderer dev server and in-app browser to verify terminal mode renders a dark remote sidebar and no console errors.
