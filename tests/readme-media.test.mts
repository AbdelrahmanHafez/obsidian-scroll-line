import * as assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { describe, it } from 'node:test';

const EXPECTED_ASSETS = [
	'docs/assets/install-in-obsidian.svg',
	'docs/assets/scroll-line-demo.gif',
	'docs/assets/scroll-line-demo.mp4',
	'docs/assets/scroll-line-selection.png',
	'docs/assets/scroll-line-reading-mode.png',
];

describe('README demo media', () => {
	it('links to the official Community listing', async () => {
		// Arrange
		const { manifest, readme } = await createTestContext();

		// Act
		const communitySlugs = [
			...readme.matchAll(
				/https:\/\/community\.obsidian\.md\/plugins\/([^"')\s<]+)/g
			),
		].map((match) => match[1]);

		// Assert
		assert.ok(communitySlugs.length > 0);
		assert.deepEqual([...new Set(communitySlugs)], [manifest.id]);
	});

	it('references every demo asset with useful alternative text', async () => {
		// Arrange
		const { mediaReferences, readme } = await createTestContext();

		// Act
		const referencedAssets = [...new Set(mediaReferences)].sort();

		// Assert
		assert.deepEqual(referencedAssets, [...EXPECTED_ASSETS].sort());
		assert.match(readme, /!\[[^\]]*selection[^\]]*\]\(docs\/assets\/scroll-line-selection\.png\)/i);
		assert.match(readme, /!\[[^\]]*reading mode[^\]]*\]\(docs\/assets\/scroll-line-reading-mode\.png\)/i);
		assert.match(readme, /!\[[^\]]*demo[^\]]*\]\(docs\/assets\/scroll-line-demo\.gif\)/i);
	});

	it('ships valid media within GitHub-friendly size limits', async () => {
		// Arrange
		const { asset, mediaReferences } = await createTestContext();

		// Act
		const assets = new Map(
			await Promise.all(
				mediaReferences.map(async (path) => [path, await asset(path)] as const)
			)
		);
		const button = assets.get('docs/assets/install-in-obsidian.svg')!;
		const demoGif = assets.get('docs/assets/scroll-line-demo.gif')!;
		const demoVideo = assets.get('docs/assets/scroll-line-demo.mp4')!;
		const selection = assets.get('docs/assets/scroll-line-selection.png')!;
		const readingMode = assets.get('docs/assets/scroll-line-reading-mode.png')!;

		// Assert
		assert.match(button.header.toString('utf8'), /^<svg\b/);
		assert.match(demoGif.header.toString('ascii'), /^GIF8[79]a/);
		assert.equal(demoVideo.header.subarray(4, 8).toString('ascii'), 'ftyp');
		assert.equal(selection.header.toString('hex'), '89504e470d0a1a0a');
		assert.equal(readingMode.header.toString('hex'), '89504e470d0a1a0a');
		assert.equal(selection.width, readingMode.width);
		assert.ok(demoGif.size <= 10 * 1024 * 1024);
		assert.ok(demoVideo.size <= 10 * 1024 * 1024);
	});

	async function createTestContext({ root = new URL('../', import.meta.url) } = {}) {
		const [readme, manifestContents] = await Promise.all([
			readFile(new URL('README.md', root), 'utf8'),
			readFile(new URL('manifest.json', root), 'utf8'),
		]);
		const mediaReferences = [
			...readme.matchAll(
				/(?:href=["']|src=["']|\]\()(?<path>docs\/assets\/[^"')\s>]+)/g
			),
		].map((match) => match.groups!.path);
		return {
			manifest: JSON.parse(manifestContents) as { id: string },
			mediaReferences,
			readme,
			async asset(relativePath: string) {
				const url = new URL(relativePath, root);
				const [contents, metadata] = await Promise.all([
					readFile(url),
					stat(url),
				]);
				return {
					header: contents.subarray(0, 8),
					size: metadata.size,
					width:
						contents.subarray(0, 8).toString('hex') ===
						'89504e470d0a1a0a'
							? contents.readUInt32BE(16)
							: undefined,
				};
			},
		};
	}
});
