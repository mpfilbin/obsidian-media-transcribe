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
}

export function buildYtDlpArgs(options: YtDlpOptions): string[] {
	return [
		'--no-playlist',
		'--no-simulate',
		'--print',
		'after_move:filepath',
		'-P',
		options.outputDir,
		'-o',
		'%(title).150B [%(id)s].%(ext)s',
		...splitArgs(options.extraArgs),
		options.url,
	];
}

export function parseYtDlpOutputPath(stdout: string): string | null {
	const lines = stdout
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l !== '');
	return lines.length > 0 ? lines[lines.length - 1] : null;
}

/** whisper.cpp requires 16 kHz mono 16-bit PCM WAV input. */
export function buildFfmpegArgs(inputPath: string, outputPath: string): string[] {
	return ['-y', '-i', inputPath, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath];
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
		'-of',
		options.outputPrefix,
	];
	if (options.threads > 0) {
		args.push('-t', String(options.threads));
	}
	return [...args, ...splitArgs(options.extraArgs)];
}
