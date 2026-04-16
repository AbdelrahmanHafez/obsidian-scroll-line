# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-16

### Added

- **Smooth scroll** setting — animate the scroll with easing instead of jumping instantly. Enabled by default. Toggle in **Settings → Scroll Line → Smooth scroll**.

### Details

Smooth scroll uses a `requestAnimationFrame` loop with exponential easing (catches up ~20% of the remaining distance per frame, settling within ~200ms). Key-repeat accumulates into the scroll target, so holding the hotkey glides continuously rather than queueing discrete jumps.

Disabling the toggle falls back to the instant scroll behavior from 1.0.0.

## [1.0.0] - 2026-03-28

### Added

- Initial release
- Configurable lines per scroll (**Settings → Scroll Line**)
- Default keybindings **Ctrl+Alt+↓** / **Ctrl+Alt+↑** (auto-configured on first install)
- Continuous scroll on key hold (registered at CM6 level so key-repeat works)
- Uses CodeMirror 6's actual line height for accurate scrolling across themes
