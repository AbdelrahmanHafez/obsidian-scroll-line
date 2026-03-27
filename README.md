# Scroll Line

An [Obsidian](https://obsidian.md) plugin that scrolls the editor viewport up or down by a configurable number of lines, without moving the cursor. Similar to `editor.action.scrollLineDown` / `editor.action.scrollLineUp` in VS Code.

## Features

- Scroll the viewport by 1-10 lines per keypress
- Fully configurable keybindings with a visual hotkey recorder
- Smooth key-repeat support (hold the key to keep scrolling)
- Uses CodeMirror 6's actual line height for accurate scrolling across all themes and font sizes

## Installation

### From Obsidian Community Plugins

1. Open **Settings > Community plugins**
2. Search for **Scroll Line**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AbdelrahmanHafez/obsidian-scroll-line/releases/latest)
2. Create a folder `scroll-line` inside your vault's `.obsidian/plugins/` directory
3. Place the downloaded files inside that folder
4. Reload Obsidian and enable the plugin in **Settings > Community plugins**

## Configuration

Open **Settings > Scroll Line** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Lines per scroll | 1 | How many lines to scroll per keypress (1-10) |
| Scroll down | Ctrl+Alt+↓ | Keybinding to scroll the viewport down |
| Scroll up | Ctrl+Alt+↑ | Keybinding to scroll the viewport up |

To change a keybinding, click the hotkey badge and press your desired key combination. Press **Escape** to cancel.

## Why This Plugin?

Obsidian has no built-in command for scrolling the viewport by lines. The existing hotkey system doesn't support key-repeat for commands, so holding a key only fires once. This plugin registers keybindings at the CodeMirror 6 level, which properly handles key-repeat for smooth, continuous scrolling.

## License

[MIT](LICENSE)
