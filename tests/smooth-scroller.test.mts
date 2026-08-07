import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { getScroller } from '../src/smooth-scroller.ts';

test('manual scrolling cancels an active shortcut animation', () => {
	// Arrange
	const { animationFrames, restoreAnimationFrame, scrollDOM, scroller, view } =
		createTestContext();

	try {
		// Act
		scroller.scrollBy(view, 120);
		runNextAnimationFrame(animationFrames);
		scrollDOM.scrollTop = 300;
		runNextAnimationFrame(animationFrames);
		runAllAnimationFrames(animationFrames);

		// Assert
		assert.equal(scrollDOM.scrollTop, 300);
		assert.equal(animationFrames.size, 0);
	} finally {
		restoreAnimationFrame();
	}
});

test('shortcut animation continues when no external scroll occurs', () => {
	// Arrange
	const { animationFrames, restoreAnimationFrame, scrollDOM, scroller, view } =
		createTestContext();

	try {
		// Act
		scroller.scrollBy(view, 120);
		runAllAnimationFrames(animationFrames);

		// Assert
		assert.equal(scrollDOM.scrollTop, 220);
		assert.equal(animationFrames.size, 0);
	} finally {
		restoreAnimationFrame();
	}
});

test('upward animation survives editor scroll adjustments', () => {
	// Arrange
	const { animationFrames, restoreAnimationFrame, scrollDOM, scroller, view } =
		createTestContext({ scrollTop: 500 });

	try {
		// Act
		scroller.scrollBy(view, -120);
		runNextAnimationFrame(animationFrames);
		scrollDOM.scrollTop -= 20;
		runAllAnimationFrames(animationFrames);

		// Assert
		assert.equal(scrollDOM.scrollTop, 380);
		assert.equal(animationFrames.size, 0);
	} finally {
		restoreAnimationFrame();
	}
});

function createTestContext({ scrollTop = 100 } = {}) {
	const animationFrames = new Map<number, FrameRequestCallback>();
	let nextAnimationFrameId = 1;
	const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
	const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
	globalThis.requestAnimationFrame = (callback) => {
		const id = nextAnimationFrameId++;
		animationFrames.set(id, callback);
		return id;
	};
	globalThis.cancelAnimationFrame = (id) => {
		animationFrames.delete(id);
	};
	const scrollDOM = {
		scrollTop,
		scrollHeight: 1_000,
		clientHeight: 200,
	};
	const view = { scrollDOM } as never;
	const scroller = getScroller(view);

	return {
		animationFrames,
		restoreAnimationFrame() {
			globalThis.requestAnimationFrame = originalRequestAnimationFrame;
			globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
		},
		scrollDOM,
		scroller,
		view,
	};
}

function runNextAnimationFrame(animationFrames: Map<number, FrameRequestCallback>) {
	const nextFrame = animationFrames.entries().next().value;
	assert.ok(nextFrame);
	const [id, callback] = nextFrame;
	animationFrames.delete(id);
	callback(0);
}

function runAllAnimationFrames(animationFrames: Map<number, FrameRequestCallback>) {
	while (animationFrames.size > 0) {
		runNextAnimationFrame(animationFrames);
	}
}
