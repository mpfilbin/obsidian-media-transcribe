# CLAUDE.md — Agent Instructions for Media Transcribe

This file defines mandatory development practices for AI agents working on this Obsidian plugin.
These rules are non-negotiable.

## Project Commands

Read the `justfile` for the full list. Key commands:

- `just setup` — Install dependencies
- `just dev` — Compile in watch mode
- `just build` — Production build
- `just test` — Run tests
- `just test-watch` — Run tests in watch mode
- `just lint` — Run ESLint
- `just check` — Full validation (lint + test + build)
- `just install` / `just uninstall` — Install into / remove from a vault (set OBSIDIAN_VAULT in .env); wrap `scripts/install.sh` and `scripts/uninstall.sh` (PowerShell versions in `scripts/*.ps1`)
- `just release <major|minor|patch>` — Bump the version and commit (`scripts/release.sh`)

## Test-Driven Development (mandatory)

Every code change must follow the red-green-refactor cycle:

1. **Red** — Write a minimal failing test that describes the next behavior
2. **Green** — Write only enough implementation code to make that test pass
3. **Refactor** — Clean up while keeping tests green

Never write implementation code without a failing test first. Never skip ahead and write
multiple features before testing them.

## Test Structure (mandatory)

Use vitest with `describe`, `it`, and `expect` exclusively. Never use `assert`.

### Rule: One assertion per test

Every `it` block makes exactly one `expect` call. If you need to verify multiple things,
write multiple `it` blocks.

```typescript
// WRONG — multiple assertions
it('processes the file correctly', () => {
    expect(result.wordCount).toBe(42);
    expect(result.lineCount).toBe(10);
});

// CORRECT — one assertion per test
it('counts 42 words', () => {
    expect(result.wordCount).toBe(42);
});

it('counts 10 lines', () => {
    expect(result.lineCount).toBe(10);
});
```

### Rule: Describe blocks mirror code branches

Every conditional branch (`if`, `switch`, ternary) in the code under test gets its own
`describe` block. Nested conditions use nested `describe` blocks.

```typescript
describe('formatDate', () => {
    describe('when the locale is en-US', () => {
        describe('when includeTime is true', () => {
            it('returns date with time in 12-hour format', () => {
                expect(formatDate(date, 'en-US', true)).toBe('1/15/2025, 3:30 PM');
            });
        });

        describe('when includeTime is false', () => {
            it('returns date without time', () => {
                expect(formatDate(date, 'en-US', false)).toBe('1/15/2025');
            });
        });
    });

    describe('when the locale is not provided', () => {
        it('uses the default locale', () => {
            expect(formatDate(date)).toBe('2025-01-15');
        });
    });
});
```

### Rule: Describe blocks use "when" language

Use `describe('when ...')` to express preconditions. Use `it('does something')` to express
the expected outcome. This reads as a specification:

```
formatDate
  when the locale is en-US
    when includeTime is true
      ✓ returns date with time in 12-hour format
    when includeTime is false
      ✓ returns date without time
  when the locale is not provided
    ✓ uses the default locale
```

## Code Organization

- Keep `src/main.ts` focused on plugin lifecycle (`onload`, `onunload`) — delegate to modules
- Settings in `src/settings.ts` — interface, defaults, and SettingTab class
- Commands in `src/commands/` — one file per command or command group
- UI components in `src/ui/` — modals, views, React/Svelte components
- Utility functions in `src/utils/` — pure functions, helpers, constants
- Types in `src/types.ts` — shared TypeScript interfaces

## Obsidian Plugin Rules

- Register all events with `this.registerEvent()` — never bare `.on()`
- Register all intervals with `this.registerInterval()` — never bare `setInterval()`
- Use `Vault.process()` for background file modifications
- Use the `Editor` API for modifications to the active editor
- Use `normalizePath()` for user-provided file paths
- Use `requestUrl()` instead of `fetch()`
- No `console.log` in `onload()` or `onunload()`
- Never create `<link>` or `<style>` elements — use `styles.css`
- Scope all CSS to plugin-specific classes

## Version Management

Never edit version numbers directly. Use:

```bash
just release patch   # 0.1.0 → 0.1.1 (or: npm run release patch)
just release minor   # 0.1.0 → 0.2.0
just release major   # 0.1.0 → 1.0.0
```

This updates `package.json`, `package-lock.json`, `manifest.json` (and `versions.json` when
`minAppVersion` changes) and commits. Pushing a `manifest.json` change to the default branch
triggers the Release workflow.

## Project Architecture

Desktop-only plugin (`isDesktopOnly: true`) that shells out to `yt-dlp`, `ffmpeg` and whisper.cpp.

- `src/settings.ts` — settings, `loadSettings` (migrates old data), and per-OS tool paths (`toolPathsFor`, `setToolPath`)
- `src/utils/paths.ts` — pure vault path helpers (`resolveDownloadFolder`)
- `src/utils/embed.ts` — pure helpers for the `![title](path)` media embed (`relativeLinkPath`, `encodeLinkPath`, `buildEmbed`, `insertEmbed`)
- `src/utils/platform.ts` — pure OS helpers (`cleanPathSetting`, `buildChildEnv`, `pickAsciiTempDir`); take the platform as a parameter so every branch is testable on any OS
- `src/utils/process.ts` — `runProcess` (cross-spawn, no shell, abortable; cancelling kills the whole process tree); inject it as a `ProcessRunner` so pipelines are testable with fakes
- `src/media/args.ts` — pure argument builders for yt-dlp, ffmpeg, whisper-cli; `parseYtDlpOutput` reads the JSON `@@mtfile` line (file path and title)
- `src/media/format.ts` — `buildFormatArgs` (resolution cap, MP4 or AV1/VP9, audio only, size-aware selection) and `sizeWarning`; sizes are decimal MB, matching yt-dlp's `MB`
- `src/media/presets.ts` — download presets (`DOWNLOAD_PRESETS`, `applyPreset`, `matchPreset`); the chosen preset is derived from the values, never stored
- `src/media/pipeline.ts` — `downloadMedia`, `generateSubtitles` (both take an `onProgress` listener); `downloadMedia` has yt-dlp write in-progress files to a scratch folder outside the vault (`-P temp:`) so other plugins never see `.part`/`.ytdl` files
- `src/types.ts` — shared types, including `Progress`
- `src/progress/` — pure parsers turning yt-dlp, ffmpeg and whisper output lines into `Progress` (`ytdlp.ts`, `audio.ts`, `whisper.ts`) and `format.ts` for status bar text
- `src/ui/progress-status.ts` — status bar item (`ProgressStatus`); written against a small `StatusElement` interface so it is testable without a DOM
- `src/transcript/vtt.ts` — VTT parser, serializer and transcript formatter; `section.ts` upserts the `## Transcript` section
- `src/transcript/rollup.ts` — `rollupCues` (fixed time increments) and `groupByPause`
- `src/utils/intervals.ts` — increment presets, suggestions and labels
- `src/ui/interval-modal.ts` — increment picker (`IntervalModal.pick`)
- `src/commands/queue.ts` — `TaskQueue`: runs tasks one at a time, drops duplicates (same command and note), cancels the current task or clears waiting ones
- `src/commands/workflow.ts` — pure command logic: `downloadAndTranscribe` (passes each step's path to the next instead of re-reading the metadata cache), `requirePath`, and queue notice text (`queuedMessage`, `duplicateMessage`, `outcomeMessage`)
- `src/main.ts` — commands and Obsidian glue only
- `tests/mocks/obsidian.ts` — runtime stub for the `obsidian` package (aliased in `vitest.config.ts`)

Keep logic in pure modules; keep `main.ts` thin.

The plugin must work on Windows and macOS. CI runs on Ubuntu, Windows and macOS; use
`describe.runIf(process.platform === 'win32')` for tests that need a real Windows shell.
