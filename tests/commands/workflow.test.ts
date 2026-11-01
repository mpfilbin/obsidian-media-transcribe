import { describe, it, expect, vi } from 'vitest';
import { downloadAndTranscribe, requirePath, commandState, busyMessage } from '../../src/commands/workflow';

describe('downloadAndTranscribe', () => {
	const steps = () => ({
		download: vi.fn().mockResolvedValue('notes/_resources/v.mp4'),
		subtitles: vi.fn().mockResolvedValue('notes/_resources/v.vtt'),
		transcript: vi.fn().mockResolvedValue(undefined),
	});

	it('gives the subtitle step the downloaded file directly', async () => {
		const s = steps();
		await downloadAndTranscribe(s, 'note');
		expect(s.subtitles).toHaveBeenCalledWith('note', 'notes/_resources/v.mp4');
	});

	it('gives the transcript step the subtitle file directly', async () => {
		const s = steps();
		await downloadAndTranscribe(s, 'note');
		expect(s.transcript).toHaveBeenCalledWith('note', 'notes/_resources/v.vtt');
	});

	describe('when the download fails', () => {
		it('does not start transcribing', async () => {
			const s = steps();
			s.download.mockRejectedValue(new Error('offline'));
			await downloadAndTranscribe(s, 'note').catch(() => undefined);
			expect(s.subtitles).not.toHaveBeenCalled();
		});
	});
});

describe('requirePath', () => {
	describe('when a path is passed directly', () => {
		it('uses it even if the properties are stale', () => {
			expect(requirePath('a.mp4', { media_file: 'old.mp4' }, 'media_file', 'missing')).toBe('a.mp4');
		});
	});

	describe('when no path is passed', () => {
		describe('when the property is set', () => {
			it('uses the property', () => {
				expect(requirePath(undefined, { media_file: 'old.mp4' }, 'media_file', 'missing')).toBe('old.mp4');
			});
		});

		describe('when the property is empty', () => {
			it('throws the given message', () => {
				expect(() => requirePath(undefined, { media_file: '' }, 'media_file', 'missing')).toThrow('missing');
			});
		});

		describe('when the note has no properties', () => {
			it('throws the given message', () => {
				expect(() => requirePath(undefined, undefined, 'media_file', 'missing')).toThrow('missing');
			});
		});
	});
});

describe('commandState', () => {
	describe('when the active file is not a markdown note', () => {
		it('hides the command', () => {
			expect(commandState(false, false)).toBe('hidden');
		});
	});

	describe('when the active file is a markdown note', () => {
		describe('when nothing is running', () => {
			it('runs the command', () => {
				expect(commandState(true, false)).toBe('run');
			});
		});

		describe('when a task is already running', () => {
			it('keeps the command visible but reports that it is busy', () => {
				expect(commandState(true, true)).toBe('busy');
			});
		});
	});
});

describe('busyMessage', () => {
	it('names the note the running task belongs to', () => {
		expect(busyMessage('Talk notes')).toBe(
			'Already working on "Talk notes". Click the status bar item or run "Cancel download or transcription" to stop it.',
		);
	});
});
