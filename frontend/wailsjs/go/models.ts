export namespace addons {
	
	export class InstallOptions {
	    enableBehavior: boolean;
	    enableResource: boolean;
	    targetWorld: string;
	    createBackup: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InstallOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enableBehavior = source["enableBehavior"];
	        this.enableResource = source["enableResource"];
	        this.targetWorld = source["targetWorld"];
	        this.createBackup = source["createBackup"];
	    }
	}
	export class InstalledPackResult {
	    success: boolean;
	    packName: string;
	    uuid: string;
	    installedBPs: string[];
	    installedRPs: string[];
	    worldUpdated: boolean;
	    backupCreated?: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new InstalledPackResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.packName = source["packName"];
	        this.uuid = source["uuid"];
	        this.installedBPs = source["installedBPs"];
	        this.installedRPs = source["installedRPs"];
	        this.worldUpdated = source["worldUpdated"];
	        this.backupCreated = source["backupCreated"];
	        this.message = source["message"];
	    }
	}

}

export namespace backend {
	
	export class ServerSetupStatus {
	    hasBds: boolean;
	    hasLeviLamina: boolean;
	    hasLip: boolean;
	    isReadyToStart: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ServerSetupStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasBds = source["hasBds"];
	        this.hasLeviLamina = source["hasLeviLamina"];
	        this.hasLip = source["hasLip"];
	        this.isReadyToStart = source["isReadyToStart"];
	    }
	}
	export class UniversalImportResult {
	    type: string;
	    success: boolean;
	    name?: string;
	    addonResult?: models.AddonAnalysisResult;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new UniversalImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.success = source["success"];
	        this.name = source["name"];
	        this.addonResult = this.convertValues(source["addonResult"], models.AddonAnalysisResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace compatibility {
	
	export class FullCompatibilityReport {
	    minecraftVersion: string;
	    leviLaminaVersion: string;
	    totalItems: number;
	    compatibleCount: number;
	    warningCount: number;
	    incompatibleCount: number;
	    unknownCount: number;
	    items: models.CompatibilityItem[];
	
	    static createFrom(source: any = {}) {
	        return new FullCompatibilityReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.minecraftVersion = source["minecraftVersion"];
	        this.leviLaminaVersion = source["leviLaminaVersion"];
	        this.totalItems = source["totalItems"];
	        this.compatibleCount = source["compatibleCount"];
	        this.warningCount = source["warningCount"];
	        this.incompatibleCount = source["incompatibleCount"];
	        this.unknownCount = source["unknownCount"];
	        this.items = this.convertValues(source["items"], models.CompatibilityItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace lip {
	
	export class CommandResult {
	    success: boolean;
	    exitCode: number;
	    stdout: string;
	    stderr: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new CommandResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.exitCode = source["exitCode"];
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.error = source["error"];
	    }
	}

}

export namespace models {
	
	export class PackDependency {
	    uuid?: string;
	    module_name?: string;
	    version: any;
	
	    static createFrom(source: any = {}) {
	        return new PackDependency(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uuid = source["uuid"];
	        this.module_name = source["module_name"];
	        this.version = source["version"];
	    }
	}
	export class PackModule {
	    type: string;
	    uuid: string;
	    version: number[];
	    description?: string;
	    language?: string;
	    entry?: string;
	
	    static createFrom(source: any = {}) {
	        return new PackModule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.uuid = source["uuid"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.language = source["language"];
	        this.entry = source["entry"];
	    }
	}
	export class Addon {
	    id: string;
	    name: string;
	    description: string;
	    version: string;
	    uuid: string;
	    behaviorUuid?: string;
	    resourceUuid?: string;
	    behaviorVersion?: number[];
	    resourceVersion?: number[];
	    type: string;
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
	
	    static createFrom(source: any = {}) {
	        return new Addon(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.version = source["version"];
	        this.uuid = source["uuid"];
	        this.behaviorUuid = source["behaviorUuid"];
	        this.resourceUuid = source["resourceUuid"];
	        this.behaviorVersion = source["behaviorVersion"];
	        this.resourceVersion = source["resourceVersion"];
	        this.type = source["type"];
	        this.hasBehaviorPack = source["hasBehaviorPack"];
	        this.hasResourcePack = source["hasResourcePack"];
	        this.hasScript = source["hasScript"];
	        this.minEngineVersion = source["minEngineVersion"];
	        this.modules = this.convertValues(source["modules"], PackModule);
	        this.dependencies = this.convertValues(source["dependencies"], PackDependency);
	        this.assignedWorlds = source["assignedWorlds"];
	        this.enabled = source["enabled"];
	        this.path = source["path"];
	        this.isEncrypted = source["isEncrypted"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SubPackInfo {
	    subPath: string;
	    type: string;
	    name: string;
	    uuid: string;
	    version: number[];
	    modules: PackModule[];
	
	    static createFrom(source: any = {}) {
	        return new SubPackInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subPath = source["subPath"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.uuid = source["uuid"];
	        this.version = source["version"];
	        this.modules = this.convertValues(source["modules"], PackModule);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AddonAnalysisResult {
	    valid: boolean;
	    fileName: string;
	    name: string;
	    description: string;
	    version: string;
	    uuid: string;
	    type: string;
	    hasBehaviorPack: boolean;
	    hasResourcePack: boolean;
	    hasScript: boolean;
	    minEngineVersion: string;
	    modules: PackModule[];
	    dependencies: PackDependency[];
	    isEncrypted: boolean;
	    compatibility: string;
	    warnings: string[];
	    errors: string[];
	    detectedPacks: SubPackInfo[];
	
	    static createFrom(source: any = {}) {
	        return new AddonAnalysisResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.fileName = source["fileName"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.version = source["version"];
	        this.uuid = source["uuid"];
	        this.type = source["type"];
	        this.hasBehaviorPack = source["hasBehaviorPack"];
	        this.hasResourcePack = source["hasResourcePack"];
	        this.hasScript = source["hasScript"];
	        this.minEngineVersion = source["minEngineVersion"];
	        this.modules = this.convertValues(source["modules"], PackModule);
	        this.dependencies = this.convertValues(source["dependencies"], PackDependency);
	        this.isEncrypted = source["isEncrypted"];
	        this.compatibility = source["compatibility"];
	        this.warnings = source["warnings"];
	        this.errors = source["errors"];
	        this.detectedPacks = this.convertValues(source["detectedPacks"], SubPackInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Backup {
	    id: string;
	    serverId: string;
	    serverName: string;
	    fileName: string;
	    filePath: string;
	    // Go type: time
	    createdAt: any;
	    sizeBytes: number;
	    type: string;
	    description: string;
	    worldName?: string;
	
	    static createFrom(source: any = {}) {
	        return new Backup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.serverId = source["serverId"];
	        this.serverName = source["serverName"];
	        this.fileName = source["fileName"];
	        this.filePath = source["filePath"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.sizeBytes = source["sizeBytes"];
	        this.type = source["type"];
	        this.description = source["description"];
	        this.worldName = source["worldName"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BanEntry {
	    name: string;
	    xuid?: string;
	    reason: string;
	    // Go type: time
	    bannedAt: any;
	    bannedBy: string;
	
	    static createFrom(source: any = {}) {
	        return new BanEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.xuid = source["xuid"];
	        this.reason = source["reason"];
	        this.bannedAt = this.convertValues(source["bannedAt"], null);
	        this.bannedBy = source["bannedBy"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BedrinthPackage {
	    tooth: string;
	    name: string;
	    description: string;
	    avatarUrl: string;
	    tags: string[];
	    stars: number;
	    updatedAt: string;
	    versions: string[];
	
	    static createFrom(source: any = {}) {
	        return new BedrinthPackage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tooth = source["tooth"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.avatarUrl = source["avatarUrl"];
	        this.tags = source["tags"];
	        this.stars = source["stars"];
	        this.updatedAt = source["updatedAt"];
	        this.versions = source["versions"];
	    }
	}
	export class CompatibilityItem {
	    name: string;
	    type: string;
	    status: string;
	    details: string;
	    requiredVersion: string;
	    currentVersion: string;
	
	    static createFrom(source: any = {}) {
	        return new CompatibilityItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.details = source["details"];
	        this.requiredVersion = source["requiredVersion"];
	        this.currentVersion = source["currentVersion"];
	    }
	}
	export class ComponentUpdate {
	    id: string;
	    name: string;
	    type: string;
	    currentVersion: string;
	    latestVersion: string;
	    tooth?: string;
	    description?: string;
	    isCompatible: boolean;
	    hasUpdate: boolean;
	    releaseNotes?: string;
	
	    static createFrom(source: any = {}) {
	        return new ComponentUpdate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.tooth = source["tooth"];
	        this.description = source["description"];
	        this.isCompatible = source["isCompatible"];
	        this.hasUpdate = source["hasUpdate"];
	        this.releaseNotes = source["releaseNotes"];
	    }
	}
	export class CurseForgeCatalogItem {
	    id: string;
	    modId: number;
	    fileId: number;
	    fileName: string;
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
	
	    static createFrom(source: any = {}) {
	        return new CurseForgeCatalogItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.modId = source["modId"];
	        this.fileId = source["fileId"];
	        this.fileName = source["fileName"];
	        this.name = source["name"];
	        this.summary = source["summary"];
	        this.author = source["author"];
	        this.version = source["version"];
	        this.category = source["category"];
	        this.thumbnailUrl = source["thumbnailUrl"];
	        this.downloadUrl = source["downloadUrl"];
	        this.downloadCount = source["downloadCount"];
	        this.updatedDate = source["updatedDate"];
	        this.sizeBytes = source["sizeBytes"];
	        this.sizeFormatted = source["sizeFormatted"];
	        this.type = source["type"];
	        this.isInstalled = source["isInstalled"];
	        this.tags = source["tags"];
	    }
	}
	export class CurseForgeCatalogResponse {
	    items: CurseForgeCatalogItem[];
	    totalCount: number;
	    page: number;
	    pageSize: number;
	
	    static createFrom(source: any = {}) {
	        return new CurseForgeCatalogResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], CurseForgeCatalogItem);
	        this.totalCount = source["totalCount"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CurseForgeDownloadItem {
	    name: string;
	    fileName: string;
	    path: string;
	    sizeBytes: number;
	    sizeFormatted: string;
	    type: string;
	    modTime: string;
	
	    static createFrom(source: any = {}) {
	        return new CurseForgeDownloadItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fileName = source["fileName"];
	        this.path = source["path"];
	        this.sizeBytes = source["sizeBytes"];
	        this.sizeFormatted = source["sizeFormatted"];
	        this.type = source["type"];
	        this.modTime = source["modTime"];
	    }
	}
	export class CurseForgeUpdateReport {
	    totalItemsCount: number;
	    lastSyncedAt: string;
	    statusMessage: string;
	
	    static createFrom(source: any = {}) {
	        return new CurseForgeUpdateReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalItemsCount = source["totalItemsCount"];
	        this.lastSyncedAt = source["lastSyncedAt"];
	        this.statusMessage = source["statusMessage"];
	    }
	}
	export class DeviceAuthResponse {
	    userCode: string;
	    deviceCode: string;
	    verificationUri: string;
	    expiresIn: number;
	    interval: number;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceAuthResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userCode = source["userCode"];
	        this.deviceCode = source["deviceCode"];
	        this.verificationUri = source["verificationUri"];
	        this.expiresIn = source["expiresIn"];
	        this.interval = source["interval"];
	        this.message = source["message"];
	    }
	}
	export class ExtensionManifest {
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
	
	    static createFrom(source: any = {}) {
	        return new ExtensionManifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.version = source["version"];
	        this.author = source["author"];
	        this.icon = source["icon"];
	        this.isInstalled = source["isInstalled"];
	        this.isEnabled = source["isEnabled"];
	        this.tags = source["tags"];
	        this.itemCount = source["itemCount"];
	    }
	}
	export class ExtensionsOverview {
	    toolCoinInstalled: boolean;
	    toolCoinRunning: boolean;
	    toolCoinExePath: string;
	    toolCoinDir: string;
	    toolCoinCount: number;
	    curseForgeCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ExtensionsOverview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.toolCoinInstalled = source["toolCoinInstalled"];
	        this.toolCoinRunning = source["toolCoinRunning"];
	        this.toolCoinExePath = source["toolCoinExePath"];
	        this.toolCoinDir = source["toolCoinDir"];
	        this.toolCoinCount = source["toolCoinCount"];
	        this.curseForgeCount = source["curseForgeCount"];
	    }
	}
	export class JoinHealthReport {
	    success: boolean;
	    loopbackFixed: boolean;
	    firewallRulesAdded: boolean;
	    propertiesFixed: boolean;
	    packsSynced: boolean;
	    portsAvailable: boolean;
	    portIpv4: number;
	    portIpv6: number;
	    isAdmin: boolean;
	    lanIp?: string;
	    vcRedistInstalled: boolean;
	    fixedIssues: string[];
	    warnings: string[];
	
	    static createFrom(source: any = {}) {
	        return new JoinHealthReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.loopbackFixed = source["loopbackFixed"];
	        this.firewallRulesAdded = source["firewallRulesAdded"];
	        this.propertiesFixed = source["propertiesFixed"];
	        this.packsSynced = source["packsSynced"];
	        this.portsAvailable = source["portsAvailable"];
	        this.portIpv4 = source["portIpv4"];
	        this.portIpv6 = source["portIpv6"];
	        this.isAdmin = source["isAdmin"];
	        this.lanIp = source["lanIp"];
	        this.vcRedistInstalled = source["vcRedistInstalled"];
	        this.fixedIssues = source["fixedIssues"];
	        this.warnings = source["warnings"];
	    }
	}
	export class LipStatus {
	    installed: boolean;
	    version: string;
	    binaryPath?: string;
	
	    static createFrom(source: any = {}) {
	        return new LipStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.version = source["version"];
	        this.binaryPath = source["binaryPath"];
	    }
	}
	export class MarketplaceUpdateReport {
	    totalKeysCount: number;
	    catalogItemsCount: number;
	    engineVersion: string;
	    enginePath: string;
	    engineAvailable: boolean;
	    lastSyncedAt: string;
	    statusMessage: string;
	    hasUpdate: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MarketplaceUpdateReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalKeysCount = source["totalKeysCount"];
	        this.catalogItemsCount = source["catalogItemsCount"];
	        this.engineVersion = source["engineVersion"];
	        this.enginePath = source["enginePath"];
	        this.engineAvailable = source["engineAvailable"];
	        this.lastSyncedAt = source["lastSyncedAt"];
	        this.statusMessage = source["statusMessage"];
	        this.hasUpdate = source["hasUpdate"];
	    }
	}
	export class Mod {
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
	
	    static createFrom(source: any = {}) {
	        return new Mod(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.author = source["author"];
	        this.description = source["description"];
	        this.path = source["path"];
	        this.enabled = source["enabled"];
	        this.minecraftVersion = source["minecraftVersion"];
	        this.leviLaminaVersion = source["leviLaminaVersion"];
	        this.dependencies = source["dependencies"];
	        this.hasUpdate = source["hasUpdate"];
	        this.isLipPackage = source["isLipPackage"];
	        this.toothPath = source["toothPath"];
	        this.configPath = source["configPath"];
	    }
	}
	
	
	export class ServerPlayer {
	    name: string;
	    xuid: string;
	    permission: string;
	    isOnline: boolean;
	    isWhitelisted: boolean;
	    isBanned: boolean;
	    ignoresPlayerLimit: boolean;
	    // Go type: time
	    connectedAt?: any;
	    pingMs?: number;
	
	    static createFrom(source: any = {}) {
	        return new ServerPlayer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.xuid = source["xuid"];
	        this.permission = source["permission"];
	        this.isOnline = source["isOnline"];
	        this.isWhitelisted = source["isWhitelisted"];
	        this.isBanned = source["isBanned"];
	        this.ignoresPlayerLimit = source["ignoresPlayerLimit"];
	        this.connectedAt = this.convertValues(source["connectedAt"], null);
	        this.pingMs = source["pingMs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PlayersOverview {
	    onlinePlayers: ServerPlayer[];
	    operators: ServerPlayer[];
	    allowlist: ServerPlayer[];
	    bannedPlayers: BanEntry[];
	    allowListEnabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PlayersOverview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.onlinePlayers = this.convertValues(source["onlinePlayers"], ServerPlayer);
	        this.operators = this.convertValues(source["operators"], ServerPlayer);
	        this.allowlist = this.convertValues(source["allowlist"], ServerPlayer);
	        this.bannedPlayers = this.convertValues(source["bannedPlayers"], BanEntry);
	        this.allowListEnabled = source["allowListEnabled"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Server {
	    id: string;
	    name: string;
	    path: string;
	    minecraftVersion: string;
	    leviLaminaVersion: string;
	    lipInstalled: boolean;
	    status: string;
	    port: number;
	    activeWorld: string;
	    autoRestart: boolean;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.minecraftVersion = source["minecraftVersion"];
	        this.leviLaminaVersion = source["leviLaminaVersion"];
	        this.lipInstalled = source["lipInstalled"];
	        this.status = source["status"];
	        this.port = source["port"];
	        this.activeWorld = source["activeWorld"];
	        this.autoRestart = source["autoRestart"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServerMetrics {
	    status: string;
	    pid: number;
	    cpuPercent: number;
	    memoryMB: number;
	    uptimeSeconds: number;
	    playerCount: number;
	    maxPlayers: number;
	    tps?: number;
	    mspt?: number;
	
	    static createFrom(source: any = {}) {
	        return new ServerMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.pid = source["pid"];
	        this.cpuPercent = source["cpuPercent"];
	        this.memoryMB = source["memoryMB"];
	        this.uptimeSeconds = source["uptimeSeconds"];
	        this.playerCount = source["playerCount"];
	        this.maxPlayers = source["maxPlayers"];
	        this.tps = source["tps"];
	        this.mspt = source["mspt"];
	    }
	}
	
	
	export class ToolCoinCatalogItem {
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
	
	    static createFrom(source: any = {}) {
	        return new ToolCoinCatalogItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.author = source["author"];
	        this.version = source["version"];
	        this.category = source["category"];
	        this.thumbnailUrl = source["thumbnailUrl"];
	        this.downloadUrl = source["downloadUrl"];
	        this.sizeBytes = source["sizeBytes"];
	        this.sizeFormatted = source["sizeFormatted"];
	        this.type = source["type"];
	        this.isInstalled = source["isInstalled"];
	        this.localPath = source["localPath"];
	        this.tags = source["tags"];
	    }
	}
	export class ToolCoinCatalogResponse {
	    items: ToolCoinCatalogItem[];
	    totalCount: number;
	    page: number;
	    pageSize: number;
	
	    static createFrom(source: any = {}) {
	        return new ToolCoinCatalogResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], ToolCoinCatalogItem);
	        this.totalCount = source["totalCount"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ToolCoinPackage {
	    name: string;
	    fileName: string;
	    path: string;
	    sizeBytes: number;
	    sizeFormatted: string;
	    type: string;
	    modTime: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolCoinPackage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fileName = source["fileName"];
	        this.path = source["path"];
	        this.sizeBytes = source["sizeBytes"];
	        this.sizeFormatted = source["sizeFormatted"];
	        this.type = source["type"];
	        this.modTime = source["modTime"];
	    }
	}
	export class UpdateCheckReport {
	    hasUpdates: boolean;
	    checkedAt: string;
	    serverId?: string;
	    serverName?: string;
	    serverVersion: ComponentUpdate;
	    loaderVersion: ComponentUpdate;
	    lipVersion: ComponentUpdate;
	    modUpdates: ComponentUpdate[];
	    totalUpdatesCount: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateCheckReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasUpdates = source["hasUpdates"];
	        this.checkedAt = source["checkedAt"];
	        this.serverId = source["serverId"];
	        this.serverName = source["serverName"];
	        this.serverVersion = this.convertValues(source["serverVersion"], ComponentUpdate);
	        this.loaderVersion = this.convertValues(source["loaderVersion"], ComponentUpdate);
	        this.lipVersion = this.convertValues(source["lipVersion"], ComponentUpdate);
	        this.modUpdates = this.convertValues(source["modUpdates"], ComponentUpdate);
	        this.totalUpdatesCount = source["totalUpdatesCount"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorldPackRecord {
	    pack_id: string;
	    version: number[];
	    name?: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new WorldPackRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pack_id = source["pack_id"];
	        this.version = source["version"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class World {
	    name: string;
	    folder: string;
	    levelName: string;
	    isActive: boolean;
	    behaviorPacks: WorldPackRecord[];
	    resourcePacks: WorldPackRecord[];
	    sizeMB: number;
	    // Go type: time
	    lastModified: any;
	
	    static createFrom(source: any = {}) {
	        return new World(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.folder = source["folder"];
	        this.levelName = source["levelName"];
	        this.isActive = source["isActive"];
	        this.behaviorPacks = this.convertValues(source["behaviorPacks"], WorldPackRecord);
	        this.resourcePacks = this.convertValues(source["resourcePacks"], WorldPackRecord);
	        this.sizeMB = source["sizeMB"];
	        this.lastModified = this.convertValues(source["lastModified"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorldCreateOptions {
	    folderName: string;
	    displayName: string;
	    gamemode?: string;
	    difficulty?: string;
	    seed?: string;
	    setActive: boolean;
	    behaviorPacks: WorldPackRecord[];
	    resourcePacks: WorldPackRecord[];
	
	    static createFrom(source: any = {}) {
	        return new WorldCreateOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.folderName = source["folderName"];
	        this.displayName = source["displayName"];
	        this.gamemode = source["gamemode"];
	        this.difficulty = source["difficulty"];
	        this.seed = source["seed"];
	        this.setActive = source["setActive"];
	        this.behaviorPacks = this.convertValues(source["behaviorPacks"], WorldPackRecord);
	        this.resourcePacks = this.convertValues(source["resourcePacks"], WorldPackRecord);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorldOptions {
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
	    levelSeed: string;
	    levelType: string;
	    forceGamemode: boolean;
	    spawnProtectionRadius: number;
	    texturePackRequired: boolean;
	    contentLogFileEnabled: boolean;
	    transport: string;
	    onlineMode: boolean;
	    serverAuthoritativeMovement: string;
	    compressionThreshold: number;
	    playersSleepingPercentage: number;
	    mobGriefing: boolean;
	    naturalRegeneration: boolean;
	    keepInventory: boolean;
	    doWeatherCycle: boolean;
	    doDaylightCycle: boolean;
	    randomTickSpeed: number;
	    chatRestriction: string;
	    clientSideChunkGenerationEnabled: boolean;
	    blockNetworkIdsAreHashes: boolean;
	    serverAuthoritativeBlockBreaking: boolean;
	    emitServerTelemetry: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorldOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.levelName = source["levelName"];
	        this.gamemode = source["gamemode"];
	        this.difficulty = source["difficulty"];
	        this.allowCheats = source["allowCheats"];
	        this.pvp = source["pvp"];
	        this.hardcore = source["hardcore"];
	        this.defaultPlayerPermission = source["defaultPlayerPermission"];
	        this.showCoordinates = source["showCoordinates"];
	        this.maxPlayers = source["maxPlayers"];
	        this.serverPort = source["serverPort"];
	        this.allowList = source["allowList"];
	        this.viewDistance = source["viewDistance"];
	        this.tickDistance = source["tickDistance"];
	        this.playerIdleTimeout = source["playerIdleTimeout"];
	        this.levelSeed = source["levelSeed"];
	        this.levelType = source["levelType"];
	        this.forceGamemode = source["forceGamemode"];
	        this.spawnProtectionRadius = source["spawnProtectionRadius"];
	        this.texturePackRequired = source["texturePackRequired"];
	        this.contentLogFileEnabled = source["contentLogFileEnabled"];
	        this.transport = source["transport"];
	        this.onlineMode = source["onlineMode"];
	        this.serverAuthoritativeMovement = source["serverAuthoritativeMovement"];
	        this.compressionThreshold = source["compressionThreshold"];
	        this.playersSleepingPercentage = source["playersSleepingPercentage"];
	        this.mobGriefing = source["mobGriefing"];
	        this.naturalRegeneration = source["naturalRegeneration"];
	        this.keepInventory = source["keepInventory"];
	        this.doWeatherCycle = source["doWeatherCycle"];
	        this.doDaylightCycle = source["doDaylightCycle"];
	        this.randomTickSpeed = source["randomTickSpeed"];
	        this.chatRestriction = source["chatRestriction"];
	        this.clientSideChunkGenerationEnabled = source["clientSideChunkGenerationEnabled"];
	        this.blockNetworkIdsAreHashes = source["blockNetworkIdsAreHashes"];
	        this.serverAuthoritativeBlockBreaking = source["serverAuthoritativeBlockBreaking"];
	        this.emitServerTelemetry = source["emitServerTelemetry"];
	    }
	}
	
	export class XboxAccount {
	    gamertag: string;
	    xuid: string;
	    avatarUrl: string;
	    isLoggedIn: boolean;
	    source: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new XboxAccount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.gamertag = source["gamertag"];
	        this.xuid = source["xuid"];
	        this.avatarUrl = source["avatarUrl"];
	        this.isLoggedIn = source["isLoggedIn"];
	        this.source = source["source"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

export namespace server {
	
	export class CreateServerOptions {
	    name: string;
	    location: string;
	    minecraftVersion: string;
	    leviLaminaVersion: string;
	    port: number;
	    worldName: string;
	    gamemode: string;
	    difficulty: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateServerOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.location = source["location"];
	        this.minecraftVersion = source["minecraftVersion"];
	        this.leviLaminaVersion = source["leviLaminaVersion"];
	        this.port = source["port"];
	        this.worldName = source["worldName"];
	        this.gamemode = source["gamemode"];
	        this.difficulty = source["difficulty"];
	    }
	}

}

