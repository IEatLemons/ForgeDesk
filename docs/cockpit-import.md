# Cockpit Tools compatibility

Reference: https://github.com/jlcodes99/cockpit-tools at commit
`13744acd3cfd575e6ca0b3371d9a1ae1012896df`.
This adapter independently implements the persisted JSON and AES-256-GCM formats;
it does not run or embed Cockpit code.

## Entry points

AI settings → **Codex 账号与 API** → **从 Cockpit 导入**. The global Codex
account page uses the same account and API components.

Choose the Cockpit data directory (normally `~/.cockpit_tools`), the legacy
application support directory, or a portable account JSON export. Preview the
accounts, select the desired ones, and optionally import the API configuration.
The preview contains metadata only. Credentials and decryption keys stay in the
main process; no source files are changed, no account is activated automatically,
and no validation request is sent by importing.

## Supported formats

- `codex_accounts.json` index plus `codex_accounts/<id>.json` details.
- Legacy plaintext account details and version 1 AES-256-GCM envelopes, using the
  source directory's existing `secure-account-storage.key`. A missing or incorrect
  key is reported per account and is never created or replaced.
- A portable account object, array of account objects, or inline `accounts` array.
- OAuth tokens converted to a dedicated Codex `auth.json`, and built-in OpenAI
  API-key accounts. Custom upstream provider accounts are identified and reported
  as unsupported so their credentials cannot accidentally be routed to OpenAI.
- Team, note, tags, plan, subscription expiration, quota remaining/reset times,
  and reset credit count/expiration. Imported quota is a timestamped Cockpit
  snapshot, displayed separately from ForgeDesk's live quota. Imported expiration
  does not replace the manually maintained renewal date.
- Optional API port and client key, stored with the service stopped and loopback
  binding preserved. An already running ForgeDesk service must first be stopped.

Existing accounts and current selection are preserved. Identical account/team
identities or previously imported credential fingerprints are skipped, including
concurrent repeated import requests. Unreadable/unsupported accounts do not stop
the other selected accounts from importing. Errors never echo malformed JSON.

## Compatibility limits

Cockpit account pools, proxies, routing rules, model mappings, additional client
keys, OAuth bindings, image routing, and CLI profile settings are not transferred.
The preview explicitly reports this scope. ForgeDesk's local API continues to
use the currently selected account, rather than claiming pool routing support.
The client API key can be copied through a main-process clipboard action; Codex
access/refresh tokens are never returned to the renderer.

The configuration drawer has a single body scroll area and ends above the status
bar. Provider settings and Codex account/API management are separate tabs, with
responsive account cards and wrapping controls for narrow windows.
