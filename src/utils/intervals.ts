/** Roll-up increments offered in the picker and settings, in seconds. */
export const PRESET_INTERVALS: number[] = [5, 10, 15, 30, 60, 300];

/** Presets, plus the typed number first when it is a positive value not already offered. */
export function intervalSuggestions(query: string): number[] {
	const n = Number(query.trim());
	if (query.trim() !== '' && Number.isFinite(n) && n > 0 && !PRESET_INTERVALS.includes(n)) {
		return [n, ...PRESET_INTERVALS];
	}
	return PRESET_INTERVALS;
}

export function formatInterval(seconds: number): string {
	if (seconds >= 60 && seconds % 60 === 0) {
		const minutes = seconds / 60;
		return minutes === 1 ? '1 minute' : `${minutes} minutes`;
	}
	return `${seconds} seconds`;
}
