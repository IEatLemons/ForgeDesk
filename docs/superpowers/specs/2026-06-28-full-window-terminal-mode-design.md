# Full Window Terminal Mode Design

## Goal

Add a sidebar toggle above Settings that switches ForgeDesk into a pure command-line tool view. In that view the whole window is dedicated to the terminal, including hiding the sidebar.

## User Experience

- The sidebar footer shows a new "命令行" entry directly above "设置".
- Selecting "命令行" changes the active app mode to a full-window terminal page.
- The terminal page hides the standard sidebar and content navigation.
- The terminal page has a compact top bar with the product name, a short "命令行工具" label, and a "返回控制台" button.
- The existing terminal workspace fills the remaining viewport and keeps its current tab, restart, and new-terminal controls.
- Selecting "返回控制台" restores the main ForgeDesk shell on the Projects page.

## Architecture

- Extend the app navigation model with a `terminal` key so the mode is handled consistently with the existing page state.
- Reuse `TerminalWorkspace` instead of adding another terminal implementation.
- Add CSS for a dedicated terminal shell that fills `100vh`, keeps the terminal visible, and gives the existing terminal workspace a full-height variant.

## Testing

- Update navigation tests to verify `terminal` appears immediately before `settings`.
- Run the renderer navigation test first in red state, then implement the minimal code and rerun it green.
- Run TypeScript linting after implementation.

## Scope

This design does not add terminal persistence across app restarts, a separate Electron window, project-specific default directories, or a command palette. Those can be added later without changing this mode boundary.
