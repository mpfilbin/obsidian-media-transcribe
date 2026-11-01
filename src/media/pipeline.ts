import { copyFile, mkdir, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { buildFfmpegArgs, buildWhisperArgs, buildYtDlpArgs, parseYtDlpOutput, type DownloadedFile } from './args';
import type { ProcessRunner, RunOptions } from '../utils/process';
import { isAscii, type OsPlatform } from '../utils/platform';
import type { Progress, ProgressListener } from '../types';
import { createYtDlpProgressParser } from '../progress/ytdlp';
import { createAudioProgressParser } from '../progress/audio';
import { createWhisperProgressParser } from '../progress/whisper';
import { MODEL_DOWNLOAD_URL } from './models';
import type { FormatOptions } from './format';

type RunPassThrough = Pick<RunOptions, 'onLine' | 'signal' | 'env'>;

/** Run options that feed every output line to a progress parser as well as the caller's onLine. */
function withProgress(
	run: RunPassThrough | undefined,
	parse: (line: string) => Progress | null,
	onProgress: ProgressListener | undefined,
): RunOptions {
	return {
		...run,
		onLine: (line) => {
			run?.onLine?.(line);
			const progress = parse(line);
			if (progress) onProgress?.(progress);
		},
	};
}

export interface DownloadOptions {
	ytDlpPath: string;
	ffmpegPath: string;
	url: string;
	outputDir: string;
	extraArgs: string;
	format: FormatOptions;
	run?: RunPassThrough;
	onProgress?: ProgressListener;
}

/** Download media with yt-dlp; returns the file's absolute path and the video title. */
export async function downloadMedia(runner: ProcessRunner, options: DownloadOptions): Promise<DownloadedFile> {
	const args = buildYtDlpArgs(options);
	const { stdout } = await runner(
		options.ytDlpPath,
		args,
		withProgress(options.run, createYtDlpProgressParser(), options.onProgress),
	);
	const file = parseYtDlpOutput(stdout);
	if (!file) {
		throw new Error('yt-dlp did not report an output file');
	}
	return file;
}

export interface SubtitleOptions {
	ffmpegPath: string;
	whisperPath: string;
	/** Absolute path to the media file. */
	mediaPath: string;
	modelPath: string;
	language: string;
	threads: number;
	extraArgs: string;
	/** Parent for a scratch folder; should be ASCII-only (see pickAsciiTempDir). */
	tempDir: string;
	platform: OsPlatform;
	run?: RunPassThrough;
	onProgress?: ProgressListener;
	/** Clock for time-remaining estimates; injectable for tests. */
	now?: () => number;
}

function stripExtension(path: string): string {
	return path.replace(/\.[^./\\]+$/, '');
}

function withWindowsPathHint(err: unknown, options: SubtitleOptions): unknown {
	if (options.platform !== 'win32' || isAscii(options.modelPath) || !(err instanceof Error)) return err;
	return new Error(
		`${err.message}\n\nThe model path contains non-ASCII characters, which whisper.cpp on Windows may not be able to open. Move the model to a folder such as C:\\models.`,
	);
}

/**
 * Convert media to 16 kHz WAV with ffmpeg, then transcribe with whisper.cpp.
 *
 * whisper.cpp only ever sees ASCII file names in a scratch folder, because some
 * Windows builds can't open paths with non-ASCII characters (video titles often
 * have them). The resulting VTT is then copied to `<media basename>.vtt` beside
 * the media file, and its absolute path is returned.
 */
export async function generateSubtitles(runner: ProcessRunner, options: SubtitleOptions): Promise<string> {
	if (options.modelPath.trim() === '') {
		throw new Error(
			`No Whisper model configured. Download a ggml model (such as ggml-medium.bin) from ${MODEL_DOWNLOAD_URL}, then set the model path in the plugin settings.`,
		);
	}

	await mkdir(options.tempDir, { recursive: true });
	const workDir = await mkdtemp(join(options.tempDir, 'mt-'));
	const wavPath = join(workDir, 'audio.wav');
	const outputPrefix = join(workDir, 'subtitles');
	const destination = `${stripExtension(options.mediaPath)}.vtt`;

	try {
		const audio = createAudioProgressParser();
		await runner(
			options.ffmpegPath,
			buildFfmpegArgs(options.mediaPath, wavPath),
			withProgress(options.run, audio.parse, options.onProgress),
		);
		const now = options.now ?? Date.now;
		const parseWhisper = createWhisperProgressParser(audio.durationSeconds(), now());
		try {
			await runner(
				options.whisperPath,
				buildWhisperArgs({
					modelPath: options.modelPath,
					audioPath: wavPath,
					outputPrefix,
					language: options.language,
					threads: options.threads,
					extraArgs: options.extraArgs,
				}),
				withProgress(options.run, (line) => parseWhisper(line, now()), options.onProgress),
			);
		} catch (err) {
			throw withWindowsPathHint(err, options);
		}
		await copyFile(`${outputPrefix}.vtt`, destination);
	} finally {
		await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
	}

	return destination;
}
