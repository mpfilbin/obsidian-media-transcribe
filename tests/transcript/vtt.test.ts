import { describe, it, expect } from 'vitest';
import { parseVtt, vttToTranscript, formatTimestamp, formatVttTimestamp, serializeVtt } from '../../src/transcript/vtt';

const SAMPLE = `WEBVTT

00:00:00.000 --> 00:00:02.500
 Hello there.

00:00:02.500 --> 00:00:05.000
 This is a test.

00:00:12.000 --> 00:00:14.000
 A new paragraph.
`;

describe('parseVtt', () => {
	describe('when the input has multiple cues', () => {
		it('returns one cue per block', () => {
			expect(parseVtt(SAMPLE)).toHaveLength(3);
		});

		it('parses the start time in seconds', () => {
			expect(parseVtt(SAMPLE)[1].start).toBe(2.5);
		});

		it('parses the end time in seconds', () => {
			expect(parseVtt(SAMPLE)[1].end).toBe(5);
		});

		it('trims the cue text', () => {
			expect(parseVtt(SAMPLE)[0].text).toBe('Hello there.');
		});
	});

	describe('when timestamps omit the hour', () => {
		it('parses minutes and seconds', () => {
			expect(parseVtt('WEBVTT\n\n01:05.250 --> 01:07.000\nHi')[0].start).toBe(65.25);
		});
	});

	describe('when a cue has an identifier line', () => {
		it('ignores the identifier', () => {
			expect(parseVtt('WEBVTT\n\nintro\n00:00:01.000 --> 00:00:02.000\nHi')[0].text).toBe('Hi');
		});
	});

	describe('when a cue spans multiple lines', () => {
		it('joins them with a space', () => {
			expect(parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\nthere')[0].text).toBe('Hi there');
		});
	});

	describe('when the file uses CRLF line endings', () => {
		it('still parses the cues', () => {
			expect(parseVtt(SAMPLE.replace(/\n/g, '\r\n'))).toHaveLength(3);
		});
	});

	describe('when a cue has no text', () => {
		it('skips it', () => {
			expect(parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n')).toHaveLength(0);
		});
	});

	describe('when the input has NOTE blocks', () => {
		it('skips them', () => {
			expect(parseVtt('WEBVTT\n\nNOTE a comment\n\n00:00:01.000 --> 00:00:02.000\nHi')).toHaveLength(1);
		});
	});
});

describe('formatTimestamp', () => {
	it('formats seconds as hh:mm:ss', () => {
		expect(formatTimestamp(3725.9)).toBe('01:02:05');
	});
});

describe('vttToTranscript', () => {
	const cues = parseVtt(SAMPLE);

	describe('when the gap between cues exceeds the paragraph gap', () => {
		it('starts a new paragraph', () => {
			expect(vttToTranscript(cues, { timestamps: false, paragraphGapSeconds: 2 })).toBe(
				'Hello there. This is a test.\n\nA new paragraph.',
			);
		});
	});

	describe('when the gap is within the paragraph gap', () => {
		it('keeps the cues in one paragraph', () => {
			expect(vttToTranscript(cues, { timestamps: false, paragraphGapSeconds: 60 })).toBe(
				'Hello there. This is a test. A new paragraph.',
			);
		});
	});

	describe('when timestamps are enabled', () => {
		it('prefixes each paragraph with its start time', () => {
			expect(vttToTranscript(cues, { timestamps: true, paragraphGapSeconds: 2 })).toBe(
				'[00:00:00] Hello there. This is a test.\n\n[00:00:12] A new paragraph.',
			);
		});
	});

	describe('when there are no cues', () => {
		it('returns an empty string', () => {
			expect(vttToTranscript([], { timestamps: true, paragraphGapSeconds: 2 })).toBe('');
		});
	});
});

describe('formatVttTimestamp', () => {
	it('formats seconds as hh:mm:ss.mmm', () => {
		expect(formatVttTimestamp(3725.25)).toBe('01:02:05.250');
	});

	describe('when rounding carries into the next second', () => {
		it('rounds to the nearest millisecond', () => {
			expect(formatVttTimestamp(1.9999)).toBe('00:00:02.000');
		});
	});
});

describe('serializeVtt', () => {
	describe('when there are cues', () => {
		it('writes a WEBVTT header and one block per cue', () => {
			expect(
				serializeVtt([
					{ start: 0, end: 5, text: 'One.' },
					{ start: 5, end: 9.5, text: 'Two.' },
				]),
			).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nOne.\n\n00:00:05.000 --> 00:00:09.500\nTwo.\n');
		});

		it('round-trips through parseVtt', () => {
			const original = parseVtt(SAMPLE);
			expect(parseVtt(serializeVtt(original))).toEqual(original);
		});
	});

	describe('when there are no cues', () => {
		it('writes only the header', () => {
			expect(serializeVtt([])).toBe('WEBVTT\n');
		});
	});
});

describe('vttToTranscript with an interval', () => {
	describe('when intervalSeconds is set', () => {
		it('creates one timestamped paragraph per interval', () => {
			expect(
				vttToTranscript(parseVtt(SAMPLE), { timestamps: true, paragraphGapSeconds: 60, intervalSeconds: 5 }),
			).toBe('[00:00:00] Hello there. This is a test.\n\n[00:00:10] A new paragraph.');
		});
	});
});
