---
name: frontend
description: Frontend implementation rules for the Awesome Sirus Launcher Vue renderer. Use when editing Vue components, Pinia stores, renderer routes, UI states, progress views, settings screens, addon management screens, backup screens, patch/update screens, logs, or user-facing error handling.
---

# Sirus Launcher Frontend

## Overview

Use this skill to build a compact, reliable launcher UI for repeated operational workflows: choose WoW path, back up `WTF`, install patches, update addons, verify client files, and launch the game.

## Product Shape

The app is a work-focused launcher, not a marketing page. Prefer dense, readable layouts with clear status, direct actions, and visible progress.

Primary views:

- Dashboard: client status, quick actions, active jobs.
- Addons: installed/available addons, versions, install/update/remove actions.
- Client Update: MD5 check status, changed files, update progress.
- FPS Patch: installed status and install/reinstall action.
- Backups: create, restore, delete, and inspect `WTF` backups.
- Settings: WoW path, source preferences, launch behavior.
- Logs: recent operations and errors.

## Vue Structure

- Keep `.vue` files focused on presentation and local interaction.
- Put domain state in Pinia stores: `settings`, `client`, `jobs`, `addons`, `backups`, `logs`.
- Put reusable logic in composables, not global mixins.
- Keep IPC calls behind typed service modules so components do not call `window.api` directly everywhere.
- Use shared DTOs from `shared`; do not duplicate backend response shapes.

## UI Rules

- Show one primary action per view.
- Dangerous actions require confirmation: restore backup, delete backup, remove addon, overwrite files.
- Every long operation must show progress, current step, and a cancellable/disabled state as appropriate.
- Use stable dimensions for toolbars, rows, progress blocks, and action buttons so text changes do not shift layout.
- Translate backend errors into user-facing messages and keep technical details available in Logs.
- Use icons for common actions after the icon library is chosen.
- Do not put explanatory onboarding text where a clear control or status would do the job.

## States To Cover

For each operational screen, cover:

- initial/loading;
- ready;
- empty;
- running;
- success;
- recoverable error;
- disabled because WoW path is missing or invalid.

## Copy

Use concise Russian UI text by default. Prefer action labels like:

- `Выбрать папку WoW`
- `Сделать бекап WTF`
- `Восстановить`
- `Проверить клиент`
- `Установить FPS-патч`
- `Обновить аддоны`
- `Запустить игру`

Avoid long paragraphs in the app. Put technical details in logs or expandable details.

## Testing

- Unit test stores and composables when they contain branching logic.
- Component test critical states for settings, backups, patches, and jobs.
- Use Playwright for smoke flows after the Electron app exists.
- Verify text does not overflow in narrow windows.
