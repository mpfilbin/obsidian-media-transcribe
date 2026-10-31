export interface Cue {
	start: number;
	end: number;
	text: string;
}

export interface TranscriptOptions {
	timestamps: boolean;
	paragraphGapSeconds: number;
}

const TIMING = /^((?:\d+:)?\d{1,2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}[.,]\d{3})/;

function toSeconds(stamp: string): number {
	const parts = stamp.replace(',', '.').split(':').map(Number);
	return parts.reduce((total, part) => total * 60 + part, 0);
}

export function parseVtt(input: string): Cue[] {
	const cues: Cue[] = [];
	const blocks = input.replace(/\r\n?/g, '\n').split(/\n{2,}/);

	for (const block of blocks) {
		const lines = block.split('\n').map((l) => l.trim());
		const timingIdx = lines.findIndex((l) => TIMING.test(l));
		if (timingIdx === -1) continue;

		const match = TIMING.exec(lines[timingIdx]);
		if (!match) continue;

		const text = lines
			.slice(timingIdx + 1)
			.filter((l) => l !== '')
			.join(' ');
		if (text === '') continue;

		cues.push({ start: toSeconds(match[1]), end: toSeconds(match[2]), text });
	}
	return cues;
}

export function formatTimestamp(seconds: number): string {
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function vttToTranscript(cues: Cue[], options: TranscriptOptions): string {
	const paragraphs: { start: number; parts: string[] }[] = [];
	let previousEnd = Number.NEGATIVE_INFINITY;

	for (const cue of cues) {
		const current = paragraphs[paragraphs.length - 1];
		if (!current || cue.start - previousEnd > options.paragraphGapSeconds) {
			paragraphs.push({ start: cue.start, parts: [cue.text] });
		} else {
			current.parts.push(cue.text);
		}
		previousEnd = cue.end;
	}

	return paragraphs
		.map((p) => {
			const body = p.parts.join(' ');
			return options.timestamps ? `[${formatTimestamp(p.start)}] ${body}` : body;
		})
		.join('\n\n');
}
