# LeviLamina Server Manager

<div align="center">

![LeviLamina Server Manager Banner](build/appicon.png)

**A clean, easy-to-use desktop app to run and manage your LeviLamina Minecraft Bedrock servers.**

[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![Wails](https://img.shields.io/badge/Wails-v2-DF1A29?style=flat)](https://wails.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-0078D6?style=flat&logo=windows)](https://microsoft.com)

[Features](#what-can-it-do) • [Quick Start](#getting-started) • [Building from Source](#building-it-yourself) • [Changelog](CHANGELOG.md)

</div>

---

## Why LeviLamina Server Manager?

Setting up a Minecraft Bedrock Dedicated Server with LeviLamina usually means dealing with multiple terminal windows, manually extracting `.mcpack` files into folders, hand-editing config files, and hunting down stuck `bedrock_server.exe` processes in Task Manager when something crashes.

We built **LeviLamina Server Manager (LLSM)** to take all that headache away. It gives you a clean desktop dashboard where you can launch servers, find and install addons with one click, watch your real TPS and RAM in real time, and keep your worlds backed up safely.

---

## What Can It Do?

### Simple Server Controls
- Start, stop, and restart your server with a single click.
- Live interactive console with color output, quick command input, and auto-scroll.
- No stuck background processes: when you close the manager or stop the server, child processes close cleanly without hogging your system RAM.

### Real Performance Stats
- Accurate TPS (Ticks Per Second) and MSPT measured directly from local server traffic, not estimated or fake numbers.
- Live graphs for CPU usage, memory consumption, and active player counts.

### Built-in Addon & Plugin Store
- **MCPEDL Integration**: Search thousands of community mods, addons, shaders, and maps right from the app and install them directly to your server.
- **Official Lip Support**: Browse, install, and update LeviLamina plugins and libraries without touching the command line.
- **Drag-and-Drop**: Drop any `.mcaddon` or `.mcpack` into the window, and the app handles the UUIDs and world configuration automatically.
- Unified progress bar with animated feedback so you always know what is downloading.

### World & Backup Management
- Take full backups of your worlds whenever you want in standard ZIP format.
- Inspect your LevelDB worlds, switch active levels, and tweak gamerules easily.

### Multilingual Interface
- Designed with full right-to-left (RTL) support for Arabic alongside English and other languages.

---

## Getting Started

### Download & Install
1. Head over to the [Releases](https://github.com/yosifdheef313/LeviLamina_Server_Manager/releases) page.
2. Download the latest `LeviLaminaServerManager-amd64-installer.exe` (or `setup.exe`).
3. Run the installer and open LeviLamina Server Manager from your Start menu or desktop.

### Requirements
- Windows 10 or Windows 11 (64-bit)
- WebView2 Runtime (already installed by default on modern Windows)
- Bedrock Dedicated Server (BDS) 1.20 or newer

---

## Building It Yourself

If you prefer building from source, it only takes a few minutes.

### What You Need
- [Go 1.21+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/)
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
- [NSIS 3.0+](https://nsis.sourceforge.io/) (if you want to build the setup installer)

### Quick Build Scripts

**Using Command Prompt:**
```cmd
build.bat nsis      :: Builds the full installer
build.bat exe       :: Builds the standalone .exe
build.bat dev       :: Starts development mode with hot reload
```

**Using PowerShell:**
```powershell
.\build.ps1 -Target nsis
.\build.ps1 -Target dev
```

### Manual Build
```bash
# 1. Install frontend packages
cd frontend
npm install
cd ..

# 2. Build the app
wails build -platform windows/amd64 -nsis
```

Your compiled files will be ready in `build/bin/`.

---

## Contributing

Suggestions, bug reports, and pull requests are always welcome! If you run into any issues or have ideas for new features, feel free to open an issue or check out our [Contributing Guide](CONTRIBUTING.md).

---

## License

LeviLamina Server Manager is licensed under the [GNU General Public License v3.0](LICENSE).  
Minecraft is a trademark of Mojang Synergies AB. This project is not affiliated with or endorsed by Mojang or Microsoft.
