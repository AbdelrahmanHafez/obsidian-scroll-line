import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;
const STATUS_BAR = { x: 0, y: 692, width: 1280, height: 28 };
const MAX_FROZEN_STRIP_DELTA = 1.5;

const SCROLL_TRANSITIONS = [
	{ before: 1.16, during: 1.32 },
	{ before: 1.56, during: 1.72 },
	{ before: 1.96, during: 2.12 },
	{ before: 2.36, during: 2.52 },
	{ before: 2.76, during: 2.92 },
	{ before: 4.0, during: 4.15 },
	{ before: 4.4, during: 4.55 },
	{ before: 4.8, during: 4.95 },
	{ before: 5.2, during: 5.35 },
	{ before: 5.6, during: 5.75 },
	{ before: 7.73, during: 7.88 },
	{ before: 8.13, during: 8.28 },
	{ before: 8.53, during: 8.68 },
	{ before: 8.93, during: 9.08 },
	{ before: 9.33, during: 9.48 },
];

describe('demo media regressions', () => {
	it('freezes the complete status bar during every synthesized scroll', () => {
		// Arrange
		const { decodeFrame } = createTestContext();
		const demos = [
			'docs/assets/scroll-line-demo.mp4',
			'docs/assets/scroll-line-demo.gif',
		];

		// Act
		const deltas = demos.flatMap((demo) =>
			SCROLL_TRANSITIONS.map(({ before, during }) => ({
				demo,
				during,
				delta: regionMeanAbsoluteDelta(
					decodeFrame(demo, before),
					decodeFrame(demo, during),
					STATUS_BAR
				),
			}))
		);
		const failures = deltas.filter(
			({ delta }) => delta > MAX_FROZEN_STRIP_DELTA
		);

		// Assert
		assert.deepEqual(
			failures,
			[],
			`status bar moved during transitions: ${failures
				.map(({ demo, during, delta }) =>
					`${demo}@${during.toFixed(2)}s=${delta.toFixed(2)}`
				)
				.join(', ')}`
		);
	});

	it('uses a colon in the anchor text across still and animated media', () => {
		// Arrange
		const { decodeFrame } = createTestContext();
		const media = [
			{
				path: 'docs/assets/scroll-line-selection.png',
				region: { x: 433, y: 135, width: 17, height: 16 },
				timestamp: 0,
			},
			{
				path: 'docs/assets/scroll-line-reading-mode.png',
				region: { x: 403, y: 97, width: 17, height: 16 },
				timestamp: 0,
			},
			{
				path: 'docs/assets/scroll-line-demo.mp4',
				region: { x: 433, y: 135, width: 17, height: 16 },
				timestamp: 0.4,
			},
			{
				path: 'docs/assets/scroll-line-demo.gif',
				region: { x: 433, y: 135, width: 17, height: 16 },
				timestamp: 0.4,
			},
		];

		// Act
		const horizontalRuns = media.map(({ path, region, timestamp }) => ({
			path,
			run: longestBrightHorizontalRun(decodeFrame(path, timestamp), region),
		}));
		const emDashMatches = horizontalRuns.filter(({ run }) => run > 5);

		// Assert
		assert.deepEqual(
			emDashMatches,
			[],
			`anchor still contains a long dash glyph: ${emDashMatches
				.map(({ path, run }) => `${path}=${run}px`)
				.join(', ')}`
		);
	});

	it('does not label the Reading mode still with the mode-toggle shortcut', () => {
		// Arrange
		const { decodeFrame } = createTestContext();
		const frame = decodeFrame(
			'docs/assets/scroll-line-reading-mode.png',
			0
		);

		// Act
		const keycapCount = countPurpleKeycapOutlines(frame, {
			x: 350,
			y: 570,
			width: 580,
			height: 130,
		});

		// Assert
		assert.ok(
			keycapCount === 0 || keycapCount === 3,
			`expected no overlay or Ctrl+Option+Down, found ${keycapCount} keycaps`
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

				assert.equal(
					result.status,
					0,
					result.stderr.toString('utf8') || `failed to decode ${relativePath}`
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

function regionMeanAbsoluteDelta(
	left: Buffer,
	right: Buffer,
	region: { x: number; y: number; width: number; height: number }
) {
	let delta = 0;
	let samples = 0;

	for (let y = region.y; y < region.y + region.height; y++) {
		for (let x = region.x; x < region.x + region.width; x++) {
			const offset = (y * FRAME_WIDTH + x) * 3;
			for (let channel = 0; channel < 3; channel++) {
				delta += Math.abs(left[offset + channel] - right[offset + channel]);
				samples++;
			}
		}
	}

	return delta / samples;
}

function longestBrightHorizontalRun(
	frame: Buffer,
	region: { x: number; y: number; width: number; height: number }
) {
	let longest = 0;

	for (let y = region.y; y < region.y + region.height; y++) {
		let current = 0;
		for (let x = region.x; x < region.x + region.width; x++) {
			const offset = (y * FRAME_WIDTH + x) * 3;
			const luminance =
				frame[offset] * 0.2126 +
				frame[offset + 1] * 0.7152 +
				frame[offset + 2] * 0.0722;
			if (luminance >= 150) {
				current++;
				longest = Math.max(longest, current);
			} else {
				current = 0;
			}
		}
	}

	return longest;
}

function countPurpleKeycapOutlines(
	frame: Buffer,
	region: { x: number; y: number; width: number; height: number }
) {
	const width = region.width;
	const height = region.height;
	const purple = new Uint8Array(width * height);
	const visited = new Uint8Array(width * height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const frameOffset =
				((region.y + y) * FRAME_WIDTH + region.x + x) * 3;
			const red = frame[frameOffset];
			const green = frame[frameOffset + 1];
			const blue = frame[frameOffset + 2];
			if (
				red >= 100 &&
				blue >= 160 &&
				blue - red >= 35 &&
				blue - green >= 55
			) {
				purple[y * width + x] = 1;
			}
		}
	}

	let keycaps = 0;
	for (let index = 0; index < purple.length; index++) {
		if (purple[index] === 0 || visited[index] === 1) {
			continue;
		}

		const component = collectComponent(purple, visited, width, height, index);
		if (
			component.pixels >= 50 &&
			component.width >= 35 &&
			component.height >= 20
		) {
			keycaps++;
		}
	}

	return keycaps;
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

		for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
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
		width: maxX - minX + 1,
		height: maxY - minY + 1,
	};
}
