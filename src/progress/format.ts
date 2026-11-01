import type { Progress } from '../types';

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KiB', 'MiB', 'GiB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(1)} ${units[unit]}`;
}

export function formatClock(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const percent = (fraction: number): string => `${Math.floor(fraction * 100)}%`;

/** One-line status bar text for a progress update. */
export function formatProgress(progress: Progress): string {
	switch (progress.stage) {
		case 'download': {
			const label = progress.part > 1 ? `Downloading part ${progress.part} ·` : 'Downloading';
			if (progress.fraction === null) return `${label} ${formatBytes(progress.downloadedBytes)}`;

			const details = [`${label} ${percent(progress.fraction)}`];
			if (progress.speed !== null) details.push(`${formatBytes(progress.speed)}/s`);
			if (progress.etaSeconds !== null) details.push(`${formatClock(progress.etaSeconds)} left`);
			return details.join(' · ');
		}
		case 'processing':
			return 'Processing download…';
		case 'audio':
			return progress.fraction === null ? 'Preparing audio…' : `Preparing audio ${percent(progress.fraction)}`;
		case 'transcribe': {
			if (progress.fraction === null) return 'Transcribing…';
			const head = `Transcribing ${percent(progress.fraction)}`;
			return progress.etaSeconds === null ? head : `${head} · ${formatClock(progress.etaSeconds)} left`;
		}
	}
}
