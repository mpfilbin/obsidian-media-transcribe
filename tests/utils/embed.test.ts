import { describe, it, expect } from 'vitest';
import { relativeLinkPath, encodeLinkPath, buildEmbed, insertEmbed } from '../../src/utils/embed';

describe('relativeLinkPath', () => {
	describe('when the media is in a folder beside the note', () => {
		it('links into that folder', () => {
			expect(relativeLinkPath('notes/talk.md', 'notes/_resources/a.mp4')).toBe('_resources/a.mp4');
		});
	});

	describe('when the note is in the vault root', () => {
		it('links from the root', () => {
			expect(relativeLinkPath('talk.md', '_resources/a.mp4')).toBe('_resources/a.mp4');
		});
	});

	describe('when the media is outside the note folder', () => {
		it('walks up with ..', () => {
			expect(relativeLinkPath('notes/sub/talk.md', 'Attachments/a.mp4')).toBe('../../Attachments/a.mp4');
		});
	});

	describe('when the folders share a prefix but not a parent', () => {
		it('only matches whole folder names', () => {
			expect(relativeLinkPath('notes/talk.md', 'notes2/a.mp4')).toBe('../notes2/a.mp4');
		});
	});
});

describe('encodeLinkPath', () => {
	describe('when the path has characters that break markdown links', () => {
		it('percent-encodes them', () => {
			expect(encodeLinkPath('_resources/My talk (2024) 100%.mp4')).toBe('_resources/My%20talk%20%282024%29%20100%25.mp4');
		});
	});

	describe('when the path has non-ASCII characters', () => {
		it('leaves them readable', () => {
			expect(encodeLinkPath('_resources/Café.mp4')).toBe('_resources/Café.mp4');
		});
	});
});

describe('buildEmbed', () => {
	describe('when the title is plain', () => {
		it('uses markdown embed syntax', () => {
			expect(buildEmbed('My talk', '_resources/a.mp4')).toBe('![My talk](_resources/a.mp4)');
		});
	});

	describe('when the title has brackets or a pipe', () => {
		it('escapes them so the link and size syntax stay intact', () => {
			expect(buildEmbed('A [b] | c', 'a.mp4')).toBe('![A \\[b\\] \\| c](a.mp4)');
		});
	});
});

describe('insertEmbed', () => {
	const embed = '![Talk](_resources/a.mp4)';

	describe('when the note has frontmatter', () => {
		describe('when there is content after it', () => {
			it('inserts the embed below the frontmatter', () => {
				expect(insertEmbed('---\nmedia: x\n---\n# Talk\n', embed, '_resources/a.mp4')).toBe(
					'---\nmedia: x\n---\n\n![Talk](_resources/a.mp4)\n\n# Talk\n',
				);
			});
		});

		describe('when the frontmatter ends the file without a newline', () => {
			it('adds the embed on its own line', () => {
				expect(insertEmbed('---\nmedia: x\n---', embed, '_resources/a.mp4')).toBe(
					'---\nmedia: x\n---\n\n![Talk](_resources/a.mp4)\n',
				);
			});
		});

		describe('when there is nothing after it', () => {
			it('adds the embed after the frontmatter', () => {
				expect(insertEmbed('---\nmedia: x\n---\n', embed, '_resources/a.mp4')).toBe(
					'---\nmedia: x\n---\n\n![Talk](_resources/a.mp4)\n',
				);
			});
		});
	});

	describe('when the note has no frontmatter', () => {
		describe('when it has content', () => {
			it('inserts the embed at the top', () => {
				expect(insertEmbed('Notes here.\n', embed, '_resources/a.mp4')).toBe(
					'![Talk](_resources/a.mp4)\n\nNotes here.\n',
				);
			});
		});

		describe('when it is empty', () => {
			it('contains just the embed', () => {
				expect(insertEmbed('', embed, '_resources/a.mp4')).toBe('![Talk](_resources/a.mp4)\n');
			});
		});
	});

	describe('when the note already links to the file', () => {
		it('leaves the note unchanged', () => {
			const content = '---\nmedia: x\n---\n\n![Old title](_resources/a.mp4)\n';
			expect(insertEmbed(content, embed, '_resources/a.mp4')).toBe(content);
		});
	});

	describe('when the note uses Windows line endings', () => {
		it('inserts the embed with matching line endings', () => {
			expect(insertEmbed('---\r\nmedia: x\r\n---\r\nBody\r\n', embed, '_resources/a.mp4')).toBe(
				'---\r\nmedia: x\r\n---\r\n\r\n![Talk](_resources/a.mp4)\r\n\r\nBody\r\n',
			);
		});
	});
});
