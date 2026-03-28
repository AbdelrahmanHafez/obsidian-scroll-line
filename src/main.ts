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
	hotkeyDefaultsApplied?: boolean;
}

const DEFAULT_SETTINGS: ScrollLineSettings = {
	linesPerScroll: 1,
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

	private async applyDefaultHotkeys() {
		if (this.settings.hotkeyDefaultsApplied) return;

		const configPath = `${this.app.vault.configDir}/hotkeys.json`;
		let hotkeys: Record<string, ObsidianHotkey[]> = {};

		try {
			hotkeys = JSON.parse(await this.app.vault.adapter.read(configPath));
		} catch {
			// File doesn't exist or is invalid
		}

		// Collect all key combos already in use
		const usedCombos = new Set<string>();
		for (const bindings of Object.values(hotkeys)) {
			for (const hk of bindings) {
				usedCombos.add(hotkeyToString(hk));
			}
		}

		let changed = false;
		for (const [cmdId, hk] of Object.entries(DESIRED_HOTKEYS)) {
			if (hotkeys[cmdId]) continue;
			if (usedCombos.has(hotkeyToString(hk))) continue;
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

	buildKeymap() {
		const { linesPerScroll } = this.settings;
		const downKeys = this.getCommandHotkeys('scroll-line:down');
		const upKeys = this.getCommandHotkeys('scroll-line:up');

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
		const hm = this.app.hotkeyManager;
		if (!hm) return [];

		const custom = hm.getHotkeys(commandId);
		if (custom !== undefined) return custom;
		return hm.getDefaultHotkeys(commandId) || [];
	}
}

function hotkeyToString(hk: ObsidianHotkey): string {
	return [...hk.modifiers].sort().join('+') + '+' + hk.key;
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
