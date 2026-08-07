import type { EditorView } from '@codemirror/view';

// Fraction of the remaining distance covered each frame. Exponential decay,
// so animations feel snappy at first and settle softly.
const EASE_PER_FRAME = 0.2;
const STOP_EPSILON = 0.5;

export class SmoothScroller {
	private target = 0;
	private lastScrollTop: number | null = null;
	private rafId: number | null = null;

	scrollBy(view: EditorView, delta: number) {
		const scrollEl = view.scrollDOM;

		if (this.rafId === null) {
			this.target = scrollEl.scrollTop;
			this.lastScrollTop = scrollEl.scrollTop;
		}

		const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
		this.target = Math.max(0, Math.min(this.target + delta, maxScroll));

		if (this.rafId !== null) return;

		const tick = () => {
			if (
				this.lastScrollTop !== null &&
				Math.abs(scrollEl.scrollTop - this.lastScrollTop) > STOP_EPSILON
			) {
				this.rafId = null;
				this.lastScrollTop = null;
				return;
			}

			const diff = this.target - scrollEl.scrollTop;
			if (Math.abs(diff) < STOP_EPSILON) {
				scrollEl.scrollTop = this.target;
				this.rafId = null;
				this.lastScrollTop = null;
				return;
			}
			scrollEl.scrollTop += diff * EASE_PER_FRAME;
			this.lastScrollTop = scrollEl.scrollTop;
			this.rafId = globalThis.requestAnimationFrame(tick);
		};
		this.rafId = globalThis.requestAnimationFrame(tick);
	}

	cancel() {
		if (this.rafId !== null) {
			globalThis.cancelAnimationFrame(this.rafId);
			this.rafId = null;
			this.lastScrollTop = null;
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
