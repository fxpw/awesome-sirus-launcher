---
name: changelog
description: Changelog maintenance rules for Awesome Sirus Launcher. Use whenever Codex or another agent changes project files, adds features, fixes bugs, changes docs, modifies build/release behavior, updates agent rules, or prepares a versioned release so CHANGELOG.md and VERSION stay accurate.
---

# Changelog Maintenance

## Overview

Use this skill after making project changes. Every agent-authored change should either update `CHANGELOG.md` or explicitly determine that the change is not user-visible and does not need an entry.

## Workflow

1. Inspect the actual changes before editing the changelog.
2. Add entries under `## [Unreleased]`.
3. Use one of these sections: `Added`, `Changed`, `Fixed`, `Removed`, `Security`.
4. Write short Russian entries in past tense.
5. Group related changes into one readable bullet instead of listing every file.
6. Do not invent version numbers for ordinary development changes.
7. Update `VERSION` only when the user asks for a release/version bump or the task is explicitly release-related.
8. When releasing, move relevant `Unreleased` entries under `## [x.y.z] - YYYY-MM-DD` and update `VERSION`.

## Rules

- Keep `CHANGELOG.md` human-readable, not a commit log.
- Mention behavior, product capabilities, release/build changes, docs, and agent workflow changes.
- Skip noise such as formatting-only edits unless they affect maintainability or release behavior.
- Preserve newest versions at the top.
- Keep `VERSION` as the release trigger file for GitHub Actions.
- After creating a release commit, ensure `CHANGELOG.md`, `VERSION`, and `package.json` version match if `package.json` exists.

## Entry Examples

```md
### Added

- Добавлена установка FPS-патча с fallback-ссылкой.
```

```md
### Fixed

- Исправлена проверка путей при распаковке zip-архивов аддонов.
```
