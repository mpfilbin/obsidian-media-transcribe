import { describe, it, expect } from 'vitest';
import { DOWNLOAD_PRESETS, applyPreset, matchPreset, type DownloadValues } from '../../src/media/presets';

const balanced: DownloadValues = { downloadType: 'video', maxResolution: 720, videoCodec: 'compatible', maxFileSizeMb: 0 };

describe('DOWNLOAD_PRESETS', () => {
	it('offers balanced, Obsidian Sync, transcript only and best quality, in that order', () => {
		expect(DOWNLOAD_PRESETS.map((p) => p.id)).toEqual(['balanced', 'sync', 'transcript', 'quality']);
	});
});

describe('applyPreset', () => {
	describe('when applying the Obsidian Sync preset', () => {
		it('caps MP4 at 720p and 200 MB', () => {
			expect(applyPreset({ ...balanced }, 'sync')).toEqual({
				downloadType: 'video',
				maxResolution: 720,
				videoCodec: 'compatible',
				maxFileSizeMb: 200,
			});
		});
	});

	describe('when applying the best quality preset', () => {
		it('removes the resolution cap and size limit, and prefers AV1 or VP9', () => {
			expect(applyPreset({ ...balanced }, 'quality')).toEqual({
				downloadType: 'video',
				maxResolution: 0,
				videoCodec: 'smallest',
				maxFileSizeMb: 0,
			});
		});
	});

	describe('when applying the transcript only preset', () => {
		it('switches to audio only', () => {
			expect(applyPreset({ ...balanced, maxFileSizeMb: 200 }, 'transcript').downloadType).toBe('audio');
		});

		it('removes the size limit', () => {
			expect(applyPreset({ ...balanced, maxFileSizeMb: 200 }, 'transcript').maxFileSizeMb).toBe(0);
		});

		it('keeps the video settings for when video is chosen again', () => {
			expect(applyPreset({ ...balanced, maxResolution: 480 }, 'transcript').maxResolution).toBe(480);
		});
	});

	describe('when the preset is unknown', () => {
		it('leaves the values unchanged', () => {
			expect(applyPreset({ ...balanced, maxResolution: 480 }, 'custom')).toEqual({ ...balanced, maxResolution: 480 });
		});
	});

	describe('when applied', () => {
		it('does not modify the values passed in', () => {
			const values = { ...balanced };
			applyPreset(values, 'sync');
			expect(values).toEqual(balanced);
		});
	});
});

describe('matchPreset', () => {
	describe('when the values equal a preset', () => {
		it('returns that preset', () => {
			expect(matchPreset({ ...balanced, maxFileSizeMb: 200 })).toBe('sync');
		});
	});

	describe('when the values equal the defaults', () => {
		it('returns balanced', () => {
			expect(matchPreset(balanced)).toBe('balanced');
		});
	});

	describe('when audio only is chosen', () => {
		describe('when there is no size limit', () => {
			it('returns transcript only, whatever the video settings are', () => {
				expect(matchPreset({ ...balanced, downloadType: 'audio', maxResolution: 360 })).toBe('transcript');
			});
		});

		describe('when there is a size limit', () => {
			it('returns custom', () => {
				expect(matchPreset({ ...balanced, downloadType: 'audio', maxFileSizeMb: 50 })).toBe('custom');
			});
		});
	});

	describe('when the values match no preset', () => {
		it('returns custom', () => {
			expect(matchPreset({ ...balanced, maxResolution: 480 })).toBe('custom');
		});
	});
});
