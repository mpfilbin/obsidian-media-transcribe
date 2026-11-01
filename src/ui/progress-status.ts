import type { Progress } from '../types';
import { formatProgress } from '../progress/format';

/** The parts of Obsidian's HTMLElement helpers this needs; keeps it testable without a DOM. */
export interface StatusElement {
	setText(text: string): void;
	setAttr(name: string, value: string): void;
	show(): void;
	hide(): void;
}

/** Status bar item showing download/transcription progress. Clicking it cancels (wired in main.ts). */
export class ProgressStatus {
	private current: string | null = null;
	private base: string | null = null;
	private queued = 0;

	constructor(private readonly el: StatusElement) {
		this.setNote(null);
		el.hide();
	}

	/** Name the note the running task belongs to in the hover text. */
	setNote(name: string | null): void {
		this.el.setAttr('aria-label', name ? `${name} · Click to cancel` : 'Click to cancel');
	}

	update(progress: Progress): void {
		this.message(formatProgress(progress));
	}

	message(text: string): void {
		this.base = text;
		this.render();
	}

	/** Number of tasks waiting behind the running one. */
	setQueued(count: number): void {
		this.queued = count;
		if (this.base !== null) this.render();
	}

	private render(): void {
		const text = this.queued > 0 ? `${this.base} · ${this.queued} queued` : (this.base ?? '');
		if (text === this.current) return;
		this.current = text;
		this.el.setText(text);
		this.el.show();
	}

	clear(): void {
		this.current = null;
		this.base = null;
		this.setNote(null);
		this.el.setText('');
		this.el.hide();
	}
}
