import type { Progress } from '../types';

const SEGMENT = /^\[[\d:.]+\s+-->\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/;
const PERCENT = /progress\s*=\s*(\d+(?:\.\d+)?)%/;
/** Below this fraction, a time-remaining estimate is mostly noise. */
const MIN_FRACTION_FOR_ETA = 0.05;

/**
 * Parses whisper-cli output: printed segments (`[00:00:20.000 --> 00:00:25.000] text`)
 * measured against the audio duration, and `-pp` percentage lines.
 * `startedAt` and `now` are epoch milliseconds, passed in to keep this pure.
 */
export function createWhisperProgressParser(
	durationSeconds: number | null,
	startedAt: number,
): (line: string, now: number) => Progress | null {
	let best: number | null = null;

	return (line, now) => {
		const trimmed = line.trim();
		let fraction: number | null | undefined;

		const segment = SEGMENT.exec(trimmed);
		if (segment) {
			const end = Number(segment[1]) * 3600 + Number(segment[2]) * 60 + Number(segment[3]);
			fraction = durationSeconds ? Math.min(end / durationSeconds, 1) : null;
		} else {
			const percent = PERCENT.exec(trimmed);
			if (!percent) return null;
			fraction = Math.min(Number(percent[1]) / 100, 1);
		}

		if (fraction !== null && (best === null || fraction > best)) best = fraction;

		const etaSeconds =
			best !== null && best >= MIN_FRACTION_FOR_ETA
				? Math.round(((now - startedAt) / 1000) * ((1 - best) / best))
				: null;
		return { stage: 'transcribe', fraction: best, etaSeconds };
	};
}
