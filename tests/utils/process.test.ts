import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, delimiter } from 'path';
import { runProcess } from '../../src/utils/process';

const node = process.execPath;

describe('runProcess', () => {
	describe('when the process exits successfully', () => {
		it('resolves with captured stdout', async () => {
			const result = await runProcess(node, ['-e', 'process.stdout.write("hi")']);
			expect(result.stdout).toBe('hi');
		});
	});

	describe('when the process exits non-zero', () => {
		it('rejects with the stderr text', async () => {
			await expect(
				runProcess(node, ['-e', 'console.error("boom"); process.exit(3)']),
			).rejects.toThrow('boom');
		});
	});

	describe('when the executable does not exist', () => {
		it('rejects with a helpful message', async () => {
			await expect(runProcess('definitely-not-a-real-binary', [])).rejects.toThrow('Could not start');
		});
	});

	describe('when a line handler is provided', () => {
		it('receives each output line', async () => {
			const lines: string[] = [];
			await runProcess(node, ['-e', 'console.log("a"); console.error("b")'], {
				onLine: (l) => lines.push(l),
			});
			expect(lines.sort()).toEqual(['a', 'b']);
		});
	});

	describe('when the signal is aborted', () => {
		it('rejects with a cancellation error', async () => {
			const controller = new AbortController();
			const promise = runProcess(node, ['-e', 'setTimeout(()=>{}, 10000)'], { signal: controller.signal });
			controller.abort();
			await expect(promise).rejects.toThrow('cancelled');
		});
	});

	describe('when an environment is provided', () => {
		it('passes it to the child process', async () => {
			const result = await runProcess(node, ['-e', 'process.stdout.write(process.env.MT_TEST ?? "")'], {
				env: { ...process.env, MT_TEST: 'from-env' },
			});
			expect(result.stdout).toBe('from-env');
		});
	});

	describe.runIf(process.platform === 'win32')('when the command is a Windows batch wrapper', () => {
		let dir: string;
		beforeAll(() => {
			dir = mkdtempSync(join(tmpdir(), 'mt-cmd-'));
			writeFileSync(join(dir, 'echo-arg.cmd'), '@echo off\r\nsetlocal EnableDelayedExpansion\r\nset "a=%~1"\r\necho(!a!\r\n');
		});

		describe('when called by its full path', () => {
			it('passes arguments containing shell metacharacters intact', async () => {
				const result = await runProcess(join(dir, 'echo-arg.cmd'), ['https://x.test/watch?v=1&t=2']);
				expect(result.stdout.trim()).toBe('https://x.test/watch?v=1&t=2');
			});
		});

		describe('when called by bare name from PATH', () => {
			it('finds the .cmd file', async () => {
				const result = await runProcess('echo-arg', ['hi'], {
					env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ''}` },
				});
				expect(result.stdout.trim()).toBe('hi');
			});
		});
	});
});
