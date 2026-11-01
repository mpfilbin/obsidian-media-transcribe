import { describe, it, expect } from 'vitest';
import { formatProgress, formatBytes, formatClock } from '../../src/progress/format';

const download = { stage: 'download' as const, part: 1, fraction: 0.425, downloadedBytes: 0, speed: null, etaSeconds: null };

describe('formatProgress', () => {
	describe('when downloading', () => {
		describe('when the fraction, speed and time remaining are known', () => {
			it('shows all three', () => {
				expect(formatProgress({ ...download, speed: 3.25 * 1024 * 1024, etaSeconds: 35 })).toBe(
					'Downloading 42% · 3.3 MiB/s · 0:35 left',
				);
			});
		});

		describe('when only the fraction is known', () => {
			it('shows the percentage', () => {
				expect(formatProgress(download)).toBe('Downloading 42%');
			});
		});

		describe('when the total size is unknown', () => {
			it('shows the amount downloaded', () => {
				expect(formatProgress({ ...download, fraction: null, downloadedBytes: 5 * 1024 * 1024 })).toBe(
					'Downloading 5.0 MiB',
				);
			});
		});

		describe('when downloading a later part', () => {
			describe('when the total size is known', () => {
				it('shows the part number and percentage', () => {
					expect(formatProgress({ ...download, part: 2 })).toBe('Downloading part 2 · 42%');
				});
			});

			describe('when the total size is unknown', () => {
				it('shows the part number and amount downloaded', () => {
					expect(formatProgress({ ...download, part: 2, fraction: null, downloadedBytes: 2048 })).toBe(
						'Downloading part 2 · 2.0 KiB',
					);
				});
			});
		});
	});

	describe('when post-processing the download', () => {
		it('says so', () => {
			expect(formatProgress({ stage: 'processing' })).toBe('Processing download…');
		});
	});

	describe('when preparing audio', () => {
		describe('when the fraction is known', () => {
			it('shows the percentage', () => {
				expect(formatProgress({ stage: 'audio', fraction: 0.8 })).toBe('Preparing audio 80%');
			});
		});

		describe('when the fraction is unknown', () => {
			it('shows an ellipsis', () => {
				expect(formatProgress({ stage: 'audio', fraction: null })).toBe('Preparing audio…');
			});
		});
	});

	describe('when transcribing', () => {
		describe('when the fraction and time remaining are known', () => {
			it('shows both', () => {
				expect(formatProgress({ stage: 'transcribe', fraction: 0.63, etaSeconds: 250 })).toBe(
					'Transcribing 63% · 4:10 left',
				);
			});
		});

		describe('when only the fraction is known', () => {
			it('shows the percentage', () => {
				expect(formatProgress({ stage: 'transcribe', fraction: 0.03, etaSeconds: null })).toBe('Transcribing 3%');
			});
		});

		describe('when the fraction is unknown', () => {
			it('shows an ellipsis', () => {
				expect(formatProgress({ stage: 'transcribe', fraction: null, etaSeconds: null })).toBe('Transcribing…');
			});
		});
	});
});

describe('formatBytes', () => {
	describe('when under a kibibyte', () => {
		it('shows bytes', () => {
			expect(formatBytes(512)).toBe('512 B');
		});
	});

	describe('when under a mebibyte', () => {
		it('shows KiB', () => {
			expect(formatBytes(1536)).toBe('1.5 KiB');
		});
	});

	describe('when under a gibibyte', () => {
		it('shows MiB', () => {
			expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MiB');
		});
	});

	describe('when a gibibyte or more', () => {
		it('shows GiB', () => {
			expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GiB');
		});
	});
});

describe('formatClock', () => {
	describe('when under an hour', () => {
		it('shows minutes and seconds', () => {
			expect(formatClock(65)).toBe('1:05');
		});
	});

	describe('when an hour or more', () => {
		it('shows hours, minutes and seconds', () => {
			expect(formatClock(3725)).toBe('1:02:05');
		});
	});
});
