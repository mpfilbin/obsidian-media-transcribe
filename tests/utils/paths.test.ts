import { describe, it, expect } from 'vitest';
import { resolveDownloadFolder, joinPath, dirname, basenameWithoutExtension, rolledUpVttPath } from '../../src/utils/paths';

describe('resolveDownloadFolder', () => {
	describe('when the setting is empty', () => {
		it('defaults to _resources beside the note', () => {
			expect(resolveDownloadFolder('notes/talk.md', '')).toBe('notes/_resources');
		});
	});

	describe('when the setting is a relative folder', () => {
		describe('when the note is in a subfolder', () => {
			it('resolves relative to the note folder', () => {
				expect(resolveDownloadFolder('notes/talk.md', 'media')).toBe('notes/media');
			});
		});

		describe('when the note is in the vault root', () => {
			it('resolves relative to the vault root', () => {
				expect(resolveDownloadFolder('talk.md', '_resources')).toBe('_resources');
			});
		});

		describe('when the setting walks up with ..', () => {
			it('resolves against the note folder', () => {
				expect(resolveDownloadFolder('a/b/talk.md', '../shared')).toBe('a/shared');
			});
		});

		describe('when the setting escapes the vault', () => {
			it('throws', () => {
				expect(() => resolveDownloadFolder('talk.md', '../outside')).toThrow('outside the vault');
			});
		});
	});

	describe('when the setting starts with a slash', () => {
		it('resolves relative to the vault root', () => {
			expect(resolveDownloadFolder('notes/talk.md', '/Attachments/Video')).toBe('Attachments/Video');
		});
	});

	describe('when the setting is a Windows drive path', () => {
		describe('when it is inside the vault', () => {
			it('converts it to a vault path', () => {
				expect(resolveDownloadFolder('notes/talk.md', 'C:\\Vault\\Media', 'C:\\Vault')).toBe('Media');
			});
		});

		describe('when the drive letter case differs from the vault path', () => {
			it('still matches the vault', () => {
				expect(resolveDownloadFolder('notes/talk.md', 'c:/vault/Media', 'C:\\Vault')).toBe('Media');
			});
		});

		describe('when it is outside the vault', () => {
			it('throws', () => {
				expect(() => resolveDownloadFolder('notes/talk.md', 'D:\\Videos', 'C:\\Vault')).toThrow('inside the vault');
			});
		});
	});

	describe('when the setting is a Windows network path', () => {
		it('throws', () => {
			expect(() => resolveDownloadFolder('notes/talk.md', '\\\\server\\share', 'C:\\Vault')).toThrow('inside the vault');
		});
	});

	describe('when the setting is an absolute macOS path', () => {
		describe('when it is inside the vault', () => {
			it('converts it to a vault path', () => {
				expect(resolveDownloadFolder('notes/talk.md', '/Users/me/Vault/Media', '/Users/me/Vault')).toBe('Media');
			});
		});

		describe('when it is outside the vault', () => {
			it('throws', () => {
				expect(() => resolveDownloadFolder('notes/talk.md', '/Users/me/Videos', '/Users/me/Vault')).toThrow('inside the vault');
			});
		});
	});

	describe('when the setting is the vault path itself', () => {
		it('resolves to the vault root', () => {
			expect(resolveDownloadFolder('notes/talk.md', '/Users/me/Vault', '/Users/me/Vault')).toBe('');
		});
	});

	describe('when the setting contains backslashes and doubled slashes', () => {
		it('normalizes them', () => {
			expect(resolveDownloadFolder('notes/talk.md', 'a\\\\b//c')).toBe('notes/a/b/c');
		});
	});
});

describe('joinPath', () => {
	describe('when the first part is empty', () => {
		it('returns the second part', () => {
			expect(joinPath('', 'a.md')).toBe('a.md');
		});
	});

	describe('when both parts are present', () => {
		it('joins them with a slash', () => {
			expect(joinPath('a', 'b.md')).toBe('a/b.md');
		});
	});
});

describe('dirname', () => {
	describe('when the path has a folder', () => {
		it('returns the folder', () => {
			expect(dirname('a/b/c.md')).toBe('a/b');
		});
	});

	describe('when the path has no folder', () => {
		it('returns an empty string', () => {
			expect(dirname('c.md')).toBe('');
		});
	});
});

describe('basenameWithoutExtension', () => {
	it('strips the folder and extension', () => {
		expect(basenameWithoutExtension('a/b/My Video [x].mp4')).toBe('My Video [x]');
	});
});

describe('rolledUpVttPath', () => {
	describe('when the path ends in .vtt', () => {
		it('inserts the interval before the extension', () => {
			expect(rolledUpVttPath('a/_resources/Talk [x].vtt', 10)).toBe('a/_resources/Talk [x].10s.vtt');
		});
	});

	describe('when the path has no .vtt extension', () => {
		it('appends the interval and extension', () => {
			expect(rolledUpVttPath('a/subs', 5)).toBe('a/subs.5s.vtt');
		});
	});
});
