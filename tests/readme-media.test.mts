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
		const { readme } = await createTestContext();

		// Act
		const hasCommunityLink = readme.includes(
			'https://community.obsidian.md/plugins/scroll-line'
		);

		// Assert
		assert.equal(hasCommunityLink, true);
	});

	it('references every demo asset with useful alternative text', async () => {
		// Arrange
		const { readme } = await createTestContext();

		// Act
		const referencedAssets = EXPECTED_ASSETS.filter((asset) =>
			readme.includes(asset)
		);

		// Assert
		assert.deepEqual(referencedAssets, EXPECTED_ASSETS);
		assert.match(readme, /!\[[^\]]*selection[^\]]*\]\(docs\/assets\/scroll-line-selection\.png\)/i);
		assert.match(readme, /!\[[^\]]*reading mode[^\]]*\]\(docs\/assets\/scroll-line-reading-mode\.png\)/i);
		assert.match(readme, /!\[[^\]]*demo[^\]]*\]\(docs\/assets\/scroll-line-demo\.gif\)/i);
	});

	it('ships valid media within GitHub-friendly size limits', async () => {
		// Arrange
		const { asset } = await createTestContext();

		// Act
		const [button, demoGif, demoVideo, selection, readingMode] = await Promise.all(
			EXPECTED_ASSETS.map(asset)
		);

		// Assert
		assert.match(button.header.toString('utf8'), /^<svg\b/);
		assert.match(demoGif.header.toString('ascii'), /^GIF8[79]a/);
		assert.equal(demoVideo.header.subarray(4, 8).toString('ascii'), 'ftyp');
		assert.equal(selection.header.toString('hex'), '89504e470d0a1a0a');
		assert.equal(readingMode.header.toString('hex'), '89504e470d0a1a0a');
		assert.ok(demoGif.size <= 10 * 1024 * 1024);
		assert.ok(demoVideo.size <= 10 * 1024 * 1024);
	});

	async function createTestContext({ root = new URL('../', import.meta.url) } = {}) {
		const readme = await readFile(new URL('README.md', root), 'utf8');
		return {
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
				};
			},
		};
	}
});
