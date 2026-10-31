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

/**
 * Resolve the folder media should be downloaded to.
 *
 * - empty            -> `_resources` beside the note
 * - `media`          -> `media` beside the note
 * - `/Attachments`   -> `Attachments` from the vault root
 */
export function resolveDownloadFolder(notePath: string, setting: string): string {
	const trimmed = setting.trim() === '' ? DEFAULT_DOWNLOAD_FOLDER : setting.trim();
	const fromRoot = /^[/\\]/.test(trimmed);
	const base = fromRoot ? [] : segments(dirname(notePath));
	return collapse([...base, ...segments(trimmed)]);
}
