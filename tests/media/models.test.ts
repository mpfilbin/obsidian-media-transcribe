import { describe, it, expect } from 'vitest';
import { MODEL_DOWNLOAD_URL } from '../../src/media/models';

describe('MODEL_DOWNLOAD_URL', () => {
	it('points to the whisper.cpp models on Hugging Face', () => {
		expect(MODEL_DOWNLOAD_URL).toBe('https://huggingface.co/ggerganov/whisper.cpp/tree/main');
	});
});
