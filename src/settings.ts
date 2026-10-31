import { App, PluginSettingTab, Setting } from 'obsidian';
import type MediaTranscribe from './main';
import { DEFAULT_DOWNLOAD_FOLDER } from './utils/paths';

export interface MediaTranscribeSettings {
	mediaProperty: string;
	downloadFolder: string;
	ytDlpPath: string;
	ytDlpExtraArgs: string;
	ffmpegPath: string;
	whisperPath: string;
	modelPath: string;
	language: string;
	threads: number;
	whisperExtraArgs: string;
	transcriptTimestamps: boolean;
	paragraphGapSeconds: number;
}

export const DEFAULT_SETTINGS: MediaTranscribeSettings = {
	mediaProperty: 'media',
	downloadFolder: DEFAULT_DOWNLOAD_FOLDER,
	ytDlpPath: 'yt-dlp',
	ytDlpExtraArgs: '',
	ffmpegPath: 'ffmpeg',
	whisperPath: 'whisper-cli',
	modelPath: '',
	language: 'auto',
	threads: 0,
	whisperExtraArgs: '',
	transcriptTimestamps: true,
	paragraphGapSeconds: 2,
};

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
		key: 'mediaProperty' | 'downloadFolder' | 'ytDlpPath' | 'ytDlpExtraArgs' | 'ffmpegPath' | 'whisperPath' | 'modelPath' | 'language' | 'whisperExtraArgs',
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

		new Setting(containerEl).setName('Download (yt-dlp)').setHeading();
		this.text(containerEl, 'yt-dlp path', 'Executable name or absolute path.', 'ytDlpPath', 'yt-dlp');
		this.text(containerEl, 'yt-dlp extra arguments', 'Optional, for example: -f "bv*+ba/b" --cookies-from-browser firefox', 'ytDlpExtraArgs');

		new Setting(containerEl).setName('Transcription (whisper.cpp)').setHeading();
		this.text(containerEl, 'ffmpeg path', 'Used to convert media to 16 kHz audio for Whisper.', 'ffmpegPath', 'ffmpeg');
		this.text(containerEl, 'Whisper executable path', 'The whisper.cpp command line binary (whisper-cli, or main in older builds).', 'whisperPath', 'whisper-cli');
		this.text(containerEl, 'Model path', 'Absolute path to a ggml model file, such as ggml-medium.bin.', 'modelPath', '/path/to/ggml-medium.bin');
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
			.setName('Paragraph gap')
			.setDesc('Start a new paragraph after this many seconds of silence.')
			.addText((t) =>
				t.setValue(String(this.plugin.settings.paragraphGapSeconds)).onChange(async (value) => {
					const n = Number.parseFloat(value);
					this.plugin.settings.paragraphGapSeconds = Number.isFinite(n) && n >= 0 ? n : 2;
					await this.plugin.saveSettings();
				}),
			);
	}
}
