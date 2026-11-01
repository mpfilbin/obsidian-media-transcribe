import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskQueue, type QueueTask } from '../../src/commands/queue';

interface Deferred {
	promise: Promise<void>;
	resolve: () => void;
	reject: (err: Error) => void;
}

const deferred = (): Deferred => {
	let resolve: () => void = () => undefined;
	let reject: (err: Error) => void = () => undefined;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A task whose completion the test controls; records the signal it was given. */
const task = (key: string) => {
	const done = deferred();
	const t = {
		key,
		label: key,
		signal: undefined as AbortSignal | undefined,
		done,
		run: vi.fn((signal: AbortSignal) => {
			t.signal = signal;
			return done.promise;
		}),
	};
	return t;
};

describe('TaskQueue', () => {
	let queue: TaskQueue;
	let onFinish: ReturnType<typeof vi.fn>;
	let onChange: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		onFinish = vi.fn();
		onChange = vi.fn();
		queue = new TaskQueue({ onFinish, onChange });
	});

	describe('when idle', () => {
		it('starts a new task immediately', () => {
			const a = task('a');
			queue.enqueue(a);
			expect(a.run).toHaveBeenCalled();
		});

		it('reports that the task started', () => {
			expect(queue.enqueue(task('a'))).toEqual({ status: 'started' });
		});

		it('has nothing to cancel', () => {
			expect(queue.cancelCurrent()).toBe(false);
		});
	});

	describe('when a task is running', () => {
		let a: ReturnType<typeof task>;
		let b: ReturnType<typeof task>;

		beforeEach(() => {
			a = task('a');
			b = task('b');
			queue.enqueue(a);
		});

		it('does not start the next task yet', () => {
			queue.enqueue(b);
			expect(b.run).not.toHaveBeenCalled();
		});

		it('reports how many tasks are ahead', () => {
			queue.enqueue(b);
			expect(queue.enqueue(task('c'))).toEqual({ status: 'queued', ahead: 2 });
		});

		it('exposes the running task signal', () => {
			expect(queue.signal).toBe(a.signal);
		});

		it('reports the running task and waiting count on change', () => {
			queue.enqueue(b);
			expect(onChange).toHaveBeenLastCalledWith({ running: a, waiting: 1 });
		});

		describe('when it finishes', () => {
			it('starts the next task', async () => {
				queue.enqueue(b);
				a.done.resolve();
				await flush();
				expect(b.run).toHaveBeenCalled();
			});

			it('reports success', async () => {
				a.done.resolve();
				await flush();
				expect(onFinish).toHaveBeenCalledWith(a, { error: null, cancelled: false });
			});
		});

		describe('when it fails', () => {
			it('still starts the next task', async () => {
				queue.enqueue(b);
				a.done.reject(new Error('boom'));
				await flush();
				expect(b.run).toHaveBeenCalled();
			});

			it('reports the error', async () => {
				const err = new Error('boom');
				a.done.reject(err);
				await flush();
				expect(onFinish).toHaveBeenCalledWith(a, { error: err, cancelled: false });
			});
		});

		describe('when it is cancelled', () => {
			it('aborts its signal', () => {
				queue.cancelCurrent();
				expect(a.signal?.aborted).toBe(true);
			});

			it('reports the cancellation', async () => {
				queue.cancelCurrent();
				a.done.reject(new Error('yt-dlp was cancelled'));
				await flush();
				expect(onFinish).toHaveBeenCalledWith(a, expect.objectContaining({ cancelled: true }));
			});

			it('moves on to the next task', async () => {
				queue.enqueue(b);
				queue.cancelCurrent();
				a.done.reject(new Error('cancelled'));
				await flush();
				expect(b.run).toHaveBeenCalled();
			});
		});

		describe('when the same task is added again', () => {
			describe('when it is the running task', () => {
				it('is rejected as a duplicate', () => {
					expect(queue.enqueue(task('a'))).toEqual({ status: 'duplicate' });
				});
			});

			describe('when it is already waiting', () => {
				it('is rejected as a duplicate', () => {
					queue.enqueue(b);
					expect(queue.enqueue(task('b'))).toEqual({ status: 'duplicate' });
				});
			});
		});

		describe('when the waiting tasks are cleared', () => {
			beforeEach(() => {
				queue.enqueue(b);
				queue.enqueue(task('c'));
			});

			it('returns how many were removed', () => {
				expect(queue.clearWaiting()).toBe(2);
			});

			it('keeps the running task going', () => {
				queue.clearWaiting();
				expect(a.signal?.aborted).toBe(false);
			});

			it('does not start them later', async () => {
				queue.clearWaiting();
				a.done.resolve();
				await flush();
				expect(b.run).not.toHaveBeenCalled();
			});
		});

		describe('when everything is stopped', () => {
			beforeEach(() => {
				queue.enqueue(b);
				queue.stopAll();
			});

			it('aborts the running task', () => {
				expect(a.signal?.aborted).toBe(true);
			});

			it('drops the waiting tasks', async () => {
				a.done.reject(new Error('cancelled'));
				await flush();
				expect(b.run).not.toHaveBeenCalled();
			});
		});
	});

	describe('when the last task finishes', () => {
		it('reports that nothing is running', async () => {
			const a = task('a');
			queue.enqueue(a);
			a.done.resolve();
			await flush();
			expect(onChange).toHaveBeenLastCalledWith({ running: null, waiting: 0 });
		});
	});
});

// Type check: QueueTask is the shape callers provide.
const _shape: QueueTask = { key: 'k', label: 'l', run: () => Promise.resolve() };
void _shape;
