import { describe, it, expect } from 'vitest';
import { createWhisperProgressParser } from '../../src/progress/whisper';

const START = 1_000_000;

describe('createWhisperProgressParser', () => {
	describe('when whisper prints a transcribed segment', () => {
		describe('when the audio duration is known', () => {
			it('reports progress from the segment end time', () => {
				expect(
					createWhisperProgressParser(100, START)('[00:00:20.000 --> 00:00:25.000]   Hello there.', START + 1000),
				).toMatchObject({ stage: 'transcribe', fraction: 0.25 });
			});
		});

		describe('when the audio duration is unknown', () => {
			it('reports an unknown fraction', () => {
				expect(
					createWhisperProgressParser(null, START)('[00:00:20.000 --> 00:00:25.000]   Hello.', START + 1000),
				).toMatchObject({ fraction: null });
			});
		});
	});

	describe('when whisper prints its own progress percentage', () => {
		it('reports that percentage', () => {
			expect(
				createWhisperProgressParser(null, START)('whisper_print_progress_callback: progress =  40%', START + 1000),
			).toMatchObject({ fraction: 0.4 });
		});
	});

	describe('when a later update reports less progress than before', () => {
		it('keeps the highest progress seen', () => {
			const parse = createWhisperProgressParser(100, START);
			parse('whisper_print_progress_callback: progress =  50%', START + 1000);
			expect(parse('[00:00:20.000 --> 00:00:25.000]   Hi.', START + 2000)).toMatchObject({ fraction: 0.5 });
		});
	});

	describe('when estimating the time remaining', () => {
		describe('when enough progress has been made', () => {
			it('extrapolates from the time taken so far', () => {
				expect(
					createWhisperProgressParser(null, START)('whisper_print_progress_callback: progress =  25%', START + 60_000),
				).toMatchObject({ etaSeconds: 180 });
			});
		});

		describe('when too little progress has been made', () => {
			it('does not guess', () => {
				expect(
					createWhisperProgressParser(null, START)('whisper_print_progress_callback: progress =   2%', START + 60_000),
				).toMatchObject({ etaSeconds: null });
			});
		});
	});

	describe('when the line is unrelated', () => {
		it('returns null', () => {
			expect(createWhisperProgressParser(100, START)('whisper_init_from_file: loading model', START)).toBeNull();
		});
	});
});
