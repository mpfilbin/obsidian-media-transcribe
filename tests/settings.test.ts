import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings';

describe('DEFAULT_SETTINGS', () => {
	it('reads the media URL from the media property', () => {
		expect(DEFAULT_SETTINGS.mediaProperty).toBe('media');
	});

	it('downloads into _resources by default', () => {
		expect(DEFAULT_SETTINGS.downloadFolder).toBe('_resources');
	});

	it('leaves the model path blank until configured', () => {
		expect(DEFAULT_SETTINGS.modelPath).toBe('');
	});

	it('groups transcripts by pauses rather than fixed increments', () => {
		expect(DEFAULT_SETTINGS.transcriptIntervalSeconds).toBe(0);
	});
});
