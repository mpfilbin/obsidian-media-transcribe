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

export type CommandState = 'hidden' | 'run' | 'busy';

/** Commands stay visible while a task runs, so they can explain why they won't start. */
export function commandState(activeIsMarkdown: boolean, taskRunning: boolean): CommandState {
	if (!activeIsMarkdown) return 'hidden';
	return taskRunning ? 'busy' : 'run';
}

export function busyMessage(noteName: string): string {
	return `Already working on "${noteName}". Click the status bar item or run "Cancel download or transcription" to stop it.`;
}
