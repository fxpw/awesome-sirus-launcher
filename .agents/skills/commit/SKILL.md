---
name: commit
description: Commit message writing rules for Awesome Sirus Launcher. Use when Codex or another agent needs to describe a commit, prepare a commit message, summarize staged or unstaged changes for git, or propose a conventional commit after code, docs, build, changelog, rules, or skill changes.
---

# Commit Message

## Overview

Use this skill when preparing a commit description. Base the message on actual changed files and behavior, not on the original user request alone.

## Workflow

1. Inspect changes with `git status --short`.
2. Read the relevant diff with `git diff` or `git diff --staged`.
3. Identify the main user-visible or maintenance-level purpose.
4. Choose a Conventional Commit type.
5. Write the subject in English, short and imperative.
6. Add a body only when it clarifies important context, risk, or follow-up.
7. Mention tests/checks only if they were actually run.

## Format

Prefer Conventional Commits:

```text
type(scope): short imperative summary

Optional body with concise details.
```

Allowed common types:

- `feat`: new user-facing capability or planned capability.
- `fix`: bug fix.
- `docs`: documentation-only changes.
- `build`: build, packaging, release, CI, dependency tooling.
- `test`: tests only.
- `refactor`: behavior-preserving code restructure.
- `chore`: repository maintenance, rules, skills, metadata.
- `ci`: GitHub Actions and automation.

Use scopes when helpful: `docs`, `agents`, `backend`, `frontend`, `build`, `release`, `addons`, `patches`.

## Rules

- Keep the subject under 72 characters when practical.
- Do not end the subject with a period.
- Do not claim implementation that is only planned in docs.
- If the change touches only plans/rules/skills, prefer `docs`, `chore`, or `ci`.
- If `CHANGELOG.md` was updated because of the change, do not make the commit only about the changelog; describe the real change.
- For mixed changes, choose the type for the highest-level intent and mention secondary changes in the body.

## Examples

```text
docs: add launcher roadmap and agent rules
```

```text
chore(agents): add changelog maintenance skill
```

```text
ci: add version-gated build workflow
```

```text
docs(addons): define GitHub source zip install flow
```
