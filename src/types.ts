/** A progress update from one stage of the download/transcribe pipeline. */
export type Progress =
	| {
			stage: 'download';
			/** Media is often downloaded as separate video and audio parts. */
			part: number;
			/** 0–1, or null when the total size is unknown. */
			fraction: number | null;
			downloadedBytes: number;
			/** Bytes per second. */
			speed: number | null;
			etaSeconds: number | null;
	  }
	| { stage: 'processing' }
	| { stage: 'audio'; fraction: number | null }
	| { stage: 'transcribe'; fraction: number | null; etaSeconds: number | null };

export type ProgressListener = (progress: Progress) => void;
