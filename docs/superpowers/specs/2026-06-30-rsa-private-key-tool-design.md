# RSA Private Key Tool Design

## Goal

Add an RSA private key generator to the ForgeDesk tools area. Users can generate RSA private keys, keep a local record of generated keys, and edit each record's name and notes later.

## Scope

- Add a new "RSA 私钥" entry under the existing tools page.
- Generate RSA private keys in the Electron main process with Node's `crypto` APIs.
- Persist generated records locally in SQLite.
- Let users list, rename, annotate, copy, and delete generated records.
- Keep this tool separate from the existing SSH key management feature.

## Non-Goals

- Do not write generated keys to `~/.ssh`.
- Do not upload or sync private keys.
- Do not add password encryption or cloud backup in this change.
- Do not generate SSH public/private key pairs from this page.

## User Experience

The tools landing page gains a third card for "RSA 私钥". Opening it shows a two-column workspace:

- A generation panel with fields for name, notes, and key size.
- A records panel showing generated key records with actions.

The default key size is 2048 bits, with 4096 bits available. After generation, the record appears immediately in the list. Records show name, notes, bit size, fingerprint, and creation time. Each row supports copying the private key, editing name and notes, and deleting the record.

The UI should make it clear that private key content is stored locally in the app database.

## Architecture

Create a focused main-process module, `src/main/rsa-private-keys.ts`, responsible for:

- SQLite table creation and migrations.
- Input validation for name, notes, and key size.
- RSA private key generation.
- Fingerprint derivation.
- CRUD operations for generated records.

Expose the module through IPC handlers in `src/main/index.ts`:

- `tools:rsa-private-keys:list`
- `tools:rsa-private-keys:create`
- `tools:rsa-private-keys:update`
- `tools:rsa-private-keys:delete`

Expose matching preload APIs in `src/preload/index.ts`, and add shared renderer types in `src/renderer/src/data.ts` or a focused renderer model file if that better matches the surrounding code.

In the renderer, extend `ToolsPanel` in `src/renderer/src/App.tsx` with a new tool key and a `RsaPrivateKeyTool` view. Keep layout and styling consistent with the existing password and file tools.

## Data Model

Store records in a SQLite table with these fields:

- `id`: stable generated ID.
- `name`: user-facing name.
- `notes`: optional notes.
- `key_size`: RSA modulus length, 2048 or 4096.
- `private_key_pem`: generated PKCS#8 PEM private key.
- `fingerprint`: SHA-256 fingerprint derived from the private key.
- `created_at`: ISO timestamp.
- `updated_at`: ISO timestamp.

Renderer list responses may include `privateKeyPem` because the user must be able to copy it. The app remains local-only, so the main security boundary is avoiding network transmission and keeping the feature out of SSH file management.

## Validation And Errors

- Name is required and trimmed.
- Notes are optional and trimmed.
- Key size must be 2048 or 4096.
- Missing records return a clear Chinese error message.
- Failed key generation or database operations surface through the existing message/error patterns.

## Testing

Main-process tests cover:

- Creating the table and listing an empty database.
- Generating a valid RSA PKCS#8 private key record.
- Persisting name, notes, size, fingerprint, and timestamps.
- Updating name and notes without regenerating the key.
- Rejecting invalid key sizes and blank names.
- Deleting records.

Renderer tests cover pure view-model helpers if introduced. If the UI stays inside `App.tsx`, add focused tests around any extracted helpers rather than brittle full-page tests.

## Implementation Notes

Use test-driven development for the new main-process module. The first failing tests should define the record API and generated PEM expectations before production code is added. After the storage behavior is green, wire IPC/preload, then add the renderer UI.
