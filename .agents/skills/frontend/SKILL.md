---
name: frontend
description: Frontend implementation rules for the Awesome Sirus Launcher Vue renderer. Use when editing Vue components, composables, the dashboard page and its sections, UI states, progress views, settings screens, addon management screens, backup screens, patch/update screens, or user-facing error handling.
---

# Sirus Launcher Frontend

## Overview

Use this skill to build a compact, reliable launcher UI for repeated operational workflows: choose WoW path, back up `WTF`, install patches, update addons, verify client files, and launch the game.

## Product Shape

The app is a work-focused launcher, not a marketing page. Prefer dense, readable layouts with clear status, direct actions, and visible progress.

There is no router: `src/renderer/pages/DashboardPage.vue` is the single page and switches sections from the sidebar.

Current sections:

- Dashboard: client path, client check, addons and backup status, launcher update and game launch (account, token and language live in the header).
- Addons: installed/available addons, versions, install/update/remove actions.
- Client check: MD5 check status, changed files, check progress and stop.
- FPS Patch: installed status and install/reinstall/delete actions.
- WTF: create, restore, delete, and inspect `WTF` backups.
- Mining: optional external miner with explicit consent (to be replaced by Sidequest).
- Settings: WoW path, backup folder, GitHub connection and token, launch behavior.
- Thanks: authors support tab.

There is no Logs view; technical details stay in main-process console logs.

## Vue Structure

- Use explicit layers for refactored UI: `page -> block -> element -> component`.
- `page` assembles screen scenarios and blocks.
- `block` owns large page sections such as sidebar, header, menu, panels.
- `element` owns meaningful local UI zones such as forms, lists, cards, tables.
- `component` is reusable: buttons, fields, badges, toggles, rows, modal shells.
- Keep `.vue` files focused on presentation and local interaction; move new branching logic into composables or `core`.
- No store library is used (no Pinia). Screen state lives in the page and flows to blocks/elements through props; state shared by unrelated components goes into composables in `src/renderer/composables` (currently `useLocale`).
- Current state, not a pattern to copy: dashboard state and handlers live in `DashboardPage.vue`, and `elements/AddonsPanel.vue` owns the addons tab state and its API calls.
- Put reusable logic in composables, not global mixins.
- Call IPC through `launcherApi` from `src/renderer/api/launcherApi.ts` instead of using `window.launcher` directly.
- Use shared DTOs from `shared`; do not duplicate backend response shapes.
- Put browser-safe helpers, i18n dictionaries, mappers, and formatters in renderer `shared`.
- New/refactored frontend files should follow root `.prettierrc`; indentation uses tabs.

## UI Rules

- Show one primary action per view.
- Dangerous actions require confirmation: restore backup, delete backup, remove addon, delete account, delete FPS patch, reset mining config, overwrite files.
- Every long operation must show progress, current step, and a cancellable/disabled state as appropriate. Today only the client check and addon installs report progress, and only the client check can be stopped.
- Use stable dimensions for toolbars, rows, progress blocks, and action buttons so text changes do not shift layout.
- Translate backend errors into user-facing messages with `getUserErrorMessage` from `src/renderer/shared/errors.ts`; keep technical details in main-process logs.
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

Use localization keys for visible UI text. Russian is the default locale. Prefer action labels like:

- `Выбрать папку WoW`
- `Сделать бекап WTF`
- `Восстановить`
- `Проверить клиент`
- `Установить FPS-патч`
- `Обновить аддоны`
- `Запустить игру`

Avoid long paragraphs in the app. Put technical details in main-process logs or expandable details.

## Testing

- Unit test composables and renderer `shared` helpers when they contain branching logic (see `tests/i18n.test.ts`, `tests/rendererErrors.test.ts`).
- Planned, no tooling yet: component tests for critical states of settings, backups and patches.
- Planned, no tooling yet: Playwright smoke flows for the Electron app.
- Verify text does not overflow in narrow windows.
