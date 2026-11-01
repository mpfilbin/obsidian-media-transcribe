import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const PLUGIN_ID = 'media-transcribe';
const isWindows = process.platform === 'win32';

/** Runs the platform's uninstall script against a temporary vault. */
const uninstall = (vault: string): void => {
	if (isWindows) {
		execFileSync('powershell.exe', [
			'-NoProfile',
			'-ExecutionPolicy',
			'Bypass',
			'-File',
			join(ROOT, 'scripts', 'uninstall.ps1'),
			vault,
		]);
	} else {
		execFileSync('bash', [join(ROOT, 'scripts', 'uninstall.sh'), vault]);
	}
};

describe(isWindows ? 'scripts/uninstall.ps1' : 'scripts/uninstall.sh', () => {
	let vault: string;

	const setUp = (plugins: string[]): void => {
		vault = mkdtempSync(join(tmpdir(), 'mt-vault-'));
		mkdirSync(join(vault, '.obsidian', 'plugins', PLUGIN_ID), { recursive: true });
		writeFileSync(join(vault, '.obsidian', 'community-plugins.json'), JSON.stringify(plugins));
	};

	const remaining = (): unknown =>
		JSON.parse(readFileSync(join(vault, '.obsidian', 'community-plugins.json'), 'utf8'));

	afterEach(() => {
		rmSync(vault, { recursive: true, force: true });
	});

	describe('when the plugin folder exists', () => {
		it('removes it', () => {
			setUp([PLUGIN_ID]);
			uninstall(vault);
			expect(existsSync(join(vault, '.obsidian', 'plugins', PLUGIN_ID))).toBe(false);
		});
	});

	describe('when one other plugin remains', () => {
		it('keeps the list a JSON array', () => {
			setUp([PLUGIN_ID, 'other-plugin']);
			uninstall(vault);
			expect(remaining()).toEqual(['other-plugin']);
		});
	});

	describe('when no plugins remain', () => {
		it('writes an empty array', () => {
			setUp([PLUGIN_ID]);
			uninstall(vault);
			expect(remaining()).toEqual([]);
		});
	});

	describe('when several plugins remain', () => {
		it('keeps them in order', () => {
			setUp(['a-plugin', PLUGIN_ID, 'b-plugin']);
			uninstall(vault);
			expect(remaining()).toEqual(['a-plugin', 'b-plugin']);
		});
	});

	describe('when the plugin is not listed', () => {
		it('leaves the list unchanged', () => {
			setUp(['other-plugin']);
			uninstall(vault);
			expect(remaining()).toEqual(['other-plugin']);
		});
	});
}, 60_000);
