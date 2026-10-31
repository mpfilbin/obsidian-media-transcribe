import { groupByPause, rollupCues } from './rollup';

export interface Cue {
	start: number;
	end: number;
	text: string;
}

export interface TranscriptOptions {
	timestamps: boolean;
	paragraphGapSeconds: number;
	/** When greater than zero, group into fixed increments instead of by pauses. */
	intervalSeconds?: number;
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

function pad(n: number, width = 2): string {
	return String(n).padStart(width, '0');
}

/** Format seconds as a WebVTT timestamp (`hh:mm:ss.mmm`). */
export function formatVttTimestamp(seconds: number): string {
	const ms = Math.round(seconds * 1000);
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	const s = Math.floor((ms % 60_000) / 1000);
	return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

export function serializeVtt(cues: Cue[]): string {
	const blocks = cues.map((c) => `${formatVttTimestamp(c.start)} --> ${formatVttTimestamp(c.end)}\n${c.text}`);
	return ['WEBVTT', ...blocks].join('\n\n') + '\n';
}

export function vttToTranscript(cues: Cue[], options: TranscriptOptions): string {
	const interval = options.intervalSeconds ?? 0;
	const paragraphs = interval > 0 ? rollupCues(cues, interval) : groupByPause(cues, options.paragraphGapSeconds);

	return paragraphs
		.map((p) => (options.timestamps ? `[${formatTimestamp(p.start)}] ${p.text}` : p.text))
		.join('\n\n');
}
