import { describe, it, expect } from 'vitest';
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
});
