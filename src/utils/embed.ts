import { dirname } from './paths';

const split = (path: string): string[] => path.split('/').filter((s) => s !== '');

/** Path from the note's folder to the target, for a markdown link (`../` when needed). */
export function relativeLinkPath(notePath: string, targetPath: string): string {
	const from = split(dirname(notePath));
	const to = split(targetPath);
	let shared = 0;
	while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared += 1;
	return [...from.slice(shared).map(() => '..'), ...to.slice(shared)].join('/');
}

/** Encode only what breaks a markdown link target; keep other characters readable. */
export function encodeLinkPath(path: string): string {
	return path.replace(/[% \t()<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

/** `![title](path)`, escaping characters that would end the alt text or set an embed size. */
export function buildEmbed(title: string, linkPath: string): string {
	return `![${title.replace(/([[\]|\\])/g, '\\$1')}](${linkPath})`;
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/** Put the embed just below the frontmatter, unless the note already links to the file. */
export function insertEmbed(content: string, embed: string, linkPath: string): string {
	if (content.includes(`](${linkPath})`)) return content;

	const eol = content.includes('\r\n') ? '\r\n' : '\n';
	const match = FRONTMATTER.exec(content);
	const frontmatter = match ? match[0] : '';
	const rest = content.slice(frontmatter.length).replace(/^(?:\r?\n)+/, '');
	const head = frontmatter === '' ? '' : frontmatter.endsWith('\n') ? `${frontmatter}${eol}` : `${frontmatter}${eol}${eol}`;

	return rest === '' ? `${head}${embed}${eol}` : `${head}${embed}${eol}${eol}${rest}`;
}
