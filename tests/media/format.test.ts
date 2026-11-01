import { describe, it, expect } from 'vitest';
import { buildFormatArgs, sizeWarning, type FormatOptions } from '../../src/media/format';

const video: FormatOptions = { type: 'video', maxResolution: 720, codec: 'compatible', maxFileSizeMb: 0 };

describe('buildFormatArgs', () => {
	describe('when downloading video', () => {
		describe('when the format is compatible MP4', () => {
			describe('when the resolution is capped', () => {
				it('prefers H.264 and AAC up to that resolution', () => {
					expect(buildFormatArgs(video).slice(0, 2)).toEqual(['-S', 'vcodec:h264,lang,quality,res:720,fps,hdr:12,acodec:aac']);
				});

				it('produces an MP4 file', () => {
					expect(buildFormatArgs(video).slice(2)).toEqual(['--merge-output-format', 'mp4', '--remux-video', 'mp4']);
				});
			});

			describe('when the resolution is not capped', () => {
				it('prefers H.264 and AAC at the best resolution', () => {
					expect(buildFormatArgs({ ...video, maxResolution: 0 })[1]).toBe(
						'vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac',
					);
				});
			});
		});

		describe('when the format is smallest files', () => {
			describe('when the resolution is capped', () => {
				it('only caps the resolution, leaving yt-dlp to prefer AV1 and VP9', () => {
					expect(buildFormatArgs({ ...video, codec: 'smallest' })).toEqual(['-S', 'res:720']);
				});
			});

			describe('when the resolution is not capped', () => {
				it('adds nothing', () => {
					expect(buildFormatArgs({ ...video, codec: 'smallest', maxResolution: 0 })).toEqual([]);
				});
			});
		});

		describe('when there is a size limit', () => {
			it('picks the best video that leaves room for audio within the limit', () => {
				expect(buildFormatArgs({ ...video, maxFileSizeMb: 200 }).slice(0, 2)).toEqual([
					'-f',
					'bv*[filesize<?170MB]+ba/b[filesize<?200MB]/bv*+ba/b',
				]);
			});
		});
	});

	describe('when downloading audio only', () => {
		const audio: FormatOptions = { ...video, type: 'audio' };

		describe('when there is no size limit', () => {
			it('prefers M4A audio and converts to M4A if needed', () => {
				expect(buildFormatArgs(audio)).toEqual(['-f', 'ba[ext=m4a]/ba/b', '-x', '--audio-format', 'm4a']);
			});
		});

		describe('when there is a size limit', () => {
			it('prefers audio within the limit', () => {
				expect(buildFormatArgs({ ...audio, maxFileSizeMb: 50 })[1]).toBe(
					'ba[ext=m4a][filesize<?50MB]/ba[filesize<?50MB]/ba[ext=m4a]/ba/b',
				);
			});
		});
	});
});

describe('sizeWarning', () => {
	describe('when there is no limit', () => {
		it('returns null', () => {
			expect(sizeWarning('Talk', 900_000_000, 0)).toBeNull();
		});
	});

	describe('when the file is within the limit', () => {
		it('returns null', () => {
			expect(sizeWarning('Talk', 150_000_000, 200)).toBeNull();
		});
	});

	describe('when the file is over the limit', () => {
		it('explains that Sync will skip it and what to change', () => {
			expect(sizeWarning('Talk', 340_000_000, 200)).toBe(
				'"Talk" downloaded at 340 MB, over your 200 MB limit, so Obsidian Sync will not sync it. Try a lower maximum resolution or audio only.',
			);
		});
	});
});
