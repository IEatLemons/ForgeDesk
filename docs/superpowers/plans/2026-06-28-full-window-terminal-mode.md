# Full Window Terminal Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidebar entry above Settings that switches ForgeDesk into a full-window command-line tool mode.

**Architecture:** Extend the existing app navigation key set with `terminal`, render a dedicated terminal shell when that key is active, and reuse `TerminalWorkspace` for terminal behavior. Keep the change scoped to renderer navigation, the app shell, and CSS.

**Tech Stack:** React 18, Ant Design, xterm via the existing `TerminalWorkspace`, TypeScript, Node test runner.

---

## File Structure

- Modify `src/renderer/src/app-navigation.ts`: add the `terminal` navigation key and label.
- Modify `src/renderer/src/app-navigation.spec.ts`: assert the new footer order places `terminal` before `settings`.
- Modify `src/renderer/src/App.tsx`: add the terminal footer entry, full-window terminal shell, and return action.
- Modify `src/renderer/src/styles.css`: add full-window terminal layout and full-height terminal workspace styling.

### Task 1: Navigation Contract

**Files:**
- Modify: `src/renderer/src/app-navigation.spec.ts`
- Modify: `src/renderer/src/app-navigation.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('places terminal directly above settings in the footer area', () => {
  assert.deepEqual(
    APP_NAVIGATION_ITEMS.map((item) => item.key),
    ['overview', 'services', 'tools', 'terminal', 'settings']
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/renderer/src/app-navigation.spec.ts`

Expected: FAIL because `APP_NAVIGATION_ITEMS` does not yet include `terminal`.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type AppNavigationKey = 'overview' | 'services' | 'tools' | 'terminal' | 'settings'

export const APP_NAVIGATION_ITEMS: AppNavigationItem[] = [
  { key: 'overview', label: '项目' },
  { key: 'services', label: '服务' },
  { key: 'tools', label: '工具' },
  { key: 'terminal', label: '命令行' },
  { key: 'settings', label: '设置' }
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/renderer/src/app-navigation.spec.ts`

Expected: PASS for the app navigation suite.

### Task 2: Terminal Shell UI

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Render the terminal footer entry**

Use the existing footer menu and include both `terminal` and `settings`. Add `CodeOutlined` to `navigationIcons`.

- [ ] **Step 2: Render the full-window terminal mode**

When `activeKey === 'terminal'`, return a root layout like:

```tsx
<Layout className="terminal-mode-shell">
  <div className="terminal-mode-header">
    <Space direction="vertical" size={0}>
      <Typography.Text strong>ForgeDesk</Typography.Text>
      <Typography.Text type="secondary">命令行工具</Typography.Text>
    </Space>
    <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveKey('overview')}>
      返回控制台
    </Button>
  </div>
  <div className="terminal-mode-body">
    <TerminalWorkspace defaultTitle="ForgeDesk CLI" />
  </div>
</Layout>
```

- [ ] **Step 3: Add full-window CSS**

```css
.terminal-mode-shell {
  min-height: 100vh;
  background: #101318;
}

.terminal-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 56px;
  padding: 10px 16px;
  border-bottom: 1px solid #273142;
  background: #151a22;
}

.terminal-mode-body {
  height: calc(100vh - 56px);
  padding: 0;
}

.terminal-mode-body .terminal-workspace {
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
}
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: TypeScript exits with code 0.

### Task 3: Final Verification

**Files:**
- Verify: `src/renderer/src/app-navigation.spec.ts`
- Verify: `src/renderer/src/App.tsx`
- Verify: `src/renderer/src/styles.css`

- [ ] **Step 1: Run focused test**

Run: `npm test -- src/renderer/src/app-navigation.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff -- src/renderer/src/app-navigation.ts src/renderer/src/app-navigation.spec.ts src/renderer/src/App.tsx src/renderer/src/styles.css docs/superpowers/specs/2026-06-28-full-window-terminal-mode-design.md docs/superpowers/plans/2026-06-28-full-window-terminal-mode.md`

Expected: Diff only contains the terminal mode feature and its docs.
