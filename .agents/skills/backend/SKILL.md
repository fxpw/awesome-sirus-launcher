---
name: backend
description: Backend implementation rules for the Awesome Sirus Launcher Electron TypeScript backend. Use when editing TypeScript core modules, Electron main/preload adapters, IPC contracts, file downloads, MD5 client patch checks, WTF backups, FPS patch installation, GitHub addon installation, launcher auto-update, account profile storage, Config.wtf account switching, settings persistence, logging, or game launch behavior.
---

# Sirus Launcher Backend

## Overview

Use this skill to keep launcher backend code safe, testable, and consistent. Keep domain logic in portable TypeScript `core` modules, and treat Electron main/preload as thin shell adapters around that core.

## Architecture

Current module boundaries (`src/core/<domain>` for pure rules, `src/main/<domain>` for side effects):

- `settings`: read/write launcher config (`settings.json` in app data) and the selected WoW path.
- `secrets`: store GitHub token and account passwords through Electron `safeStorage`.
- `accounts`: store local account profiles, protect saved passwords, and update `WTF/Config.wtf` before launch.
- `wow`: validate the WoW directory and derive `WTF`, `Data/ruRU`, `Interface/AddOns`, and `run.exe` paths.
- `downloads`, `files`, `archive`: download to a file, fetch JSON, stream MD5, read/write JSON atomically, move files, zip/unzip with path checks.
- `clientPatches`: fetch patch manifests with mirror fallback, normalize paths, stream MD5 checks with a cache, download missing or mismatched files.
- `fpsPatch`: install `patch-ruRU-[.mpq` into `Data/ruRU`.
- `addons`, `github`: download GitHub repository source zip archives through the GitHub network session (proxy, token, diagnostics), unpack them safely, strip the top archive folder, and install real addon folders.
- `backup`: zip, list, restore, and safety-backup `WTF`.
- `launcher`: start WoW without blocking the UI.
- `updater`: check GitHub Releases, compare launcher versions, download update assets, and trigger installation.
- `device`, `secureConnection`, `sirus`: Sirus-compatible device registration, handshake and MCR check.
- `mining`: optional external miner process.

There is no logging module yet: main writes to the console. A structured operation log is planned in `docs/ROADMAP.md`.

Keep shared DTOs and channel names in `shared` so main, preload, renderer, and tests compile against the same contract.

## Desktop Request Flow

Adapt service backend layering to Electron desktop:

- `ipc channel`: route name from `shared`.
- `request/response schema`: Zod validation near the IPC layer.
- `handler/controller`: validates input/output and delegates.
- `service/core`: portable domain logic without Electron imports.
- `adapter`: Electron, filesystem, downloader, archive, process, or secret storage boundary.

Do not add manual ad-hoc `if/throw` validation in IPC handlers when a Zod schema can describe the input or output.

## Electron Security

- Enable `contextIsolation`.
- Keep `nodeIntegration` disabled in renderer.
- Expose only a narrow typed API from preload through `contextBridge`.
- Validate all renderer inputs in IPC handlers.
- Return plain DTOs, not Node objects, streams, or internal classes.
- Never expose arbitrary filesystem operations to renderer.

## Portability

- Keep `core` free of `electron` imports (enforced by `tests/portableCore.test.ts`), network calls, process launches and file writes. `node:path` and read-only `node:fs` checks are allowed there.
- Put filesystem, downloader, archive, process launch, and secret storage behind interfaces.
- Keep Electron-specific code in adapters that call `core`.
- Add tests for `core` behavior before wiring it to IPC.
- Use fake adapters in tests so future migration to Tauri or another shell only replaces adapters.

## File Operations

- Use `path.join`, `path.resolve`, and `path.normalize`; do not concatenate paths by hand.
- Verify the selected WoW path before writing: require expected directories/files where practical.
- Download to a temporary file first, validate it, then move into place.
- Check archive entries before extraction and reject paths that escape the target directory.
- Before restoring `WTF`, create a safety backup of the current folder.
- Before editing `WTF/Config.wtf`, create a quick safety backup and change only the required account lines.
- Stream large files for MD5 and zip operations.

## Jobs And Progress

Current state: there is no job model. Progress events exist for the client check (`progress:client-check`) and addon installs (`progress:addons`); only the client check can be cancelled (`client:cancel-check`, `AbortController` in `clientPatchService`). Events carry no job id.

Target model for new long-running work (not implemented yet, see `docs/ARCHITECTURE.md` §7):

```ts
export interface LauncherJob {
	id: string
	type:
		| 'client-check'
		| 'client-update'
		| 'fps-patch'
		| 'addon-install'
		| 'wtf-backup'
		| 'wtf-restore'
	status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
	progress: number
	message?: string
	error?: string
}
```

Emit progress events from main to renderer. Keep cancellation cooperative and make retries explicit.

## Domain Rules

- Fetch client MD5 manifests from `https://s-patches.pro/api/client/patches`, then `https://s-patches.ru/api/client/patches`, then `https://sirus.world/api/client/patches`.
- Install the FPS patch as `<wowPath>/Data/ruRU/patch-ruRU-[.mpq`.
- Order FPS patch sources with `orderFpsPatchSourceUrls`: when the HTTPS manifest provides an MD5 hash, try `http://d1st4r.stream/patch/patch-ruRU-[.mpq` first and `https://d1st4r.ru/patch/patch-ruRU-[.mpq` second; without a hash keep HTTPS first and the HTTP mirror as the fallback.
- Download GitHub addons as repository source zip files, not release assets for the MVP.
- Support an optional GitHub token for addon downloads/API calls to raise rate limits. Store it as a secret, use `Authorization: Bearer ...`, never log it, and keep addon downloads working without it when possible.
- After unpacking a GitHub source zip, do not install the top folder like `{repo}-{branch}`. Find folders containing `.toc` and move those addon folders into `<wowPath>/Interface/AddOns`.
- Back up `<wowPath>/WTF` into timestamped zip archives.
- For multi-account launch, update `<wowPath>/WTF/Config.wtf` with `SET accountName "login"` and `SET readTerminationWithoutNotice "password"` immediately before launching the game.
- For launcher auto-update, compare the app version with GitHub Releases and ignore pre-releases unless the hidden `allowPrereleaseUpdates` flag is set in `settings.json` (no UI toggle on purpose). Download to a temporary file and check size and the `MZ` executable signature before running it. Checksum/signature validation and a manual fallback to the release page are not implemented yet.
- Never log saved passwords or write them to plaintext launcher logs/settings. Prefer OS-protected storage for secrets.
- Launch only `run.exe` from the validated WoW folder, the miner exe chosen by the user after explicit consent, and the downloaded launcher update after the size and PE signature check. Never launch commands or paths supplied by the renderer (see `docs/ARCHITECTURE.md` §4).

## Testing

- Unit test path derivation, manifest parsing, fallback source selection, and MD5 comparison.
- Unit test GitHub token handling without exposing token values: auth header creation, redacted logging, 401/403 handling, and rate-limit parsing.
- Unit test app updater version comparison, release parsing, pre-release filtering, asset selection, and fallback behavior.
- Integration test backup/restore and addon extraction using temporary directories.
- Add adapter contract tests for filesystem, downloader, archive extraction, process launch, and secret storage. Archive, JSON file and GitHub downloader tests exist; process launch and the Electron secret store have none yet.
- Mock network calls; do not depend on live patch servers in unit tests.
- Add regression tests for any bug involving data loss, path traversal, or failed validation.
