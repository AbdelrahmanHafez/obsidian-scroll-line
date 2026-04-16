import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { keymap, EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

// --- Obsidian type augmentation for undocumented APIs ---

interface ObsidianHotkey {
	modifiers: string[];
	key: string;
}

declare module 'obsidian' {
	interface App {
		hotkeyManager: {
			getHotkeys(id: string): ObsidianHotkey[] | undefined;
			getDefaultHotkeys(id: string): ObsidianHotkey[];
			load(): Promise<void>;
		};
	}
	interface Editor {
		cm: EditorView;
	}
}

// --- Settings ---

interface ScrollLineSettings {
	linesPerScroll: number;
	smoothScroll: boolean;
	hotkeyDefaultsApplied?: boolean;
}

const DEFAULT_SETTINGS: ScrollLineSettings = {
	linesPerScroll: 1,
	smoothScroll: true,
};

const DESIRED_HOTKEYS: Record<string, ObsidianHotkey> = {
	'scroll-line:down': { modifiers: ['Ctrl', 'Alt'], key: 'ArrowDown' },
	'scroll-line:up': { modifiers: ['Ctrl', 'Alt'], key: 'ArrowUp' },
};

// --- Plugin ---

export default class ScrollLinePlugin extends Plugin {
	settings: ScrollLineSettings;
	private editorExtension: Extension[] = [];

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'down',
			name: 'Down',
			editorCallback: (editor) => this.scrollBy(editor.cm, this.pixelsPerScroll(editor.cm)),
		});

		this.addCommand({
			id: 'up',
			name: 'Up',
			editorCallback: (editor) => this.scrollBy(editor.cm, -this.pixelsPerScroll(editor.cm)),
		});

		this.registerEditorExtension(this.editorExtension);
		this.app.workspace.onLayoutReady(async () => {
			await this.applyDefaultHotkeys();
			this.buildKeymap();
		});
		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.buildKeymap())
		);

		this.addSettingTab(new ScrollLineSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.buildKeymap();
	}

	buildKeymap() {
		const downKeys = this.getCommandHotkeys('scroll-line:down');
		const upKeys = this.getCommandHotkeys('scroll-line:up');

		const bindings: Array<{ key: string; run: (view: EditorView) => boolean }> = [];

		for (const hk of downKeys) {
			bindings.push({
				key: obsidianHotkeyToCM6(hk),
				run: (view) => {
					this.scrollBy(view, this.pixelsPerScroll(view));
					return true;
				},
			});
		}

		for (const hk of upKeys) {
			bindings.push({
				key: obsidianHotkeyToCM6(hk),
				run: (view) => {
					this.scrollBy(view, -this.pixelsPerScroll(view));
					return true;
				},
			});
		}

		this.editorExtension.length = 0;
		if (bindings.length > 0) {
			this.editorExtension.push(keymap.of(bindings));
		}
		this.app.workspace.updateOptions();
	}

	private pixelsPerScroll(view: EditorView): number {
		return view.defaultLineHeight * this.settings.linesPerScroll;
	}

	private scrollBy(view: EditorView, delta: number) {
		const scroller = getScroller(view);
		if (this.settings.smoothScroll) {
			scroller.scrollBy(view, delta);
		} else {
			scroller.cancel();
			view.scrollDOM.scrollBy(0, delta);
		}
	}

	private async applyDefaultHotkeys() {
		if (this.settings.hotkeyDefaultsApplied) return;

		const configPath = `${this.app.vault.configDir}/hotkeys.json`;
		let hotkeys: Record<string, ObsidianHotkey[]> = {};

		try {
			hotkeys = JSON.parse(await this.app.vault.adapter.read(configPath));
		} catch {
			// File doesn't exist or is invalid
		}

		let changed = false;
		for (const [cmdId, hk] of Object.entries(DESIRED_HOTKEYS)) {
			if (hotkeys[cmdId]) continue;
			hotkeys[cmdId] = [hk];
			changed = true;
		}

		if (changed) {
			await this.app.vault.adapter.write(configPath, JSON.stringify(hotkeys, null, '  '));
			// Reload hotkeyManager so the new entries take effect immediately
			if (typeof this.app.hotkeyManager?.load === 'function') {
				await this.app.hotkeyManager.load();
			}
		}

		this.settings.hotkeyDefaultsApplied = true;
		await this.saveData(this.settings);
	}

	private getCommandHotkeys(commandId: string): ObsidianHotkey[] {
		const hm = this.app.hotkeyManager;
		if (!hm) return [];

		const custom = hm.getHotkeys(commandId);
		if (custom !== undefined) return custom;
		return hm.getDefaultHotkeys(commandId) || [];
	}
}

function obsidianHotkeyToCM6(hotkey: ObsidianHotkey): string {
	return [...hotkey.modifiers, hotkey.key].join('-');
}

// --- Smooth scroller (rAF easing per EditorView) ---

// Fraction of the remaining distance covered each frame. Exponential decay,
// so animations feel snappy at first and settle softly.
const EASE_PER_FRAME = 0.2;
const STOP_EPSILON = 0.5;

class SmoothScroller {
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
			this.rafId = requestAnimationFrame(tick);
		};
		this.rafId = requestAnimationFrame(tick);
	}

	cancel() {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}
}

const scrollers = new WeakMap<EditorView, SmoothScroller>();

function getScroller(view: EditorView): SmoothScroller {
	let s = scrollers.get(view);
	if (!s) {
		s = new SmoothScroller();
		scrollers.set(view, s);
	}
	return s;
}

// --- Settings Tab ---

class ScrollLineSettingTab extends PluginSettingTab {
	plugin: ScrollLinePlugin;

	constructor(app: App, plugin: ScrollLinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Lines per scroll')
			.setDesc('Number of lines to scroll per keypress.')
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.linesPerScroll))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!num || num < 1) return;
						this.plugin.settings.linesPerScroll = num;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Smooth scroll')
			.setDesc('Animate the scroll with easing instead of jumping instantly.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.smoothScroll)
					.onChange(async (value) => {
						this.plugin.settings.smoothScroll = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Hotkeys')
			.setDesc('You can change these in settings \u2192 hotkeys.');
	}
}
