/**
 * Pure, vault-relative path helpers. These intentionally avoid importing
 * from `obsidian` so they can be unit tested without mocking the API.
 */

export const DEFAULT_DOWNLOAD_FOLDER = '_resources';

function segments(path: string): string[] {
	return path.replace(/\\+/g, '/').split('/').filter((s) => s !== '' && s !== '.');
}

function collapse(parts: string[]): string {
	const out: string[] = [];
	for (const part of parts) {
		if (part === '..') {
			if (out.length === 0) {
				throw new Error('Download folder resolves outside the vault');
			}
			out.pop();
		} else {
			out.push(part);
		}
	}
	return out.join('/');
}

export function dirname(path: string): string {
	const idx = path.lastIndexOf('/');
	return idx === -1 ? '' : path.slice(0, idx);
}

export function joinPath(base: string, name: string): string {
	return base === '' ? name : `${base}/${name}`;
}

export function basenameWithoutExtension(path: string): string {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(0, dot) : name;
}

/** Top-level folders that mark a `/`-prefixed setting as a filesystem path rather than a vault path. */
const SYSTEM_ROOTS = ['users', 'volumes', 'home', 'private', 'tmp', 'var', 'opt', 'mnt', 'media', 'library', 'applications', 'system'];

function isWindowsAbsolute(path: string): boolean {
	return /^[a-zA-Z]:[\\/]/.test(path) || /^[\\/]{2}/.test(path);
}

function looksLikeFilesystemPath(path: string, vaultBasePath: string): boolean {
	if (isWindowsAbsolute(path)) return true;
	if (!path.startsWith('/')) return false;
	const first = (segments(path)[0] ?? '').toLowerCase();
	const vaultFirst = (segments(vaultBasePath)[0] ?? '').toLowerCase();
	return SYSTEM_ROOTS.includes(first) || (vaultBasePath.startsWith('/') && first === vaultFirst);
}

/** Convert an absolute filesystem path to a vault path, or throw if it is outside the vault. */
function toVaultRelative(path: string, vaultBasePath: string): string {
	const target = segments(path);
	const base = segments(vaultBasePath);
	const inside =
		vaultBasePath !== '' &&
		!/^[\\/]{2}/.test(path) &&
		target.length >= base.length &&
		base.every((part, i) => part.toLowerCase() === target[i].toLowerCase());
	if (!inside) {
		throw new Error(`Download folder "${path}" must be inside the vault`);
	}
	return collapse(target.slice(base.length));
}

/**
 * Resolve the folder media should be downloaded to.
 *
 * - empty            -> `_resources` beside the note
 * - `media`          -> `media` beside the note
 * - `/Attachments`   -> `Attachments` from the vault root
 * - an absolute path inside the vault (`C:\Vault\Media`, `/Users/me/Vault/Media`) -> `Media`
 * - an absolute path outside the vault -> error
 */
export function resolveDownloadFolder(notePath: string, setting: string, vaultBasePath = ''): string {
	const trimmed = setting.trim() === '' ? DEFAULT_DOWNLOAD_FOLDER : setting.trim();
	if (looksLikeFilesystemPath(trimmed, vaultBasePath)) {
		return toVaultRelative(trimmed, vaultBasePath);
	}
	const fromRoot = /^[/\\]/.test(trimmed);
	const base = fromRoot ? [] : segments(dirname(notePath));
	return collapse([...base, ...segments(trimmed)]);
}

/** `subs/Talk.vtt` + 10 → `subs/Talk.10s.vtt` */
export function rolledUpVttPath(vttPath: string, intervalSeconds: number): string {
	return `${vttPath.replace(/\.vtt$/i, '')}.${intervalSeconds}s.vtt`;
}
