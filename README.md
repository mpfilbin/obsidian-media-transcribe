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
   | Download media and create transcript | All three steps in order |

## Requirements

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg](https://ffmpeg.org/)
- A [whisper.cpp](https://github.com/ggml-org/whisper.cpp) build (`whisper-cli`)
- A ggml model such as `ggml-medium.bin` from [ggerganov/whisper.cpp on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/tree/main)

GUI apps often do not inherit your shell `PATH`; if a tool is not found, set its absolute path in the settings.

## Download location

The **Download folder** setting defaults to `_resources`, resolved **beside the note**
(`notes/talk.md` → `notes/_resources/`). A path starting with `/` is resolved from the vault root
(`/Attachments/Video`). Paths cannot escape the vault. Subtitles are saved next to the downloaded video.

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

Prerequisites: [Node.js](https://nodejs.org/) (LTS), [just](https://github.com/casey/just)

```bash
# Install dependencies
just setup

# Start development (watch mode)
just dev

# Run tests
just test

# Run all checks
just check

# Install to your test vault
echo 'OBSIDIAN_VAULT=/path/to/your/vault' > .env
just install
```

## Creating a release

```bash
# Bump version (patch/minor/major)
just version-bump patch

# Run full release pipeline
just release-build

# Tag and push (triggers GitHub Action)
just tag
```

The GitHub Action will automatically create a BRAT-compatible release with build artifacts
and SHA-256 checksums.
