import { describe, it, expect } from 'vitest';
import { upsertTranscriptSection } from '../../src/transcript/section';

describe('upsertTranscriptSection', () => {
	describe('when the note has no transcript section', () => {
		it('appends one at the end', () => {
			expect(upsertTranscriptSection('# Note\n\nBody\n', 'Hello')).toBe('# Note\n\nBody\n\n## Transcript\n\nHello\n');
		});
	});

	describe('when the note already has a transcript section at the end', () => {
		it('replaces its body', () => {
			expect(upsertTranscriptSection('# Note\n\n## Transcript\n\nold\n', 'new')).toBe('# Note\n\n## Transcript\n\nnew\n');
		});
	});

	describe('when the transcript section is followed by another heading', () => {
		it('preserves the following section', () => {
			expect(upsertTranscriptSection('## Transcript\n\nold\n\n## Notes\n\nkeep\n', 'new')).toBe(
				'## Transcript\n\nnew\n\n## Notes\n\nkeep\n',
			);
		});
	});

	describe('when the note is empty', () => {
		it('creates just the section', () => {
			expect(upsertTranscriptSection('', 'Hello')).toBe('## Transcript\n\nHello\n');
		});
	});
});
