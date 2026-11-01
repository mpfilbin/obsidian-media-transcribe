/** The plugin's three steps, each returning the vault path the next step needs. */
export interface Steps<F> {
	download(file: F): Promise<string>;
	subtitles(file: F, mediaPath?: string): Promise<string>;
	transcript(file: F, subtitlesPath?: string): Promise<void>;
}

/**
 * Run all three steps, passing each result straight to the next step. Re-reading
 * the note's properties between steps would race Obsidian's metadata cache,
 * which updates a moment after each write.
 */
export async function downloadAndTranscribe<F>(steps: Steps<F>, file: F): Promise<void> {
	const mediaPath = await steps.download(file);
	const subtitlesPath = await steps.subtitles(file, mediaPath);
	await steps.transcript(file, subtitlesPath);
}

/** A path passed directly wins; otherwise fall back to the note's property, or throw `missing`. */
export function requirePath(
	explicit: string | undefined,
	frontmatter: Record<string, unknown> | undefined,
	property: string,
	missing: string,
): string {
	if (explicit) return explicit;
	const value = frontmatter?.[property];
	if (typeof value === 'string' && value !== '') return value;
	throw new Error(missing);
}

export function queuedMessage(label: string, ahead: number): string {
	return `Queued "${label}". It will start after ${ahead} ${ahead === 1 ? 'task' : 'tasks'}.`;
}

export function duplicateMessage(label: string): string {
	return `"${label}" is already queued or running.`;
}

/** Notice text for a finished task, or null when the steps already reported success. */
export function outcomeMessage(label: string, outcome: { error: unknown; cancelled: boolean }): string | null {
	if (outcome.cancelled) return `Cancelled "${label}".`;
	if (outcome.error === null) return null;
	const { error } = outcome;
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
	return `"${label}": ${message}`;
}
