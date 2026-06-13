---
name: backend
description: Backend implementation rules for the Awesome Sirus Launcher Electron main process and preload layer. Use when editing TypeScript backend modules, IPC contracts, file downloads, MD5 client patch checks, WTF backups, FPS patch installation, GitHub addon installation, settings persistence, logging, or game launch behavior.
---

# Sirus Launcher Backend

## Overview

Use this skill to keep launcher backend code safe, testable, and consistent. Treat Electron main process code as the only place allowed to touch the filesystem, network downloads, archives, process launch, and persistent settings.

## Architecture

Prefer these module boundaries:

- `settings`: read/write launcher config and selected WoW path.
- `wow-client`: validate WoW directory, derive `WTF`, `Data/ruRU`, `Interface/AddOns`, and `Wow.exe` paths.
- `downloads`: queued downloads, temporary files, progress, retry, cancellation.
- `patches`: fetch patch manifests, normalize paths, stream MD5 checks, update mismatched files.
- `fps-patch`: install `patch-ruRU-[.mpq` into `Data/ruRU`.
- `addons`: download GitHub repository source zip archives, unpack them safely, strip the top archive folder, and install real addon folders.
- `backup`: zip, list, restore, and safety-backup `WTF`.
- `launcher`: start WoW without blocking the UI.
- `logging`: write structured logs and forward user-facing events.

Keep shared DTOs and channel names in `shared` so main, preload, and renderer compile against the same contract.

## Electron Security

- Enable `contextIsolation`.
- Keep `nodeIntegration` disabled in renderer.
- Expose only a narrow typed API from preload through `contextBridge`.
- Validate all renderer inputs in IPC handlers.
- Return plain DTOs, not Node objects, streams, or internal classes.
- Never expose arbitrary filesystem operations to renderer.

## File Operations

- Use `path.join`, `path.resolve`, and `path.normalize`; do not concatenate paths by hand.
- Verify the selected WoW path before writing: require expected directories/files where practical.
- Download to a temporary file first, validate it, then move into place.
- Check archive entries before extraction and reject paths that escape the target directory.
- Before restoring `WTF`, create a safety backup of the current folder.
- Stream large files for MD5 and zip operations.

## Jobs And Progress

Represent long-running work as jobs:

```ts
export interface LauncherJob {
  id: string
  type: 'client-check' | 'client-update' | 'fps-patch' | 'addon-install' | 'wtf-backup' | 'wtf-restore'
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
- Try `https://d1st4r.ru/patch/patch-ruRU-[.mpq` before `http://d1st4r.stream/patch/patch-ruRU-[.mpq`.
- Download GitHub addons as repository source zip files, not release assets for the MVP.
- After unpacking a GitHub source zip, do not install the top folder like `{repo}-{branch}`. Find folders containing `.toc` and move those addon folders into `<wowPath>/Interface/AddOns`.
- Back up `<wowPath>/WTF` into timestamped zip archives.
- Launch only the validated WoW executable, not arbitrary user-provided commands.

## Testing

- Unit test path derivation, manifest parsing, fallback source selection, and MD5 comparison.
- Integration test backup/restore and addon extraction using temporary directories.
- Mock network calls; do not depend on live patch servers in unit tests.
- Add regression tests for any bug involving data loss, path traversal, or failed validation.
