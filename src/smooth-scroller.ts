import type { EditorView } from '@codemirror/view';

type ScrollTarget = EditorView | HTMLElement;

interface MarkdownScrollView {
	getMode(): string;
	editor: { cm: EditorView };
	previewMode: { containerEl: HTMLElement };
}

export interface MarkdownScrollContext {
	lineHeight: number;
	mode: 'preview' | 'source';
	scrollEl: HTMLElement;
}

interface ScrollCommand {
	callback(): void;
	id: 'down' | 'up';
	name: 'Down' | 'Up';
	repeatable: true;
}

// Fraction of the remaining distance covered each frame. Exponential decay,
// so animations feel snappy at first and settle softly.
const EASE_PER_FRAME = 0.2;
const STOP_EPSILON = 0.5;
const DEFAULT_PREVIEW_LINE_HEIGHT = 24;
const NORMAL_LINE_HEIGHT_RATIO = 1.5;

export class SmoothScroller {
	private target = 0;
	private rafId: number | null = null;

	scrollBy(target: ScrollTarget, delta: number) {
		const scrollEl = getScrollElement(target);

		if (this.rafId === null) {
			this.target = scrollEl.scrollTop;
		}

		const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
		this.target = Math.max(0, Math.min(this.target + delta, maxScroll));

		if (this.rafId !== null) return;

		const tick = () => {
			const diff = this.target - scrollEl.scrollTop;
			if (Math.abs(diff) < STOP_EPSILON) {
				scrollEl.scrollTop = this.target;
				this.rafId = null;
				return;
			}
			scrollEl.scrollTop += diff * EASE_PER_FRAME;
			this.rafId = globalThis.requestAnimationFrame(tick);
		};
		this.rafId = globalThis.requestAnimationFrame(tick);
	}

	cancel() {
		if (this.rafId !== null) {
			globalThis.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}
}

const scrollers = new WeakMap<HTMLElement, SmoothScroller>();

export function getScroller(target: ScrollTarget): SmoothScroller {
	const scrollEl = getScrollElement(target);
	let scroller = scrollers.get(scrollEl);
	if (!scroller) {
		scroller = new SmoothScroller();
		scrollers.set(scrollEl, scroller);
	}
	return scroller;
}

export function getMarkdownScrollContext(
	view: MarkdownScrollView
): MarkdownScrollContext {
	if (view.getMode() === 'preview') {
		const previewContainer = view.previewMode.containerEl;
		const scrollEl =
			previewContainer.querySelector<HTMLElement>('.markdown-preview-view') ??
			previewContainer;
		return {
			lineHeight: getPreviewLineHeight(scrollEl),
			mode: 'preview',
			scrollEl,
		};
	}

	return {
		lineHeight: view.editor.cm.defaultLineHeight,
		mode: 'source',
		scrollEl: view.editor.cm.scrollDOM,
	};
}

export function createScrollCommands(
	scroll: (direction: -1 | 1) => void
): ScrollCommand[] {
	return [
		{
			id: 'down',
			name: 'Down',
			repeatable: true,
			callback: () => scroll(1),
		},
		{
			id: 'up',
			name: 'Up',
			repeatable: true,
			callback: () => scroll(-1),
		},
	];
}

export class ManualScrollObserver {
	private readonly scrollEl: HTMLElement;
	private readonly scroller: SmoothScroller;
	private readonly cancelAnimation = () => this.scroller.cancel();

	constructor(target: ScrollTarget) {
		this.scrollEl = getScrollElement(target);
		this.scroller = getScroller(this.scrollEl);
		this.scrollEl.addEventListener('wheel', this.cancelAnimation, { passive: true });
		this.scrollEl.addEventListener('mousedown', this.cancelAnimation, {
			passive: true,
		});
		this.scrollEl.addEventListener('pointerdown', this.cancelAnimation, {
			passive: true,
		});
	}

	destroy() {
		this.scrollEl.removeEventListener('wheel', this.cancelAnimation);
		this.scrollEl.removeEventListener('mousedown', this.cancelAnimation);
		this.scrollEl.removeEventListener('pointerdown', this.cancelAnimation);
	}
}

function getScrollElement(target: ScrollTarget): HTMLElement {
	return 'scrollDOM' in target ? target.scrollDOM : target;
}

function getPreviewLineHeight(scrollEl: HTMLElement): number {
	const styles = scrollEl.ownerDocument.defaultView?.getComputedStyle(scrollEl);
	const lineHeight = parsePositiveCssLength(styles?.lineHeight);
	if (lineHeight !== null) return lineHeight;

	const fontSize = parsePositiveCssLength(styles?.fontSize);
	return fontSize === null
		? DEFAULT_PREVIEW_LINE_HEIGHT
		: fontSize * NORMAL_LINE_HEIGHT_RATIO;
}

function parsePositiveCssLength(value: string | undefined): number | null {
	const pixels = Number.parseFloat(value ?? '');
	return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
}
