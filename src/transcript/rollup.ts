import type { Cue } from './vtt';

function merge(group: Cue[], start: number): Cue {
	return {
		start,
		end: Math.max(...group.map((c) => c.end)),
		text: group.map((c) => c.text).join(' '),
	};
}

/**
 * Roll cues up into fixed time increments (for example every 5 or 10 seconds).
 * Each result cue starts on an interval boundary and holds all speech that began in it.
 * Intervals with no speech are skipped.
 */
export function rollupCues(cues: Cue[], intervalSeconds: number): Cue[] {
	if (intervalSeconds <= 0) return cues;

	const buckets = new Map<number, Cue[]>();
	for (const cue of cues) {
		const bucket = Math.floor(cue.start / intervalSeconds);
		const group = buckets.get(bucket);
		if (group) group.push(cue);
		else buckets.set(bucket, [cue]);
	}

	return [...buckets.entries()]
		.sort(([a], [b]) => a - b)
		.map(([bucket, group]) => merge(group, bucket * intervalSeconds));
}

/** Merge consecutive cues, starting a new group after a pause longer than `gapSeconds`. */
export function groupByPause(cues: Cue[], gapSeconds: number): Cue[] {
	const groups: Cue[][] = [];
	let previousEnd = Number.NEGATIVE_INFINITY;

	for (const cue of cues) {
		const current = groups[groups.length - 1];
		if (!current || cue.start - previousEnd > gapSeconds) groups.push([cue]);
		else current.push(cue);
		previousEnd = cue.end;
	}

	return groups.map((group) => merge(group, group[0].start));
}
