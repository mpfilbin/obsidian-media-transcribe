/**
 * Pure platform helpers. Callers pass the platform in (derived from Obsidian's
 * `Platform` API in main.ts) so every branch is testable on any OS.
 */

export type OsPlatform = 'win32' | 'darwin' | 'linux';

export interface PathContext {
	platform: OsPlatform;
	home: string;
}

/** Folders GUI-launched apps on macOS usually lack, because they don't inherit the shell PATH. */
export const MACOS_EXTRA_PATH = ['/opt/homebrew/bin', '/usr/local/bin'];

/**
 * Normalise a path typed or pasted into settings:
 * strips surrounding quotes ("Copy as path" on Windows), unescapes `\ ` on
 * macOS/Linux, and expands a leading `~`.
 */
export function cleanPathSetting(value: string, ctx: PathContext): string {
	let path = value.trim();
	const quoted = /^"(.*)"$/.exec(path) ?? /^'(.*)'$/.exec(path);
	if (quoted) path = quoted[1];

	if (ctx.platform !== 'win32') path = path.replace(/\\ /g, ' ');

	if (path === '~') return ctx.home;
	const sepAfterTilde = ctx.platform === 'win32' ? /^~[\\/]/ : /^~\//;
	if (sepAfterTilde.test(path)) {
		const separator = ctx.platform === 'win32' ? '\\' : '/';
		return `${ctx.home}${separator}${path.slice(2)}`;
	}
	return path;
}

/** Environment for child processes: UTF-8 Python output, plus Homebrew folders on macOS. */
export function buildChildEnv(
	env: Record<string, string | undefined>,
	platform: OsPlatform,
): Record<string, string | undefined> {
	const out: Record<string, string | undefined> = { ...env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

	if (platform === 'darwin') {
		const key = Object.keys(out).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
		const parts = (out[key] ?? '').split(':').filter((p) => p !== '');
		for (const extra of MACOS_EXTRA_PATH) {
			if (!parts.includes(extra)) parts.push(extra);
		}
		out[key] = parts.join(':');
	}
	return out;
}

export function isAscii(value: string): boolean {
	return [...value].every((c) => c.charCodeAt(0) < 128);
}

/**
 * whisper.cpp on Windows may fail to open paths with non-ASCII characters
 * (for example a user folder named `José`). Prefer the first ASCII-only candidate.
 */
export function pickAsciiTempDir(candidates: (string | undefined)[]): string {
	const present = candidates.filter((c): c is string => typeof c === 'string' && c !== '');
	return present.find(isAscii) ?? present[0];
}
