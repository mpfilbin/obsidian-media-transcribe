import type { Progress } from '../types';

export const YTDLP_PROGRESS_PREFIX = '@@mt';

/**
 * Machine-readable progress lines. `--print` makes yt-dlp quiet, so `--progress`
 * is needed to get any progress at all.
 */
export const YTDLP_PROGRESS_ARGS = [
	'--progress',
	'--newline',
	'--progress-template',
	`download:${YTDLP_PROGRESS_PREFIX} download %(progress.status)s %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s`,
	'--progress-template',
	`postprocess:${YTDLP_PROGRESS_PREFIX} postprocess %(progress.status)s %(progress.postprocessor)s`,
];

function num(value: string | undefined): number | null {
	if (value === undefined || value === 'NA') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/** Returns a stateful parser that counts download parts across lines. */
export function createYtDlpProgressParser(): (line: string) => Progress | null {
	let part = 1;
	let previousFinished = false;
	let downloadStarted = false;

	return (line) => {
		const fields = line.trim().split(/\s+/);
		if (fields[0] !== YTDLP_PROGRESS_PREFIX) return null;

		if (fields[1] === 'postprocess') {
			// Metadata clean-up (--replace-in-metadata) runs before the download; ignore it.
			return fields[2] === 'started' && downloadStarted ? { stage: 'processing' } : null;
		}
		if (fields[1] !== 'download') return null;

		const [, , status, done, total, estimate, speed, eta] = fields;
		downloadStarted = true;
		if (previousFinished && status === 'downloading') part += 1;
		previousFinished = status === 'finished';

		const downloaded = num(done) ?? 0;
		const size = num(total) ?? num(estimate);
		const fraction = status === 'finished' ? 1 : size ? Math.min(downloaded / size, 1) : null;

		return { stage: 'download', part, fraction, downloadedBytes: downloaded, speed: num(speed), etaSeconds: num(eta) };
	};
}
