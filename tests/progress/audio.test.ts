import { describe, it, expect } from 'vitest';
import { createAudioProgressParser } from '../../src/progress/audio';

describe('createAudioProgressParser', () => {
	describe('when ffmpeg reports the input duration', () => {
		const parser = createAudioProgressParser();
		const result = parser.parse('  Duration: 00:01:30.50, start: 0.025057, bitrate: 320 kb/s');

		it('does not report progress yet', () => {
			expect(result).toBeNull();
		});

		it('remembers the duration in seconds', () => {
			expect(parser.durationSeconds()).toBe(90.5);
		});
	});

	describe('when ffmpeg reports the output position', () => {
		describe('when the duration is known', () => {
			it('reports the fraction converted', () => {
				const parser = createAudioProgressParser();
				parser.parse('  Duration: 00:00:40.00, start: 0.0');
				expect(parser.parse('out_time_us=10000000')).toEqual({ stage: 'audio', fraction: 0.25 });
			});
		});

		describe('when the duration is unknown', () => {
			it('reports an unknown fraction', () => {
				expect(createAudioProgressParser().parse('out_time_us=10000000')).toEqual({ stage: 'audio', fraction: null });
			});
		});

		describe('when the position is not available', () => {
			it('returns null', () => {
				expect(createAudioProgressParser().parse('out_time_us=N/A')).toBeNull();
			});
		});

		describe('when the position passes the duration', () => {
			it('caps the fraction at 1', () => {
				const parser = createAudioProgressParser();
				parser.parse('  Duration: 00:00:10.00, start: 0.0');
				expect(parser.parse('out_time_us=11000000')).toEqual({ stage: 'audio', fraction: 1 });
			});
		});
	});

	describe('when ffmpeg reports the end', () => {
		it('reports completion', () => {
			expect(createAudioProgressParser().parse('progress=end')).toEqual({ stage: 'audio', fraction: 1 });
		});
	});

	describe('when the line is unrelated', () => {
		it('returns null', () => {
			expect(createAudioProgressParser().parse('bitrate=256.0kbits/s')).toBeNull();
		});
	});

	describe('when no duration has been reported', () => {
		it('leaves the duration unknown', () => {
			expect(createAudioProgressParser().durationSeconds()).toBeNull();
		});
	});
});
