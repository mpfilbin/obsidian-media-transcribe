import { describe, it, expect, vi } from 'vitest';
import {
	downloadAndTranscribe,
	requirePath,
	queuedMessage,
	duplicateMessage,
	outcomeMessage,
} from '../../src/commands/workflow';

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

describe('queuedMessage', () => {
	describe('when one task is ahead', () => {
		it('uses the singular', () => {
			expect(queuedMessage('Note B', 1)).toBe('Queued "Note B". It will start after 1 task.');
		});
	});

	describe('when several tasks are ahead', () => {
		it('uses the plural', () => {
			expect(queuedMessage('Note B', 2)).toBe('Queued "Note B". It will start after 2 tasks.');
		});
	});
});

describe('duplicateMessage', () => {
	it('says the task is already waiting or running', () => {
		expect(duplicateMessage('Note B')).toBe('"Note B" is already queued or running.');
	});
});

describe('outcomeMessage', () => {
	describe('when the task was cancelled', () => {
		it('says so', () => {
			expect(outcomeMessage('Note B', { error: new Error('x'), cancelled: true })).toBe('Cancelled "Note B".');
		});
	});

	describe('when the task failed', () => {
		describe('when the error is an Error', () => {
			it('names the note and gives the message', () => {
				expect(outcomeMessage('Note B', { error: new Error('boom'), cancelled: false })).toBe('"Note B": boom');
			});
		});

		describe('when the error is a string', () => {
			it('uses it as the message', () => {
				expect(outcomeMessage('Note B', { error: 'bad', cancelled: false })).toBe('"Note B": bad');
			});
		});

		describe('when the error is something else', () => {
			it('gives a generic message rather than [object Object]', () => {
				expect(outcomeMessage('Note B', { error: { code: 1 }, cancelled: false })).toBe('"Note B": Unknown error');
			});
		});
	});

	describe('when the task succeeded', () => {
		it('returns null, since each step reports its own success', () => {
			expect(outcomeMessage('Note B', { error: null, cancelled: false })).toBeNull();
		});
	});
});
