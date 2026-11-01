import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
		},
		rules: {
			'obsidianmd/ui/sentence-case': [
				'warn',
				{
					brands: ['Obsidian Sync', 'Sync Plus', 'Sync Standard', 'Obsidian', 'GitHub', 'Hugging Face', 'yt-dlp', 'ffmpeg', 'Whisper', 'whisper.cpp'],
					acronyms: ['API', 'URL', 'HTML', 'CSS', 'JSON', 'WAV', 'CPU', 'PATH', 'OS', 'MB', 'MP4', 'AV1', 'VP9'],
					enforceCamelCaseLower: true,
				},
			],
		},
	},
]);
