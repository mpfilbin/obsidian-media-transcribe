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
		if (text === this.current) return;
		this.current = text;
		this.el.setText(text);
		this.el.show();
	}

	clear(): void {
		this.current = null;
		this.setNote(null);
		this.el.setText('');
		this.el.hide();
	}
}
