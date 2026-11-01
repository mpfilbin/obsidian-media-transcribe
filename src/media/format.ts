export interface FormatOptions {
	type: 'video' | 'audio';
	/** Highest resolution (shortest side, e.g. 720), or 0 for the best available. */
	maxResolution: number;
	/** `compatible`: H.264/AAC MP4 that plays everywhere. `smallest`: yt-dlp's default AV1/VP9 preference. */
	codec: 'compatible' | 'smallest';
	/** Preferred maximum file size in MB (decimal), or 0 for no limit. */
	maxFileSizeMb: number;
}

/** Share of the size limit the video stream may use, leaving room for the audio. */
const VIDEO_SHARE = 0.85;

/**
 * yt-dlp format options. Sizes use `filesize<?` so formats of unknown size stay eligible,
 * and each selector falls back to the normal choice rather than failing the download.
 */
export function buildFormatArgs(options: FormatOptions): string[] {
	const limit = options.maxFileSizeMb;

	if (options.type === 'audio') {
		const selector =
			limit > 0
				? `ba[ext=m4a][filesize<?${limit}MB]/ba[filesize<?${limit}MB]/ba[ext=m4a]/ba/b`
				: 'ba[ext=m4a]/ba/b';
		return ['-f', selector, '-x', '--audio-format', 'm4a'];
	}

	const args: string[] = [];
	if (limit > 0) {
		const videoLimit = Math.floor(limit * VIDEO_SHARE);
		args.push('-f', `bv*[filesize<?${videoLimit}MB]+ba/b[filesize<?${limit}MB]/bv*+ba/b`);
	}

	const res = options.maxResolution > 0 ? `res:${options.maxResolution}` : 'res';
	if (options.codec === 'compatible') {
		// Mirrors yt-dlp's own `-t mp4` preset, with the resolution cap added.
		args.push('-S', `vcodec:h264,lang,quality,${res},fps,hdr:12,acodec:aac`);
		args.push('--merge-output-format', 'mp4', '--remux-video', 'mp4');
	} else if (options.maxResolution > 0) {
		args.push('-S', res);
	}
	return args;
}

/** Warning when a download is still over the size limit (e.g. Obsidian Sync's per-file maximum). */
export function sizeWarning(label: string, bytes: number, limitMb: number): string | null {
	if (limitMb <= 0 || bytes <= limitMb * 1_000_000) return null;
	const mb = Math.round(bytes / 1_000_000);
	return `"${label}" downloaded at ${mb} MB, over your ${limitMb} MB limit, so Obsidian Sync will not sync it. Try a lower maximum resolution or audio only.`;
}
