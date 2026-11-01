import { App, SuggestModal } from 'obsidian';
import { formatInterval, intervalSuggestions } from '../utils/intervals';

/** Pick a roll-up increment from presets, or type any number of seconds. */
export class IntervalModal extends SuggestModal<number> {
	private chosen = false;

	constructor(
		app: App,
		private readonly onChoose: (seconds: number | null) => void,
	) {
		super(app);
		this.setPlaceholder('Choose a time increment, or type a number of seconds');
	}

	getSuggestions(query: string): number[] {
		return intervalSuggestions(query);
	}

	renderSuggestion(seconds: number, el: HTMLElement): void {
		el.createDiv({ text: formatInterval(seconds) });
	}

	onChooseSuggestion(seconds: number): void {
		this.chosen = true;
		this.onChoose(seconds);
	}

	onClose(): void {
		// Obsidian calls onChooseSuggestion synchronously after onClose, so defer the cancel check.
		void Promise.resolve().then(() => {
			if (!this.chosen) this.onChoose(null);
		});
	}

	static pick(app: App): Promise<number | null> {
		return new Promise((resolve) => new IntervalModal(app, resolve).open());
	}
}
