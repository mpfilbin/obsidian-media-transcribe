import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { downloadMedia, generateSubtitles, type SubtitleOptions } from '../../src/media/pipeline';
import { isAscii } from '../../src/utils/platform';
import { MODEL_DOWNLOAD_URL } from '../../src/media/models';
import type { ProcessRunner, RunOptions } from '../../src/utils/process';

const format = { type: 'video' as const, maxResolution: 720, codec: 'compatible' as const, maxFileSizeMb: 0 };
const tools = { ytDlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg', whisperPath: 'whisper-cli' };

describe('downloadMedia', () => {
	let scratch: string;
	const tempDir = (): string => join(scratch, 'tmp');
	const options = () => ({
		ytDlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg', url: 'https://x', outputDir: '/out', tempDir: tempDir(), extraArgs: '', format,
	});
	const scratchArg = (run: ReturnType<typeof vi.fn>): string => {
		const args = run.mock.calls[0][1] as string[];
		return (args.find((a) => a.startsWith('temp:')) ?? '').slice('temp:'.length);
	};

	beforeEach(() => {
		scratch = mkdtempSync(join(tmpdir(), 'mt-dl-'));
	});

	afterEach(() => {
		rmSync(scratch, { recursive: true, force: true });
	});

	describe('when yt-dlp prints the output path', () => {
		it('returns that path and the title', async () => {
			const run: ProcessRunner = vi.fn().mockResolvedValue({ stdout: '@@mtfile {"filepath": "/out/video.mp4", "title": "Video"}\n', stderr: '' });
			const path = await downloadMedia(run, options());
			expect(path).toEqual({ filePath: '/out/video.mp4', title: 'Video' });
		});
	});

	describe('when yt-dlp prints nothing', () => {
		it('throws', async () => {
			const run: ProcessRunner = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
			await expect(downloadMedia(run, options())).rejects.toThrow('did not report');
		});
	});

	describe('when invoked', () => {
		it('uses the configured yt-dlp executable', async () => {
			const run = vi.fn().mockResolvedValue({ stdout: '@@mtfile {"filepath": "/out/v.mp4"}', stderr: '' });
			await downloadMedia(run, { ...options(), ytDlpPath: '/opt/yt-dlp' });
			expect(run.mock.calls[0][0]).toBe('/opt/yt-dlp');
		});

		it('has yt-dlp keep in-progress files in a scratch folder inside the temp directory', async () => {
			const run = vi.fn().mockResolvedValue({ stdout: '@@mtfile {"filepath": "/out/v.mp4"}', stderr: '' });
			await downloadMedia(run, options());
			expect(scratchArg(run).startsWith(tempDir())).toBe(true);
		});

		it('does not put in-progress files in the download directory', async () => {
			const run = vi.fn().mockResolvedValue({ stdout: '@@mtfile {"filepath": "/out/v.mp4"}', stderr: '' });
			await downloadMedia(run, options());
			expect(scratchArg(run).startsWith('/out')).toBe(false);
		});
	});

	describe('when the download finishes', () => {
		it('removes the scratch folder', async () => {
			const run = vi.fn((_c: string, args: string[]) => {
				const dir = args.find((a) => a.startsWith('temp:'))!.slice('temp:'.length);
				writeFileSync(join(dir, 'v.mp4.part'), 'x');
				return Promise.resolve({ stdout: '@@mtfile {"filepath": "/out/v.mp4"}', stderr: '' });
			});
			await downloadMedia(run, options());
			expect(readdirSync(tempDir())).toEqual([]);
		});
	});

	describe('when the download fails or is cancelled', () => {
		it('removes the scratch folder', async () => {
			const run = vi.fn((_c: string, args: string[]) => {
				const dir = args.find((a) => a.startsWith('temp:'))!.slice('temp:'.length);
				writeFileSync(join(dir, 'v.mp4.part'), 'x');
				return Promise.reject(new Error('cancelled'));
			});
			await downloadMedia(run, options()).catch(() => undefined);
			expect(readdirSync(tempDir())).toEqual([]);
		});
	});
});

describe('downloadMedia progress', () => {
	let scratch: string;
	const base = () => ({ ytDlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg', url: 'https://x', outputDir: '/out', tempDir: scratch, extraArgs: '', format });
	const runner = (lines: string[]): ProcessRunner =>
		vi.fn((_c: string, _a: string[], opts?: RunOptions) => {
			lines.forEach((l) => opts?.onLine?.(l));
			return Promise.resolve({ stdout: '@@mtfile {"filepath": "/out/v.mp4"}', stderr: '' });
		});

	beforeEach(() => {
		scratch = mkdtempSync(join(tmpdir(), 'mt-dlp-'));
	});

	afterEach(() => {
		rmSync(scratch, { recursive: true, force: true });
	});

	describe('when yt-dlp reports progress', () => {
		it('passes download progress to the listener', async () => {
			const onProgress = vi.fn();
			await downloadMedia(runner(['@@mt download downloading 1 4 NA NA NA']), { ...base(), onProgress });
			expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'download', fraction: 0.25 }));
		});
	});

	describe('when yt-dlp prints a line that is not progress', () => {
		it('does not call the listener', async () => {
			const onProgress = vi.fn();
			await downloadMedia(runner(['/out/v.mp4']), { ...base(), onProgress });
			expect(onProgress).not.toHaveBeenCalled();
		});
	});

	describe('when the caller also listens to raw lines', () => {
		it('still passes each line through', async () => {
			const onLine = vi.fn();
			await downloadMedia(runner(['hello']), { ...base(), run: { onLine } });
			expect(onLine).toHaveBeenCalledWith('hello');
		});
	});
});

describe('generateSubtitles', () => {
	let root: string;
	let options: SubtitleOptions;

	/** Fake runner: whisper "writes" a VTT at its -of prefix. */
	const fakeRunner = (): ReturnType<typeof vi.fn> =>
		vi.fn((command: string, args: string[]) => {
			if (command === 'whisper-cli') {
				writeFileSync(`${args[args.indexOf('-of') + 1]}.vtt`, 'WEBVTT\n');
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		});

	const whisperArgs = (run: ReturnType<typeof vi.fn>): string[] =>
		(run.mock.calls.find((c) => c[0] === 'whisper-cli') ?? [])[1] as string[];

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'mt-pipe-'));
		options = {
			...tools,
			mediaPath: join(root, 'Vidéo [x].mp4'),
			modelPath: '/models/ggml-medium.bin',
			language: 'auto',
			threads: 0,
			extraArgs: '',
			tempDir: join(root, 'tmp'),
			platform: 'linux',
		};
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	describe('when the media file and model are valid', () => {
		it('runs ffmpeg before whisper', async () => {
			const run = fakeRunner();
			await generateSubtitles(run, options);
			expect(run.mock.calls.map((c) => c[0])).toEqual(['ffmpeg', 'whisper-cli']);
		});

		it('returns the vtt path beside the media file', async () => {
			expect(await generateSubtitles(fakeRunner(), options)).toBe(join(root, 'Vidéo [x].vtt'));
		});

		it('copies the subtitles beside the media file', async () => {
			await generateSubtitles(fakeRunner(), options);
			expect(existsSync(join(root, 'Vidéo [x].vtt'))).toBe(true);
		});

		it('gives whisper an output path inside the temp folder', async () => {
			const run = fakeRunner();
			await generateSubtitles(run, options);
			expect(whisperArgs(run)[whisperArgs(run).indexOf('-of') + 1].startsWith(options.tempDir)).toBe(true);
		});

		it('gives whisper only ASCII file names', async () => {
			const run = fakeRunner();
			await generateSubtitles(run, options);
			expect(isAscii(whisperArgs(run)[whisperArgs(run).indexOf('-of') + 1])).toBe(true);
		});

		it('removes its temporary work folder', async () => {
			await generateSubtitles(fakeRunner(), options);
			expect(readdirSync(options.tempDir)).toEqual([]);
		});
	});

	describe('when the tools report progress', () => {
		const chattyRunner = (): ReturnType<typeof vi.fn> =>
			vi.fn((command: string, args: string[], opts?: RunOptions) => {
				if (command === 'ffmpeg') {
					opts?.onLine?.('  Duration: 00:01:40.00, start: 0.000000, bitrate: 128 kb/s');
					opts?.onLine?.('out_time_us=50000000');
				} else {
					opts?.onLine?.('[00:00:25.000 --> 00:00:50.000]   Halfway there.');
					writeFileSync(`${args[args.indexOf('-of') + 1]}.vtt`, 'WEBVTT\n');
				}
				return Promise.resolve({ stdout: '', stderr: '' });
			});

		it('reports audio conversion progress', async () => {
			const onProgress = vi.fn();
			await generateSubtitles(chattyRunner(), { ...options, onProgress });
			expect(onProgress).toHaveBeenCalledWith({ stage: 'audio', fraction: 0.5 });
		});

		it('reports transcription progress against the audio duration', async () => {
			const onProgress = vi.fn();
			await generateSubtitles(chattyRunner(), { ...options, onProgress });
			expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'transcribe', fraction: 0.5 }));
		});
	});

	describe('when no model path is configured', () => {
		it('throws before running anything', async () => {
			const run = vi.fn();
			await expect(generateSubtitles(run, { ...options, modelPath: '' })).rejects.toThrow('model');
		});

		it('says where to download a model', async () => {
			await expect(generateSubtitles(vi.fn(), { ...options, modelPath: '' })).rejects.toThrow(MODEL_DOWNLOAD_URL);
		});
	});

	describe('when whisper fails', () => {
		const failingRunner = (): ReturnType<typeof vi.fn> =>
			vi.fn().mockResolvedValueOnce({ stdout: '', stderr: '' }).mockRejectedValueOnce(new Error('whisper failed'));

		it('propagates the error', async () => {
			await expect(generateSubtitles(failingRunner(), options)).rejects.toThrow('whisper failed');
		});

		it('still removes its temporary work folder', async () => {
			await generateSubtitles(failingRunner(), options).catch(() => undefined);
			expect(readdirSync(options.tempDir)).toEqual([]);
		});

		describe('when on Windows with a non-ASCII model path', () => {
			it('explains the likely cause', async () => {
				await expect(
					generateSubtitles(failingRunner(), { ...options, platform: 'win32', modelPath: 'C:\\Users\\José\\m.bin' }),
				).rejects.toThrow('non-ASCII');
			});
		});

		describe('when on Windows with an ASCII model path', () => {
			it('does not add the hint', async () => {
				await expect(
					generateSubtitles(failingRunner(), { ...options, platform: 'win32', modelPath: 'C:\\models\\m.bin' }),
				).rejects.not.toThrow('non-ASCII');
			});
		});

		describe('when on macOS with a non-ASCII model path', () => {
			it('does not add the hint', async () => {
				await expect(
					generateSubtitles(failingRunner(), { ...options, platform: 'darwin', modelPath: '/Users/José/m.bin' }),
				).rejects.not.toThrow('non-ASCII');
			});
		});
	});
});
