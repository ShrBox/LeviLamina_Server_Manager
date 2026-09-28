export type ServerStatus = 'OFFLINE' | 'STARTING' | 'ONLINE' | 'STOPPING' | 'CRASHED';

export interface Server {
  id: string;
  name: string;
  path: string;
  minecraftVersion: string;
  leviLaminaVersion: string;
  lipInstalled: boolean;
  status: ServerStatus;
  port: number;
  activeWorld: string;
  autoRestart: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Mod {
  id?: string;
  name: string;
  version: string;
  author: string;
  description: string;
  path: string;
  enabled: boolean;
  minecraftVersion: string;
  leviLaminaVersion: string;
  dependencies: string[];
  hasUpdate: boolean;
  isLipPackage: boolean;
  toothPath?: string;
  configPath?: string;
}

export interface BedrinthPackage {
  tooth: string;
  name: string;
  description: string;
  avatarUrl?: string;
  tags: string[];
  stars: number;
  updatedAt: string;
  versions: string[];
}

export type AddonType = 'BEHAVIOR' | 'RESOURCE' | 'COMBINED' | 'SCRIPT';

export interface PackModule {
  type: string;
  uuid: string;
  version: number[];
  description?: string;
  language?: string;
  entry?: string;
}

export interface PackDependency {
  uuid?: string;
  module_name?: string;
  version: any;
}

export interface Addon {
  id: string;
  name: string;
  description: string;
  version: string;
  uuid: string;
  behaviorUuid?: string;
  resourceUuid?: string;
  behaviorVersion?: number[];
  resourceVersion?: number[];
  type: AddonType;
  hasBehaviorPack: boolean;
  hasResourcePack: boolean;
  hasScript: boolean;
  minEngineVersion: string;
  modules: PackModule[];
  dependencies: PackDependency[];
  assignedWorlds: string[];
  enabled: boolean;
  path: string;
  isEncrypted: boolean;
}

export interface WorldPackRecord {
  pack_id: string;
  version: number[];
  name?: string;
  description?: string;
}

export interface World {
  name: string;
  folder: string;
  levelName: string;
  isActive?: boolean;
  behaviorPacks: WorldPackRecord[];
  resourcePacks: WorldPackRecord[];
  sizeMB: number;
  lastModified: string;
}

export interface Backup {
  id: string;
  serverId: string;
  serverName: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
  type: string;
  description: string;
  worldName?: string;
}

export interface ServerMetrics {
  status: ServerStatus;
  pid: number;
  cpuPercent: number;
  memoryMB: number;
  totalSystemMemMB?: number;
  uptimeSeconds: number;
  playerCount: number;
  maxPlayers: number;
  tps: number | null;
  mspt: number | null;
}

export type CompatibilityStatus = 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE' | 'UNKNOWN';

export interface CompatibilityItem {
  name: string;
  type: string;
  status: CompatibilityStatus;
  details: string;
  requiredVersion: string;
  currentVersion: string;
}

export interface CompatibilityReport {
  minecraftVersion: string;
  leviLaminaVersion: string;
  totalItems: number;
  compatibleCount: number;
  warningCount: number;
  incompatibleCount: number;
  unknownCount: number;
  items: CompatibilityItem[];
}

export interface AddonAnalysisResult {
  valid: boolean;
  fileName: string;
  name: string;
  description: string;
  version: string;
  uuid: string;
  type: AddonType;
  hasBehaviorPack: boolean;
  hasResourcePack: boolean;
  hasScript: boolean;
  minEngineVersion: string;
  modules: PackModule[];
  dependencies: PackDependency[];
  isEncrypted: boolean;
  compatibility: CompatibilityStatus;
  warnings: string[];
  errors: string[];
}

export interface WorldCreateOptions {
  folderName: string;
  displayName: string;
  gamemode?: string;
  difficulty?: string;
  seed?: string;
  setActive?: boolean;
  behaviorPacks?: WorldPackRecord[];
  resourcePacks?: WorldPackRecord[];
}

export interface LipStatus {
  installed: boolean;
  version: string;
  binaryPath?: string;
}

export type PlayerPermission = 'visitor' | 'member' | 'operator';

export interface ServerPlayer {
  name: string;
  xuid: string;
  permission: PlayerPermission;
  isOnline: boolean;
  isWhitelisted: boolean;
  isBanned: boolean;
  ignoresPlayerLimit: boolean;
  connectedAt?: string;
  pingMs?: number;
}

export interface BanEntry {
  name: string;
  xuid?: string;
  reason: string;
  bannedAt: string;
  bannedBy: string;
}

export interface PlayersOverview {
  onlinePlayers: ServerPlayer[];
  operators: ServerPlayer[];
  allowlist: ServerPlayer[];
  bannedPlayers: BanEntry[];
  allowListEnabled: boolean;
}

export interface WorldOptions {
  levelName: string;
  gamemode: string;
  difficulty: string;
  allowCheats: boolean;
  pvp: boolean;
  hardcore: boolean;
  defaultPlayerPermission: string;
  showCoordinates: boolean;
  maxPlayers: number;
  serverPort: number;
  allowList: boolean;
  viewDistance: number;
  tickDistance: number;
  playerIdleTimeout: number;
  levelSeed?: string;
  levelType?: string;
  forceGamemode?: boolean;
  spawnProtectionRadius?: number;
  texturePackRequired?: boolean;
  contentLogFileEnabled?: boolean;
  transport?: string;
  onlineMode?: boolean;
  serverAuthoritativeMovement?: string;
  compressionThreshold?: number;
  // Extended gamerules
  playersSleepingPercentage?: number;
  mobGriefing?: boolean;
  naturalRegeneration?: boolean;
  keepInventory?: boolean;
  doWeatherCycle?: boolean;
  doDaylightCycle?: boolean;
  randomTickSpeed?: number;
  chatRestriction?: string;
  clientSideChunkGenerationEnabled?: boolean;
  blockNetworkIdsAreHashes?: boolean;
  serverAuthoritativeBlockBreaking?: boolean;
  emitServerTelemetry?: boolean;
}

export interface ComponentUpdate {
  id: string;
  name: string;
  type: 'LOADER' | 'BDS' | 'TOOL' | 'MOD';
  currentVersion: string;
  latestVersion: string;
  tooth?: string;
  description?: string;
  isCompatible: boolean;
  hasUpdate: boolean;
  releaseNotes?: string;
}

export interface UpdateCheckReport {
  hasUpdates: boolean;
  checkedAt: string;
  serverId?: string;
  serverName?: string;
  serverVersion: ComponentUpdate;
  loaderVersion: ComponentUpdate;
  lipVersion: ComponentUpdate;
  modUpdates: ComponentUpdate[];
  totalUpdatesCount: number;
}

export interface XboxAccount {
  gamertag: string;
  xuid: string;
  avatarUrl: string;
  isLoggedIn: boolean;
  source: string;
  updatedAt: string;
}

export interface DeviceAuthResponse {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

export interface ToolCoinPackage {
  name: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: 'mcaddon' | 'mctemplate' | 'mcpack' | 'zip' | 'rar';
  modTime: string;
}

export interface CurseForgeDownloadItem {
  name: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string;
  modTime: string;
}

export interface ExtensionsOverview {
  toolCoinInstalled: boolean;
  toolCoinRunning: boolean;
  toolCoinExePath: string;
  toolCoinDir: string;
  toolCoinCount: number;
  curseForgeCount: number;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  isInstalled: boolean;
  isEnabled: boolean;
  tags: string[];
  itemCount: number;
}

export interface ToolCoinCatalogItem {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  thumbnailUrl: string;
  downloadUrl: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string;
  isInstalled: boolean;
  localPath?: string;
  tags: string[];
}

export interface CurseForgeCatalogItem {
  id: string;
  modId?: number;
  fileId?: number;
  fileName?: string;
  name: string;
  summary: string;
  author: string;
  version: string;
  category: string;
  thumbnailUrl: string;
  downloadUrl: string;
  downloadCount: string;
  updatedDate: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string;
  isInstalled: boolean;
  tags: string[];
}

export interface CurseForgeCatalogResponse {
  items: CurseForgeCatalogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ToolCoinCatalogResponse {
  items: ToolCoinCatalogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MCPEDLCatalogItem {
  id: string;
  slug: string;
  name: string;
  summary: string;
  author: string;
  version: string;
  category: string;
  thumbnailUrl: string;
  downloadUrl: string;
  downloadCount: string;
  rating: string;
  updatedDate: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string;
  isInstalled: boolean;
  tags: string[];
  fileCount: number;
}

export interface MCPEDLDownloadFile {
  name: string;
  fileName: string;
  downloadUrl: string;
  sizeFormatted: string;
  type: string;
}

export interface MCPEDLCatalogResponse {
  items: MCPEDLCatalogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MarketplaceUpdateReport {
  totalKeysCount: number;
  catalogItemsCount: number;
  engineVersion: string;
  enginePath: string;
  engineAvailable: boolean;
  lastSyncedAt: string;
  statusMessage: string;
  hasUpdate: boolean;
}

export interface CurseForgeUpdateReport {
  totalItemsCount: number;
  lastSyncedAt: string;
  statusMessage: string;
}

export interface JoinHealthReport {
  success: boolean;
  loopbackFixed: boolean;
  firewallRulesAdded: boolean;
  propertiesFixed: boolean;
  packsSynced: boolean;
  portsAvailable: boolean;
  portIpv4: number;
  portIpv6: number;
  isAdmin?: boolean;
  lanIp?: string;
  vcRedistInstalled?: boolean;
  fixedIssues: string[];
  warnings: string[];
}
