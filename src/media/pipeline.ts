import { unlink } from 'fs/promises';
import { join } from 'path';
import { buildFfmpegArgs, buildWhisperArgs, buildYtDlpArgs, parseYtDlpOutputPath } from './args';
import type { ProcessRunner, RunOptions } from '../utils/process';

export interface DownloadOptions {
	ytDlpPath: string;
	url: string;
	outputDir: string;
	extraArgs: string;
	run?: Pick<RunOptions, 'onLine' | 'signal'>;
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
	tempDir: string;
	run?: Pick<RunOptions, 'onLine' | 'signal'>;
}

function stripExtension(path: string): string {
	return path.replace(/\.[^./\\]+$/, '');
}

/**
 * Convert media to 16 kHz WAV with ffmpeg, then transcribe with whisper.cpp.
 * Writes `<media basename>.vtt` beside the media file and returns its absolute path.
 */
export async function generateSubtitles(runner: ProcessRunner, options: SubtitleOptions): Promise<string> {
	if (options.modelPath.trim() === '') {
		throw new Error('No Whisper model configured. Set the model path in the plugin settings.');
	}

	const prefix = stripExtension(options.mediaPath);
	const wavPath = join(options.tempDir, `media-transcribe-${Date.now()}.wav`);

	try {
		await runner(options.ffmpegPath, buildFfmpegArgs(options.mediaPath, wavPath), options.run);
		await runner(
			options.whisperPath,
			buildWhisperArgs({
				modelPath: options.modelPath,
				audioPath: wavPath,
				outputPrefix: prefix,
				language: options.language,
				threads: options.threads,
				extraArgs: options.extraArgs,
			}),
			options.run,
		);
	} finally {
		await unlink(wavPath).catch(() => undefined);
	}

	return `${prefix}.vtt`;
}
