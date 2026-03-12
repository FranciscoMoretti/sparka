---
"@chat-js/cli": minor
---

Add Electron desktop app scaffolding. The `create` command now prompts `Include an Electron desktop app?` and, when accepted, copies a pre-configured `electron/` subfolder into the new project. The folder includes the main process, preload script (context isolation), system tray, deep-link OAuth flow, auto-updater (GitHub Releases), and `electron-builder` config for macOS, Windows, and Linux targets.
