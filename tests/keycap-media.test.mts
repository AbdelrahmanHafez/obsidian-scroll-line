import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;
const OVERLAY_REGION = { x: 300, y: 580, width: 680, height: 112 };

const HELD_SHORTCUTS = [
	{
		label: 'MP4 editing scroll down',
		path: 'docs/assets/scroll-line-demo.mp4',
		timestamp: 2,
		keys: ['modifier', 'modifier', 'key'],
	},
	{
		label: 'MP4 editing scroll up',
		path: 'docs/assets/scroll-line-demo.mp4',
		timestamp: 5,
		keys: ['modifier', 'modifier', 'key'],
	},
	{
		label: 'MP4 Reading mode toggle',
		path: 'docs/assets/scroll-line-demo.mp4',
		timestamp: 7.1,
		keys: ['modifier', 'key'],
	},
	{
		label: 'MP4 Reading mode scroll down',
		path: 'docs/assets/scroll-line-demo.mp4',
		timestamp: 8.5,
		keys: ['modifier', 'modifier', 'key'],
	},
	{
		label: 'GIF editing scroll down',
		path: 'docs/assets/scroll-line-demo.gif',
		timestamp: 2,
		keys: ['modifier', 'modifier', 'key'],
	},
	{
		label: 'GIF editing scroll up',
		path: 'docs/assets/scroll-line-demo.gif',
		timestamp: 5,
		keys: ['modifier', 'modifier', 'key'],
	},
	{
		label: 'GIF Reading mode toggle',
		path: 'docs/assets/scroll-line-demo.gif',
		timestamp: 7.1,
		keys: ['modifier', 'key'],
	},
	{
		label: 'GIF Reading mode scroll down',
		path: 'docs/assets/scroll-line-demo.gif',
		timestamp: 8.5,
		keys: ['modifier', 'modifier', 'key'],
	},
	{
		label: 'Reading mode still',
		path: 'docs/assets/scroll-line-reading-mode.png',
		timestamp: 0,
		keys: ['modifier', 'modifier', 'key'],
	},
] as const;

describe('shortcut overlay keycaps', () => {
	it('uses compact Apple-keyboard geometry with centered glyphs', () => {
		// Arrange
		const { decodeFrame } = createTestContext();

		// Act
		const audits = HELD_SHORTCUTS.map((shortcut) => ({
			...shortcut,
			keycaps: inspectKeycaps(
				decodeFrame(shortcut.path, shortcut.timestamp),
				OVERLAY_REGION
			),
		}));
		const failures = audits.flatMap(auditKeycapGeometry);

		// Assert
		assert.deepEqual(
			failures,
			[],
			`keycap geometry regressions:\n${failures.join('\n')}`
		);
	});

	it('fades the overlay in and out over approximately 200ms', () => {
		// Arrange
		const { decodeFrame } = createTestContext();
		const fadeInBefore = decodeFrame('docs/assets/scroll-line-demo.mp4', 0.93);
		const fadeInMidpoint = decodeFrame(
			'docs/assets/scroll-line-demo.mp4',
			1.05
		);
		const fadeInHeld = decodeFrame('docs/assets/scroll-line-demo.mp4', 1.18);
		const fadeOutHeld = decodeFrame('docs/assets/scroll-line-demo.mp4', 3.04);
		const fadeOutMidpoint = decodeFrame(
			'docs/assets/scroll-line-demo.mp4',
			3.15
		);
		const fadeOutAfter = decodeFrame('docs/assets/scroll-line-demo.mp4', 3.27);

		// Act
		const fadeInSignal = normalizedPurpleSignal({
			background: fadeInBefore,
			midpoint: fadeInMidpoint,
			held: fadeInHeld,
		});
		const fadeOutSignal = normalizedPurpleSignal({
			background: fadeOutAfter,
			midpoint: fadeOutMidpoint,
			held: fadeOutHeld,
		});
		const failures = [
			{ transition: 'fade-in', signal: fadeInSignal },
			{ transition: 'fade-out', signal: fadeOutSignal },
		].filter(({ signal }) => signal < 0.3 || signal > 0.85);

		// Assert
		assert.deepEqual(
			failures,
			[],
			`expected a partial purple signal 100ms into each 200ms fade: ${failures
				.map(
					({ transition, signal }) =>
						`${transition}=${(signal * 100).toFixed(1)}%`
				)
				.join(', ')}`
		);
	});

	function createTestContext({ root = new URL('../', import.meta.url) } = {}) {
		const cache = new Map<string, Buffer>();

		return {
			decodeFrame(relativePath: string, timestamp: number) {
				const key = `${relativePath}:${timestamp}`;
				const cached = cache.get(key);
				if (cached != null) {
					return cached;
				}

				const result = spawnSync(
					'ffmpeg',
					[
						'-v',
						'error',
						'-i',
						fileURLToPath(new URL(relativePath, root)),
						'-ss',
						timestamp.toFixed(3),
						'-frames:v',
						'1',
						'-vf',
						`scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:flags=lanczos`,
						'-f',
						'rawvideo',
						'-pix_fmt',
						'rgb24',
						'pipe:1',
					],
					{ maxBuffer: FRAME_WIDTH * FRAME_HEIGHT * 4 }
				);

				if (result.error != null) {
					assert.fail(`failed to launch ffmpeg: ${result.error.message}`);
				}
				assert.equal(
					result.status,
					0,
					result.stderr?.toString('utf8') || `failed to decode ${relativePath}`
				);
				assert.equal(
					result.stdout.length,
					FRAME_WIDTH * FRAME_HEIGHT * 3,
					`unexpected frame size for ${relativePath}`
				);
				cache.set(key, result.stdout);
				return result.stdout;
			},
		};
	}
});

type Region = { x: number; y: number; width: number; height: number };
type KeyKind = (typeof HELD_SHORTCUTS)[number]['keys'][number];
type Keycap = ReturnType<typeof inspectKeycaps>[number];

function auditKeycapGeometry({
	label,
	keys,
	keycaps,
}: {
	label: string;
	keys: readonly KeyKind[];
	keycaps: Keycap[];
}) {
	const failures: string[] = [];
	if (keycaps.length !== keys.length) {
		return [
			`${label}: found ${keycaps.length} keycaps, expected ${keys.length}`,
		];
	}

	const heights = keycaps.map(({ height }) => height);
	const gaps = keycaps.slice(1).map((keycap, index) =>
		keycap.x - (keycaps[index].x + keycaps[index].width)
	);
	if (Math.max(...heights) - Math.min(...heights) > 2) {
		failures.push(`${label}: key heights differ (${heights.join(', ')}px)`);
	}
	if (gaps.some((gap) => gap < 8 || gap > 12)) {
		failures.push(`${label}: key gaps are ${gaps.join(', ')}px, expected 8-12px`);
	}
	if (gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 2) {
		failures.push(`${label}: key gaps are uneven (${gaps.join(', ')}px)`);
	}

	keycaps.forEach((keycap, index) => {
		const kind = keys[index];
		const prefix = `${label} key ${index + 1}`;
		if (keycap.height < 50 || keycap.height > 56) {
			failures.push(`${prefix}: height ${keycap.height}px, expected 50-56px`);
		}
		if (
			kind === 'modifier' &&
			(keycap.width < 92 || keycap.width > 142)
		) {
			failures.push(
				`${prefix}: modifier width ${keycap.width}px, expected 92-142px`
			);
		}
		if (kind === 'key' && Math.abs(keycap.width - keycap.height) > 3) {
			failures.push(
				`${prefix}: regular key is ${keycap.width}x${keycap.height}px, expected square`
			);
		}
		if (Math.abs(keycap.leftPadding - keycap.rightPadding) > 3) {
			failures.push(
				`${prefix}: horizontal text padding is ${keycap.leftPadding}/${keycap.rightPadding}px`
			);
		}
		if (Math.abs(keycap.topPadding - keycap.bottomPadding) > 3) {
			failures.push(
				`${prefix}: vertical text padding is ${keycap.topPadding}/${keycap.bottomPadding}px`
			);
		}
		if (
			Math.abs(keycap.horizontalGlyphOffset) > 1.5 ||
			Math.abs(keycap.verticalGlyphOffset) > 1.5
		) {
			failures.push(
				`${prefix}: glyph center offset is ${keycap.horizontalGlyphOffset.toFixed(
					1
				)}/${keycap.verticalGlyphOffset.toFixed(1)}px`
			);
		}
		if (keycap.outlineThickness < 1 || keycap.outlineThickness > 3) {
			failures.push(
				`${prefix}: outline is ${keycap.outlineThickness}px, expected 1-3px`
			);
		}
		if (keycap.cornerInset < 8 || keycap.cornerInset > 12) {
			failures.push(
				`${prefix}: corner inset is ${keycap.cornerInset}px, expected 8-12px`
			);
		}
		if (kind === 'modifier' && keycap.labelTokens.length !== 2) {
			failures.push(
				`${prefix}: found ${keycap.labelTokens.length} label token groups, expected modifier icon plus text (${keycap.labelTokens.join(
					', '
				)}px)`
			);
		}
	});

	return failures;
}

function inspectKeycaps(frame: Buffer, region: Region) {
	const { mask, components } = purpleComponents(frame, region);
	return components
		.filter(
			(component) =>
				component.pixels >= 30 &&
				component.width >= 35 &&
				component.height >= 20
		)
		.sort((left, right) => left.minX - right.minX)
		.map((component) => {
			const glyph = brightGlyph(frame, region, component);
			const leftPadding = glyph.minX - component.minX;
			const rightPadding = component.maxX - glyph.maxX;
			const topPadding = glyph.minY - component.minY;
			const bottomPadding = component.maxY - glyph.maxY;
			return {
				x: region.x + component.minX,
				y: region.y + component.minY,
				width: component.width,
				height: component.height,
				leftPadding,
				rightPadding,
				topPadding,
				bottomPadding,
				horizontalGlyphOffset: (leftPadding - rightPadding) / 2,
				verticalGlyphOffset: (topPadding - bottomPadding) / 2,
				outlineThickness: measureOutlineThickness(
					mask,
					region.width,
					component
				),
				cornerInset: measureCornerInset(mask, region.width, component),
				labelTokens: horizontalTokenWidths(glyph.columns),
			};
		});
}

function purpleComponents(frame: Buffer, region: Region) {
	const mask = new Uint8Array(region.width * region.height);
	const visited = new Uint8Array(region.width * region.height);

	for (let y = 0; y < region.height; y++) {
		for (let x = 0; x < region.width; x++) {
			const offset = ((region.y + y) * FRAME_WIDTH + region.x + x) * 3;
			const red = frame[offset];
			const green = frame[offset + 1];
			const blue = frame[offset + 2];
			if (
				red >= 60 &&
				blue >= 105 &&
				blue - red >= 20 &&
				blue - green >= 30
			) {
				mask[y * region.width + x] = 1;
			}
		}
	}

	const components = [];
	for (let index = 0; index < mask.length; index++) {
		if (mask[index] === 0 || visited[index] === 1) {
			continue;
		}
		components.push(
			collectComponent(mask, visited, region.width, region.height, index)
		);
	}
	return { components, mask };
}

function brightGlyph(
	frame: Buffer,
	region: Region,
	component: ReturnType<typeof collectComponent>
) {
	const columns = new Uint8Array(component.width);
	let minX = component.maxX;
	let maxX = component.minX;
	let minY = component.maxY;
	let maxY = component.minY;

	for (let y = component.minY + 5; y <= component.maxY - 5; y++) {
		for (let x = component.minX + 5; x <= component.maxX - 5; x++) {
			const offset = ((region.y + y) * FRAME_WIDTH + region.x + x) * 3;
			const red = frame[offset];
			const green = frame[offset + 1];
			const blue = frame[offset + 2];
			if (
				red >= 220 &&
				green >= 220 &&
				blue >= 220 &&
				Math.max(red, green, blue) - Math.min(red, green, blue) <= 35
			) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
				columns[x - component.minX] = 1;
			}
		}
	}

	assert.ok(minX <= maxX && minY <= maxY, 'keycap contains no visible glyph');
	return { columns, minX, maxX, minY, maxY };
}

function horizontalTokenWidths(columns: Uint8Array) {
	const runs: Array<{ start: number; end: number }> = [];
	let start = -1;
	for (let x = 0; x <= columns.length; x++) {
		if (x < columns.length && columns[x] === 1 && start === -1) {
			start = x;
		}
		if ((x === columns.length || columns[x] === 0) && start !== -1) {
			runs.push({ start, end: x - 1 });
			start = -1;
		}
	}

	const merged: typeof runs = [];
	for (const run of runs) {
		const previous = merged.at(-1);
		if (previous != null && run.start - previous.end - 1 <= 4) {
			previous.end = run.end;
		} else {
			merged.push({ ...run });
		}
	}
	return merged.map(({ start: runStart, end }) => end - runStart + 1);
}

function measureOutlineThickness(
	mask: Uint8Array,
	width: number,
	component: ReturnType<typeof collectComponent>
) {
	const y = Math.round((component.minY + component.maxY) / 2);
	let thickness = 0;
	for (let x = component.minX; x <= component.maxX; x++) {
		if (mask[y * width + x] === 0) {
			if (thickness > 0) {
				break;
			}
			continue;
		}
		thickness++;
	}
	return thickness;
}

function measureCornerInset(
	mask: Uint8Array,
	width: number,
	component: ReturnType<typeof collectComponent>
) {
	for (let y = component.minY; y <= component.minY + 3; y++) {
		const purpleXs = [];
		for (let x = component.minX; x <= component.maxX; x++) {
			if (mask[y * width + x] === 1) {
				purpleXs.push(x);
			}
		}
		if (purpleXs.length >= component.width * 0.35) {
			const left = purpleXs[0] - component.minX;
			const right = component.maxX - purpleXs.at(-1)!;
			return Math.round((left + right) / 2);
		}
	}
	return 0;
}

function collectComponent(
	mask: Uint8Array,
	visited: Uint8Array,
	width: number,
	height: number,
	start: number
) {
	const queue = [start];
	let cursor = 0;
	let pixels = 0;
	let minX = width;
	let maxX = 0;
	let minY = height;
	let maxY = 0;
	visited[start] = 1;

	while (cursor < queue.length) {
		const index = queue[cursor++];
		const x = index % width;
		const y = Math.floor(index / width);
		pixels++;
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);

		for (const neighbor of [
			index - width - 1,
			index - width,
			index - width + 1,
			index - 1,
			index + 1,
			index + width - 1,
			index + width,
			index + width + 1,
		]) {
			if (
				neighbor < 0 ||
				neighbor >= mask.length ||
				visited[neighbor] === 1 ||
				mask[neighbor] === 0
			) {
				continue;
			}
			const neighborX = neighbor % width;
			if (Math.abs(neighborX - x) > 1) {
				continue;
			}
			visited[neighbor] = 1;
			queue.push(neighbor);
		}
	}

	return {
		pixels,
		minX,
		maxX,
		minY,
		maxY,
		width: maxX - minX + 1,
		height: maxY - minY + 1,
	};
}

function purpleEnergy(frame: Buffer, region: Region) {
	let energy = 0;
	for (let y = region.y; y < region.y + region.height; y++) {
		for (let x = region.x; x < region.x + region.width; x++) {
			const offset = (y * FRAME_WIDTH + x) * 3;
			const red = frame[offset];
			const green = frame[offset + 1];
			const blue = frame[offset + 2];
			energy += Math.max(0, blue - Math.max(red, green));
		}
	}
	return energy;
}

function normalizedPurpleSignal({
	background,
	midpoint,
	held,
}: {
	background: Buffer;
	midpoint: Buffer;
	held: Buffer;
}) {
	const backgroundEnergy = purpleEnergy(background, OVERLAY_REGION);
	return (
		(purpleEnergy(midpoint, OVERLAY_REGION) - backgroundEnergy) /
		(purpleEnergy(held, OVERLAY_REGION) - backgroundEnergy)
	);
}
