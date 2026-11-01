import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressStatus, type StatusElement } from '../../src/ui/progress-status';

class FakeElement implements StatusElement {
	text = '';
	visible = true;
	attrs: Record<string, string> = {};
	writes = 0;
	setText(text: string): void {
		this.text = text;
		this.writes += 1;
	}
	setAttr(name: string, value: string): void {
		this.attrs[name] = value;
	}
	show(): void {
		this.visible = true;
	}
	hide(): void {
		this.visible = false;
	}
}

describe('ProgressStatus', () => {
	let el: FakeElement;
	let status: ProgressStatus;

	beforeEach(() => {
		el = new FakeElement();
		status = new ProgressStatus(el);
	});

	describe('when created', () => {
		it('starts hidden', () => {
			expect(el.visible).toBe(false);
		});

		it('tells screen readers and hover that clicking cancels', () => {
			expect(el.attrs['aria-label']).toBe('Click to cancel');
		});
	});

	describe('when given a progress update', () => {
		beforeEach(() => status.update({ stage: 'audio', fraction: 0.5 }));

		it('shows the formatted progress', () => {
			expect(el.text).toBe('Preparing audio 50%');
		});

		it('becomes visible', () => {
			expect(el.visible).toBe(true);
		});
	});

	describe('when given a message', () => {
		it('shows the message', () => {
			status.message('Starting download…');
			expect(el.text).toBe('Starting download…');
		});
	});

	describe('when the text has not changed', () => {
		it('does not rewrite the element', () => {
			status.update({ stage: 'audio', fraction: 0.5 });
			const writes = el.writes;
			status.update({ stage: 'audio', fraction: 0.501 });
			expect(el.writes).toBe(writes);
		});
	});

	describe('when cleared', () => {
		beforeEach(() => {
			status.update({ stage: 'audio', fraction: 0.5 });
			status.clear();
		});

		it('hides the item', () => {
			expect(el.visible).toBe(false);
		});

		it('shows the next update even if its text matches the last one', () => {
			status.update({ stage: 'audio', fraction: 0.5 });
			expect(el.visible).toBe(true);
		});
	});

	describe('when a note name is set', () => {
		it('names the note in the hover text', () => {
			status.setNote('Talk notes');
			expect(el.attrs['aria-label']).toBe('Talk notes · Click to cancel');
		});
	});

	describe('when cleared after a note name was set', () => {
		it('drops the note from the hover text', () => {
			status.setNote('Talk notes');
			status.clear();
			expect(el.attrs['aria-label']).toBe('Click to cancel');
		});
	});

	describe('when tasks are queued', () => {
		describe('when some are waiting', () => {
			it('adds the count to the text', () => {
				status.message('Transcribing 63%');
				status.setQueued(2);
				expect(el.text).toBe('Transcribing 63% · 2 queued');
			});
		});

		describe('when none are waiting', () => {
			it('shows just the progress', () => {
				status.setQueued(2);
				status.setQueued(0);
				status.message('Transcribing 63%');
				expect(el.text).toBe('Transcribing 63%');
			});
		});

		describe('when the count changes before any progress', () => {
			it('stays hidden', () => {
				status.setQueued(1);
				expect(el.visible).toBe(false);
			});
		});
	});
});
