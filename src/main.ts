import { App, Platform, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { keymap, EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

// --- Settings ---

interface ScrollLineSettings {
	linesPerScroll: number;
	scrollDownKey: string;
	scrollUpKey: string;
}

const DEFAULT_SETTINGS: ScrollLineSettings = {
	linesPerScroll: 1,
	scrollDownKey: 'Ctrl-Alt-ArrowDown',
	scrollUpKey: 'Ctrl-Alt-ArrowUp',
};

// --- Plugin ---

export default class ScrollLinePlugin extends Plugin {
	settings: ScrollLineSettings;
	private editorExtension: Extension[] = [];

	async onload() {
		await this.loadSettings();
		this.buildKeymap();
		this.registerEditorExtension(this.editorExtension);
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
		const { linesPerScroll, scrollDownKey, scrollUpKey } = this.settings;

		const scrollDown = (view: EditorView) => {
			view.scrollDOM.scrollBy(0, view.defaultLineHeight * linesPerScroll);
			return true;
		};

		const scrollUp = (view: EditorView) => {
			view.scrollDOM.scrollBy(0, -view.defaultLineHeight * linesPerScroll);
			return true;
		};

		this.editorExtension.length = 0;
		this.editorExtension.push(
			keymap.of([
				{ key: scrollDownKey, run: scrollDown },
				{ key: scrollUpKey, run: scrollUp },
			])
		);
		this.app.workspace.updateOptions();
	}
}

// --- Key formatting ---

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

function keyEventToCM6(e: KeyboardEvent): string {
	if (MODIFIER_KEYS.has(e.key)) return '';

	const parts: string[] = [];
	if (e.ctrlKey) parts.push('Ctrl');
	if (e.altKey) parts.push('Alt');
	if (e.shiftKey) parts.push('Shift');
	if (e.metaKey) parts.push('Cmd');
	parts.push(e.key === ' ' ? 'Space' : e.key);
	return parts.join('-');
}

const MAC_SYMBOLS: Record<string, string> = {
	Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Cmd: '⌘',
	ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
	Space: '␣', Backspace: '⌫', Delete: '⌦', Enter: '↩',
	Tab: '⇥', Escape: '⎋',
};

const ARROW_SYMBOLS: Record<string, string> = {
	ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

function formatKeyForDisplay(cm6Key: string): string {
	const parts = cm6Key.split('-');
	if (Platform.isMacOS) {
		return parts.map((p) => MAC_SYMBOLS[p] || p).join('');
	}
	return parts.map((p) => ARROW_SYMBOLS[p] || p).join('+');
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
			.addSlider((slider) =>
				slider
					.setLimits(1, 10, 1)
					.setValue(this.plugin.settings.linesPerScroll)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.linesPerScroll = value;
						await this.plugin.saveSettings();
					})
			);

		this.addHotkeySetting(containerEl, 'Scroll down', 'scrollDownKey');
		this.addHotkeySetting(containerEl, 'Scroll up', 'scrollUpKey');
	}

	private addHotkeySetting(
		containerEl: HTMLElement,
		name: string,
		settingKey: 'scrollDownKey' | 'scrollUpKey'
	) {
		const setting = new Setting(containerEl).setName(name);

		const hotkeyEl = setting.controlEl.createEl('kbd', {
			text: formatKeyForDisplay(this.plugin.settings[settingKey]),
			cls: 'scroll-line-hotkey',
		});

		let cleanup: (() => void) | null = null;

		const stopRecording = () => {
			if (cleanup) {
				cleanup();
				cleanup = null;
			}
			hotkeyEl.textContent = formatKeyForDisplay(this.plugin.settings[settingKey]);
			hotkeyEl.removeClass('is-recording');
		};

		hotkeyEl.addEventListener('click', () => {
			if (cleanup) {
				stopRecording();
				return;
			}

			hotkeyEl.textContent = 'Press hotkey...';
			hotkeyEl.addClass('is-recording');

			const onKeyDown = (e: KeyboardEvent) => {
				e.preventDefault();
				e.stopPropagation();

				if (e.key === 'Escape') {
					stopRecording();
					return;
				}

				const cm6Key = keyEventToCM6(e);
				if (!cm6Key) return;

				this.plugin.settings[settingKey] = cm6Key;
				this.plugin.saveSettings();
				stopRecording();
			};

			document.addEventListener('keydown', onKeyDown, true);
			cleanup = () => document.removeEventListener('keydown', onKeyDown, true);
		});
	}
}
