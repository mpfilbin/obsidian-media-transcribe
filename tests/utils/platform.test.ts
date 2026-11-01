import { describe, it, expect } from 'vitest';
import { cleanPathSetting, buildChildEnv, pickAsciiTempDir, isAscii } from '../../src/utils/platform';

describe('cleanPathSetting', () => {
	const mac = { platform: 'darwin' as const, home: '/Users/me' };
	const win = { platform: 'win32' as const, home: 'C:\\Users\\me' };

	describe('when the value is empty', () => {
		it('returns an empty string', () => {
			expect(cleanPathSetting('  ', mac)).toBe('');
		});
	});

	describe('when the value is wrapped in double quotes', () => {
		it('removes the quotes', () => {
			expect(cleanPathSetting('"C:\\models\\ggml-medium.bin"', win)).toBe('C:\\models\\ggml-medium.bin');
		});
	});

	describe('when the value is wrapped in single quotes', () => {
		it('removes the quotes', () => {
			expect(cleanPathSetting("'/opt/models/m.bin'", mac)).toBe('/opt/models/m.bin');
		});
	});

	describe('when only one side is quoted', () => {
		it('leaves the value alone', () => {
			expect(cleanPathSetting('"abc', mac)).toBe('"abc');
		});
	});

	describe('when the value contains escaped spaces', () => {
		describe('when the platform is not Windows', () => {
			it('unescapes them', () => {
				expect(cleanPathSetting('/Users/me/My\\ Models/m.bin', mac)).toBe('/Users/me/My Models/m.bin');
			});
		});

		describe('when the platform is Windows', () => {
			it('keeps backslashes as separators', () => {
				expect(cleanPathSetting('C:\\My\\ Dir', win)).toBe('C:\\My\\ Dir');
			});
		});
	});

	describe('when the value starts with ~/', () => {
		it('expands to the home folder', () => {
			expect(cleanPathSetting('~/models/m.bin', mac)).toBe('/Users/me/models/m.bin');
		});
	});

	describe('when the value starts with ~\\ on Windows', () => {
		it('expands to the home folder', () => {
			expect(cleanPathSetting('~\\models\\m.bin', win)).toBe('C:\\Users\\me\\models\\m.bin');
		});
	});

	describe('when the value is just ~', () => {
		it('expands to the home folder', () => {
			expect(cleanPathSetting('~', mac)).toBe('/Users/me');
		});
	});

	describe('when ~ is not a prefix', () => {
		it('leaves it alone', () => {
			expect(cleanPathSetting('/a/~b', mac)).toBe('/a/~b');
		});
	});
});

describe('buildChildEnv', () => {
	describe('when building for any platform', () => {
		it('forces Python UTF-8 mode', () => {
			expect(buildChildEnv({}, 'linux').PYTHONUTF8).toBe('1');
		});

		it('forces UTF-8 Python stdio', () => {
			expect(buildChildEnv({}, 'linux').PYTHONIOENCODING).toBe('utf-8');
		});

		it('does not modify the input', () => {
			const env = { PATH: '/usr/bin' };
			buildChildEnv(env, 'darwin');
			expect(env).toEqual({ PATH: '/usr/bin' });
		});
	});

	describe('when the platform is macOS', () => {
		describe('when Homebrew folders are missing from PATH', () => {
			it('appends them', () => {
				expect(buildChildEnv({ PATH: '/usr/bin:/bin' }, 'darwin').PATH).toBe(
					'/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin',
				);
			});
		});

		describe('when a Homebrew folder is already on PATH', () => {
			it('does not add it twice', () => {
				expect(buildChildEnv({ PATH: '/opt/homebrew/bin:/usr/bin' }, 'darwin').PATH).toBe(
					'/opt/homebrew/bin:/usr/bin:/usr/local/bin',
				);
			});
		});

		describe('when PATH is unset', () => {
			it('uses only the Homebrew folders', () => {
				expect(buildChildEnv({}, 'darwin').PATH).toBe('/opt/homebrew/bin:/usr/local/bin');
			});
		});
	});

	describe('when the platform is Windows', () => {
		it('preserves the existing Path key and value', () => {
			expect(buildChildEnv({ Path: 'C:\\bin' }, 'win32').Path).toBe('C:\\bin');
		});
	});
});

describe('isAscii', () => {
	describe('when every character is ASCII', () => {
		it('returns true', () => {
			expect(isAscii('C:\\Users\\me\\Temp')).toBe(true);
		});
	});

	describe('when a character is outside ASCII', () => {
		it('returns false', () => {
			expect(isAscii('C:\\Users\\José\\Temp')).toBe(false);
		});
	});
});

describe('pickAsciiTempDir', () => {
	describe('when the first candidate is ASCII', () => {
		it('returns it', () => {
			expect(pickAsciiTempDir(['/tmp', '/other'])).toBe('/tmp');
		});
	});

	describe('when the first candidate has non-ASCII characters', () => {
		it('returns the first ASCII candidate', () => {
			expect(pickAsciiTempDir(['C:\\Users\\José\\Temp', undefined, 'C:\\ProgramData\\x'])).toBe('C:\\ProgramData\\x');
		});
	});

	describe('when no candidate is ASCII', () => {
		it('falls back to the first candidate', () => {
			expect(pickAsciiTempDir(['C:\\José', 'D:\\Zoë'])).toBe('C:\\José');
		});
	});
});
