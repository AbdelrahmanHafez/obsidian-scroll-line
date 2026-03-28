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
		};
	}
	interface Editor {
		cm: EditorView;
	}
}

// --- Settings ---

interface ScrollLineSettings {
	linesPerScroll: number;
}

const DEFAULT_SETTINGS: ScrollLineSettings = {
	linesPerScroll: 1,
};

const DEFAULT_HOTKEYS: Record<string, ObsidianHotkey[]> = {
	down: [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowDown' }],
	up: [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowUp' }],
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
			editorCallback: (editor) => {
				editor.cm.scrollDOM.scrollBy(0, editor.cm.defaultLineHeight * this.settings.linesPerScroll);
			},
		});

		this.addCommand({
			id: 'up',
			name: 'Up',
			editorCallback: (editor) => {
				editor.cm.scrollDOM.scrollBy(0, -editor.cm.defaultLineHeight * this.settings.linesPerScroll);
			},
		});

		this.registerEditorExtension(this.editorExtension);
		this.app.workspace.onLayoutReady(() => this.buildKeymap());
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
		const { linesPerScroll } = this.settings;
		const downKeys = this.getCommandHotkeys('scroll-line:down', DEFAULT_HOTKEYS.down);
		const upKeys = this.getCommandHotkeys('scroll-line:up', DEFAULT_HOTKEYS.up);

		const bindings: Array<{ key: string; run: (view: EditorView) => boolean }> = [];

		for (const hk of downKeys) {
			bindings.push({
				key: obsidianHotkeyToCM6(hk),
				run: (view) => {
					view.scrollDOM.scrollBy(0, view.defaultLineHeight * linesPerScroll);
					return true;
				},
			});
		}

		for (const hk of upKeys) {
			bindings.push({
				key: obsidianHotkeyToCM6(hk),
				run: (view) => {
					view.scrollDOM.scrollBy(0, -view.defaultLineHeight * linesPerScroll);
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

	private getCommandHotkeys(commandId: string, fallback: ObsidianHotkey[]): ObsidianHotkey[] {
		const hm = this.app.hotkeyManager;
		if (!hm) return fallback;

		const custom = hm.getHotkeys(commandId);
		if (custom !== undefined) return custom;
		return fallback;
	}
}

function obsidianHotkeyToCM6(hotkey: ObsidianHotkey): string {
	return [...hotkey.modifiers, hotkey.key].join('-');
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
			.setName('Hotkeys')
			.setDesc('Configure scroll hotkeys in Settings \u2192 Hotkeys \u2192 search "Scroll Line".');
	}
}
