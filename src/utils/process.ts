// cross-spawn resolves PATHEXT (finding `yt-dlp.cmd` for `yt-dlp`) and escapes arguments
// for Windows .cmd/.bat wrappers, which Node refuses to start without a shell.
import spawn from 'cross-spawn';
import type { ChildProcess } from 'child_process';
import { kill, platform as currentPlatform } from 'process';
import type { OsPlatform } from './platform';

export interface RunResult {
	stdout: string;
	stderr: string;
}

export interface RunOptions {
	/** Called for every complete line of stdout or stderr. */
	onLine?: (line: string) => void;
	signal?: AbortSignal;
	/** Environment for the child; defaults to the current process environment. */
	env?: Record<string, string | undefined>;
}

/**
 * How to stop a process and everything it started (yt-dlp runs ffmpeg, for example).
 * Windows needs taskkill; on macOS/Linux we return null and signal the process group.
 */
export function killTreeCommand(pid: number, platform: OsPlatform): { command: string; args: string[] } | null {
	return platform === 'win32' ? { command: 'taskkill', args: ['/pid', String(pid), '/T', '/F'] } : null;
}

function killTree(child: ChildProcess): void {
	if (child.pid === undefined) return;
	const tree = killTreeCommand(child.pid, currentPlatform as OsPlatform);
	if (tree) {
		spawn(tree.command, tree.args, { stdio: 'ignore', windowsHide: true }).on('error', () => child.kill());
		return;
	}
	try {
		// Negative pid signals the whole process group (the child was started detached).
		kill(-child.pid, 'SIGTERM');
	} catch {
		child.kill();
	}
}

export type ProcessRunner = (command: string, args: string[], options?: RunOptions) => Promise<RunResult>;

/** Spawn a process without a shell, capturing output. Rejects on non-zero exit. */
export const runProcess: ProcessRunner = (command, args, options = {}) =>
	new Promise<RunResult>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
			env: options.env,
			// Own process group on macOS/Linux so cancelling can stop grandchildren too.
			detached: currentPlatform !== 'win32',
		});
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
			killTree(child);
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

		child.stdout?.setEncoding('utf8');
		child.stderr?.setEncoding('utf8');
		child.stdout?.on('data', (c: string) => {
			stdout += c;
			feed('out', c);
		});
		child.stderr?.on('data', (c: string) => {
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
