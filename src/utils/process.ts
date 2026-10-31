import { spawn } from 'child_process';

export interface RunResult {
	stdout: string;
	stderr: string;
}

export interface RunOptions {
	/** Called for every complete line of stdout or stderr. */
	onLine?: (line: string) => void;
	signal?: AbortSignal;
}

export type ProcessRunner = (command: string, args: string[], options?: RunOptions) => Promise<RunResult>;

/** Spawn a process without a shell, capturing output. Rejects on non-zero exit. */
export const runProcess: ProcessRunner = (command, args, options = {}) =>
	new Promise<RunResult>((resolve, reject) => {
		const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
		let stdout = '';
		let stderr = '';
		let settled = false;

		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			options.signal?.removeEventListener('abort', onAbort);
			fn();
		};

		const onAbort = () => {
			child.kill();
			finish(() => reject(new Error(`${command} was cancelled`)));
		};
		if (options.signal?.aborted) {
			onAbort();
			return;
		}
		options.signal?.addEventListener('abort', onAbort);

		const lineBuffer = { out: '', err: '' };
		const feed = (key: 'out' | 'err', chunk: string) => {
			lineBuffer[key] += chunk;
			const lines = lineBuffer[key].split(/\r?\n|\r/);
			lineBuffer[key] = lines.pop() ?? '';
			for (const line of lines) if (line.trim() !== '') options.onLine?.(line);
		};

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (c: string) => {
			stdout += c;
			feed('out', c);
		});
		child.stderr.on('data', (c: string) => {
			stderr += c;
			feed('err', c);
		});

		child.on('error', (err) =>
			finish(() => reject(new Error(`Could not start "${command}": ${err.message}`))),
		);
		child.on('close', (code) => {
			for (const rest of [lineBuffer.out, lineBuffer.err]) {
				if (rest.trim() !== '') options.onLine?.(rest);
			}
			finish(() =>
				code === 0
					? resolve({ stdout, stderr })
					: reject(new Error(`${command} exited with code ${code}: ${stderr.trim() || stdout.trim()}`)),
			);
		});
	});
