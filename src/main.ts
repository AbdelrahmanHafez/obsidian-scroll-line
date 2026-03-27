import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { keymap, EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

// --- Settings ---

interface ScrollLineSettings {
	linesPerScroll: number;
}

const DEFAULT_SETTINGS: ScrollLineSettings = {
	linesPerScroll: 1,
};

// --- Plugin ---

interface ObsidianHotkey {
	modifiers: string[];
	key: string;
}

export default class ScrollLinePlugin extends Plugin {
	settings: ScrollLineSettings;
	private editorExtension: Extension[] = [];

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'scroll-line-down',
			name: 'Scroll line down',
			hotkeys: [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowDown' }],
			editorCallback: (editor) => {
				const cm = (editor as any).cm as EditorView;
				cm.scrollDOM.scrollBy(0, cm.defaultLineHeight * this.settings.linesPerScroll);
			},
		});

		this.addCommand({
			id: 'scroll-line-up',
			name: 'Scroll line up',
			hotkeys: [{ modifiers: ['Ctrl', 'Alt'], key: 'ArrowUp' }],
			editorCallback: (editor) => {
				const cm = (editor as any).cm as EditorView;
				cm.scrollDOM.scrollBy(0, -cm.defaultLineHeight * this.settings.linesPerScroll);
			},
		});

		this.registerEditorExtension(this.editorExtension);

		// Build CM6 keymaps after the app is fully initialized so hotkeyManager is available
		this.app.workspace.onLayoutReady(() => this.buildKeymap());

		// Rebuild keymaps when layout changes (catches hotkey setting changes)
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
		const downKeys = this.getCommandHotkeys('scroll-line:scroll-line-down');
		const upKeys = this.getCommandHotkeys('scroll-line:scroll-line-up');

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

	private getCommandHotkeys(commandId: string): ObsidianHotkey[] {
		const hm = (this.app as any).hotkeyManager;
		if (!hm) return [];

		// getHotkeys returns undefined if no custom override, or the custom array (possibly empty if cleared)
		const custom = hm.getHotkeys(commandId);
		if (custom !== undefined) return custom;
		return hm.getDefaultHotkeys(commandId) || [];
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
			.setDesc('Number of lines to scroll per keypress')
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
			.setDesc('Configure scroll hotkeys in Settings \u2192 Hotkeys \u2192 search "Scroll line"');
	}
}
