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
});
