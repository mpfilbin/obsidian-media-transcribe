const HEADING = '## Transcript';

/** Insert or replace the `## Transcript` section of a note. */
export function upsertTranscriptSection(content: string, transcript: string): string {
	const section = `${HEADING}\n\n${transcript}\n`;
	const lines = content.split('\n');
	const start = lines.findIndex((l) => l.trim() === HEADING);

	if (start === -1) {
		const base = content.replace(/\s+$/, '');
		return base === '' ? section : `${base}\n\n${section}`;
	}

	let end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
	if (end === -1) end = lines.length;

	const before = lines.slice(0, start).join('\n');
	const after = lines.slice(end).join('\n').replace(/^\n+/, '');
	const head = before === '' ? '' : `${before}\n`;
	return after === '' ? `${head}${section}` : `${head}${section}\n${after}`;
}
