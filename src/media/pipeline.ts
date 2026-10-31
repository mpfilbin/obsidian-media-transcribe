import { copyFile, mkdir, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { buildFfmpegArgs, buildWhisperArgs, buildYtDlpArgs, parseYtDlpOutputPath } from './args';
import type { ProcessRunner, RunOptions } from '../utils/process';
import { isAscii, type OsPlatform } from '../utils/platform';

export interface DownloadOptions {
	ytDlpPath: string;
	ffmpegPath: string;
	url: string;
	outputDir: string;
	extraArgs: string;
	run?: Pick<RunOptions, 'onLine' | 'signal' | 'env'>;
}

/** Download media with yt-dlp and return the absolute path of the file. */
export async function downloadMedia(runner: ProcessRunner, options: DownloadOptions): Promise<string> {
	const args = buildYtDlpArgs(options);
	const { stdout } = await runner(options.ytDlpPath, args, options.run);
	const path = parseYtDlpOutputPath(stdout);
	if (!path) {
		throw new Error('yt-dlp did not report an output file');
	}
	return path;
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
	run?: Pick<RunOptions, 'onLine' | 'signal' | 'env'>;
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
		throw new Error('No Whisper model configured. Set the model path in the plugin settings.');
	}

	await mkdir(options.tempDir, { recursive: true });
	const workDir = await mkdtemp(join(options.tempDir, 'mt-'));
	const wavPath = join(workDir, 'audio.wav');
	const outputPrefix = join(workDir, 'subtitles');
	const destination = `${stripExtension(options.mediaPath)}.vtt`;

	try {
		await runner(options.ffmpegPath, buildFfmpegArgs(options.mediaPath, wavPath), options.run);
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
				options.run,
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
