import { FileSystemAdapter, Notice, Plugin, TFile, normalizePath } from 'obsidian';
import { tmpdir } from 'os';
import { relative, sep } from 'path';
import { DEFAULT_SETTINGS, type MediaTranscribeSettings, MediaTranscribeSettingTab } from './settings';
import { downloadMedia, generateSubtitles } from './media/pipeline';
import { parseVtt, vttToTranscript } from './transcript/vtt';
import { upsertTranscriptSection } from './transcript/section';
import { getMediaUrl } from './utils/frontmatter';
import { resolveDownloadFolder } from './utils/paths';
import { runProcess } from './utils/process';

/** Frontmatter properties written by the plugin. */
const MEDIA_FILE_PROPERTY = 'media_file';
const SUBTITLES_FILE_PROPERTY = 'subtitles_file';

export default class MediaTranscribe extends Plugin {
	settings: MediaTranscribeSettings;
	private abort: AbortController | null = null;

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

		this.addSettingTab(new MediaTranscribeSettingTab(this.app, this));
	}

	onunload() {
		this.abort?.abort();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<MediaTranscribeSettings>);
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
		this.abort = new AbortController();
		try {
			await task();
		} catch (err) {
			new Notice(err instanceof Error ? err.message : String(err), 10000);
		} finally {
			this.abort = null;
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

	private async download(file: TFile): Promise<void> {
		const url = getMediaUrl(this.frontmatterOf(file), this.settings.mediaProperty);
		if (!url) {
			throw new Error(`No URL found in the "${this.settings.mediaProperty}" property of this note.`);
		}

		const folder = resolveDownloadFolder(file.path, this.settings.downloadFolder);
		if (!(await this.app.vault.adapter.exists(folder))) {
			await this.app.vault.adapter.mkdir(folder);
		}

		const notice = new Notice('Downloading media…', 0);
		try {
			const absolute = await downloadMedia(runProcess, {
				ytDlpPath: this.settings.ytDlpPath,
				url,
				outputDir: this.toAbsolute(folder),
				extraArgs: this.settings.ytDlpExtraArgs,
				run: {
					signal: this.abort?.signal,
					onLine: (line) => {
						if (line.startsWith('[download]')) notice.setMessage(line);
					},
				},
			});
			await this.setFrontmatter(file, MEDIA_FILE_PROPERTY, this.toVaultPath(absolute));
			new Notice('Media downloaded.');
		} finally {
			notice.hide();
		}
	}

	private async subtitles(file: TFile): Promise<void> {
		const mediaFile = this.frontmatterOf(file)?.[MEDIA_FILE_PROPERTY];
		if (typeof mediaFile !== 'string' || mediaFile === '') {
			throw new Error(`No downloaded media found. Run the download command first (missing "${MEDIA_FILE_PROPERTY}").`);
		}

		const notice = new Notice('Transcribing… this can take a while.', 0);
		try {
			const absoluteVtt = await generateSubtitles(runProcess, {
				ffmpegPath: this.settings.ffmpegPath,
				whisperPath: this.settings.whisperPath,
				mediaPath: this.toAbsolute(mediaFile),
				modelPath: this.settings.modelPath,
				language: this.settings.language,
				threads: this.settings.threads,
				extraArgs: this.settings.whisperExtraArgs,
				tempDir: tmpdir(),
				run: { signal: this.abort?.signal },
			});
			await this.setFrontmatter(file, SUBTITLES_FILE_PROPERTY, this.toVaultPath(absoluteVtt));
			new Notice('Subtitles generated.');
		} finally {
			notice.hide();
		}
	}

	private async transcript(file: TFile): Promise<void> {
		const vttPath = this.frontmatterOf(file)?.[SUBTITLES_FILE_PROPERTY];
		if (typeof vttPath !== 'string' || vttPath === '') {
			throw new Error(`No subtitles found. Run the subtitle command first (missing "${SUBTITLES_FILE_PROPERTY}").`);
		}

		const vtt = await this.app.vault.adapter.read(vttPath);
		const text = vttToTranscript(parseVtt(vtt), {
			timestamps: this.settings.transcriptTimestamps,
			paragraphGapSeconds: this.settings.paragraphGapSeconds,
		});
		await this.app.vault.process(file, (content) => upsertTranscriptSection(content, text));
		new Notice('Transcript inserted.');
	}
}
