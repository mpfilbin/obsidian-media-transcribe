export interface QueueTask {
	/** Identifies the command and note, e.g. `download-media:notes/talk.md`; used to drop duplicates. */
	key: string;
	/** Shown to the user, e.g. the note name. */
	label: string;
	run: (signal: AbortSignal) => Promise<void>;
}

export interface QueueOutcome {
	error: unknown;
	cancelled: boolean;
}

export interface QueueState {
	running: QueueTask | null;
	waiting: number;
}

export interface QueueEvents {
	onStart?: (task: QueueTask) => void;
	onFinish?: (task: QueueTask, outcome: QueueOutcome) => void;
	onChange?: (state: QueueState) => void;
}

export type EnqueueResult = { status: 'started' } | { status: 'queued'; ahead: number } | { status: 'duplicate' };

/** Runs tasks one at a time, in the order they were added. */
export class TaskQueue {
	private current: { task: QueueTask; abort: AbortController } | null = null;
	private waiting: QueueTask[] = [];

	constructor(private readonly events: QueueEvents = {}) {}

	/** Abort signal of the running task. */
	get signal(): AbortSignal | undefined {
		return this.current?.abort.signal;
	}

	get running(): QueueTask | null {
		return this.current?.task ?? null;
	}

	get waitingCount(): number {
		return this.waiting.length;
	}

	enqueue(task: QueueTask): EnqueueResult {
		if (this.current?.task.key === task.key || this.waiting.some((t) => t.key === task.key)) {
			return { status: 'duplicate' };
		}
		const ahead = (this.current ? 1 : 0) + this.waiting.length;
		this.waiting.push(task);
		if (this.current) {
			this.emitChange();
			return { status: 'queued', ahead };
		}
		void this.pump();
		return { status: 'started' };
	}

	/** Cancel the running task; the queue then moves on. */
	cancelCurrent(): boolean {
		if (!this.current) return false;
		this.current.abort.abort();
		return true;
	}

	/** Drop waiting tasks, leaving the running one alone. Returns how many were dropped. */
	clearWaiting(): number {
		const count = this.waiting.length;
		this.waiting = [];
		this.emitChange();
		return count;
	}

	stopAll(): void {
		this.waiting = [];
		this.current?.abort.abort();
	}

	private emitChange(): void {
		this.events.onChange?.({ running: this.running, waiting: this.waiting.length });
	}

	private async pump(): Promise<void> {
		while (!this.current && this.waiting.length > 0) {
			const task = this.waiting.shift() as QueueTask;
			const abort = new AbortController();
			this.current = { task, abort };
			this.emitChange();
			this.events.onStart?.(task);

			let error: unknown = null;
			try {
				await task.run(abort.signal);
			} catch (err) {
				error = err;
			}

			this.current = null;
			this.events.onFinish?.(task, { error, cancelled: abort.signal.aborted });
			this.emitChange();
		}
	}
}
