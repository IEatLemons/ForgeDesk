# Terminal Remote Shortcuts Design

## Goal

Add a Termius-like remote shortcut library to ForgeDesk command-line mode. Users can organize SSH targets into groups, save connection metadata locally, and open a terminal tab that starts an SSH command.

## Scope

- Add a remote sidebar inside full-window command-line mode.
- Support remote groups with a permanent default group named `默认`.
- Support remote hosts with name, group, host, user, port, identity file, and notes.
- Reuse the existing SSH key inventory so identity files can be selected from local private keys.
- Clicking a host opens a terminal tab and writes an SSH command into it.
- Persist groups and hosts in the existing ForgeDesk SQLite database.

## Out Of Scope

- Do not store server passwords.
- Do not add cloud sync.
- Do not add jump hosts, port forwarding, SFTP, terminal themes, or multi-hop profiles in this iteration.
- Do not modify `~/.ssh/config` automatically.

## Security Boundary

ForgeDesk stores only connection metadata. It does not store remote account passwords. Private key passphrases continue to use the existing ForgeDesk SSH passphrase helpers. SSH commands are generated from validated fields and shell-quoted before being written into the terminal.

## Data Model

`terminal_remote_groups`

- `id`
- `name`
- `sort_order`
- `created_at`
- `updated_at`

`terminal_remote_hosts`

- `id`
- `group_id`
- `name`
- `host`
- `username`
- `port`
- `identity_file`
- `notes`
- `created_at`
- `updated_at`

Deleting a non-default group moves its hosts to the default group. The default group cannot be deleted.

## User Experience

- Command-line mode becomes a two-pane layout: remote shortcuts on the left, terminal on the right.
- The remote panel has group sections, a search box, and buttons to add groups and hosts.
- Each host row shows name, `user@host:port`, and a connect action.
- Host editing uses a drawer or modal with compact form fields.
- The terminal area stays full-height and keeps the existing tab controls.

## Terminal Launch

Connecting to a host creates a terminal open request with:

- `title`: the host display name
- `reuseKey`: `remote:<hostId>`
- `startupCommand`: the generated SSH command plus carriage return

The terminal service writes the startup command to the pty immediately after creating the shell.

## Testing

- Storage tests cover migration, default group creation, saving groups, saving hosts, group deletion behavior, and SSH command generation.
- Terminal service tests cover startup command writing to a new pty.
- Renderer tests cover grouping and filtering view-model helpers.
- Existing TypeScript lint and full test suite must pass.
