# Changelog

All notable changes to **LeviLamina Server Manager** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-09-28

### 🚀 What's New

- **Live MCPEDL Community Search Engine**:
  - Replaced the previous single-page local filter with real-time official MCPEDL API integration (`api.mcpedl.com/api/submissions?s=...`).
  - Added full search indexing for thousands of community Bedrock addons, guns, furniture, backpacks, shaders, maps, and textures.
  - Implemented smart category fallback: searching for mods never returns empty even if an orthogonal category filter is active.
  - Added popular quick-search chips (Furniture, Backpacks, Weapons, Guns, Zombies, Pokémon, Shaders, Vehicles, SkyBlock).

- **Unified Download & Install Loading Bar**:
  - Created a brand-new `InstallButton` component with animated moving diagonal progress stripes (`download-bar-stripes`), progress track, percentage indicator, and animated download state.
  - Unified the installation UI across the MCPEDL Portal, CurseForge, Extensions, and Addons pages.

- **Direct In-Tab MCPEDL Sync**:
  - Added a dedicated `Check Updates & Sync` (`تحديث ومزامنة الكتالوج`) button directly in the MCPEDL header to flush memory caches and pull the latest upstream submissions on demand.

- **OP Cheats Enabled by Default**:
  - Automatically configured default operator permissions to have cheat commands enabled upon server initialization.

---

### 🐛 Bug Fixes & Improvements

- **Fixed Download HTTP 403 Forbidden Error**:
  - Replaced all obsolete `edge.mcpedl.com` links with authentic ForgeCDN download endpoints (`edge.forgecdn.net`).
  - Implemented dynamic slug-based file resolution in `InstallMCPEDLItemLive`: if a package has multiple sub-files or generic links, the manager queries the official CDN file list and downloads authentic `.mcaddon` / `.mcpack` files.
  - Added automatic download retry with fallback file resolution if an upstream link is stale.
  - Added a dedicated `downloadClient` with a 10-minute timeout to ensure large addon packs (15MB–50MB+) download reliably without context deadline timeouts.

- **Eliminated Duplicate Content on "Load More"**:
  - Added strict key deduplication by item slug and ID across pagination requests, ensuring no cards or addons repeat when clicking "Load More".

- **Clean App Exit & Process Termination**:
  - Fixed background processes lingering after closing the application or uninstaller. Process trees and Windows Job Objects now cleanly terminate upon app exit.

- **RAM Percentage & Progress Bar Alignment**:
  - Fixed memory usage percentage calculation and ensured memory progress bars adhere to strict left-to-right (`dir="ltr"`) layout regardless of system locale.

- **BDS Setup Validation**:
  - Fixed Bedrock Dedicated Server ZIP validation and local cache resolution during initial server creation.

---

## [1.0.0] - 2026-09-28

### 🚀 Initial Public Release

- Official `lip` integration for LeviLamina plugins and libraries.
- Kernel-level process supervision using Windows Job Objects (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`).
- Accurate real-time telemetry (TPS & MSPT) via UDP RakNet ping and OS thread scheduling.
- Transactional add-on engine for `.mcpack` and `.mcaddon` drag-and-drop installation.
- World & backup manager with LevelDB inspector and scheduled ZIP archives.
- Pre-flight diagnostics for UWP loopback exemption and Windows Firewall configuration.
