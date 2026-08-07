# Scroll Line

<p align="center">
  <strong>Move the viewport, not the cursor.</strong><br>
  Scroll an Obsidian note by exact lines while your cursor and selection stay put.
</p>

<p align="center">
  <a href="https://community.obsidian.md/plugins/scroll-line">
    <img src="docs/assets/install-in-obsidian.svg" alt="View and install Scroll Line in Obsidian" height="48">
  </a>
</p>

| Selection stays put | Works in Reading mode |
| --- | --- |
| ![Scroll Line keeps the text selection fixed while moving the viewport](docs/assets/scroll-line-selection.png) | ![Scroll Line moves the viewport in Obsidian Reading mode](docs/assets/scroll-line-reading-mode.png) |

## See it in action

![Scroll Line demo showing the viewport move with visible keyboard shortcuts](docs/assets/scroll-line-demo.gif)

_Demo setting: 4 lines per keypress._

<p align="center">
  <a href="docs/assets/scroll-line-demo.mp4">Watch the full-quality recording</a>
</p>

## What it does

- Scrolls by a configurable number of visual lines
- Keeps the cursor and selection exactly where they are
- Supports smooth animation and continuous key repeat
- Works in Editing and Reading modes
- Uses the active view's line height, so movement stays accurate across themes and font sizes

## Shortcuts

| Action | Editing mode default |
| --- | --- |
| Scroll down | `Ctrl` + `Option` + `Down` |
| Scroll up | `Ctrl` + `Option` + `Up` |

Change either binding in **Settings > Hotkeys**. Assign the commands there if you also want to use them in Reading mode.

## Settings

Open **Settings > Scroll Line** to change:

- **Lines per scroll:** Number of lines moved by each keypress
- **Smooth scroll:** Animate movement instead of jumping instantly

## Install

Open [Scroll Line in the Obsidian Community directory](https://community.obsidian.md/plugins/scroll-line), then press **Add to Obsidian**.

For a manual installation, download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AbdelrahmanHafez/obsidian-scroll-line/releases/latest), then place them in `<vault>/.obsidian/plugins/scroll-line/`.

## License

[MIT](LICENSE)
