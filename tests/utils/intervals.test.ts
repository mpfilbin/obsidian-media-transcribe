import { describe, it, expect } from 'vitest';
import { intervalSuggestions, formatInterval, PRESET_INTERVALS } from '../../src/utils/intervals';

describe('intervalSuggestions', () => {
	describe('when the query is empty', () => {
		it('returns the presets', () => {
			expect(intervalSuggestions('')).toEqual(PRESET_INTERVALS);
		});
	});

	describe('when the query is a positive number', () => {
		describe('when it is not a preset', () => {
			it('offers it first, followed by the presets', () => {
				expect(intervalSuggestions('45')).toEqual([45, ...PRESET_INTERVALS]);
			});
		});

		describe('when it is a preset', () => {
			it('returns the presets without a duplicate', () => {
				expect(intervalSuggestions('10')).toEqual(PRESET_INTERVALS);
			});
		});
	});

	describe('when the query is not a positive number', () => {
		it('returns the presets', () => {
			expect(intervalSuggestions('abc')).toEqual(PRESET_INTERVALS);
		});
	});
});

describe('formatInterval', () => {
	describe('when the interval is under a minute', () => {
		it('formats as seconds', () => {
			expect(formatInterval(5)).toBe('5 seconds');
		});
	});

	describe('when the interval is a whole number of minutes', () => {
		describe('when it is one minute', () => {
			it('uses the singular', () => {
				expect(formatInterval(60)).toBe('1 minute');
			});
		});

		describe('when it is several minutes', () => {
			it('uses the plural', () => {
				expect(formatInterval(300)).toBe('5 minutes');
			});
		});
	});

	describe('when the interval is over a minute but not whole', () => {
		it('formats as seconds', () => {
			expect(formatInterval(90)).toBe('90 seconds');
		});
	});
});
