import type { EditorView } from '@codemirror/view';

// Fraction of the remaining distance covered each frame. Exponential decay,
// so animations feel snappy at first and settle softly.
const EASE_PER_FRAME = 0.2;
const STOP_EPSILON = 0.5;

export class SmoothScroller {
	private target = 0;
	private rafId: number | null = null;

	scrollBy(view: EditorView, delta: number) {
		const scrollEl = view.scrollDOM;

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

const scrollers = new WeakMap<EditorView, SmoothScroller>();

export function getScroller(view: EditorView): SmoothScroller {
	let scroller = scrollers.get(view);
	if (!scroller) {
		scroller = new SmoothScroller();
		scrollers.set(view, scroller);
	}
	return scroller;
}

export class ManualScrollObserver {
	private readonly scrollEl: HTMLElement;
	private readonly scroller: SmoothScroller;
	private readonly cancelAnimation = () => this.scroller.cancel();

	constructor(view: EditorView) {
		this.scrollEl = view.scrollDOM;
		this.scroller = getScroller(view);
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
