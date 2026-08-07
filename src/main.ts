import { App, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { keymap, EditorView, ViewPlugin } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import {
	createScrollCommands,
	getMarkdownScrollContext,
	getScroller,
	ManualScrollObserver,
} from './smooth-scroller';
import { ObsidianHotkey, resolveHotkeys } from './hotkeys';

// --- Obsidian type augmentation for undocumented APIs ---

declare module 'obsidian' {
	interface App {
		hotkeyManager: {
			getHotkeys(id: string): ObsidianHotkey[] | undefined;
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
}

const DEFAULT_SETTINGS: ScrollLineSettings = {
	linesPerScroll: 1,
	smoothScroll: true,
};

const DEFAULT_HOTKEYS: Record<string, ObsidianHotkey[]> = {
	'scroll-line:down': [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowDown' }],
	'scroll-line:up': [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowUp' }],
};

// --- Plugin ---

export default class ScrollLinePlugin extends Plugin {
	settings: ScrollLineSettings;
	private editorExtension: Extension[] = [];
	private previewScrollEl: HTMLElement | null = null;
	private previewScrollObserver: ManualScrollObserver | null = null;

	async onload() {
		await this.loadSettings();

		for (const command of createScrollCommands((direction) =>
			this.scrollActiveView(direction)
		)) {
			this.addCommand(command);
		}

		this.registerEditorExtension(ViewPlugin.fromClass(ManualScrollObserver));
		this.registerEditorExtension(this.editorExtension);
		this.app.workspace.onLayoutReady(() => this.buildKeymap());
		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.buildKeymap())
		);

		this.addSettingTab(new ScrollLineSettingTab(this.app, this));
	}

	onunload() {
		this.previewScrollObserver?.destroy();
	}

	async loadSettings() {
		const savedSettings: unknown = await this.loadData();
		this.settings = isStoredSettings(savedSettings)
			? Object.assign({}, DEFAULT_SETTINGS, savedSettings)
			: { ...DEFAULT_SETTINGS };
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.buildKeymap();
	}

	buildKeymap() {
		const downKeys = resolveHotkeys(
			this.app.hotkeyManager,
			'scroll-line:down',
			DEFAULT_HOTKEYS['scroll-line:down']
		);
		const upKeys = resolveHotkeys(
			this.app.hotkeyManager,
			'scroll-line:up',
			DEFAULT_HOTKEYS['scroll-line:up']
		);

		const bindings: Array<{ key: string; run: (view: EditorView) => boolean }> = [];

		for (const hk of downKeys) {
			bindings.push({
				key: obsidianHotkeyToCM6(hk),
				run: (view) => {
					this.scrollBy(view.scrollDOM, this.pixelsPerScroll(view));
					return true;
				},
			});
		}

		for (const hk of upKeys) {
			bindings.push({
				key: obsidianHotkeyToCM6(hk),
				run: (view) => {
					this.scrollBy(view.scrollDOM, -this.pixelsPerScroll(view));
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

	private scrollActiveView(direction: -1 | 1) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const context = getMarkdownScrollContext(view);
		if (context.mode === 'preview') {
			this.observePreviewScrolling(context.scrollEl);
		}
		this.scrollBy(
			context.scrollEl,
			direction * context.lineHeight * this.settings.linesPerScroll
		);
	}

	private observePreviewScrolling(scrollEl: HTMLElement) {
		if (this.previewScrollEl === scrollEl) return;

		this.previewScrollObserver?.destroy();
		this.previewScrollEl = scrollEl;
		this.previewScrollObserver = new ManualScrollObserver(scrollEl);
	}

	private scrollBy(scrollEl: HTMLElement, delta: number) {
		const scroller = getScroller(scrollEl);
		if (this.settings.smoothScroll) {
			scroller.scrollBy(scrollEl, delta);
		} else {
			scroller.cancel();
			scrollEl.scrollBy(0, delta);
		}
	}

}

function obsidianHotkeyToCM6(hotkey: ObsidianHotkey): string {
	return [...hotkey.modifiers, hotkey.key].join('-');
}

function isStoredSettings(value: unknown): value is Partial<ScrollLineSettings> {
	if (typeof value !== 'object' || value === null) return false;

	const settings = value as Record<string, unknown>;
	return (settings.linesPerScroll === undefined
			|| typeof settings.linesPerScroll === 'number')
		&& (settings.smoothScroll === undefined
			|| typeof settings.smoothScroll === 'boolean');
}

// --- Settings Tab ---

class ScrollLineSettingTab extends PluginSettingTab {
	plugin: ScrollLinePlugin;

	constructor(app: App, plugin: ScrollLinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [
			{
				name: 'Lines per scroll',
				desc: 'Number of lines to scroll per keypress.',
				control: {
					type: 'number' as const,
					key: 'linesPerScroll',
					min: 1,
					step: 1,
				},
			},
			{
				name: 'Smooth scroll',
				desc: 'Animate the scroll with easing instead of jumping instantly.',
				control: { type: 'toggle' as const, key: 'smoothScroll' },
			},
			{
				name: 'Hotkeys',
				desc: 'You can change these in settings > hotkeys.',
			},
		];
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
			.setDesc('You can change these in settings > hotkeys.');
	}
}
