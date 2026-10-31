import { FileSystemAdapter, Notice, Platform, Plugin, TFile, normalizePath } from 'obsidian';
import { homedir, tmpdir } from 'os';
import { join, relative, sep } from 'path';
import { env as processEnv } from 'process';
import { IntervalModal } from './ui/interval-modal';
import { ProgressStatus } from './ui/progress-status';
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
import { buildChildEnv, cleanPathSetting, pickAsciiTempDir, type OsPlatform } from './utils/platform';

/** Frontmatter properties written by the plugin. */
const MEDIA_FILE_PROPERTY = 'media_file';
const SUBTITLES_FILE_PROPERTY = 'subtitles_file';

export default class MediaTranscribe extends Plugin {
	settings: MediaTranscribeSettings;
	private abort: AbortController | null = null;
	private status: ProgressStatus;
	readonly platform: OsPlatform = Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux';
	private readonly childEnv = buildChildEnv(processEnv, this.platform);

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'download-media',
			name: 'Download media for this note',
			checkCallback: (checking) => this.guard(checking, (file) => this.runTask(() => this.download(file))),
		});

		this.addCommand({
			id: 'generate-subtitles',
			name: 'Generate subtitles for this note',
			checkCallback: (checking) => this.guard(checking, (file) => this.runTask(() => this.subtitles(file))),
		});

		this.addCommand({
			id: 'insert-transcript',
			name: 'Insert transcript from subtitles',
			checkCallback: (checking) => this.guard(checking, (file) => this.runTask(() => this.transcript(file))),
		});

		this.addCommand({
			id: 'insert-transcript-in-increments',
			name: 'Insert transcript in time increments',
			checkCallback: (checking) =>
				this.guard(checking, async (file) => {
					const seconds = await IntervalModal.pick(this.app);
					if (seconds !== null) await this.runTask(() => this.transcript(file, seconds));
				}),
		});

		this.addCommand({
			id: 'save-subtitles-in-increments',
			name: 'Save subtitles rolled up into time increments',
			checkCallback: (checking) =>
				this.guard(checking, async (file) => {
					const seconds = await IntervalModal.pick(this.app);
					if (seconds !== null) await this.runTask(() => this.saveRolledUp(file, seconds));
				}),
		});

		this.addCommand({
			id: 'download-and-transcribe',
			name: 'Download media and create transcript',
			checkCallback: (checking) =>
				this.guard(checking, (file) =>
					this.runTask(async () => {
						await this.download(file);
						await this.subtitles(file);
						await this.transcript(file);
					}),
				),
		});

		this.addCommand({
			id: 'cancel-running-task',
			name: 'Cancel download or transcription',
			checkCallback: (checking) => {
				const running = this.abort !== null;
				if (running && !checking) this.abort?.abort();
				return running;
			},
		});

		const statusEl = this.addStatusBarItem();
		statusEl.addClasses(['media-transcribe-status', 'mod-clickable']);
		this.status = new ProgressStatus(statusEl);
		this.registerDomEvent(statusEl, 'click', () => this.abort?.abort());

		this.addSettingTab(new MediaTranscribeSettingTab(this.app, this));
	}

	onunload() {
		this.abort?.abort();
	}

	async loadSettings() {
		this.settings = loadSettings(await this.loadData(), this.platform);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Enable a command only when a markdown note is active and no task is running. */
	private guard(checking: boolean, action: (file: TFile) => Promise<void>): boolean {
		const file = this.app.workspace.getActiveFile();
		const available = file !== null && file.extension === 'md' && this.abort === null;
		if (available && !checking) void action(file);
		return available;
	}

	private async runTask(task: () => Promise<void>): Promise<void> {
		const abort = new AbortController();
		this.abort = abort;
		try {
			await task();
		} catch (err) {
			if (abort.signal.aborted) new Notice('Cancelled.');
			else new Notice(err instanceof Error ? err.message : String(err), 10000);
		} finally {
			this.abort = null;
			this.status.clear();
		}
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

	private async download(file: TFile): Promise<void> {
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
			run: { signal: this.abort?.signal, env: this.childEnv },
			onProgress: (progress) => this.status.update(progress),
		});
		const mediaPath = this.toVaultPath(downloaded.filePath);
		await this.setFrontmatter(file, MEDIA_FILE_PROPERTY, mediaPath);
		if (this.settings.embedMedia) {
			const linkPath = encodeLinkPath(relativeLinkPath(file.path, mediaPath));
			const embed = buildEmbed(downloaded.title || basenameWithoutExtension(mediaPath), linkPath);
			await this.app.vault.process(file, (content) => insertEmbed(content, embed, linkPath));
		}
		new Notice('Media downloaded.');
	}

	private async subtitles(file: TFile): Promise<void> {
		const mediaFile = this.frontmatterOf(file)?.[MEDIA_FILE_PROPERTY];
		if (typeof mediaFile !== 'string' || mediaFile === '') {
			throw new Error(`No downloaded media found. Run the download command first (missing "${MEDIA_FILE_PROPERTY}").`);
		}

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
			run: { signal: this.abort?.signal, env: this.childEnv },
			onProgress: (progress) => this.status.update(progress),
		});
		await this.setFrontmatter(file, SUBTITLES_FILE_PROPERTY, this.toVaultPath(absoluteVtt));
		new Notice('Subtitles generated.');
	}

	private subtitlesPath(file: TFile): string {
		const vttPath = this.frontmatterOf(file)?.[SUBTITLES_FILE_PROPERTY];
		if (typeof vttPath !== 'string' || vttPath === '') {
			throw new Error(`No subtitles found. Run the subtitle command first (missing "${SUBTITLES_FILE_PROPERTY}").`);
		}
		return vttPath;
	}

	private async transcript(file: TFile, intervalSeconds = this.settings.transcriptIntervalSeconds): Promise<void> {
		const vtt = await this.app.vault.adapter.read(this.subtitlesPath(file));
		const text = vttToTranscript(parseVtt(vtt), {
			timestamps: this.settings.transcriptTimestamps,
			paragraphGapSeconds: this.settings.paragraphGapSeconds,
			intervalSeconds,
		});
		await this.app.vault.process(file, (content) => upsertTranscriptSection(content, text));
		new Notice('Transcript inserted.');
	}

	private async saveRolledUp(file: TFile, intervalSeconds: number): Promise<void> {
		const source = this.subtitlesPath(file);
		const cues = rollupCues(parseVtt(await this.app.vault.adapter.read(source)), intervalSeconds);
		const target = rolledUpVttPath(source, intervalSeconds);
		await this.app.vault.adapter.write(target, serializeVtt(cues));
		new Notice(`Saved subtitles in ${formatInterval(intervalSeconds)} increments to ${target}`);
	}
}
