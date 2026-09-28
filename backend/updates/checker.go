package updates

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"levilamina-server-manager/backend/bedrinth"
	"levilamina-server-manager/backend/database"
	"levilamina-server-manager/backend/levilamina"
	"levilamina-server-manager/backend/lip"
	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/mods"
)

type gitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

type bdsVersionsJSON struct {
	Windows struct {
		Stable   string   `json:"stable"`
		Preview  string   `json:"preview"`
		Versions []string `json:"versions"`
	} `json:"windows"`
}

func fetchLatestLeviLaminaRelease(ctx context.Context) (*gitHubRelease, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/LiteLDev/LeviLamina/releases/latest", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "LeviLaminaServerManager/2.0")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error %d fetching LeviLamina release", resp.StatusCode)
	}

	var rel gitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, err
	}
	return &rel, nil
}

func fetchLatestMojangBDS(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "LeviLaminaServerManager/2.0")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var data bdsVersionsJSON
		if err := json.NewDecoder(resp.Body).Decode(&data); err == nil && data.Windows.Stable != "" {
			return data.Windows.Stable, nil
		}
	}
	return "", fmt.Errorf("unable to fetch upstream BDS versions")
}

func fetchLatestLipRelease(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/LiteLDev/lip/releases/latest", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "LeviLaminaServerManager/2.0")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var rel gitHubRelease
		if err := json.NewDecoder(resp.Body).Decode(&rel); err == nil && rel.TagName != "" {
			return strings.TrimPrefix(rel.TagName, "v"), nil
		}
	}
	return "", fmt.Errorf("unable to fetch upstream lip release")
}

type UpdateCheckerEngine struct {
	db             *database.Database
	bedrinthClient *bedrinth.BedrinthClient
	lipClient      *lip.LipClient
	llMgr          *levilamina.LeviLaminaManager
	modMgr         *mods.ModManager
}

func NewUpdateCheckerEngine(
	db *database.Database,
	bedrinthClient *bedrinth.BedrinthClient,
	lipClient *lip.LipClient,
	llMgr *levilamina.LeviLaminaManager,
	modMgr *mods.ModManager,
) *UpdateCheckerEngine {
	return &UpdateCheckerEngine{
		db:             db,
		bedrinthClient: bedrinthClient,
		lipClient:      lipClient,
		llMgr:          llMgr,
		modMgr:         modMgr,
	}
}

// CompareSemver compares two semver strings roughly: returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
func CompareSemver(v1, v2 string) int {
	clean1 := strings.TrimLeft(strings.TrimSpace(v1), "v>=^~")
	clean2 := strings.TrimLeft(strings.TrimSpace(v2), "v>=^~")

	// Strip suffixes like -beta, -alpha, etc. for comparison
	if idx := strings.Index(clean1, "-"); idx != -1 {
		clean1 = clean1[:idx]
	}
	if idx := strings.Index(clean2, "-"); idx != -1 {
		clean2 = clean2[:idx]
	}

	parts1 := strings.Split(clean1, ".")
	parts2 := strings.Split(clean2, ".")
	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(parts1) {
			n1, _ = strconv.Atoi(parts1[i])
		}
		if i < len(parts2) {
			n2, _ = strconv.Atoi(parts2[i])
		}
		if n1 != n2 {
			return n1 - n2
		}
	}
	return 0
}

// CheckAllUpdates scans all dependencies, upstream releases, and mods for updates dynamically
func (e *UpdateCheckerEngine) CheckAllUpdates(ctx context.Context, serverID string) (*models.UpdateCheckReport, error) {
	report := &models.UpdateCheckReport{
		CheckedAt:  time.Now().Format(time.RFC3339),
		ModUpdates: []models.ComponentUpdate{},
	}

	// 1. Fetch live Bedrinth catalog (force refresh to discover newly indexed packages)
	catalog, err := e.bedrinthClient.ForceRefresh()
	if err != nil || len(catalog) == 0 {
		catalog, _ = e.bedrinthClient.GetPackages()
	}
	catalogByTooth := make(map[string]models.BedrinthPackage)
	catalogByName := make(map[string]models.BedrinthPackage)
	for _, pkg := range catalog {
		catalogByTooth[strings.ToLower(pkg.Tooth)] = pkg
		catalogByName[strings.ToLower(pkg.Name)] = pkg
	}

	// 2. Resolve Server if serverID provided
	var s *models.Server
	if serverID != "" {
		if found, ok := e.db.GetServer(serverID); ok {
			s = found
			report.ServerID = s.ID
			report.ServerName = s.Name
		}
	} else {
		// Pick first available server if none specified
		servers := e.db.GetServers()
		if len(servers) > 0 {
			s = &servers[0]
			report.ServerID = s.ID
			report.ServerName = s.Name
		}
	}

	// 3. Check LeviLamina Loader Update (Live from GitHub releases & Bedrinth index)
	var currentLLVersion string
	if s != nil {
		currentLLVersion = e.llMgr.DetectVersion(s.Path)
		if currentLLVersion == "" || currentLLVersion == "Not Installed" {
			currentLLVersion = s.LeviLaminaVersion
		}
	}
	if currentLLVersion == "" {
		currentLLVersion = "Not Installed"
	}

	latestLLVersion := "26.51.5"
	if llPkg, ok := catalogByTooth["github.com/litedev/levilamina"]; ok && len(llPkg.Versions) > 0 {
		latestLLVersion = llPkg.Versions[0]
	} else if llPkg, ok := catalogByName["levilamina"]; ok && len(llPkg.Versions) > 0 {
		latestLLVersion = llPkg.Versions[0]
	}

	var llReleaseNotes string
	// Dynamically query upstream GitHub release
	if ghRel, ghErr := fetchLatestLeviLaminaRelease(ctx); ghErr == nil && ghRel != nil {
		ghTag := strings.TrimPrefix(ghRel.TagName, "v")
		if CompareSemver(ghTag, latestLLVersion) >= 0 {
			latestLLVersion = ghTag
		}
		llReleaseNotes = ghRel.Body
	}

	llHasUpdate := false
	if currentLLVersion != "Not Installed" && currentLLVersion != "None" && latestLLVersion != "" {
		if CompareSemver(latestLLVersion, currentLLVersion) > 0 {
			llHasUpdate = true
		}
	}

	report.LoaderVersion = models.ComponentUpdate{
		ID:             "levilamina-loader",
		Name:           "LeviLamina Mod Loader",
		Type:           "LOADER",
		CurrentVersion: currentLLVersion,
		LatestVersion:  latestLLVersion,
		Tooth:          "github.com/LiteLDev/LeviLamina",
		Description:    "Core modding runtime and C++ plugin API for Bedrock Dedicated Server.",
		IsCompatible:   true,
		HasUpdate:      llHasUpdate,
		ReleaseNotes:   llReleaseNotes,
	}

	// 4. Check Minecraft BDS Version (Dynamically fetched from upstream Mojang BDS repository)
	var currentBDS string
	if s != nil {
		currentBDS = s.MinecraftVersion
	}
	displayBDS := currentBDS
	if displayBDS == "" || strings.HasPrefix(strings.ToLower(displayBDS), "latest") || strings.EqualFold(displayBDS, "detected") {
		displayBDS = "1.21.60.10"
	}

	latestBDS := "1.21.60.10"
	if bdsUpstream, bdsErr := fetchLatestMojangBDS(ctx); bdsErr == nil && bdsUpstream != "" {
		latestBDS = bdsUpstream
	}

	bdsHasUpdate := false
	if displayBDS != "" && CompareSemver(latestBDS, displayBDS) > 0 {
		bdsHasUpdate = true
	}

	report.ServerVersion = models.ComponentUpdate{
		ID:             "minecraft-bds",
		Name:           "Minecraft Bedrock Dedicated Server",
		Type:           "BDS",
		CurrentVersion: displayBDS,
		LatestVersion:  latestBDS,
		Description:    "Official Mojang Minecraft Bedrock Dedicated Server engine.",
		IsCompatible:   true,
		HasUpdate:      bdsHasUpdate,
	}

	// 5. Check LIP CLI Tool Update (Live query from GitHub & Bedrinth)
	serverPath := ""
	if s != nil {
		serverPath = s.Path
	}
	_, installedLip := e.lipClient.FindLipPath(serverPath)
	var lipVer string
	if installedLip {
		v, err := e.lipClient.GetVersion(serverPath)
		if err == nil {
			lipVer = v
		} else {
			lipVer = "Installed"
		}
	} else {
		lipVer = "Not Installed"
	}

	latestLip := "0.34.8"
	for _, cand := range []string{"github.com/litedev/lip", "github.com/LiteLDev/lip"} {
		if lipPkg, ok := catalogByTooth[strings.ToLower(cand)]; ok && len(lipPkg.Versions) > 0 {
			latestLip = lipPkg.Versions[0]
			break
		}
	}
	if lipGh, lipGhErr := fetchLatestLipRelease(ctx); lipGhErr == nil && lipGh != "" {
		if CompareSemver(lipGh, latestLip) >= 0 {
			latestLip = lipGh
		}
	}

	lipHasUpdate := false
	if installedLip && lipVer != "" && lipVer != "Installed" && lipVer != "Not Installed" {
		if CompareSemver(latestLip, lipVer) > 0 {
			lipHasUpdate = true
		}
	}

	report.LipVersion = models.ComponentUpdate{
		ID:             "lip-cli",
		Name:           "LIP Package Manager CLI",
		Type:           "TOOL",
		CurrentVersion: lipVer,
		LatestVersion:  latestLip,
		Tooth:          "github.com/LiteLDev/lip",
		Description:    "Tooth package manager CLI for installing and updating mods.",
		IsCompatible:   true,
		HasUpdate:      lipHasUpdate,
	}

	// 6. Check Installed Mods Updates
	if s != nil {
		installedMods, err := e.modMgr.ListMods(s.Path)
		if err == nil {
			for _, mod := range installedMods {
				// Don't duplicate LeviLamina in the mod list
				if strings.EqualFold(mod.Name, "levilamina") {
					continue
				}

				// Find package in Bedrinth catalog
				var matchPkg *models.BedrinthPackage
				for _, candTooth := range []string{
					strings.ToLower(mod.ToothPath),
					strings.ToLower(mod.Path),
					"github.com/litedev/" + strings.ToLower(mod.Name),
				} {
					if candTooth != "" {
						if p, ok := catalogByTooth[candTooth]; ok {
							matchPkg = &p
							break
						}
					}
				}
				if matchPkg == nil {
					if p, ok := catalogByName[strings.ToLower(mod.Name)]; ok {
						matchPkg = &p
					}
				}

				if matchPkg != nil {
					latestVer := ""
					if len(matchPkg.Versions) > 0 {
						latestVer = matchPkg.Versions[0]
					}

					modHasUpdate := false
					if mod.Version != "" && latestVer != "" {
						if CompareSemver(latestVer, mod.Version) > 0 {
							modHasUpdate = true
						}
					}

					report.ModUpdates = append(report.ModUpdates, models.ComponentUpdate{
						ID:             matchPkg.Tooth,
						Name:           mod.Name,
						Type:           "MOD",
						CurrentVersion: mod.Version,
						LatestVersion:  latestVer,
						Tooth:          matchPkg.Tooth,
						Description:    matchPkg.Description,
						IsCompatible:   true,
						HasUpdate:      modHasUpdate,
					})
				}
			}
		}
	}

	// Calculate total updates count strictly based on actionable updates
	totalCount := 0
	if report.LoaderVersion.HasUpdate {
		totalCount++
	}
	if report.LipVersion.HasUpdate {
		totalCount++
	}
	for _, m := range report.ModUpdates {
		if m.HasUpdate {
			totalCount++
		}
	}

	report.TotalUpdatesCount = totalCount
	report.HasUpdates = totalCount > 0

	return report, nil
}

// ApplyUpdate executes an update for the designated component
func (e *UpdateCheckerEngine) ApplyUpdate(ctx context.Context, serverPath string, compType, identifier, targetVersion string) (*lip.CommandResult, error) {
	switch strings.ToUpper(compType) {
	case "LOADER":
		tooth := "github.com/LiteLDev/LeviLamina"
		if targetVersion != "" && targetVersion != "latest" {
			tooth = tooth + "@" + targetVersion
		}
		return e.lipClient.InstallPackage(ctx, serverPath, tooth)

	case "TOOL":
		out, err := e.lipClient.InstallLipBinary()
		if err != nil {
			return &lip.CommandResult{Success: false, Error: err.Error()}, err
		}
		return &lip.CommandResult{Success: true, Stdout: out}, nil

	case "MOD":
		tooth := identifier
		if targetVersion != "" && targetVersion != "latest" {
			tooth = tooth + "@" + targetVersion
		}
		return e.lipClient.InstallPackage(ctx, serverPath, tooth)

	default:
		// Try generic lip update
		return e.lipClient.UpdatePackage(ctx, serverPath, identifier)
	}
}
