import { describe, it, expect } from 'vitest';
import { getMediaUrl } from '../../src/utils/frontmatter';

describe('getMediaUrl', () => {
	describe('when the property is a string', () => {
		it('returns the trimmed string', () => {
			expect(getMediaUrl({ media: ' https://x.test/v ' }, 'media')).toBe('https://x.test/v');
		});
	});

	describe('when the property is a list', () => {
		it('returns the first entry', () => {
			expect(getMediaUrl({ media: ['https://a', 'https://b'] }, 'media')).toBe('https://a');
		});
	});

	describe('when the property is missing', () => {
		it('returns null', () => {
			expect(getMediaUrl({}, 'media')).toBeNull();
		});
	});

	describe('when there is no frontmatter', () => {
		it('returns null', () => {
			expect(getMediaUrl(undefined, 'media')).toBeNull();
		});
	});

	describe('when the property is not a string', () => {
		it('returns null', () => {
			expect(getMediaUrl({ media: 42 }, 'media')).toBeNull();
		});
	});

	describe('when the value is a wiki link', () => {
		it('returns null', () => {
			expect(getMediaUrl({ media: '[[local.mp4]]' }, 'media')).toBeNull();
		});
	});
});
