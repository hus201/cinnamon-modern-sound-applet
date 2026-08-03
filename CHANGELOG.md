# Changelog

All notable changes to **Modern Sound** are documented in this file.

## [1.2.0] — 2026-08-03

### Added

- **Overamplification support** — when Cinnamon's *Allow volume above 100%* setting is enabled, master volume (menu slider, panel scroll) can go up to 150%.
- **Panel icon tooltip** — hover the sound icon to see the current volume percentage (e.g. `Volume: 78%`), including values above 100% when overamplification is on.

### Changed

- Shared **`volumePercent`** utility for consistent percentage display across the panel tooltip, master slider, and mic slider.
- Panel scroll volume uses shared **`adjustStreamVolume`** with a configurable max when overamplification is enabled.

---

## [1.1.0] — 2026-08-02

### Added

- **Scroll wheel on panel icon** — scroll up/down on the sound icon to raise or lower master volume (5% per step).
- **Input device picker** — choose the active microphone from the menu, with the same expandable radio list used for outputs.
- **Settings: hide single device rows** — optionally hide the output or input device row when only one device is available (Configure Applet → Devices).

### Changed

- Refactored the codebase for maintainability:
  - Shared **device picker** widget for input and output devices.
  - Shared **stream volume slider** base for master, mic, and per-app volume rows.
  - **`handlers/`** for panel events (scroll) and **`utils/`** for icon resolvers and scroll volume math.
- Unified device picker styling under `modern-sound-device-*` CSS classes.

---

## [1.0.0] — 2026-08-01

### Added

- Initial release on Cinnamon Spices.
- Master volume and mic volume sliders with percentage.
- Output device picker with expandable device list.
- Per-application volume controls for active audio streams.
- Quick actions: Mute Sound, Mute Mic, Open Settings.
- Keyboard shortcut to open the menu (default: `Shift+Super+S`).
- Offline test suite and development link scripts.
