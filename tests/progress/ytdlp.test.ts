import { describe, it, expect } from 'vitest';
import { createYtDlpProgressParser, YTDLP_PROGRESS_ARGS } from '../../src/progress/ytdlp';

const line = (status: string, done: string, total: string, estimate: string, speed: string, eta: string): string =>
	`@@mt download ${status} ${done} ${total} ${estimate} ${speed} ${eta}`;

describe('YTDLP_PROGRESS_ARGS', () => {
	it('forces progress output even though --print makes yt-dlp quiet', () => {
		expect(YTDLP_PROGRESS_ARGS).toContain('--progress');
	});

	it('prints each update on its own line', () => {
		expect(YTDLP_PROGRESS_ARGS).toContain('--newline');
	});
});

describe('createYtDlpProgressParser', () => {
	describe('when the line is not a progress line', () => {
		it('returns null', () => {
			expect(createYtDlpProgressParser()('/vault/_resources/video.mp4')).toBeNull();
		});
	});

	describe('when the line reports download progress', () => {
		describe('when the total size is known', () => {
			const progress = createYtDlpProgressParser()(line('downloading', '250', '1000', 'NA', '2048.5', '12'));

			it('reports the fraction downloaded', () => {
				expect(progress).toMatchObject({ stage: 'download', fraction: 0.25 });
			});

			it('reports the speed in bytes per second', () => {
				expect(progress).toMatchObject({ speed: 2048.5 });
			});

			it('reports the seconds remaining', () => {
				expect(progress).toMatchObject({ etaSeconds: 12 });
			});

			it('starts at part 1', () => {
				expect(progress).toMatchObject({ part: 1 });
			});
		});

		describe('when only an estimated total is known', () => {
			it('uses the estimate', () => {
				expect(createYtDlpProgressParser()(line('downloading', '500', 'NA', '1000', 'NA', 'NA'))).toMatchObject({
					fraction: 0.5,
				});
			});
		});

		describe('when no total is known', () => {
			it('reports an unknown fraction', () => {
				expect(createYtDlpProgressParser()(line('downloading', '500', 'NA', 'NA', 'NA', 'NA'))).toMatchObject({
					fraction: null,
				});
			});
		});

		describe('when speed and eta are unavailable', () => {
			it('reports them as null', () => {
				expect(createYtDlpProgressParser()(line('downloading', '1', '10', 'NA', 'NA', 'NA'))).toMatchObject({
					speed: null,
					etaSeconds: null,
				});
			});
		});

		describe('when a previous part has finished', () => {
			it('counts the next download as the next part', () => {
				const parse = createYtDlpProgressParser();
				parse(line('finished', '10', '10', 'NA', 'NA', 'NA'));
				expect(parse(line('downloading', '1', '10', 'NA', 'NA', 'NA'))).toMatchObject({ part: 2 });
			});
		});

		describe('when the download finishes', () => {
			it('reports it as complete', () => {
				expect(createYtDlpProgressParser()(line('finished', '10', '10', 'NA', 'NA', 'NA'))).toMatchObject({
					fraction: 1,
				});
			});
		});
	});

	describe('when the line reports post-processing', () => {
		describe('when a step starts after downloading', () => {
			it('reports the processing stage', () => {
				const parse = createYtDlpProgressParser();
				parse(line('finished', '10', '10', 'NA', 'NA', 'NA'));
				expect(parse('@@mt postprocess started Merger')).toEqual({ stage: 'processing' });
			});
		});

		describe('when a step starts before anything is downloaded', () => {
			it('returns null, since metadata clean-up runs first', () => {
				expect(createYtDlpProgressParser()('@@mt postprocess started MetadataParser')).toBeNull();
			});
		});

		describe('when a step finishes', () => {
			it('returns null', () => {
				expect(createYtDlpProgressParser()('@@mt postprocess finished Merger')).toBeNull();
			});
		});
	});
});
