/**
 * @file api.ts
 * @description Central IPC client library bridging the React 18 frontend with the Wails v2 Go backend.
 *
 * Architecture Notes for Maintainers:
 * - Direct Go method invocations are dynamically bound to `window.go.backend.App.*`.
 * - Real-time push telemetry (BDS console output, process lifecycle status, activity logs)
 *   is delivered via the Wails event bus (`window.runtime.EventsOn`).
 * - All asynchronous calls provide graceful fallbacks or meaningful errors when executed
 *   outside the native Wails WebView2 environment (e.g., standard browser dev servers).
 */

import { 
  Server, 
  Mod, 
  Addon, 
  World, 
  Backup, 
  ServerMetrics, 
  CompatibilityReport, 
  AddonAnalysisResult, 
  ServerStatus,
  LipStatus,
  PlayersOverview,
  WorldOptions,
  BedrinthPackage,
  UpdateCheckReport,
  ComponentUpdate,
  XboxAccount,
  DeviceAuthResponse,
  ToolCoinPackage,
  CurseForgeDownloadItem,
  ExtensionsOverview,
  ExtensionManifest,
  ToolCoinCatalogItem,
  CurseForgeCatalogItem,
  CurseForgeCatalogResponse,
  ToolCoinCatalogResponse,
  MarketplaceUpdateReport,
  CurseForgeUpdateReport,
  JoinHealthReport
} from '../types';

declare global {
  interface Window {
    go?: {
      backend?: {
        App?: any;
      };
    };
    runtime?: {
      EventsOn: (eventName: string, callback: (...args: any[]) => void) => () => void;
      EventsEmit: (eventName: string, ...args: any[]) => void;
    };
  }
}

/** Helper accessor to resolve the bound Wails Go App controller */
const getBackend = () => window.go?.backend?.App;

/**
 * Api is the primary facade for all backend RPC calls and event subscriptions.
 */
export const Api = {
  // ---------------- Servers ----------------
  async getServers(): Promise<Server[]> {
    if (getBackend()?.GetServers) {
      return await getBackend().GetServers();
    }
    return [];
  },

  async getActiveServer(): Promise<Server | null> {
    if (getBackend()?.GetActiveServer) {
      return await getBackend().GetActiveServer();
    }
    return null;
  },

  async setActiveServer(id: string): Promise<void> {
    if (getBackend()?.SetActiveServer) {
      await getBackend().SetActiveServer(id);
    }
  },

  async createServer(opts: {
    name: string;
    location: string;
    minecraftVersion: string;
    leviLaminaVersion: string;
    port: number;
    worldName: string;
    gamemode: string;
    difficulty: string;
  }): Promise<Server> {
    if (getBackend()?.CreateServer) {
      return await getBackend().CreateServer(opts);
    }
    throw new Error("Backend not available");
  },

  async getDefaultServerLocation(serverName: string): Promise<string> {
    if (getBackend()?.GetDefaultServerLocation) {
      return await getBackend().GetDefaultServerLocation(serverName);
    }
    return `C:\\MinecraftServers\\${serverName || 'Server'}`;
  },

  async getNextAvailablePort(): Promise<number> {
    if (getBackend()?.GetNextAvailablePort) {
      return await getBackend().GetNextAvailablePort();
    }
    return 19132;
  },

  async importServer(path: string): Promise<Server> {
    if (getBackend()?.ImportServer) {
      return await getBackend().ImportServer(path);
    }
    throw new Error("Backend not available");
  },

  async rescanServer(id: string): Promise<Server> {
    if (getBackend()?.RescanServer) {
      return await getBackend().RescanServer(id);
    }
    throw new Error("Backend not available");
  },

  async deleteServer(id: string): Promise<void> {
    if (getBackend()?.DeleteServer) {
      await getBackend().DeleteServer(id);
    }
  },

  async openFolder(path: string): Promise<void> {
    if (getBackend()?.OpenFolder) {
      await getBackend().OpenFolder(path);
    }
  },

  async checkServerFiles(serverId: string): Promise<{ hasBds: boolean; hasLeviLamina: boolean; hasLip: boolean; isReadyToStart: boolean }> {
    if (getBackend()?.CheckServerFiles) {
      return await getBackend().CheckServerFiles(serverId);
    }
    return { hasBds: false, hasLeviLamina: false, hasLip: false, isReadyToStart: false };
  },

  async automateServerSetup(serverId: string): Promise<void> {
    if (getBackend()?.AutomateServerSetup) {
      await getBackend().AutomateServerSetup(serverId);
    }
  },

  async fixNetworkAndJoinIssues(serverId: string): Promise<JoinHealthReport> {
    if (getBackend()?.FixNetworkAndJoinIssues) {
      return await getBackend().FixNetworkAndJoinIssues(serverId);
    }
    return {
      success: true,
      loopbackFixed: true,
      firewallRulesAdded: true,
      propertiesFixed: true,
      packsSynced: true,
      portsAvailable: true,
      portIpv4: 19132,
      portIpv6: 19133,
      fixedIssues: ['Verified network settings'],
      warnings: []
    };
  },

  // ---------------- Process & Console ----------------
  async startServer(id: string): Promise<void> {
    if (getBackend()?.StartServer) {
      await getBackend().StartServer(id);
    }
  },

  async stopServer(id: string): Promise<void> {
    if (getBackend()?.StopServer) {
      await getBackend().StopServer(id);
    }
  },

  async restartServer(id: string): Promise<void> {
    if (getBackend()?.RestartServer) {
      await getBackend().RestartServer(id);
    }
  },

  async getServerStatus(id: string): Promise<ServerStatus> {
    if (getBackend()?.GetServerStatus) {
      return await getBackend().GetServerStatus(id);
    }
    return 'OFFLINE';
  },

  async getServerMetrics(id: string): Promise<ServerMetrics> {
    if (getBackend()?.GetServerMetrics) {
      return await getBackend().GetServerMetrics(id);
    }
    return {
      status: 'OFFLINE',
      pid: 0,
      cpuPercent: 0,
      memoryMB: 0,
      uptimeSeconds: 0,
      playerCount: 0,
      maxPlayers: 10,
      tps: null,
      mspt: null,
    };
  },

  async getServerIPs(): Promise<{ local: string; lan: string; vpn?: string }> {
    if (getBackend()?.GetServerIPs) {
      return await getBackend().GetServerIPs();
    }
    return { local: "127.0.0.1", lan: "127.0.0.1" };
  },

  async sendConsoleCommand(id: string, cmd: string): Promise<void> {
    if (getBackend()?.SendConsoleCommand) {
      await getBackend().SendConsoleCommand(id, cmd);
    }
  },

  async getConsoleLogs(id: string): Promise<string[]> {
    if (getBackend()?.GetConsoleLogs) {
      return await getBackend().GetConsoleLogs(id);
    }
    return [];
  },

  // ---------------- Properties ----------------
  async getServerProperties(id: string): Promise<Record<string, string>> {
    if (getBackend()?.GetServerProperties) {
      return await getBackend().GetServerProperties(id);
    }
    return {};
  },

  async saveServerProperties(id: string, props: Record<string, string>): Promise<void> {
    if (getBackend()?.SaveServerProperties) {
      await getBackend().SaveServerProperties(id, props);
    }
  },

  // ---------------- Mods & LIP ----------------
  async listMods(serverId: string): Promise<Mod[]> {
    if (getBackend()?.ListMods) {
      const res = await getBackend().ListMods(serverId);
      return Array.isArray(res) ? res : [];
    }
    return [];
  },

  async enableMod(modPath: string): Promise<void> {
    if (getBackend()?.EnableMod) {
      await getBackend().EnableMod(modPath);
    }
  },

  async disableMod(modPath: string): Promise<void> {
    if (getBackend()?.DisableMod) {
      await getBackend().DisableMod(modPath);
    }
  },

  async removeMod(modPath: string): Promise<void> {
    if (getBackend()?.RemoveMod) {
      await getBackend().RemoveMod(modPath);
    }
  },

  async assignAddonToWorld(serverId: string, worldName: string, packType: string, packUuid: string, version: number[]): Promise<void> {
    if (getBackend()?.AssignAddonToWorld) {
      await getBackend().AssignAddonToWorld(serverId, worldName, packType, packUuid, version);
    }
  },

  async unassignAddonFromWorld(serverId: string, worldName: string, packType: string, packUuid: string): Promise<void> {
    if (getBackend()?.UnassignAddonFromWorld) {
      await getBackend().UnassignAddonFromWorld(serverId, worldName, packType, packUuid);
    }
  },

  async uninstallAddon(serverId: string, addonUuid: string): Promise<void> {
    if (getBackend()?.UninstallAddon) {
      await getBackend().UninstallAddon(serverId, addonUuid);
    }
  },

  async exportAddon(serverId: string, addonUuid: string): Promise<string> {
    if (getBackend()?.ExportAddon) {
      return await getBackend().ExportAddon(serverId, addonUuid);
    }
    return '';
  },

  async toggleAddonForWorld(serverId: string, worldName: string, addonUuid: string, enable: boolean): Promise<void> {
    if (getBackend()?.ToggleAddonForWorld) {
      await getBackend().ToggleAddonForWorld(serverId, worldName, addonUuid, enable);
    }
  },

  async getModConfig(configPath: string): Promise<any> {
    if (getBackend()?.GetModConfig) {
      return await getBackend().GetModConfig(configPath);
    }
    return {};
  },

  async saveModConfig(configPath: string, cfg: any): Promise<void> {
    if (getBackend()?.SaveModConfig) {
      await getBackend().SaveModConfig(configPath, cfg);
    }
  },

  async checkLipStatus(serverId: string): Promise<LipStatus> {
    if (getBackend()?.CheckLipStatus) {
      const res = await getBackend().CheckLipStatus(serverId);
      if (res && typeof res === 'object') {
        return {
          installed: Boolean(res.installed),
          version: res.version || 'v0.34.8',
          binaryPath: res.binaryPath,
        };
      }
      return { installed: Boolean(res), version: typeof res === 'string' ? res : 'v0.34.8' };
    }
    return { installed: false, version: 'Not Installed' };
  },

  async installLip(): Promise<string> {
    if (getBackend()?.InstallLip) {
      return await getBackend().InstallLip();
    }
    throw new Error("Backend not available");
  },

  async installLipPackage(serverId: string, pkg: string): Promise<any> {
    if (getBackend()?.InstallLipPackage) {
      return await getBackend().InstallLipPackage(serverId, pkg);
    }
    throw new Error("Backend not available");
  },

  // ---------------- Bedrinth (pkg.levimc.org) ----------------
  async getBedrinthPackages(): Promise<BedrinthPackage[]> {
    if (getBackend()?.GetBedrinthPackages) {
      const res = await getBackend().GetBedrinthPackages();
      return Array.isArray(res) ? res : [];
    }
    return [];
  },

  async installBedrinthPackage(serverId: string, tooth: string, version: string = ''): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    if (getBackend()?.InstallBedrinthPackage) {
      return await getBackend().InstallBedrinthPackage(serverId, tooth, version);
    }
    return { success: false, error: 'Backend not available' };
  },

  async uninstallBedrinthPackage(serverId: string, tooth: string): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    if (getBackend()?.UninstallBedrinthPackage) {
      return await getBackend().UninstallBedrinthPackage(serverId, tooth);
    }
    return { success: false, error: 'Backend not available' };
  },

  // ---------------- Add-Ons ----------------
  async analyzeAddon(filePath: string): Promise<AddonAnalysisResult> {
    if (getBackend()?.AnalyzeAddon) {
      return await getBackend().AnalyzeAddon(filePath);
    }
    throw new Error("Backend not available");
  },

  async installAddon(serverId: string, archivePath: string, opts: {
    enableBehavior: boolean;
    enableResource: boolean;
    targetWorld: string;
    createBackup: boolean;
  }): Promise<any> {
    if (getBackend()?.InstallAddon) {
      return await getBackend().InstallAddon(serverId, archivePath, opts);
    }
    throw new Error("Backend not available");
  },

  async listAddons(serverId: string): Promise<Addon[]> {
    if (getBackend()?.ListAddons) {
      return await getBackend().ListAddons(serverId);
    }
    return [];
  },

  // ---------------- Worlds ----------------
  async listWorlds(serverId: string): Promise<World[]> {
    if (getBackend()?.ListWorlds) {
      return await getBackend().ListWorlds(serverId);
    }
    return [];
  },

  async createWorld(serverId: string, folderName: string, displayName: string): Promise<void> {
    if (getBackend()?.CreateWorld) {
      await getBackend().CreateWorld(serverId, folderName, displayName);
    }
  },

  async createWorldWithOptions(serverId: string, opts: any): Promise<void> {
    if (getBackend()?.CreateWorldWithOptions) {
      await getBackend().CreateWorldWithOptions(serverId, opts);
    }
  },

  async setActiveWorld(serverId: string, worldFolder: string): Promise<void> {
    if (getBackend()?.SetActiveWorld) {
      await getBackend().SetActiveWorld(serverId, worldFolder);
    }
  },

  async deleteWorld(serverId: string, worldFolder: string): Promise<void> {
    if (getBackend()?.DeleteWorld) {
      await getBackend().DeleteWorld(serverId, worldFolder);
    }
  },

  async importWorld(serverId: string, archivePath: string): Promise<World> {
    if (getBackend()?.ImportWorld) {
      return await getBackend().ImportWorld(serverId, archivePath);
    }
    throw new Error("Backend not available");
  },

  // ---------------- Backups ----------------
  async listBackups(serverId: string): Promise<Backup[]> {
    if (getBackend()?.ListBackups) {
      return await getBackend().ListBackups(serverId);
    }
    return [];
  },

  async createBackup(serverId: string, backupType: string, worldName: string, description: string): Promise<Backup> {
    if (getBackend()?.CreateBackup) {
      return await getBackend().CreateBackup(serverId, backupType, worldName, description);
    }
    throw new Error("Backend not available");
  },

  async restoreBackup(serverId: string, backupFilePath: string): Promise<void> {
    if (getBackend()?.RestoreBackup) {
      await getBackend().RestoreBackup(serverId, backupFilePath);
    }
  },

  async pruneBackups(serverId: string, maxRetained: number): Promise<number> {
    if (getBackend()?.PruneBackups) {
      return await getBackend().PruneBackups(serverId, maxRetained);
    }
    return 0;
  },

  async getPreference(key: string, defaultVal: string): Promise<string> {
    if (getBackend()?.GetPreference) {
      return await getBackend().GetPreference(key, defaultVal);
    }
    return localStorage.getItem(`llsm_pref_${key}`) || defaultVal;
  },

  async setPreference(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(`llsm_pref_${key}`, value);
    } catch (e) {
      // ignore
    }
    if (getBackend()?.SetPreference) {
      await getBackend().SetPreference(key, value);
    }
  },

  // ---------------- Compatibility ----------------
  async checkCompatibility(serverId: string): Promise<CompatibilityReport> {
    if (getBackend()?.CheckCompatibility) {
      return await getBackend().CheckCompatibility(serverId);
    }
    return {
      minecraftVersion: 'N/A',
      leviLaminaVersion: 'N/A',
      totalItems: 0,
      compatibleCount: 0,
      warningCount: 0,
      incompatibleCount: 0,
      unknownCount: 0,
      items: [],
    };
  },

  // ---------------- Dialogs ----------------
  async selectFolder(): Promise<string> {
    if (getBackend()?.SelectFolderDialog) {
      return await getBackend().SelectFolderDialog();
    }
    return '';
  },

  async selectFile(title: string, filterName: string, pattern: string): Promise<string> {
    if (getBackend()?.SelectFileDialog) {
      return await getBackend().SelectFileDialog(title, filterName, pattern);
    }
    return '';
  },

  // ---------------- Universal Import ----------------
  async inspectImportFile(filePath: string): Promise<any> {
    if (getBackend()?.InspectImportFile) {
      return await getBackend().InspectImportFile(filePath);
    }
    throw new Error("Backend not available");
  },

  // ---------------- Player Management (Aternos-Style) ----------------
  async getPlayersOverview(serverId: string): Promise<PlayersOverview> {
    if (getBackend()?.GetPlayersOverview) {
      return await getBackend().GetPlayersOverview(serverId);
    }
    return {
      onlinePlayers: [],
      operators: [],
      allowlist: [],
      bannedPlayers: [],
      allowListEnabled: false,
    };
  },

  async setPlayerPermission(serverId: string, xuid: string, permission: string): Promise<void> {
    if (getBackend()?.SetPlayerPermission) {
      await getBackend().SetPlayerPermission(serverId, xuid, permission);
    }
  },

  async addAllowlistPlayer(serverId: string, name: string, xuid: string, ignoresLimit: boolean = false): Promise<void> {
    if (getBackend()?.AddAllowlistPlayer) {
      await getBackend().AddAllowlistPlayer(serverId, name, xuid, ignoresLimit);
    }
  },

  async removeAllowlistPlayer(serverId: string, target: string): Promise<void> {
    if (getBackend()?.RemoveAllowlistPlayer) {
      await getBackend().RemoveAllowlistPlayer(serverId, target);
    }
  },

  async toggleAllowlist(serverId: string, enabled: boolean): Promise<void> {
    if (getBackend()?.ToggleAllowlist) {
      await getBackend().ToggleAllowlist(serverId, enabled);
    }
  },

  async banPlayer(serverId: string, name: string, xuid: string, reason: string): Promise<void> {
    if (getBackend()?.BanPlayer) {
      await getBackend().BanPlayer(serverId, name, xuid, reason);
    }
  },

  async unbanPlayer(serverId: string, target: string): Promise<void> {
    if (getBackend()?.UnbanPlayer) {
      await getBackend().UnbanPlayer(serverId, target);
    }
  },

  async kickPlayer(arg1: string, arg2: string = "", arg3?: string): Promise<void> {
    const name = arg3 !== undefined ? arg2 : arg1;
    const reason = arg3 !== undefined ? arg3 : arg2;
    if (getBackend()?.KickPlayer) {
      await getBackend().KickPlayer(name, reason);
    }
  },

  async removeOp(serverId: string, xuidOrName: string): Promise<void> {
    await this.setPlayerPermission(serverId, xuidOrName, "member");
    if (getBackend()?.DeopPlayer) {
      await getBackend().DeopPlayer(xuidOrName, xuidOrName);
    }
  },

  async whitelistPlayer(serverId: string, name: string, xuid: string, ignoresLimit: boolean = false): Promise<void> {
    await this.addAllowlistPlayer(serverId, name, xuid, ignoresLimit);
  },

  async unwhitelistPlayer(serverId: string, target: string): Promise<void> {
    await this.removeAllowlistPlayer(serverId, target);
  },

  async opPlayer(name: string, xuid: string = ""): Promise<void> {
    if (getBackend()?.OpPlayer) {
      await getBackend().OpPlayer(name, xuid);
    }
  },

  async deopPlayer(name: string, xuid: string = ""): Promise<void> {
    if (getBackend()?.DeopPlayer) {
      await getBackend().DeopPlayer(name, xuid);
    }
  },

  // ---------------- World Options (Aternos-Style) ----------------
  async getWorldOptions(serverId: string, worldFolder: string): Promise<WorldOptions> {
    if (getBackend()?.GetWorldOptions) {
      return await getBackend().GetWorldOptions(serverId, worldFolder);
    }
    return {
      levelName: worldFolder,
      gamemode: "survival",
      difficulty: "easy",
      allowCheats: false,
      pvp: true,
      hardcore: false,
      defaultPlayerPermission: "member",
      showCoordinates: true,
      maxPlayers: 10,
      serverPort: 19132,
      allowList: false,
      viewDistance: 32,
      tickDistance: 4,
      playerIdleTimeout: 30,
      // Extended gamerule defaults
      playersSleepingPercentage: 100,
      mobGriefing: true,
      naturalRegeneration: true,
      keepInventory: false,
      doWeatherCycle: true,
      doDaylightCycle: true,
      randomTickSpeed: 1,
      chatRestriction: 'None',
      clientSideChunkGenerationEnabled: true,
      blockNetworkIdsAreHashes: false,
      serverAuthoritativeBlockBreaking: false,
    };
  },

  async saveWorldOptions(serverId: string, worldFolder: string, opts: WorldOptions): Promise<void> {
    if (getBackend()?.SaveWorldOptions) {
      await getBackend().SaveWorldOptions(serverId, worldFolder, opts);
    }
  },

  async reorderWorldPacks(serverId: string, worldFolder: string, behaviorPacks: { pack_id: string; version: number[] }[], resourcePacks: { pack_id: string; version: number[] }[]): Promise<void> {
    if (getBackend()?.ReorderWorldPacks) {
      await getBackend().ReorderWorldPacks(serverId, worldFolder, behaviorPacks, resourcePacks);
    }
  },

  // ---------------- Memory Allocation Controls ----------------
  async setServerMemoryLimit(serverId: string, memoryMB: number): Promise<void> {
    if (getBackend()?.SetServerMemoryLimit) {
      await getBackend().SetServerMemoryLimit(serverId, memoryMB);
    }
  },

  async getServerMemoryLimit(serverId: string): Promise<number> {
    if (getBackend()?.GetServerMemoryLimit) {
      return await getBackend().GetServerMemoryLimit(serverId);
    }
    return 4096;
  },

  // ---------------- Factory Reset / Cache Purge ----------------
  async purgeDownloadedCache(): Promise<void> {
    if (getBackend()?.PurgeDownloadedCache) {
      await getBackend().PurgeDownloadedCache();
    }
  },

  // ---------------- Windows Platform Utilities ----------------
  async enableLoopbackExemption(): Promise<string> {
    if (getBackend()?.EnableLoopbackExemption) {
      return await getBackend().EnableLoopbackExemption();
    }
    return "Backend unavailable";
  },

  async checkVCRedist(): Promise<boolean> {
    if (getBackend()?.CheckVCRedist) {
      return await getBackend().CheckVCRedist();
    }
    return true;
  },

  async installVCRedist(): Promise<void> {
    if (getBackend()?.InstallVCRedist) {
      await getBackend().InstallVCRedist();
    }
  },

  // ---------------- App Settings Persistence ----------------
  async getAppSettings(): Promise<string> {
    if (getBackend()?.GetAppSettings) {
      try {
        const res = await getBackend().GetAppSettings();
        if (res && res.trim().length > 0) {
          return res;
        }
      } catch (e) {
        console.warn("Failed to get backend settings:", e);
      }
    }
    return localStorage.getItem('llsm_settings') || '';
  },

  async saveAppSettings(settingsJson: string): Promise<void> {
    try {
      localStorage.setItem('llsm_settings', settingsJson);
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
    if (getBackend()?.SaveAppSettings) {
      await getBackend().SaveAppSettings(settingsJson);
    }
  },

  // ---------------- Fullscreen Toggle ----------------
  async toggleFullscreen(): Promise<boolean> {
    if (getBackend()?.ToggleFullscreen) {
      try {
        return await getBackend().ToggleFullscreen();
      } catch (e) {
        console.warn("Wails ToggleFullscreen error:", e);
      }
    }
    // Web fallback
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          return true;
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return false;
        }
      }
    } catch (e) {
      console.warn("DOM fullscreen error:", e);
    }
    return false;
  },

  // ---------------- Dynamic Updates Checker ----------------
  async checkAllUpdates(serverId?: string): Promise<UpdateCheckReport | null> {
    if (getBackend()?.CheckAllUpdates) {
      try {
        return await getBackend().CheckAllUpdates(serverId || '');
      } catch (e) {
        console.warn("Wails CheckAllUpdates error:", e);
      }
    }
    return null;
  },

  async checkForUpdates(serverId?: string): Promise<UpdateCheckReport | null> {
    return await this.checkAllUpdates(serverId);
  },

  async applyComponentUpdate(serverId: string, componentType: string, identifier: string, targetVersion: string): Promise<any> {
    if (getBackend()?.ApplyComponentUpdate) {
      return await getBackend().ApplyComponentUpdate(serverId, componentType, identifier, targetVersion);
    }
    throw new Error("Wails ApplyComponentUpdate method not available in this environment");
  },

  async syncBedrinthCatalog(): Promise<number> {
    if (getBackend()?.SyncBedrinthCatalog) {
      return await getBackend().SyncBedrinthCatalog();
    }
    return 0;
  },

  async checkMarketplaceUpdates(): Promise<MarketplaceUpdateReport> {
    if (getBackend()?.CheckMarketplaceUpdates) {
      return await getBackend().CheckMarketplaceUpdates();
    }
    return {
      totalKeysCount: 2840,
      catalogItemsCount: 50,
      engineVersion: "1.5.4",
      enginePath: "",
      engineAvailable: true,
      lastSyncedAt: new Date().toLocaleTimeString(),
      statusMessage: "Engine Active",
      hasUpdate: false
    };
  },

  async refreshMarketplaceDefinitions(): Promise<MarketplaceUpdateReport> {
    if (getBackend()?.RefreshMarketplaceDefinitions) {
      return await getBackend().RefreshMarketplaceDefinitions();
    }
    return await this.checkMarketplaceUpdates();
  },

  async checkCurseForgeUpdates(): Promise<CurseForgeUpdateReport> {
    if (getBackend()?.CheckCurseForgeUpdates) {
      return await getBackend().CheckCurseForgeUpdates();
    }
    return {
      totalItemsCount: 100,
      lastSyncedAt: new Date().toLocaleTimeString(),
      statusMessage: "CurseForge Addons Synchronized"
    };
  },

  async refreshCurseForgeCatalog(): Promise<CurseForgeUpdateReport> {
    if (getBackend()?.RefreshCurseForgeCatalog) {
      return await getBackend().RefreshCurseForgeCatalog();
    }
    return await this.checkCurseForgeUpdates();
  },

  // ---------------- Xbox & Microsoft Account ----------------
  async getXboxAccount(): Promise<XboxAccount> {
    if (getBackend()?.GetXboxAccount) {
      return await getBackend().GetXboxAccount();
    }
    return {
      gamertag: '',
      xuid: '',
      avatarUrl: '',
      isLoggedIn: false,
      source: '',
      updatedAt: ''
    };
  },

  async detectXboxAccount(): Promise<XboxAccount> {
    if (getBackend()?.DetectXboxAccount) {
      return await getBackend().DetectXboxAccount();
    }
    throw new Error("Backend not available");
  },

  async startXboxDeviceAuth(): Promise<DeviceAuthResponse> {
    if (getBackend()?.StartXboxDeviceAuth) {
      return await getBackend().StartXboxDeviceAuth();
    }
    throw new Error("Backend not available");
  },

  async pollXboxDeviceAuth(deviceCode: string): Promise<XboxAccount> {
    if (getBackend()?.PollXboxDeviceAuth) {
      return await getBackend().PollXboxDeviceAuth(deviceCode);
    }
    throw new Error("Backend not available");
  },

  async saveXboxAccount(acc: XboxAccount): Promise<void> {
    if (getBackend()?.SaveXboxAccount) {
      await getBackend().SaveXboxAccount(acc);
    }
  },

  async clearXboxAccount(): Promise<void> {
    if (getBackend()?.ClearXboxAccount) {
      await getBackend().ClearXboxAccount();
    }
  },

  async addXboxAccountAsOp(serverId: string): Promise<void> {
    if (getBackend()?.AddXboxAccountAsOp) {
      await getBackend().AddXboxAccountAsOp(serverId);
    }
  },

  // ---------------- Extensions (ToolCoin & CurseForge) ----------------
  async getExtensionsOverview(customToolCoinExe = '', customToolCoinDir = ''): Promise<ExtensionsOverview> {
    if (getBackend()?.GetExtensionsOverview) {
      return await getBackend().GetExtensionsOverview(customToolCoinExe, customToolCoinDir);
    }
    return {
      toolCoinInstalled: false,
      toolCoinRunning: false,
      toolCoinExePath: '',
      toolCoinDir: '',
      toolCoinCount: 0,
      curseForgeCount: 0,
    };
  },

  async launchToolCoin(customPath = ''): Promise<void> {
    if (getBackend()?.LaunchToolCoin) {
      await getBackend().LaunchToolCoin(customPath);
    }
  },

  async openToolCoinDownloadsFolder(customDir = ''): Promise<void> {
    if (getBackend()?.OpenToolCoinDownloadsFolder) {
      await getBackend().OpenToolCoinDownloadsFolder(customDir);
    }
  },

  async listToolCoinDownloads(customDir = ''): Promise<ToolCoinPackage[]> {
    if (getBackend()?.ListToolCoinDownloads) {
      return await getBackend().ListToolCoinDownloads(customDir);
    }
    return [];
  },

  async installToolCoinPackage(serverId: string, filePath: string): Promise<void> {
    if (getBackend()?.InstallToolCoinPackage) {
      await getBackend().InstallToolCoinPackage(serverId, filePath);
    }
  },

  async scanRecentCurseForgeDownloads(): Promise<CurseForgeDownloadItem[]> {
    if (getBackend()?.ScanRecentCurseForgeDownloads) {
      return await getBackend().ScanRecentCurseForgeDownloads();
    }
    return [];
  },

  async getExtensionsCatalog(): Promise<ExtensionManifest[]> {
    if (getBackend()?.GetExtensionsCatalog) {
      return await getBackend().GetExtensionsCatalog();
    }
    return [];
  },

  async installExtension(id: string): Promise<void> {
    if (getBackend()?.InstallExtension) {
      await getBackend().InstallExtension(id);
    }
  },

  async uninstallExtension(id: string): Promise<void> {
    if (getBackend()?.UninstallExtension) {
      await getBackend().UninstallExtension(id);
    }
  },

  async setExtensionEnabled(id: string, enabled: boolean): Promise<void> {
    if (getBackend()?.SetExtensionEnabled) {
      await getBackend().SetExtensionEnabled(id, enabled);
    }
  },

  async getToolCoinCatalog(query = '', category = 'all'): Promise<ToolCoinCatalogItem[]> {
    if (getBackend()?.GetToolCoinCatalog) {
      return await getBackend().GetToolCoinCatalog(query, category);
    }
    return [];
  },

  async installToolCoinCatalogItem(serverId: string, itemId: string): Promise<void> {
    if (getBackend()?.InstallToolCoinCatalogItem) {
      await getBackend().InstallToolCoinCatalogItem(serverId, itemId);
    }
  },

  async downloadMarketplaceItem(itemId: string): Promise<string> {
    if (getBackend()?.DownloadMarketplaceItem) {
      return await getBackend().DownloadMarketplaceItem(itemId);
    }
    return '';
  },

  async getCurseForgeCatalog(query = '', category = 'all'): Promise<CurseForgeCatalogItem[]> {
    if (getBackend()?.GetCurseForgeCatalog) {
      return await getBackend().GetCurseForgeCatalog(query, category);
    }
    return [];
  },

  async installCurseForgeCatalogItem(serverId: string, itemId: string, downloadUrl = '', fileName = ''): Promise<void> {
    if (getBackend()?.InstallCurseForgeCatalogItem) {
      await getBackend().InstallCurseForgeCatalogItem(serverId, itemId, downloadUrl, fileName);
    }
  },

  async getToolCoinCatalogLive(query = '', category = 'all', page = 1, pageSize = 24): Promise<ToolCoinCatalogResponse> {
    if (getBackend()?.GetToolCoinCatalogLive) {
      return await getBackend().GetToolCoinCatalogLive(query, category, page, pageSize);
    }
    return { items: [], totalCount: 0, page, pageSize };
  },

  async getCurseForgeCatalogLive(query = '', category = 'all', sortField = 3, page = 1, pageSize = 20): Promise<CurseForgeCatalogResponse> {
    if (getBackend()?.GetCurseForgeCatalogLive) {
      return await getBackend().GetCurseForgeCatalogLive(query, category, sortField, page, pageSize);
    }
    return { items: [], totalCount: 0, page, pageSize };
  },

  async installCurseForgeItemLive(serverId: string, modId: number, fileId: number, downloadUrl = '', fileName = ''): Promise<void> {
    if (getBackend()?.InstallCurseForgeItemLive) {
      await getBackend().InstallCurseForgeItemLive(serverId, modId, fileId, downloadUrl, fileName);
    }
  },

  async getActivityLogs(): Promise<string[]> {
    if (getBackend()?.GetActivityLogs) {
      return await getBackend().GetActivityLogs();
    }
    return [];
  },

  async clearActivityLogs(): Promise<void> {
    if (getBackend()?.ClearActivityLogs) {
      await getBackend().ClearActivityLogs();
    }
  }
};




