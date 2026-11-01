import { App, PluginSettingTab, Setting, type DropdownComponent, type TextComponent } from 'obsidian';
import type MediaTranscribe from './main';
import { DEFAULT_DOWNLOAD_FOLDER } from './utils/paths';
import { PRESET_INTERVALS, formatInterval } from './utils/intervals';
import type { OsPlatform } from './utils/platform';
import { MODEL_DOWNLOAD_URL } from './media/models';
import { DOWNLOAD_PRESETS, applyPreset, matchPreset, type DownloadValues } from './media/presets';

/** Paths that differ per machine, so they are saved separately for each OS. */
export interface ToolPaths {
	ytDlpPath: string;
	ffmpegPath: string;
	whisperPath: string;
	modelPath: string;
}

export type ToolPathKey = keyof ToolPaths;

export const DEFAULT_TOOL_PATHS: ToolPaths = {
	ytDlpPath: 'yt-dlp',
	ffmpegPath: 'ffmpeg',
	whisperPath: 'whisper-cli',
	modelPath: '',
};

const TOOL_PATH_KEYS = Object.keys(DEFAULT_TOOL_PATHS) as ToolPathKey[];

export interface MediaTranscribeSettings {
	mediaProperty: string;
	downloadFolder: string;
	/** Add `![title](path)` for the downloaded file to the note. */
	embedMedia: boolean;
	downloadType: 'video' | 'audio';
	/** Shortest side in pixels, or 0 for the best available. */
	maxResolution: number;
	videoCodec: 'compatible' | 'smallest';
	/** Preferred maximum file size in MB, or 0 for no limit. */
	maxFileSizeMb: number;
	ytDlpExtraArgs: string;
	language: string;
	threads: number;
	whisperExtraArgs: string;
	transcriptTimestamps: boolean;
	paragraphGapSeconds: number;
	/** 0 groups by pauses; otherwise roll up into increments of this many seconds. */
	transcriptIntervalSeconds: number;
	/** Tool and model paths per OS, so a vault synced between macOS and Windows works on both. */
	toolPaths: Partial<Record<OsPlatform, Partial<ToolPaths>>>;
}

export const DEFAULT_SETTINGS: MediaTranscribeSettings = {
	mediaProperty: 'media',
	downloadFolder: DEFAULT_DOWNLOAD_FOLDER,
	embedMedia: true,
	downloadType: 'video',
	maxResolution: 720,
	videoCodec: 'compatible',
	maxFileSizeMb: 0,
	ytDlpExtraArgs: '',
	language: 'auto',
	threads: 0,
	whisperExtraArgs: '',
	transcriptTimestamps: true,
	paragraphGapSeconds: 2,
	transcriptIntervalSeconds: 0,
	toolPaths: {},
};

/**
 * Merge saved data over the defaults. Tool paths saved by earlier versions
 * (one shared set for every OS) are moved to the current platform.
 */
export function loadSettings(raw: unknown, platform: OsPlatform): MediaTranscribeSettings {
	const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const legacy: Partial<ToolPaths> = {};
	const rest: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(data)) {
		if ((TOOL_PATH_KEYS as string[]).includes(key)) {
			if (typeof value === 'string') legacy[key as ToolPathKey] = value;
		} else {
			rest[key] = value;
		}
	}

	const settings: MediaTranscribeSettings = {
		...DEFAULT_SETTINGS,
		...(rest as Partial<MediaTranscribeSettings>),
	};
	settings.toolPaths = { ...(settings.toolPaths ?? {}) };
	if (Object.keys(legacy).length > 0 && !settings.toolPaths[platform]) {
		settings.toolPaths[platform] = legacy;
	}
	return settings;
}

/** Tool paths for this OS, with blank or missing entries filled from the defaults. */
export function toolPathsFor(settings: MediaTranscribeSettings, platform: OsPlatform): ToolPaths {
	const saved = settings.toolPaths[platform] ?? {};
	const out = { ...DEFAULT_TOOL_PATHS };
	for (const key of TOOL_PATH_KEYS) {
		const value = saved[key];
		if (typeof value === 'string' && value.trim() !== '') out[key] = value;
	}
	return out;
}

export function setToolPath(
	settings: MediaTranscribeSettings,
	platform: OsPlatform,
	key: ToolPathKey,
	value: string,
): void {
	settings.toolPaths[platform] = { ...(settings.toolPaths[platform] ?? {}), [key]: value };
}

const PLATFORM_NAMES: Record<OsPlatform, string> = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

export class MediaTranscribeSettingTab extends PluginSettingTab {
	plugin: MediaTranscribe;

	constructor(app: App, plugin: MediaTranscribe) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private text(
		container: HTMLElement,
		name: string,
		desc: string,
		key: 'mediaProperty' | 'downloadFolder' | 'ytDlpExtraArgs' | 'language' | 'whisperExtraArgs',
		placeholder = '',
	): void {
		new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addText((t) =>
				t
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}

	private toolText(container: HTMLElement, name: string, desc: string, key: ToolPathKey, placeholder: string): Setting {
		const { platform } = this.plugin;
		return new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addText((t) =>
				t
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings.toolPaths[platform]?.[key] ?? '')
					.onChange(async (value) => {
						setToolPath(this.plugin.settings, platform, key, value.trim());
						await this.plugin.saveSettings();
					}),
			);
	}

	/** Preset, download type, resolution, format and size; a preset fills in the rest. */
	private downloadSettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		const values = (): DownloadValues => ({
			downloadType: settings.downloadType,
			maxResolution: settings.maxResolution,
			videoCodec: settings.videoCodec,
			maxFileSizeMb: settings.maxFileSizeMb,
		});
		let preset: DropdownComponent | undefined;
		let type: DropdownComponent | undefined;
		let resolution: DropdownComponent | undefined;
		let codec: DropdownComponent | undefined;
		let size: TextComponent | undefined;

		/** Bring every control in line with the settings; `keepSize` avoids rewriting the field being typed in. */
		const refresh = (keepSize = false): void => {
			const current = values();
			const id = matchPreset(current);
			preset?.setValue(id);
			presetSetting.setDesc(
				DOWNLOAD_PRESETS.find((p) => p.id === id)?.description ?? 'Your own combination of the settings below.',
			);
			type?.setValue(current.downloadType);
			resolution?.setValue(String(current.maxResolution));
			codec?.setValue(current.videoCodec);
			if (!keepSize) size?.setValue(String(current.maxFileSizeMb));
			for (const setting of videoOnly) setting.settingEl.toggle(current.downloadType === 'video');
		};
		const save = async (keepSize = false): Promise<void> => {
			await this.plugin.saveSettings();
			refresh(keepSize);
		};

		const presetSetting = new Setting(containerEl).setName('Preset').addDropdown((d) => {
			preset = d;
			for (const p of DOWNLOAD_PRESETS) d.addOption(p.id, p.name);
			d.addOption('custom', 'Custom');
			d.onChange(async (id) => {
				if (id === 'custom') return;
				Object.assign(settings, applyPreset(values(), id));
				await save();
			});
		});

		new Setting(containerEl)
			.setName('Download')
			.setDesc('Audio only is a fraction of the size and is all transcription needs.')
			.addDropdown((d) => {
				type = d;
				d.addOption('video', 'Video').addOption('audio', 'Audio only');
				d.onChange(async (value) => {
					settings.downloadType = value === 'audio' ? 'audio' : 'video';
					await save();
				});
			});

		const videoOnly = [
			new Setting(containerEl)
				.setName('Maximum resolution')
				.setDesc('The biggest factor in file size. Uses the closest resolution available at or below this.')
				.addDropdown((d) => {
					resolution = d;
					d.addOption('0', 'Best available');
					for (const res of [1080, 720, 480, 360]) d.addOption(String(res), `${res}p`);
					d.onChange(async (value) => {
						settings.maxResolution = Number(value);
						await save();
					});
				}),
			new Setting(containerEl)
				.setName('Video format')
				.setDesc('MP4 plays on every device. AV1 or VP9 files are smaller at the same quality but may not play on phones and tablets.')
				.addDropdown((d) => {
					codec = d;
					d.addOption('compatible', 'MP4 (plays everywhere)').addOption('smallest', 'Smallest files (AV1 or VP9)');
					d.onChange(async (value) => {
						settings.videoCodec = value === 'smallest' ? 'smallest' : 'compatible';
						await save();
					});
				}),
		];

		new Setting(containerEl)
			.setName('Maximum file size (MB)')
			.setDesc('Prefer downloads under this size, and warn if one is still larger. Obsidian Sync allows 200 MB per file on Sync Plus and 5 MB on Sync Standard. Use 0 for no limit.')
			.addText((t) => {
				size = t;
				t.setPlaceholder('0').onChange(async (value) => {
					const n = Number.parseInt(value, 10);
					settings.maxFileSizeMb = Number.isFinite(n) && n > 0 ? n : 0;
					await save(true);
				});
			});

		refresh();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Notes').setHeading();
		this.text(
			containerEl,
			'Media property',
			'Frontmatter property that holds the media URL.',
			'mediaProperty',
			'media',
		);
		this.text(
			containerEl,
			'Download folder',
			'Where media and subtitles are saved. A relative path is resolved beside the note; a path starting with / is resolved from the vault root.',
			'downloadFolder',
			DEFAULT_DOWNLOAD_FOLDER,
		);

		new Setting(containerEl)
			.setName('Embed downloaded media')
			.setDesc('Add a markdown embed of the downloaded file, titled with the video title, below the note properties.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.embedMedia).onChange(async (value) => {
					this.plugin.settings.embedMedia = value;
					await this.plugin.saveSettings();
				}),
			);

		const isWin = this.plugin.platform === 'win32';
		new Setting(containerEl)
			.setName(`Tools on ${PLATFORM_NAMES[this.plugin.platform]}`)
			.setDesc('Saved separately for each operating system, so a synced vault works on all of them. Leave blank to use the command name from PATH.')
			.setHeading();
		this.toolText(containerEl, 'yt-dlp path', 'Executable name or absolute path.', 'ytDlpPath', isWin ? 'yt-dlp.exe' : 'yt-dlp');
		this.toolText(containerEl, 'ffmpeg path', 'Used by yt-dlp to merge downloads, and to convert media to 16 kHz audio for Whisper.', 'ffmpegPath', isWin ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : 'ffmpeg');
		this.toolText(containerEl, 'Whisper executable path', 'The whisper.cpp command line binary (whisper-cli, or main in older builds).', 'whisperPath', isWin ? 'C:\\whisper\\whisper-cli.exe' : 'whisper-cli');
		const model = this.toolText(
			containerEl,
			'Model path',
			'Absolute path to a ggml model file. ggml-base.en.bin is fast; ggml-medium.bin is more accurate. ',
			'modelPath',
			isWin ? 'C:\\models\\ggml-medium.bin' : '~/models/ggml-medium.bin',
		);
		model.descEl.createEl('a', { text: 'Download models from Hugging Face', href: MODEL_DOWNLOAD_URL });

		new Setting(containerEl).setName('Download (yt-dlp)').setHeading();
		this.downloadSettings(containerEl);
		this.text(containerEl, 'yt-dlp extra arguments', 'Optional, for example: -f "bv*+ba/b" --cookies-from-browser firefox', 'ytDlpExtraArgs');

		new Setting(containerEl).setName('Transcription (whisper.cpp)').setHeading();
		this.text(containerEl, 'Language', 'Language code such as en, or auto to detect.', 'language', 'auto');
		new Setting(containerEl)
			.setName('Threads')
			.setDesc('Number of CPU threads. Use 0 for the whisper.cpp default.')
			.addText((t) =>
				t.setValue(String(this.plugin.settings.threads)).onChange(async (value) => {
					const n = Number.parseInt(value, 10);
					this.plugin.settings.threads = Number.isFinite(n) && n > 0 ? n : 0;
					await this.plugin.saveSettings();
				}),
			);
		this.text(containerEl, 'Whisper extra arguments', 'Optional additional whisper.cpp flags.', 'whisperExtraArgs');

		new Setting(containerEl).setName('Transcript').setHeading();
		new Setting(containerEl)
			.setName('Include timestamps')
			.setDesc('Prefix each paragraph with its start time.')
			.addToggle((t) =>
				t.setValue(this.plugin.settings.transcriptTimestamps).onChange(async (value) => {
					this.plugin.settings.transcriptTimestamps = value;
					await this.plugin.saveSettings();
				}),
			);
		new Setting(containerEl)
			.setName('Group transcript by')
			.setDesc('Start paragraphs at pauses in speech, or roll subtitles up into fixed time increments.')
			.addDropdown((d) => {
				d.addOption('0', 'Pauses in speech');
				for (const seconds of PRESET_INTERVALS) d.addOption(String(seconds), formatInterval(seconds));
				const current = String(this.plugin.settings.transcriptIntervalSeconds);
				if (!PRESET_INTERVALS.includes(this.plugin.settings.transcriptIntervalSeconds) && current !== '0') {
					d.addOption(current, formatInterval(this.plugin.settings.transcriptIntervalSeconds));
				}
				d.setValue(current).onChange(async (value) => {
					this.plugin.settings.transcriptIntervalSeconds = Number(value);
					await this.plugin.saveSettings();
				});
			});
		new Setting(containerEl)
			.setName('Paragraph gap')
			.setDesc('When grouping by pauses, start a new paragraph after this many seconds of silence.')
			.addText((t) =>
				t.setValue(String(this.plugin.settings.paragraphGapSeconds)).onChange(async (value) => {
					const n = Number.parseFloat(value);
					this.plugin.settings.paragraphGapSeconds = Number.isFinite(n) && n >= 0 ? n : 2;
					await this.plugin.saveSettings();
				}),
			);
	}
}
