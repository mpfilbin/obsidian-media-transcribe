import type { Progress } from '../types';

const DURATION = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;

/**
 * Parses ffmpeg output when run with `-progress pipe:1 -nostats`.
 * The input duration (from ffmpeg's stderr header) is kept for whisper's progress too.
 */
export function createAudioProgressParser(): {
	parse: (line: string) => Progress | null;
	durationSeconds: () => number | null;
} {
	let duration: number | null = null;

	return {
		durationSeconds: () => duration,
		parse: (line) => {
			const d = DURATION.exec(line);
			if (d) {
				duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);
				return null;
			}
			const trimmed = line.trim();
			if (trimmed === 'progress=end') return { stage: 'audio', fraction: 1 };

			const position = /^out_time_us=(\d+)$/.exec(trimmed);
			if (!position) return null;
			const seconds = Number(position[1]) / 1_000_000;
			return { stage: 'audio', fraction: duration ? Math.min(seconds / duration, 1) : null };
		},
	};
}
