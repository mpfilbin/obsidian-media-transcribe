# Media Transcribe

Download media with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and generate WebVTT subtitles and transcripts
locally with [whisper.cpp](https://github.com/ggml-org/whisper.cpp). Nothing leaves your machine.

**Desktop only** — the plugin runs external programs.

## How it works

1. Put a URL in a note's `media` frontmatter property (the property name is configurable):

   ```yaml
   ---
   media: https://www.youtube.com/watch?v=...
   ---
   ```

2. Run a command from the command palette:

   | Command | What it does |
   |---|---|
   | Download media for this note | `yt-dlp` saves the video, and the vault path is written to `media_file` |
   | Generate subtitles for this note | `ffmpeg` converts to 16 kHz WAV, `whisper-cli` writes `<media>.vtt`, path stored in `subtitles_file` |
   | Insert transcript from subtitles | Converts the VTT into paragraphs (optionally timestamped) under a `## Transcript` heading |
   | Insert transcript in time increments | Pick an increment (5 s, 10 s, 15 s, 30 s, 1 min, 5 min, or type any number of seconds) and insert a transcript with one timestamped paragraph per increment |
   | Save subtitles rolled up into time increments | Pick an increment and write a merged VTT beside the original, e.g. `Talk.10s.vtt` |
   | Download media and create transcript | Download, subtitles, and transcript in order |
   | Cancel download or transcription | Stops the running task, including any ffmpeg process yt-dlp started |

## Rolling up subtitles

whisper.cpp produces many short cues. Rolling up merges every cue that *starts* within each increment
into a single cue aligned to the increment boundary (`00:00:00`, `00:00:10`, `00:00:20`, …). Increments
with no speech are skipped. Set **Group transcript by** in the settings to use an increment by default
for **Insert transcript from subtitles**; the default groups paragraphs by pauses in speech.

## Requirements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg](https://ffmpeg.org/)
- A [whisper.cpp](https://github.com/ggml-org/whisper.cpp) build (`whisper-cli`)
- A ggml model such as `ggml-medium.bin` from [ggerganov/whisper.cpp on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main)

### Platform notes

- **macOS:** apps opened from the Dock don't inherit your shell `PATH`. The plugin also looks in
  `/opt/homebrew/bin` and `/usr/local/bin`; for anything else, set the absolute path in settings.
  If macOS blocks a downloaded binary, run `xattr -d com.apple.quarantine <file>` and `chmod +x <file>`.
- **Windows:** `.exe`, `.cmd` and `.bat` installs all work, including wrappers from scoop or pip.
  If whisper.cpp fails and your model path contains non-ASCII characters, move the model to a
  folder such as `C:\models`.
- Tool and model paths are saved **per operating system**, so a vault synced between a Mac and a
  Windows PC keeps the right paths on each. Paths saved by earlier versions move to the OS you open the vault on first.
- Downloaded files get Windows-safe names on every OS, capped at 80 bytes of title, with `[ ] # ^ |`
  replaced so they work in Obsidian links: `My Talk - dQw4w9WgXcQ.mp4`.
- Path settings accept pasted paths with surrounding quotes (Windows "Copy as path") and `~/…`.
- If you set an absolute ffmpeg path, it is passed to yt-dlp too (`--ffmpeg-location`), so merged
  video and audio downloads work without ffmpeg on `PATH`.

## Download location

The **Download folder** setting defaults to `_resources`, resolved **beside the note**
(`notes/talk.md` → `notes/_resources/`). A path starting with `/` is resolved from the vault root
(`/Attachments/Video`). An absolute path such as `C:\Vault\Media` or `/Users/me/Vault/Media` is
accepted if it is inside the vault; folders outside the vault are rejected with an error. Subtitles are saved next to the downloaded video.

## Installation

### From BRAT (recommended for beta testing)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository: `mpfilbin/media-transcribe`
3. Enable the plugin in Community Plugins settings

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Verify checksums against `SHA256SUMS.txt`: `sha256sum -c SHA256SUMS.txt`
3. Copy the files to `<vault>/.obsidian/plugins/media-transcribe/`
4. Enable the plugin in Community Plugins settings

## Development

Prerequisites: [Node.js](https://nodejs.org/) 20 or later (CI uses the version in `.nvmrc`).
[just](https://github.com/casey/just) is optional; every recipe has an `npm` or script equivalent.

```bash
npm install          # or: just setup
npm run dev          # watch mode
npm run test         # or: just test
just check           # lint + test + build
```

### Install to a local vault for testing

```bash
./scripts/install.sh /path/to/your/vault     # builds, then copies main.js, manifest.json, styles.css
./scripts/uninstall.sh /path/to/your/vault   # removes the plugin folder and its community-plugins.json entry
```

Or put `OBSIDIAN_VAULT=/path/to/your/vault` in `.env` and run `just install` / `just uninstall`.
After either, reload community plugins in Obsidian (or restart it).

### Working on Windows

The PowerShell scripts work with Windows PowerShell 5.1 or PowerShell 7+:

```powershell
npm install
.\scripts\install.ps1 C:\path\to\your\vault
.\scripts\uninstall.ps1 C:\path\to\your\vault
```

If the execution policy blocks them, run one invocation with
`powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 C:\path\to\your\vault`.
`npm run release` and the `just` recipes use bash, so run those from Git Bash or WSL.

## Creating a release

```bash
npm run release patch     # or minor / major (or: just release patch)
git push
```

This bumps the version in `package.json`, `package-lock.json` and `manifest.json` (and `versions.json`
when `minAppVersion` changes) and commits it. When a `manifest.json` change reaches the default branch,
the Release workflow builds the plugin and publishes a GitHub release named after the version, with
`main.js`, `manifest.json`, `styles.css` and `SHA256SUMS.txt` attached, ready for BRAT.

Pull requests run typecheck, lint and build on Ubuntu, and tests on Ubuntu, Windows and macOS.
Dependabot opens weekly updates for npm packages and GitHub Actions.
