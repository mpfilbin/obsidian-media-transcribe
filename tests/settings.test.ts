import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_TOOL_PATHS, loadSettings, toolPathsFor, setToolPath } from '../src/settings';

describe('DEFAULT_SETTINGS', () => {
	it('reads the media URL from the media property', () => {
		expect(DEFAULT_SETTINGS.mediaProperty).toBe('media');
	});

	it('downloads into _resources by default', () => {
		expect(DEFAULT_SETTINGS.downloadFolder).toBe('_resources');
	});

	it('groups transcripts by pauses rather than fixed increments', () => {
		expect(DEFAULT_SETTINGS.transcriptIntervalSeconds).toBe(0);
	});

	it('embeds downloaded media in the note', () => {
		expect(DEFAULT_SETTINGS.embedMedia).toBe(true);
	});

	it('starts with no per-platform tool paths', () => {
		expect(DEFAULT_SETTINGS.toolPaths).toEqual({});
	});
});

describe('DEFAULT_TOOL_PATHS', () => {
	it('leaves the model path blank until configured', () => {
		expect(DEFAULT_TOOL_PATHS.modelPath).toBe('');
	});

	it('finds whisper-cli on PATH', () => {
		expect(DEFAULT_TOOL_PATHS.whisperPath).toBe('whisper-cli');
	});
});

describe('loadSettings', () => {
	describe('when there is no saved data', () => {
		it('returns the defaults', () => {
			expect(loadSettings(null, 'darwin')).toEqual(DEFAULT_SETTINGS);
		});

		it('does not share the default toolPaths object', () => {
			expect(loadSettings(null, 'darwin').toolPaths).not.toBe(DEFAULT_SETTINGS.toolPaths);
		});
	});

	describe('when saved data has other settings', () => {
		it('keeps them', () => {
			expect(loadSettings({ language: 'en' }, 'darwin').language).toBe('en');
		});
	});

	describe('when saved data uses the old shared tool path fields', () => {
		const old = { ytDlpPath: '/opt/homebrew/bin/yt-dlp', modelPath: '/Users/me/m.bin' };

		describe('when this platform has no saved tool paths', () => {
			it('moves them to this platform', () => {
				expect(loadSettings(old, 'darwin').toolPaths.darwin).toEqual(old);
			});
		});

		describe('when this platform already has saved tool paths', () => {
			it('keeps the per-platform paths', () => {
				expect(
					loadSettings({ ...old, toolPaths: { darwin: { ytDlpPath: 'yt-dlp' } } }, 'darwin').toolPaths.darwin,
				).toEqual({ ytDlpPath: 'yt-dlp' });
			});
		});

		it('removes the old fields', () => {
			expect('ytDlpPath' in loadSettings(old, 'darwin')).toBe(false);
		});
	});
});

describe('toolPathsFor', () => {
	const settings = {
		...DEFAULT_SETTINGS,
		toolPaths: { darwin: { ffmpegPath: '/opt/homebrew/bin/ffmpeg', ytDlpPath: '' } },
	};

	describe('when this platform has a saved path', () => {
		it('returns it', () => {
			expect(toolPathsFor(settings, 'darwin').ffmpegPath).toBe('/opt/homebrew/bin/ffmpeg');
		});
	});

	describe('when this platform has a blank saved path', () => {
		it('falls back to the default', () => {
			expect(toolPathsFor(settings, 'darwin').ytDlpPath).toBe('yt-dlp');
		});
	});

	describe('when only another platform has saved paths', () => {
		it('returns the defaults', () => {
			expect(toolPathsFor(settings, 'win32')).toEqual(DEFAULT_TOOL_PATHS);
		});
	});
});

describe('setToolPath', () => {
	describe('when this platform has no saved paths', () => {
		it('creates an entry for this platform', () => {
			const s = { ...DEFAULT_SETTINGS, toolPaths: {} };
			setToolPath(s, 'win32', 'modelPath', 'C:\\models\\m.bin');
			expect(s.toolPaths).toEqual({ win32: { modelPath: 'C:\\models\\m.bin' } });
		});
	});

	describe('when another platform has saved paths', () => {
		it('leaves them alone', () => {
			const s = { ...DEFAULT_SETTINGS, toolPaths: { darwin: { modelPath: '/m.bin' } } };
			setToolPath(s, 'win32', 'modelPath', 'C:\\m.bin');
			expect(s.toolPaths.darwin).toEqual({ modelPath: '/m.bin' });
		});
	});
});
