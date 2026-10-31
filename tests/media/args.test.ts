import { describe, it, expect } from 'vitest';
import {
	splitArgs,
	buildYtDlpArgs,
	parseYtDlpOutputPath,
	buildFfmpegArgs,
	buildWhisperArgs,
} from '../../src/media/args';

describe('splitArgs', () => {
	describe('when the input is blank', () => {
		it('returns no arguments', () => {
			expect(splitArgs('   ')).toEqual([]);
		});
	});

	describe('when the input has plain tokens', () => {
		it('splits on whitespace', () => {
			expect(splitArgs('--a  --b')).toEqual(['--a', '--b']);
		});
	});

	describe('when a token is double quoted', () => {
		it('keeps the quoted text together', () => {
			expect(splitArgs('--prompt "hello world"')).toEqual(['--prompt', 'hello world']);
		});
	});

	describe('when a token is single quoted', () => {
		it('keeps the quoted text together', () => {
			expect(splitArgs("--prompt 'hello world'")).toEqual(['--prompt', 'hello world']);
		});
	});
});

describe('buildYtDlpArgs', () => {
	const base = { url: 'https://example.com/v', outputDir: '/vault/notes/_resources', extraArgs: '', ffmpegPath: 'ffmpeg' };

	it('passes the url last', () => {
		expect(buildYtDlpArgs(base).at(-1)).toBe('https://example.com/v');
	});

	it('sets the download directory', () => {
		expect(buildYtDlpArgs(base)).toContain('/vault/notes/_resources');
	});

	it('prints the final file path', () => {
		expect(buildYtDlpArgs(base)).toContain('after_move:filepath');
	});

	it('disables playlist downloads', () => {
		expect(buildYtDlpArgs(base)).toContain('--no-playlist');
	});

	it('forces UTF-8 output so non-English file names survive on Windows', () => {
		expect(buildYtDlpArgs(base).join(' ')).toContain('--encoding utf-8');
	});

	describe('when ffmpeg is configured as a path', () => {
		it('tells yt-dlp where ffmpeg is', () => {
			expect(buildYtDlpArgs({ ...base, ffmpegPath: 'C:\\tools\\ffmpeg.exe' }).join(' ')).toContain(
				'--ffmpeg-location C:\\tools\\ffmpeg.exe',
			);
		});
	});

	describe('when ffmpeg is configured as a bare command name', () => {
		it('lets yt-dlp find ffmpeg on PATH', () => {
			expect(buildYtDlpArgs(base)).not.toContain('--ffmpeg-location');
		});
	});

	describe('when extra arguments are configured', () => {
		it('inserts them before the url', () => {
			const args = buildYtDlpArgs({ ...base, extraArgs: '-f bestvideo+bestaudio' });
			expect(args.slice(-3)).toEqual(['-f', 'bestvideo+bestaudio', 'https://example.com/v'].slice(0, 3));
		});
	});
});

describe('parseYtDlpOutputPath', () => {
	describe('when stdout has several lines', () => {
		it('returns the last non-empty line', () => {
			expect(parseYtDlpOutputPath('[download] x\n/a/b/video.mp4\n\n')).toBe('/a/b/video.mp4');
		});
	});

	describe('when stdout is empty', () => {
		it('returns null', () => {
			expect(parseYtDlpOutputPath('  \n')).toBeNull();
		});
	});
});

describe('buildFfmpegArgs', () => {
	it('extracts 16 kHz mono PCM audio', () => {
		expect(buildFfmpegArgs('/in.mp4', '/out.wav')).toEqual([
			'-y', '-i', '/in.mp4', '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '/out.wav',
		]);
	});
});

describe('buildWhisperArgs', () => {
	const base = {
		modelPath: '/models/ggml-medium.bin',
		audioPath: '/tmp/a.wav',
		outputPrefix: '/vault/notes/_resources/video',
		language: 'auto',
		threads: 0,
		extraArgs: '',
	};

	it('selects the model', () => {
		expect(buildWhisperArgs(base).slice(0, 2)).toEqual(['-m', '/models/ggml-medium.bin']);
	});

	it('requests WebVTT output', () => {
		expect(buildWhisperArgs(base)).toContain('-ovtt');
	});

	it('sets the output file prefix', () => {
		expect(buildWhisperArgs(base)).toContain('/vault/notes/_resources/video');
	});

	it('sets the language', () => {
		expect(buildWhisperArgs(base)).toContain('auto');
	});

	describe('when threads is zero', () => {
		it('omits the threads flag', () => {
			expect(buildWhisperArgs(base)).not.toContain('-t');
		});
	});

	describe('when threads is positive', () => {
		it('passes the threads flag', () => {
			expect(buildWhisperArgs({ ...base, threads: 4 })).toContain('-t');
		});
	});

	describe('when extra arguments are configured', () => {
		it('appends them', () => {
			expect(buildWhisperArgs({ ...base, extraArgs: '--prompt "hi there"' }).slice(-2)).toEqual([
				'--prompt',
				'hi there',
			]);
		});
	});
});
