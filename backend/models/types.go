package models

import "time"

// ServerStatus constants
type ServerStatus string

const (
	StatusOffline  ServerStatus = "OFFLINE"
	StatusStarting ServerStatus = "STARTING"
	StatusOnline   ServerStatus = "ONLINE"
	StatusStopping ServerStatus = "STOPPING"
	StatusCrashed  ServerStatus = "CRASHED"
)

// Server represents a managed BDS instance
type Server struct {
	ID                string       `json:"id"`
	Name              string       `json:"name"`
	Path              string       `json:"path"`
	MinecraftVersion  string       `json:"minecraftVersion"`
	LeviLaminaVersion string       `json:"leviLaminaVersion"`
	LipInstalled      bool         `json:"lipInstalled"`
	Status            ServerStatus `json:"status"`
	Port              int          `json:"port"`
	ActiveWorld       string       `json:"activeWorld"`
	AutoRestart       bool         `json:"autoRestart"`
	CreatedAt         time.Time    `json:"createdAt"`
	UpdatedAt         time.Time    `json:"updatedAt"`
}

// Mod represents an installed LeviLamina mod/plugin
type Mod struct {
	Name              string   `json:"name"`
	Version           string   `json:"version"`
	Author            string   `json:"author"`
	Description       string   `json:"description"`
	Path              string   `json:"path"`
	Enabled           bool     `json:"enabled"`
	MinecraftVersion  string   `json:"minecraftVersion"`
	LeviLaminaVersion string   `json:"leviLaminaVersion"`
	Dependencies      []string `json:"dependencies"`
	HasUpdate         bool     `json:"hasUpdate"`
	IsLIPPackage      bool     `json:"isLipPackage"`
	ToothPath         string   `json:"toothPath,omitempty"`
	ConfigPath        string   `json:"configPath,omitempty"`
}

// AddonType defines Bedrock addon nature
type AddonType string

const (
	AddonTypeBehavior AddonType = "BEHAVIOR"
	AddonTypeResource AddonType = "RESOURCE"
	AddonTypeCombined AddonType = "COMBINED"
	AddonTypeScript   AddonType = "SCRIPT"
)

// PackModule represents a module inside manifest.json
type PackModule struct {
	Type        string `json:"type"`
	UUID        string `json:"uuid"`
	Version     []int  `json:"version"`
	Description string `json:"description,omitempty"`
	Language    string `json:"language,omitempty"`
	Entry       string `json:"entry,omitempty"`
}

// PackDependency represents a dependency declared in manifest.json
type PackDependency struct {
	UUID       string `json:"uuid,omitempty"`
	ModuleName string `json:"module_name,omitempty"`
	Version    any    `json:"version"` // can be string or []int
}

// Addon represents an analyzed or installed Bedrock Add-On
type Addon struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	Description      string           `json:"description"`
	Version          string           `json:"version"`
	UUID             string           `json:"uuid"`
	BehaviorUUID     string           `json:"behaviorUuid,omitempty"`
	ResourceUUID     string           `json:"resourceUuid,omitempty"`
	BehaviorVersion  []int            `json:"behaviorVersion,omitempty"`
	ResourceVersion  []int            `json:"resourceVersion,omitempty"`
	Type             AddonType        `json:"type"`
	HasBehaviorPack  bool             `json:"hasBehaviorPack"`
	HasResourcePack  bool             `json:"hasResourcePack"`
	HasScript        bool             `json:"hasScript"`
	MinEngineVersion string           `json:"minEngineVersion"`
	Modules          []PackModule     `json:"modules"`
	Dependencies     []PackDependency `json:"dependencies"`
	AssignedWorlds   []string         `json:"assignedWorlds"`
	Enabled          bool             `json:"enabled"`
	Path             string           `json:"path"`
	IsEncrypted      bool             `json:"isEncrypted"`
}

// World represents a world in the server's worlds/ directory
type World struct {
	Name            string            `json:"name"`
	Folder          string            `json:"folder"`
	LevelName       string            `json:"levelName"`
	IsActive        bool              `json:"isActive"`
	BehaviorPacks   []WorldPackRecord `json:"behaviorPacks"`
	ResourcePacks   []WorldPackRecord `json:"resourcePacks"`
	SizeMB          float64           `json:"sizeMB"`
	LastModified    time.Time         `json:"lastModified"`
}

// WorldPackRecord represents an entry in world_behavior_packs.json / world_resource_packs.json
type WorldPackRecord struct {
	PackID      string `json:"pack_id"`
	Version     []int  `json:"version"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
}

// Backup represents a server/world backup archive
type Backup struct {
	ID          string    `json:"id"`
	ServerID    string    `json:"serverId"`
	ServerName  string    `json:"serverName"`
	FileName    string    `json:"fileName"`
	FilePath    string    `json:"filePath"`
	CreatedAt   time.Time `json:"createdAt"`
	SizeBytes   int64     `json:"sizeBytes"`
	Type        string    `json:"type"` // "FULL", "WORLD", "PRE_UPDATE", "PRE_INSTALL"
	Description string    `json:"description"`
	WorldName   string    `json:"worldName,omitempty"`
}

// ServerMetrics represents real-time telemetry
type ServerMetrics struct {
	Status        ServerStatus `json:"status"`
	PID           int          `json:"pid"`
	CPUPercent    float64      `json:"cpuPercent"`
	MemoryMB      float64      `json:"memoryMB"`
	UptimeSeconds int64        `json:"uptimeSeconds"`
	PlayerCount   int          `json:"playerCount"`
	MaxPlayers    int          `json:"maxPlayers"`
	TPS           *float64     `json:"tps"`  // nil if unavailable
	MSPT          *float64     `json:"mspt"` // nil if unavailable
}

// CompatibilityStatus represents compatibility severity
type CompatibilityStatus string

const (
	CompatOK       CompatibilityStatus = "COMPATIBLE"
	CompatWarning  CompatibilityStatus = "WARNING"
	CompatIncompat CompatibilityStatus = "INCOMPATIBLE"
	CompatUnknown  CompatibilityStatus = "UNKNOWN"
)

// CompatibilityItem represents an analysis row
type CompatibilityItem struct {
	Name            string              `json:"name"`
	Type            string              `json:"type"` // "MOD", "ADDON", "CORE"
	Status          CompatibilityStatus `json:"status"`
	Details         string              `json:"details"`
	RequiredVersion string              `json:"requiredVersion"`
	CurrentVersion  string              `json:"currentVersion"`
}

// AddonAnalysisResult is returned when dragging an archive into the app
type AddonAnalysisResult struct {
	Valid            bool                `json:"valid"`
	FileName         string              `json:"fileName"`
	Name             string              `json:"name"`
	Description      string              `json:"description"`
	Version          string              `json:"version"`
	UUID             string              `json:"uuid"`
	Type             AddonType           `json:"type"`
	HasBehaviorPack  bool                `json:"hasBehaviorPack"`
	HasResourcePack  bool                `json:"hasResourcePack"`
	HasScript        bool                `json:"hasScript"`
	MinEngineVersion string              `json:"minEngineVersion"`
	Modules          []PackModule        `json:"modules"`
	Dependencies     []PackDependency    `json:"dependencies"`
	IsEncrypted      bool                `json:"isEncrypted"`
	Compatibility    CompatibilityStatus `json:"compatibility"`
	Warnings         []string            `json:"warnings"`
	Errors           []string            `json:"errors"`
	DetectedPacks    []SubPackInfo       `json:"detectedPacks"`
}

// SubPackInfo for multi-pack archives (.mcaddon)
type SubPackInfo struct {
	SubPath     string       `json:"subPath"`
	Type        AddonType    `json:"type"`
	Name        string       `json:"name"`
	UUID        string       `json:"uuid"`
	Version     []int        `json:"version"`
	Modules     []PackModule `json:"modules"`
}

// WorldCreateOptions provides parameters for creating a world with pre-plugged packs
type WorldCreateOptions struct {
	FolderName    string            `json:"folderName"`
	DisplayName   string            `json:"displayName"`
	Gamemode      string            `json:"gamemode,omitempty"`
	Difficulty    string            `json:"difficulty,omitempty"`
	Seed          string            `json:"seed,omitempty"`
	SetActive     bool              `json:"setActive"`
	BehaviorPacks []WorldPackRecord `json:"behaviorPacks"`
	ResourcePacks []WorldPackRecord `json:"resourcePacks"`
}

// LipStatus represents the installation and version status of LIP
type LipStatus struct {
	Installed  bool   `json:"installed"`
	Version    string `json:"version"`
	BinaryPath string `json:"binaryPath,omitempty"`
}

// PlayerPermission levels for Bedrock
type PlayerPermission string

const (
	PermissionVisitor  PlayerPermission = "visitor"
	PermissionMember   PlayerPermission = "member"
	PermissionOperator PlayerPermission = "operator"
)

// ServerPlayer represents a player record (online, operator, whitelisted, or banned)
type ServerPlayer struct {
	Name          string           `json:"name"`
	XUID          string           `json:"xuid"`
	Permission    PlayerPermission `json:"permission"`
	IsOnline      bool             `json:"isOnline"`
	IsWhitelisted bool             `json:"isWhitelisted"`
	IsBanned      bool             `json:"isBanned"`
	IgnoresLimit  bool             `json:"ignoresPlayerLimit"`
	ConnectedAt   *time.Time       `json:"connectedAt,omitempty"`
	PingMs        int              `json:"pingMs,omitempty"`
}

// BanEntry represents a banned player record
type BanEntry struct {
	Name     string    `json:"name"`
	XUID     string    `json:"xuid,omitempty"`
	Reason   string    `json:"reason"`
	BannedAt time.Time `json:"bannedAt"`
	BannedBy string    `json:"bannedBy"`
}

// PlayersOverview packages all player lists for the frontend
type PlayersOverview struct {
	OnlinePlayers    []ServerPlayer `json:"onlinePlayers"`
	Operators        []ServerPlayer `json:"operators"`
	Allowlist        []ServerPlayer `json:"allowlist"`
	BannedPlayers    []BanEntry     `json:"bannedPlayers"`
	AllowListEnabled bool           `json:"allowListEnabled"`
}

// WorldOptions represents configurable gameplay rules and world properties
type WorldOptions struct {
	LevelName                          string `json:"levelName"`
	Gamemode                           string `json:"gamemode"`
	Difficulty                         string `json:"difficulty"`
	AllowCheats                        bool   `json:"allowCheats"`
	PVP                                bool   `json:"pvp"`
	Hardcore                           bool   `json:"hardcore"`
	DefaultPlayerPermission            string `json:"defaultPlayerPermission"`
	ShowCoordinates                    bool   `json:"showCoordinates"`
	MaxPlayers                         int    `json:"maxPlayers"`
	ServerPort                         int    `json:"serverPort"`
	AllowList                          bool   `json:"allowList"`
	ViewDistance                       int    `json:"viewDistance"`
	TickDistance                       int    `json:"tickDistance"`
	PlayerIdleTimeout                  int    `json:"playerIdleTimeout"`
	LevelSeed                          string `json:"levelSeed"`
	LevelType                          string `json:"levelType"`
	ForceGamemode                      bool   `json:"forceGamemode"`
	SpawnProtectionRadius              int    `json:"spawnProtectionRadius"`
	TexturePackRequired                bool   `json:"texturePackRequired"`
	ContentLogFileEnabled              bool   `json:"contentLogFileEnabled"`
	Transport                          string `json:"transport"`
	OnlineMode                         bool   `json:"onlineMode"`
	ServerAuthoritativeMovement        string `json:"serverAuthoritativeMovement"`
	CompressionThreshold               int    `json:"compressionThreshold"`
	// Extended gameplay gamerules
	PlayersSleepingPercentage          int    `json:"playersSleepingPercentage"`
	MobGriefing                        bool   `json:"mobGriefing"`
	NaturalRegeneration                bool   `json:"naturalRegeneration"`
	KeepInventory                      bool   `json:"keepInventory"`
	DoWeatherCycle                     bool   `json:"doWeatherCycle"`
	DoDaylightCycle                    bool   `json:"doDaylightCycle"`
	RandomTickSpeed                    int    `json:"randomTickSpeed"`
	ChatRestriction                    string `json:"chatRestriction"`
	ClientSideChunkGenerationEnabled   bool   `json:"clientSideChunkGenerationEnabled"`
	BlockNetworkIdsAreHashes           bool   `json:"blockNetworkIdsAreHashes"`
	ServerAuthoritativeBlockBreaking   bool   `json:"serverAuthoritativeBlockBreaking"`
	EmitServerTelemetry                bool   `json:"emitServerTelemetry"`
}

// BedrinthPackage represents a package indexed on Bedrinth (pkg.levimc.org / lipr.levimc.org)
type BedrinthPackage struct {
	Tooth       string   `json:"tooth"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	AvatarURL   string   `json:"avatarUrl"`
	Tags        []string `json:"tags"`
	Stars       int      `json:"stars"`
	UpdatedAt   string   `json:"updatedAt"`
	Versions    []string `json:"versions"`
}

// ComponentUpdate describes an update available for a dependency or mod
type ComponentUpdate struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Type           string `json:"type"` // "LOADER", "BDS", "TOOL", "MOD"
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	Tooth          string `json:"tooth,omitempty"`
	Description    string `json:"description,omitempty"`
	IsCompatible   bool   `json:"isCompatible"`
	HasUpdate      bool   `json:"hasUpdate"`
	ReleaseNotes   string `json:"releaseNotes,omitempty"`
}

// UpdateCheckReport contains full update scan results across all components
type UpdateCheckReport struct {
	HasUpdates        bool              `json:"hasUpdates"`
	CheckedAt         string            `json:"checkedAt"`
	ServerID          string            `json:"serverId,omitempty"`
	ServerName        string            `json:"serverName,omitempty"`
	ServerVersion     ComponentUpdate   `json:"serverVersion"`
	LoaderVersion     ComponentUpdate   `json:"loaderVersion"`
	LipVersion        ComponentUpdate   `json:"lipVersion"`
	ModUpdates        []ComponentUpdate `json:"modUpdates"`
	TotalUpdatesCount int               `json:"totalUpdatesCount"`
}

// XboxAccount represents a linked Xbox Live account (e.g. from LeviLauncher or Microsoft auth)
type XboxAccount struct {
	Gamertag   string `json:"gamertag"`
	XUID       string `json:"xuid"`
	AvatarURL  string `json:"avatarUrl"`
	IsLoggedIn bool   `json:"isLoggedIn"`
	Source     string `json:"source"` // "levilauncher", "microsoft", "manual"
	UpdatedAt  string `json:"updatedAt"`
}

// DeviceAuthResponse holds Microsoft Device Code flow authorization details
type DeviceAuthResponse struct {
	UserCode        string `json:"userCode"`
	DeviceCode      string `json:"deviceCode"`
	VerificationURI string `json:"verificationUri"`
	ExpiresIn       int    `json:"expiresIn"`
	Interval        int    `json:"interval"`
	Message         string `json:"message"`
}

// ToolCoinPackage represents a downloaded package found in ToolCoin directory
type ToolCoinPackage struct {
	Name          string `json:"name"`
	FileName      string `json:"fileName"`
	Path          string `json:"path"`
	SizeBytes     int64  `json:"sizeBytes"`
	SizeFormatted string `json:"sizeFormatted"`
	Type          string `json:"type"` // "mcaddon", "mctemplate", "mcpack", "archive"
	ModTime       string `json:"modTime"`
}

// CurseForgeDownloadItem represents a recent Minecraft Bedrock download from CurseForge
type CurseForgeDownloadItem struct {
	Name          string `json:"name"`
	FileName      string `json:"fileName"`
	Path          string `json:"path"`
	SizeBytes     int64  `json:"sizeBytes"`
	SizeFormatted string `json:"sizeFormatted"`
	Type          string `json:"type"`
	ModTime       string `json:"modTime"`
}

// ExtensionsOverview represents the current status of installed extensions
type ExtensionsOverview struct {
	ToolCoinInstalled bool   `json:"toolCoinInstalled"`
	ToolCoinRunning   bool   `json:"toolCoinRunning"`
	ToolCoinExePath   string `json:"toolCoinExePath"`
	ToolCoinDir       string `json:"toolCoinDir"`
	ToolCoinCount     int    `json:"toolCoinCount"`
	CurseForgeCount   int    `json:"curseForgeCount"`
}

// ExtensionManifest represents an installable/toggleable extension module
type ExtensionManifest struct {
	ID          string   `json:"id"`          // "toolcoin", "curseforge"
	Name        string   `json:"name"`        // "ToolCoin Marketplace"
	Description string   `json:"description"` // Description of what the extension brings
	Version     string   `json:"version"`     // "1.5.4"
	Author      string   `json:"author"`      // "alph" or "CurseForge"
	Icon        string   `json:"icon"`        // "Coins", "Flame"
	IsInstalled bool     `json:"isInstalled"`
	IsEnabled   bool     `json:"isEnabled"`
	Tags        []string `json:"tags"`
	ItemCount   int      `json:"itemCount"`
}

// ToolCoinCatalogItem represents an in-app browsable marketplace item
type ToolCoinCatalogItem struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Author        string   `json:"author"`
	Version       string   `json:"version"`
	Category      string   `json:"category"` // "addon", "world", "texture"
	ThumbnailURL  string   `json:"thumbnailUrl"`
	DownloadURL   string   `json:"downloadUrl"`
	SizeBytes     int64    `json:"sizeBytes"`
	SizeFormatted string   `json:"sizeFormatted"`
	Type          string   `json:"type"` // "mcaddon", "mctemplate", "mcpack"
	IsInstalled   bool     `json:"isInstalled"`
	LocalPath     string   `json:"localPath,omitempty"`
	Tags          []string `json:"tags"`
}

// CurseForgeCatalogItem represents an in-app browsable CurseForge Bedrock item
type CurseForgeCatalogItem struct {
	ID            string   `json:"id"`
	ModID         int      `json:"modId"`
	FileID        int      `json:"fileId"`
	FileName      string   `json:"fileName"`
	Name          string   `json:"name"`
	Summary       string   `json:"summary"`
	Author        string   `json:"author"`
	Version       string   `json:"version"`
	Category      string   `json:"category"` // "addon", "world", "texture", "script"
	ThumbnailURL  string   `json:"thumbnailUrl"`
	DownloadURL   string   `json:"downloadUrl"`
	DownloadCount string   `json:"downloadCount"`
	UpdatedDate   string   `json:"updatedDate"`
	SizeBytes     int64    `json:"sizeBytes"`
	SizeFormatted string   `json:"sizeFormatted"`
	Type          string   `json:"type"` // "mcaddon", "mctemplate", "mcpack"
	IsInstalled   bool     `json:"isInstalled"`
	Tags          []string `json:"tags"`
}

// CurseForgeCatalogResponse wraps paginated CurseForge results
type CurseForgeCatalogResponse struct {
	Items      []CurseForgeCatalogItem `json:"items"`
	TotalCount int                     `json:"totalCount"`
	Page       int                     `json:"page"`
	PageSize   int                     `json:"pageSize"`
}

// ToolCoinCatalogResponse wraps paginated ToolCoin results
type ToolCoinCatalogResponse struct {
	Items      []ToolCoinCatalogItem `json:"items"`
	TotalCount int                   `json:"totalCount"`
	Page       int                   `json:"page"`
	PageSize   int                   `json:"pageSize"`
}

// MarketplaceUpdateReport holds dynamic update information for the Marketplace (Addons Manager) extension
type MarketplaceUpdateReport struct {
	TotalKeysCount    int    `json:"totalKeysCount"`
	CatalogItemsCount int    `json:"catalogItemsCount"`
	EngineVersion     string `json:"engineVersion"`
	EnginePath        string `json:"enginePath"`
	EngineAvailable   bool   `json:"engineAvailable"`
	LastSyncedAt      string `json:"lastSyncedAt"`
	StatusMessage     string `json:"statusMessage"`
	HasUpdate         bool   `json:"hasUpdate"`
}

// CurseForgeUpdateReport holds dynamic update information for the CurseForge extension
type CurseForgeUpdateReport struct {
	TotalItemsCount int    `json:"totalItemsCount"`
	LastSyncedAt    string `json:"lastSyncedAt"`
	StatusMessage   string `json:"statusMessage"`
}

// JoinHealthReport holds diagnosis and auto-fix results for server connection and networking issues
type JoinHealthReport struct {
	Success            bool     `json:"success"`
	LoopbackFixed      bool     `json:"loopbackFixed"`
	FirewallRulesAdded bool     `json:"firewallRulesAdded"`
	PropertiesFixed    bool     `json:"propertiesFixed"`
	PacksSynced        bool     `json:"packsSynced"`
	PortsAvailable     bool     `json:"portsAvailable"`
	PortIPv4           int      `json:"portIpv4"`
	PortIPv6           int      `json:"portIpv6"`
	IsAdmin            bool     `json:"isAdmin"`
	LanIP              string   `json:"lanIp,omitempty"`
	VCRedistInstalled  bool     `json:"vcRedistInstalled"`
	FixedIssues        []string `json:"fixedIssues"`
	Warnings           []string `json:"warnings"`
}
