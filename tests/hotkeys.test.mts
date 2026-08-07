import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveHotkeys } from '../src/hotkeys.ts';

const fallback = [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowDown' }];

test('uses the fallback when no custom hotkey exists', () => {
	// Arrange
	const manager = { getHotkeys: () => undefined };

	// Act
	const hotkeys = resolveHotkeys(manager, 'scroll-line:down', fallback);

	// Assert
	assert.equal(hotkeys, fallback);
});

test('uses the configured hotkey when one exists', () => {
	// Arrange
	const configured = [{ modifiers: ['Mod'], key: 'ArrowDown' }];
	const manager = { getHotkeys: () => configured };

	// Act
	const hotkeys = resolveHotkeys(manager, 'scroll-line:down', fallback);

	// Assert
	assert.equal(hotkeys, configured);
});

test('respects an explicitly cleared hotkey', () => {
	// Arrange
	const manager = { getHotkeys: () => [] };

	// Act
	const hotkeys = resolveHotkeys(manager, 'scroll-line:down', fallback);

	// Assert
	assert.deepEqual(hotkeys, []);
});
