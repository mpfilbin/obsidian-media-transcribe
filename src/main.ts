import { FileSystemAdapter, Notice, Platform, Plugin, TFile, normalizePath } from 'obsidian';
import { homedir, tmpdir } from 'os';
import { join, relative, sep } from 'path';
import { env as processEnv } from 'process';
import { IntervalModal } from './ui/interval-modal';
import { ProgressStatus } from './ui/progress-status';
import { downloadAndTranscribe, duplicateMessage, outcomeMessage, queuedMessage, requirePath } from './commands/workflow';
import { TaskQueue } from './commands/queue';
import { DEFAULT_TOOL_PATHS, type MediaTranscribeSettings, MediaTranscribeSettingTab, loadSettings, toolPathsFor } from './settings';
import { downloadMedia, generateSubtitles } from './media/pipeline';
import { parseVtt, serializeVtt, vttToTranscript } from './transcript/vtt';
import { rollupCues } from './transcript/rollup';
import { formatInterval } from './utils/intervals';
import { upsertTranscriptSection } from './transcript/section';
import { getMediaUrl } from './utils/frontmatter';
import { basenameWithoutExtension, resolveDownloadFolder, rolledUpVttPath } from './utils/paths';
import { buildEmbed, encodeLinkPath, insertEmbed, relativeLinkPath } from './utils/embed';
import { runProcess } from './utils/process';
import { sizeWarning } from './media/format';
import { buildChildEnv, cleanPathSetting, pickAsciiTempDir, type OsPlatform } from './utils/platform';

/** Frontmatter properties written by the plugin. */
const MEDIA_FILE_PROPERTY = 'media_file';
const SUBTITLES_FILE_PROPERTY = 'subtitles_file';

export default class MediaTranscribe extends Plugin {
	settings: MediaTranscribeSettings;
	private status: ProgressStatus;
	/** Runs one task at a time; commands started meanwhile wait their turn. */
	private readonly queue = new TaskQueue({
		onStart: (task) => this.status.setNote(task.label),
		onFinish: (task, outcome) => {
			this.status.clear();
			const message = outcomeMessage(task.label, outcome);
			if (message) new Notice(message, outcome.cancelled ? 4000 : 10000);
		},
		onChange: (state) => this.status.setQueued(state.waiting),
	});
	readonly platform: OsPlatform = Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux';
	private readonly childEnv = buildChildEnv(processEnv, this.platform);

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'download-media',
			name: 'Download media for this note',
			checkCallback: (checking) =>
				this.forNote(checking, (file) => this.enqueue('download-media', file, () => this.download(file).then(() => undefined))),
		});

		this.addCommand({
			id: 'generate-subtitles',
			name: 'Generate subtitles for this note',
			checkCallback: (checking) =>
				this.forNote(checking, (file) =>
					this.enqueue('generate-subtitles', file, () => this.subtitles(file).then(() => undefined)),
				),
		});

		this.addCommand({
			id: 'insert-transcript',
			name: 'Insert transcript from subtitles',
			checkCallback: (checking) =>
				this.forNote(checking, (file) => this.enqueue('insert-transcript', file, () => this.transcript(file))),
		});

		this.addCommand({
			id: 'insert-transcript-in-increments',
			name: 'Insert transcript in time increments',
			checkCallback: (checking) =>
				this.forNote(checking, (file) => {
					void IntervalModal.pick(this.app).then((seconds) => {
						if (seconds !== null) {
							this.enqueue('insert-transcript-in-increments', file, () => this.transcript(file, undefined, seconds));
						}
					});
				}),
		});

		this.addCommand({
			id: 'save-subtitles-in-increments',
			name: 'Save subtitles rolled up into time increments',
			checkCallback: (checking) =>
				this.forNote(checking, (file) => {
					void IntervalModal.pick(this.app).then((seconds) => {
						if (seconds !== null) {
							this.enqueue('save-subtitles-in-increments', file, () => this.saveRolledUp(file, seconds));
						}
					});
				}),
		});

		this.addCommand({
			id: 'download-and-transcribe',
			name: 'Download media and create transcript',
			checkCallback: (checking) =>
				this.forNote(checking, (file) =>
					this.enqueue('download-and-transcribe', file, () =>
						downloadAndTranscribe(
							{
								download: (f) => this.download(f),
								subtitles: (f, media) => this.subtitles(f, media),
								transcript: (f, vtt) => this.transcript(f, vtt),
							},
							file,
						),
					),
				),
		});

		this.addCommand({
			id: 'cancel-running-task',
			name: 'Cancel download or transcription',
			checkCallback: (checking) => {
				const running = this.queue.running !== null;
				if (running && !checking) this.queue.cancelCurrent();
				return running;
			},
		});

		this.addCommand({
			id: 'clear-queued-tasks',
			name: 'Clear queued tasks',
			checkCallback: (checking) => {
				const waiting = this.queue.waitingCount > 0;
				if (waiting && !checking) {
					const removed = this.queue.clearWaiting();
					new Notice(`Removed ${removed} queued ${removed === 1 ? 'task' : 'tasks'}.`);
				}
				return waiting;
			},
		});

		const statusEl = this.addStatusBarItem();
		statusEl.addClasses(['media-transcribe-status', 'mod-clickable']);
		this.status = new ProgressStatus(statusEl);
		this.registerDomEvent(statusEl, 'click', () => this.queue.cancelCurrent());

		this.addSettingTab(new MediaTranscribeSettingTab(this.app, this));
	}

	onunload() {
		this.queue.stopAll();
	}

	async loadSettings() {
		this.settings = loadSettings(await this.loadData(), this.platform);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Commands are available whenever a markdown note is active. */
	private forNote(checking: boolean, start: (file: TFile) => void): boolean {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== 'md') return false;
		if (!checking) start(file);
		return true;
	}

	/** Run now, or queue behind the running task. The note is captured here, so switching notes is safe. */
	private enqueue(commandId: string, file: TFile, run: () => Promise<void>): void {
		const result = this.queue.enqueue({ key: `${commandId}:${file.path}`, label: file.basename, run: () => run() });
		if (result.status === 'queued') new Notice(queuedMessage(file.basename, result.ahead));
		else if (result.status === 'duplicate') new Notice(duplicateMessage(file.basename));
	}

	private get basePath(): string {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error('This plugin requires a local (filesystem) vault.');
		}
		return adapter.getBasePath();
	}

	private toVaultPath(absolute: string): string {
		return normalizePath(relative(this.basePath, absolute).split(sep).join('/'));
	}

	private toAbsolute(vaultPath: string): string {
		return `${this.basePath}${sep}${vaultPath.split('/').join(sep)}`;
	}

	private frontmatterOf(file: TFile): Record<string, unknown> | undefined {
		return this.app.metadataCache.getFileCache(file)?.frontmatter;
	}

	private async setFrontmatter(file: TFile, key: string, value: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[key] = value;
		});
	}

	/** Tool and model paths with quotes stripped and `~` expanded. */
	private get tools() {
		const ctx = { platform: this.platform, home: homedir() };
		const paths = toolPathsFor(this.settings, this.platform);
		return {
			ytDlpPath: cleanPathSetting(paths.ytDlpPath, ctx) || DEFAULT_TOOL_PATHS.ytDlpPath,
			ffmpegPath: cleanPathSetting(paths.ffmpegPath, ctx) || DEFAULT_TOOL_PATHS.ffmpegPath,
			whisperPath: cleanPathSetting(paths.whisperPath, ctx) || DEFAULT_TOOL_PATHS.whisperPath,
			modelPath: cleanPathSetting(paths.modelPath, ctx),
		};
	}

	/** whisper.cpp scratch space; avoids non-ASCII user folders on Windows. */
	private get tempDir(): string {
		const env = this.childEnv;
		return pickAsciiTempDir([
			tmpdir(),
			env.ProgramData ? join(env.ProgramData, 'media-transcribe') : undefined,
			env.PUBLIC ? join(env.PUBLIC, 'media-transcribe') : undefined,
		]);
	}

	/** Returns the downloaded file's vault path. */
	private async download(file: TFile): Promise<string> {
		const url = getMediaUrl(this.frontmatterOf(file), this.settings.mediaProperty);
		if (!url) {
			throw new Error(`No URL found in the "${this.settings.mediaProperty}" property of this note.`);
		}

		const folder = resolveDownloadFolder(file.path, this.settings.downloadFolder, this.basePath);
		if (!(await this.app.vault.adapter.exists(folder))) {
			await this.app.vault.adapter.mkdir(folder);
		}

		this.status.message('Starting download…');
		const downloaded = await downloadMedia(runProcess, {
			ytDlpPath: this.tools.ytDlpPath,
			ffmpegPath: this.tools.ffmpegPath,
			url,
			outputDir: this.toAbsolute(folder),
			extraArgs: this.settings.ytDlpExtraArgs,
			format: {
				type: this.settings.downloadType,
				maxResolution: this.settings.maxResolution,
				codec: this.settings.videoCodec,
				maxFileSizeMb: this.settings.maxFileSizeMb,
			},
			run: { signal: this.queue.signal, env: this.childEnv },
			onProgress: (progress) => this.status.update(progress),
		});
		const mediaPath = this.toVaultPath(downloaded.filePath);
		await this.setFrontmatter(file, MEDIA_FILE_PROPERTY, mediaPath);
		if (this.settings.embedMedia) {
			const linkPath = encodeLinkPath(relativeLinkPath(file.path, mediaPath));
			const embed = buildEmbed(downloaded.title || basenameWithoutExtension(mediaPath), linkPath);
			await this.app.vault.process(file, (content) => insertEmbed(content, embed, linkPath));
		}
		new Notice(`Downloaded media for "${file.basename}".`);
		const stat = await this.app.vault.adapter.stat(mediaPath);
		const warning = stat ? sizeWarning(file.basename, stat.size, this.settings.maxFileSizeMb) : null;
		if (warning) new Notice(warning, 15000);
		return mediaPath;
	}

	/** Returns the subtitle file's vault path. `mediaPath` skips re-reading the note's properties. */
	private async subtitles(file: TFile, mediaPath?: string): Promise<string> {
		const mediaFile = requirePath(
			mediaPath,
			this.frontmatterOf(file),
			MEDIA_FILE_PROPERTY,
			`No downloaded media found. Run the download command first (missing "${MEDIA_FILE_PROPERTY}").`,
		);

		this.status.message('Starting transcription…');
		const absoluteVtt = await generateSubtitles(runProcess, {
			ffmpegPath: this.tools.ffmpegPath,
			whisperPath: this.tools.whisperPath,
			mediaPath: this.toAbsolute(mediaFile),
			modelPath: this.tools.modelPath,
			language: this.settings.language,
			threads: this.settings.threads,
			extraArgs: this.settings.whisperExtraArgs,
			tempDir: this.tempDir,
			platform: this.platform,
			run: { signal: this.queue.signal, env: this.childEnv },
			onProgress: (progress) => this.status.update(progress),
		});
		const vttPath = this.toVaultPath(absoluteVtt);
		await this.setFrontmatter(file, SUBTITLES_FILE_PROPERTY, vttPath);
		new Notice(`Generated subtitles for "${file.basename}".`);
		return vttPath;
	}

	private subtitlesPath(file: TFile, explicit?: string): string {
		return requirePath(
			explicit,
			this.frontmatterOf(file),
			SUBTITLES_FILE_PROPERTY,
			`No subtitles found. Run the subtitle command first (missing "${SUBTITLES_FILE_PROPERTY}").`,
		);
	}

	private async transcript(
		file: TFile,
		subtitlesPath?: string,
		intervalSeconds = this.settings.transcriptIntervalSeconds,
	): Promise<void> {
		const vtt = await this.app.vault.adapter.read(this.subtitlesPath(file, subtitlesPath));
		const text = vttToTranscript(parseVtt(vtt), {
			timestamps: this.settings.transcriptTimestamps,
			paragraphGapSeconds: this.settings.paragraphGapSeconds,
			intervalSeconds,
		});
		await this.app.vault.process(file, (content) => upsertTranscriptSection(content, text));
		new Notice(`Inserted transcript into "${file.basename}".`);
	}

	private async saveRolledUp(file: TFile, intervalSeconds: number): Promise<void> {
		const source = this.subtitlesPath(file);
		const cues = rollupCues(parseVtt(await this.app.vault.adapter.read(source)), intervalSeconds);
		const target = rolledUpVttPath(source, intervalSeconds);
		await this.app.vault.adapter.write(target, serializeVtt(cues));
		new Notice(`Saved subtitles in ${formatInterval(intervalSeconds)} increments to ${target}`);
	}
}
