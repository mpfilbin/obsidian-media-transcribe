/** The download settings a preset controls. */
export interface DownloadValues {
	downloadType: 'video' | 'audio';
	maxResolution: number;
	videoCodec: 'compatible' | 'smallest';
	maxFileSizeMb: number;
}

export interface DownloadPreset {
	id: string;
	name: string;
	description: string;
	/** Only these fields are set or compared; audio presets leave the video fields alone. */
	values: Partial<DownloadValues>;
}

export const DOWNLOAD_PRESETS: DownloadPreset[] = [
	{
		id: 'balanced',
		name: 'Balanced',
		description: 'MP4 up to 720p, no size limit. Good quality at a moderate size.',
		values: { downloadType: 'video', maxResolution: 720, videoCodec: 'compatible', maxFileSizeMb: 0 },
	},
	{
		id: 'sync',
		name: 'Obsidian Sync',
		description:
			'MP4 up to 720p that fits the 200 MB per-file limit of Sync Plus. Long videos automatically drop to the best resolution that fits.',
		values: { downloadType: 'video', maxResolution: 720, videoCodec: 'compatible', maxFileSizeMb: 200 },
	},
	{
		id: 'transcript',
		name: 'Transcript only',
		description: 'Audio only, as M4A. The smallest download, and all transcription needs.',
		values: { downloadType: 'audio', maxFileSizeMb: 0 },
	},
	{
		id: 'quality',
		name: 'Best quality',
		description: 'Highest resolution available, in AV1 or VP9 where possible. Large files; best for vaults that do not sync.',
		values: { downloadType: 'video', maxResolution: 0, videoCodec: 'smallest', maxFileSizeMb: 0 },
	},
];

/** Returns new values with the preset applied; an unknown id changes nothing. */
export function applyPreset(values: DownloadValues, id: string): DownloadValues {
	const preset = DOWNLOAD_PRESETS.find((p) => p.id === id);
	return { ...values, ...(preset?.values ?? {}) };
}

/** The preset the values correspond to, or `custom`. */
export function matchPreset(values: DownloadValues): string {
	const match = DOWNLOAD_PRESETS.find((p) =>
		(Object.keys(p.values) as (keyof DownloadValues)[]).every((key) => p.values[key] === values[key]),
	);
	return match?.id ?? 'custom';
}
