import { YTDLP_PROGRESS_ARGS } from '../progress/ytdlp';
import { buildFormatArgs, type FormatOptions } from './format';

/** Marks the line carrying the downloaded file's path and title, printed as JSON. */
export const YTDLP_FILE_PREFIX = '@@mtfile';

/** Split a user-provided argument string, honouring single and double quotes. */
export function splitArgs(input: string): string[] {
	const out: string[] = [];
	const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(input)) !== null) {
		out.push(m[1] ?? m[2] ?? m[3]);
	}
	return out;
}

export interface YtDlpOptions {
	url: string;
	/** Absolute directory on disk to download into. */
	outputDir: string;
	extraArgs: string;
	/** yt-dlp needs ffmpeg to merge streams; it can't see our setting unless we pass it. */
	ffmpegPath: string;
	format: FormatOptions;
}

export function buildYtDlpArgs(options: YtDlpOptions): string[] {
	const ffmpeg = /[\\/]/.test(options.ffmpegPath) ? ['--ffmpeg-location', options.ffmpegPath] : [];
	return [
		'--no-playlist',
		'--encoding',
		'utf-8',
		...ffmpeg,
		'--no-simulate',
		...YTDLP_PROGRESS_ARGS,
		'--print',
		// JSON keeps non-ASCII intact whatever the console encoding.
		`after_move:${YTDLP_FILE_PREFIX} %(.{filepath,title})j`,
		'-P',
		options.outputDir,
		// Same safe names on every OS so a synced vault works on Windows too.
		'--windows-filenames',
		// Obsidian links can't contain [ ] # ^ |
		'--replace-in-metadata',
		'title,id',
		'[\\[\\]#^|]',
		'-',
		'-o',
		// Short enough to stay under Windows' 260-character path limit in deep vaults.
		'%(title).80B - %(id)s.%(ext)s',
		...buildFormatArgs(options.format),
		...splitArgs(options.extraArgs),
		options.url,
	];
}

export interface DownloadedFile {
	/** Absolute path on disk. */
	filePath: string;
	title: string;
}

export function parseYtDlpOutput(stdout: string): DownloadedFile | null {
	const line = stdout
		.split(/\r?\n/)
		.map((l) => l.trim())
		.find((l) => l.startsWith(`${YTDLP_FILE_PREFIX} `));
	if (!line) return null;

	try {
		const data = JSON.parse(line.slice(YTDLP_FILE_PREFIX.length + 1)) as { filepath?: unknown; title?: unknown };
		if (typeof data.filepath !== 'string' || data.filepath === '') return null;
		return { filePath: data.filepath, title: typeof data.title === 'string' ? data.title : '' };
	} catch {
		return null;
	}
}

/** whisper.cpp requires 16 kHz mono 16-bit PCM WAV input. */
export function buildFfmpegArgs(inputPath: string, outputPath: string): string[] {
	return ['-y', '-i', inputPath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-progress', 'pipe:1', '-nostats', outputPath];
}

export interface WhisperOptions {
	modelPath: string;
	audioPath: string;
	/** Output path without extension; whisper.cpp appends `.vtt`. */
	outputPrefix: string;
	language: string;
	threads: number;
	extraArgs: string;
}

export function buildWhisperArgs(options: WhisperOptions): string[] {
	const args = [
		'-m',
		options.modelPath,
		'-f',
		options.audioPath,
		'-l',
		options.language || 'auto',
		'-ovtt',
		'-pp',
		'-of',
		options.outputPrefix,
	];
	if (options.threads > 0) {
		args.push('-t', String(options.threads));
	}
	return [...args, ...splitArgs(options.extraArgs)];
}
