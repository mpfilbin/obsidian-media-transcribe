import { describe, it, expect, vi } from 'vitest';
import { downloadMedia, generateSubtitles } from '../../src/media/pipeline';
import type { ProcessRunner } from '../../src/utils/process';

const tools = { ytDlpPath: 'yt-dlp', ffmpegPath: 'ffmpeg', whisperPath: 'whisper-cli' };

describe('downloadMedia', () => {
	describe('when yt-dlp prints the output path', () => {
		it('returns that path', async () => {
			const run: ProcessRunner = vi.fn().mockResolvedValue({ stdout: '/out/video.mp4\n', stderr: '' });
			const path = await downloadMedia(run, {
				ytDlpPath: 'yt-dlp', url: 'https://x', outputDir: '/out', extraArgs: '',
			});
			expect(path).toBe('/out/video.mp4');
		});
	});

	describe('when yt-dlp prints nothing', () => {
		it('throws', async () => {
			const run: ProcessRunner = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
			await expect(
				downloadMedia(run, { ytDlpPath: 'yt-dlp', url: 'https://x', outputDir: '/out', extraArgs: '' }),
			).rejects.toThrow('did not report');
		});
	});

	describe('when invoked', () => {
		it('uses the configured yt-dlp executable', async () => {
			const run = vi.fn().mockResolvedValue({ stdout: '/out/v.mp4', stderr: '' });
			await downloadMedia(run, { ytDlpPath: '/opt/yt-dlp', url: 'https://x', outputDir: '/out', extraArgs: '' });
			expect(run.mock.calls[0][0]).toBe('/opt/yt-dlp');
		});
	});
});

describe('generateSubtitles', () => {
	const options = {
		...tools,
		mediaPath: '/vault/_resources/video.mp4',
		modelPath: '/models/ggml-medium.bin',
		language: 'auto',
		threads: 0,
		extraArgs: '',
		tempDir: '/tmp',
	};

	describe('when the media file and model are valid', () => {
		it('runs ffmpeg before whisper', async () => {
			const run = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
			await generateSubtitles(run, options);
			expect(run.mock.calls.map((c) => c[0])).toEqual(['ffmpeg', 'whisper-cli']);
		});

		it('returns the vtt path beside the media file', async () => {
			const run = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
			expect(await generateSubtitles(run, options)).toBe('/vault/_resources/video.vtt');
		});
	});

	describe('when no model path is configured', () => {
		it('throws before running anything', async () => {
			const run = vi.fn();
			await expect(generateSubtitles(run, { ...options, modelPath: '' })).rejects.toThrow('model');
		});
	});

	describe('when whisper fails', () => {
		it('propagates the error', async () => {
			const run = vi
				.fn()
				.mockResolvedValueOnce({ stdout: '', stderr: '' })
				.mockRejectedValueOnce(new Error('whisper failed'));
			await expect(generateSubtitles(run, options)).rejects.toThrow('whisper failed');
		});
	});
});
