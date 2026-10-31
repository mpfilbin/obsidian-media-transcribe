import { describe, it, expect } from 'vitest';
import { rollupCues, groupByPause } from '../../src/transcript/rollup';
import type { Cue } from '../../src/transcript/vtt';

const cues: Cue[] = [
	{ start: 0.5, end: 2, text: 'One.' },
	{ start: 2, end: 4.8, text: 'Two.' },
	{ start: 5.2, end: 7, text: 'Three.' },
	{ start: 16, end: 18, text: 'Four.' },
];

describe('rollupCues', () => {
	describe('when the interval is positive', () => {
		const result = rollupCues(cues, 5);

		it('creates one cue per interval that contains speech', () => {
			expect(result).toHaveLength(3);
		});

		it('aligns each cue start to the interval boundary', () => {
			expect(result.map((c) => c.start)).toEqual([0, 5, 15]);
		});

		it('ends each cue at the end of its last spoken cue', () => {
			expect(result[0].end).toBe(4.8);
		});

		it('joins the text of the cues in the interval', () => {
			expect(result[0].text).toBe('One. Two.');
		});
	});

	describe('when a cue starts exactly on a boundary', () => {
		it('places it in the interval that begins there', () => {
			expect(rollupCues([{ start: 10, end: 11, text: 'x' }], 10)[0].start).toBe(10);
		});
	});

	describe('when the interval is zero or negative', () => {
		it('returns the cues unchanged', () => {
			expect(rollupCues(cues, 0)).toEqual(cues);
		});
	});

	describe('when there are no cues', () => {
		it('returns an empty list', () => {
			expect(rollupCues([], 10)).toEqual([]);
		});
	});
});

describe('groupByPause', () => {
	describe('when the gap between cues exceeds the pause', () => {
		it('starts a new group', () => {
			expect(groupByPause(cues, 2).map((c) => c.text)).toEqual(['One. Two. Three.', 'Four.']);
		});
	});

	describe('when every gap is within the pause', () => {
		it('returns a single group', () => {
			expect(groupByPause(cues, 60)).toHaveLength(1);
		});
	});

	describe('when cues are grouped', () => {
		it('keeps the start of the first cue', () => {
			expect(groupByPause(cues, 2)[1].start).toBe(16);
		});
	});
});
