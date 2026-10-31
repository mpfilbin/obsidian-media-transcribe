/** Read the media URL from a note's frontmatter. Accepts a string or the first entry of a list. */
export function getMediaUrl(
	frontmatter: Record<string, unknown> | undefined,
	property: string,
): string | null {
	if (!frontmatter) return null;
	const raw = frontmatter[property];
	const value: unknown = Array.isArray(raw) ? (raw[0] as unknown) : raw;
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (trimmed === '' || trimmed.startsWith('[[')) return null;
	return trimmed;
}
