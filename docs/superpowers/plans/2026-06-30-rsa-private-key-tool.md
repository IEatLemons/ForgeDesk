# RSA Private Key Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local RSA private key generator and generated-record manager to ForgeDesk tools.

**Architecture:** A focused main-process module owns RSA generation, validation, SQLite migration, and CRUD. IPC/preload expose the module to the renderer, and the existing tools page gains a third tool view that lists, creates, updates, copies, and deletes records.

**Tech Stack:** Electron, Node `crypto`, better-sqlite3-style database interface, React 18, Ant Design, node:test.

---

### Task 1: Main-Process RSA Storage And Generation

**Files:**
- Create: `src/main/rsa-private-keys.spec.ts`
- Create: `src/main/rsa-private-keys.ts`

- [ ] **Step 1: Write failing tests**

Add tests for migration, empty listing, valid RSA PKCS#8 generation, update, validation, and delete.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/main/rsa-private-keys.spec.ts`
Expected: FAIL because `src/main/rsa-private-keys.js` does not exist.

- [ ] **Step 3: Implement the module**

Implement `migrateRsaPrivateKeyTables`, `listRsaPrivateKeyRecords`, `createRsaPrivateKeyRecord`, `updateRsaPrivateKeyRecord`, and `deleteRsaPrivateKeyRecord`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/main/rsa-private-keys.spec.ts`
Expected: PASS.

### Task 2: IPC, Preload, And Types

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/vite-env.d.ts`
- Modify: `src/renderer/src/data.ts`

- [ ] **Step 1: Add type and wiring tests where practical**

Use TypeScript compilation as the verification boundary for preload/window API shape.

- [ ] **Step 2: Wire database migration and IPC**

Import the RSA module, call `migrateRsaPrivateKeyTables(db)`, and add four IPC handlers:
`tools:rsa-private-keys:list`, `tools:rsa-private-keys:create`, `tools:rsa-private-keys:update`, and `tools:rsa-private-keys:delete`.

- [ ] **Step 3: Expose renderer APIs**

Add preload functions and window types for listing, creating, updating, and deleting RSA private key records.

- [ ] **Step 4: Verify type surface**

Run: `npm run lint`
Expected: PASS.

### Task 3: Tools UI

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Extend the tools landing page**

Add `rsa` to the tool key union and render an "RSA 私钥" entry card.

- [ ] **Step 2: Add the RSA private key tool view**

Render a generation form, local-storage notice, records table, edit modal, copy action, and delete action.

- [ ] **Step 3: Keep rendering efficient**

Keep components at module scope, use primitive effect dependencies, and refresh records after write actions.

- [ ] **Step 4: Verify focused and full checks**

Run: `npm test -- src/main/rsa-private-keys.spec.ts`
Run: `npm run lint`
Expected: both PASS.
