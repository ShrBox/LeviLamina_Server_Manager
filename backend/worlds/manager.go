package worlds

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/security"
	"levilamina-server-manager/backend/server"
)

type WorldManager struct{}

func NewWorldManager() *WorldManager {
	return &WorldManager{}
}

// ListWorlds scans serverPath/worlds and reads world details and pack configurations
func (wm *WorldManager) ListWorlds(serverPath string) ([]models.World, error) {
	worldsDir := filepath.Join(serverPath, "worlds")
	if _, err := os.Stat(worldsDir); os.IsNotExist(err) {
		return []models.World{}, nil
	}

	// Read server.properties level-name as ground truth for active world
	activeLevelName := ""
	if props, err := server.LoadProperties(serverPath); err == nil {
		activeLevelName = strings.TrimSpace(props.Get("level-name", ""))
	}

	// Single world policy: Clean up untouched or unwanted 'Bedrock level' placeholder before reading directory
	if activeLevelName != "" && !strings.EqualFold(activeLevelName, "Bedrock level") {
		_ = os.RemoveAll(filepath.Join(worldsDir, "Bedrock level"))
	}

	entries, err := os.ReadDir(worldsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read worlds directory: %w", err)
	}

	worlds := make([]models.World, 0)

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		folderName := e.Name()
		if strings.EqualFold(folderName, "Bedrock level") && !strings.EqualFold(activeLevelName, "Bedrock level") {
			continue
		}
		worldDir := filepath.Join(worldsDir, folderName)

		levelName := folderName
		levelNameFile := filepath.Join(worldDir, "levelname.txt")
		if data, err := os.ReadFile(levelNameFile); err == nil {
			trimmed := strings.TrimSpace(string(data))
			if trimmed != "" {
				levelName = trimmed
			}
		}

		// Read behavior packs
		bps := make([]models.WorldPackRecord, 0)
		bpFile := filepath.Join(worldDir, "world_behavior_packs.json")
		if data, err := os.ReadFile(bpFile); err == nil {
			_ = json.Unmarshal(data, &bps)
			for i := range bps {
				name, desc := resolvePackInfo(serverPath, worldDir, bps[i].PackID, false)
				bps[i].Name = name
				bps[i].Description = desc
			}
		}

		// Read resource packs
		rps := make([]models.WorldPackRecord, 0)
		rpFile := filepath.Join(worldDir, "world_resource_packs.json")
		if data, err := os.ReadFile(rpFile); err == nil {
			_ = json.Unmarshal(data, &rps)
			for i := range rps {
				name, desc := resolvePackInfo(serverPath, worldDir, rps[i].PackID, true)
				rps[i].Name = name
				rps[i].Description = desc
			}
		}

		// Calculate size
		var totalBytes int64
		_ = filepath.Walk(worldDir, func(_ string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() {
				totalBytes += info.Size()
			}
			return nil
		})

		fi, _ := e.Info()
		var modTime time.Time
		if fi != nil {
			modTime = fi.ModTime()
		} else {
			modTime = time.Now()
		}

		isActive := false
		if activeLevelName != "" {
			isActive = strings.EqualFold(folderName, activeLevelName) || strings.EqualFold(levelName, activeLevelName)
		}

		worlds = append(worlds, models.World{
			Name:          levelName,
			Folder:        folderName,
			LevelName:     levelName,
			IsActive:      isActive,
			BehaviorPacks: bps,
			ResourcePacks: rps,
			SizeMB:        float64(totalBytes) / (1024.0 * 1024.0),
			LastModified:  modTime,
		})
	}

	return worlds, nil
}

// CreateWorld creates a new world folder and sets levelname.txt and empty pack configs
func (wm *WorldManager) CreateWorld(serverPath, folderName, displayName string) error {
	return wm.CreateWorldWithOptions(serverPath, models.WorldCreateOptions{
		FolderName:    folderName,
		DisplayName:   displayName,
		BehaviorPacks: []models.WorldPackRecord{},
		ResourcePacks: []models.WorldPackRecord{},
	})
}

// CreateWorldWithOptions creates a world with initial packs and configurations
func (wm *WorldManager) CreateWorldWithOptions(serverPath string, opts models.WorldCreateOptions) error {
	folder := strings.TrimSpace(opts.FolderName)
	if folder == "" {
		return fmt.Errorf("world folder name cannot be empty")
	}
	if strings.Contains(folder, "..") || strings.Contains(folder, "/") || strings.Contains(folder, "\\") {
		return fmt.Errorf("invalid world folder name: path traversal characters not permitted")
	}

	worldDir := filepath.Join(serverPath, "worlds", folder)
	if err := os.MkdirAll(worldDir, 0755); err != nil {
		return fmt.Errorf("failed to create world directory: %w", err)
	}

	displayName := strings.TrimSpace(opts.DisplayName)
	if displayName == "" {
		displayName = folder
	}
	levelNameFile := filepath.Join(worldDir, "levelname.txt")
	_ = os.WriteFile(levelNameFile, []byte(displayName), 0644)

	// Write behavior packs
	bps := opts.BehaviorPacks
	if bps == nil {
		bps = []models.WorldPackRecord{}
	}
	bpData, err := json.MarshalIndent(bps, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(worldDir, "world_behavior_packs.json"), bpData, 0644)
	}

	// Write resource packs
	rps := opts.ResourcePacks
	if rps == nil {
		rps = []models.WorldPackRecord{}
	}
	rpData, err := json.MarshalIndent(rps, "", "  ")
	if err == nil {
		_ = os.WriteFile(filepath.Join(worldDir, "world_resource_packs.json"), rpData, 0644)
	}

	// If setActive is requested, immediately update server.properties so BDS loads this world
	if opts.SetActive {
		if props, err := server.LoadProperties(serverPath); err == nil {
			props.Set("level-name", folder)
			if props.Get("transport", "") == "" || strings.EqualFold(props.Get("transport", ""), "nethernet") {
				props.Set("transport", "raknet")
			}
			if opts.Gamemode != "" {
				props.Set("gamemode", strings.ToLower(opts.Gamemode))
			}
			if opts.Difficulty != "" {
				props.Set("difficulty", strings.ToLower(opts.Difficulty))
			}
			if opts.Seed != "" {
				props.Set("level-seed", opts.Seed)
			}
			_ = props.Save()
		}

		// Single world policy: Clean up untouched 'Bedrock level' placeholder unconditionally
		if !strings.EqualFold(folder, "Bedrock level") {
			_ = os.RemoveAll(filepath.Join(serverPath, "worlds", "Bedrock level"))
		}
	}

	return nil
}

// DeleteWorld safely removes a world folder if it is not the active world
func (wm *WorldManager) DeleteWorld(serverPath, folderName, activeWorld string) error {
	folder := strings.TrimSpace(folderName)
	if folder == "" {
		return fmt.Errorf("folder name cannot be empty")
	}
	if strings.Contains(folder, "..") || strings.Contains(folder, "/") || strings.Contains(folder, "\\") {
		return fmt.Errorf("invalid world folder name: path traversal characters not permitted")
	}

	if strings.EqualFold(folder, activeWorld) {
		return fmt.Errorf("cannot delete world '%s': it is currently the active server world. Please switch active worlds first", folder)
	}

	worldDir := filepath.Join(serverPath, "worlds", folder)
	if _, err := os.Stat(worldDir); os.IsNotExist(err) {
		return fmt.Errorf("world folder '%s' does not exist", folder)
	}

	return os.RemoveAll(worldDir)
}

// GetWorldOptions loads server.properties and world levelname.txt
func (wm *WorldManager) GetWorldOptions(serverPath, worldFolder string) (*models.WorldOptions, error) {
	props, err := server.LoadProperties(serverPath)
	if err != nil {
		return nil, err
	}

	levelName := worldFolder
	levelNameFile := filepath.Join(serverPath, "worlds", worldFolder, "levelname.txt")
	if data, err := os.ReadFile(levelNameFile); err == nil {
		trimmed := strings.TrimSpace(string(data))
		if trimmed != "" {
			levelName = trimmed
		}
	}

	transport := props.Get("transport", "raknet")
	if transport == "" {
		transport = "raknet"
	}

	opts := &models.WorldOptions{
		LevelName:                          levelName,
		Gamemode:                           props.Get("gamemode", "survival"),
		Difficulty:                         props.Get("difficulty", "easy"),
		AllowCheats:                        props.GetBool("allow-cheats", true),
		PVP:                                props.GetBool("pvp", true),
		Hardcore:                           props.GetBool("hardcore", false),
		DefaultPlayerPermission:            props.Get("default-player-permission-level", "member"),
		ShowCoordinates:                    props.GetBool("show-coordinates", true),
		MaxPlayers:                         props.GetInt("max-players", 10),
		ServerPort:                         props.GetInt("server-port", 19132),
		AllowList:                          props.GetBool("allow-list", false),
		ViewDistance:                       props.GetInt("view-distance", 32),
		TickDistance:                       props.GetInt("tick-distance", 4),
		PlayerIdleTimeout:                  props.GetInt("player-idle-timeout", 30),
		LevelSeed:                          props.Get("level-seed", ""),
		LevelType:                          props.Get("level-type", "DEFAULT"),
		ForceGamemode:                      props.GetBool("force-gamemode", false),
		SpawnProtectionRadius:              props.GetInt("spawn-protection-radius", 16),
		TexturePackRequired:                props.GetBool("texturepack-required", false),
		ContentLogFileEnabled:              props.GetBool("content-log-file-enabled", true),
		Transport:                          transport,
		OnlineMode:                         props.GetBool("online-mode", true),
		ServerAuthoritativeMovement:        props.Get("server-authoritative-movement", "server-auth"),
		CompressionThreshold:               props.GetInt("compression-threshold", 1),
		// Extended gamerules
		PlayersSleepingPercentage:          props.GetInt("players-sleeping-percentage", 100),
		MobGriefing:                        props.GetBool("mob-griefing", true),
		NaturalRegeneration:                props.GetBool("natural-regeneration", true),
		KeepInventory:                      props.GetBool("keep-inventory", false),
		DoWeatherCycle:                     props.GetBool("do-weather-cycle", true),
		DoDaylightCycle:                    props.GetBool("do-daylight-cycle", true),
		RandomTickSpeed:                    props.GetInt("random-tick-speed", 1),
		ChatRestriction:                    props.Get("chat-restriction", "None"),
		ClientSideChunkGenerationEnabled:   props.GetBool("client-side-chunk-generation-enabled", true),
		BlockNetworkIdsAreHashes:           props.GetBool("block-network-ids-are-hashes", false),
		ServerAuthoritativeBlockBreaking:   props.GetBool("server-authoritative-block-breaking", false),
		EmitServerTelemetry:                props.GetBool("emit-server-telemetry", true),
	}
	return opts, nil
}

// SaveWorldOptions updates server.properties and world levelname.txt, renaming folders when needed
func (wm *WorldManager) SaveWorldOptions(serverPath, worldFolder string, opts models.WorldOptions) error {
	props, err := server.LoadProperties(serverPath)
	if err != nil {
		return err
	}

	activeTargetFolder := worldFolder
	trimmedLevelName := strings.TrimSpace(opts.LevelName)

	// If world name changed and worldFolder is 'Bedrock level' or user gave a valid new name, rename folder to match
	if trimmedLevelName != "" && !strings.EqualFold(trimmedLevelName, worldFolder) {
		sanitizedNewFolder := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
				return r
			}
			return '_'
		}, trimmedLevelName)
		sanitizedNewFolder = strings.Trim(sanitizedNewFolder, "_")
		if sanitizedNewFolder == "" {
			sanitizedNewFolder = "world"
		}

		oldDir := filepath.Join(serverPath, "worlds", worldFolder)
		newDir := filepath.Join(serverPath, "worlds", sanitizedNewFolder)

		if _, oldStatErr := os.Stat(oldDir); oldStatErr == nil && !strings.EqualFold(oldDir, newDir) {
			if _, newStatErr := os.Stat(newDir); os.IsNotExist(newStatErr) {
				if renameErr := os.Rename(oldDir, newDir); renameErr == nil {
					activeTargetFolder = sanitizedNewFolder
				}
			}
		}
	}

	targetDir := filepath.Join(serverPath, "worlds", activeTargetFolder)
	if trimmedLevelName != "" {
		_ = os.MkdirAll(targetDir, 0755)
		_ = os.WriteFile(filepath.Join(targetDir, "levelname.txt"), []byte(trimmedLevelName), 0644)
	}

	// Synchronize level-name in server.properties so BDS loads this world
	props.Set("level-name", activeTargetFolder)

	if opts.Gamemode != "" {
		props.Set("gamemode", strings.ToLower(opts.Gamemode))
	}
	if opts.Difficulty != "" {
		props.Set("difficulty", strings.ToLower(opts.Difficulty))
	}
	allowCheatsVal := opts.AllowCheats
	if !allowCheatsVal {
		allowCheatsVal = true
	}
	props.Set("allow-cheats", fmt.Sprintf("%t", allowCheatsVal))
	props.Set("pvp", fmt.Sprintf("%t", opts.PVP))
	props.Set("hardcore", fmt.Sprintf("%t", opts.Hardcore))
	if opts.DefaultPlayerPermission != "" {
		props.Set("default-player-permission-level", strings.ToLower(opts.DefaultPlayerPermission))
	}
	props.Set("show-coordinates", fmt.Sprintf("%t", opts.ShowCoordinates))
	if opts.MaxPlayers > 0 {
		props.Set("max-players", fmt.Sprintf("%d", opts.MaxPlayers))
	}
	if opts.ServerPort > 0 {
		props.Set("server-port", fmt.Sprintf("%d", opts.ServerPort))
	}
	props.Set("allow-list", fmt.Sprintf("%t", opts.AllowList))
	if opts.ViewDistance > 0 {
		props.Set("view-distance", fmt.Sprintf("%d", opts.ViewDistance))
	}
	if opts.TickDistance > 0 {
		props.Set("tick-distance", fmt.Sprintf("%d", opts.TickDistance))
	}
	if opts.PlayerIdleTimeout >= 0 {
		props.Set("player-idle-timeout", fmt.Sprintf("%d", opts.PlayerIdleTimeout))
	}

	if opts.LevelSeed != "" {
		props.Set("level-seed", opts.LevelSeed)
	}
	if opts.LevelType != "" {
		props.Set("level-type", opts.LevelType)
	}
	props.Set("force-gamemode", fmt.Sprintf("%t", opts.ForceGamemode))
	if opts.SpawnProtectionRadius >= 0 {
		props.Set("spawn-protection-radius", fmt.Sprintf("%d", opts.SpawnProtectionRadius))
	}
	props.Set("texturepack-required", fmt.Sprintf("%t", opts.TexturePackRequired))
	props.Set("content-log-file-enabled", fmt.Sprintf("%t", opts.ContentLogFileEnabled))
	if opts.Transport != "" {
		props.Set("transport", strings.ToLower(opts.Transport))
	} else {
		props.Set("transport", "raknet")
	}
	props.Set("online-mode", fmt.Sprintf("%t", opts.OnlineMode))
	if opts.ServerAuthoritativeMovement != "" {
		props.Set("server-authoritative-movement", opts.ServerAuthoritativeMovement)
	}
	if opts.CompressionThreshold >= 0 {
		props.Set("compression-threshold", fmt.Sprintf("%d", opts.CompressionThreshold))
	}
	// Extended gamerules
	if opts.PlayersSleepingPercentage >= 0 && opts.PlayersSleepingPercentage <= 100 {
		props.Set("players-sleeping-percentage", fmt.Sprintf("%d", opts.PlayersSleepingPercentage))
	}
	props.Set("mob-griefing", fmt.Sprintf("%t", opts.MobGriefing))
	props.Set("natural-regeneration", fmt.Sprintf("%t", opts.NaturalRegeneration))
	props.Set("keep-inventory", fmt.Sprintf("%t", opts.KeepInventory))
	props.Set("do-weather-cycle", fmt.Sprintf("%t", opts.DoWeatherCycle))
	props.Set("do-daylight-cycle", fmt.Sprintf("%t", opts.DoDaylightCycle))
	if opts.RandomTickSpeed >= 0 {
		props.Set("random-tick-speed", fmt.Sprintf("%d", opts.RandomTickSpeed))
	}
	if opts.ChatRestriction != "" {
		props.Set("chat-restriction", opts.ChatRestriction)
	}
	props.Set("client-side-chunk-generation-enabled", fmt.Sprintf("%t", opts.ClientSideChunkGenerationEnabled))
	props.Set("block-network-ids-are-hashes", fmt.Sprintf("%t", opts.BlockNetworkIdsAreHashes))
	props.Set("server-authoritative-block-breaking", fmt.Sprintf("%t", opts.ServerAuthoritativeBlockBreaking))
	props.Set("emit-server-telemetry", fmt.Sprintf("%t", opts.EmitServerTelemetry))

	if err := props.Save(); err != nil {
		return err
	}

	// Single world policy: Clean up untouched 'Bedrock level' placeholder if not current world unconditionally
	if !strings.EqualFold(activeTargetFolder, "Bedrock level") {
		_ = os.RemoveAll(filepath.Join(serverPath, "worlds", "Bedrock level"))
	}

	return nil
}

// ReorderWorldPacks writes behavior/resource pack arrays in the specified order to commit priority
func (wm *WorldManager) ReorderWorldPacks(serverPath, worldFolder string, behaviorPacks, resourcePacks []models.WorldPackRecord) error {
	folder := strings.TrimSpace(worldFolder)
	if folder == "" {
		return fmt.Errorf("world folder name cannot be empty")
	}
	worldDir := filepath.Join(serverPath, "worlds", folder)
	if _, err := os.Stat(worldDir); os.IsNotExist(err) {
		return fmt.Errorf("world folder '%s' does not exist", folder)
	}

	type diskPackRecord struct {
		PackID  string `json:"pack_id"`
		Version []int  `json:"version"`
	}

	if behaviorPacks != nil {
		diskBPs := make([]diskPackRecord, 0, len(behaviorPacks))
		for _, p := range behaviorPacks {
			diskBPs = append(diskBPs, diskPackRecord{
				PackID:  p.PackID,
				Version: p.Version,
			})
		}
		data, err := json.MarshalIndent(diskBPs, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal behavior packs: %w", err)
		}
		if err := os.WriteFile(filepath.Join(worldDir, "world_behavior_packs.json"), data, 0644); err != nil {
			return fmt.Errorf("failed to write behavior packs: %w", err)
		}
	}

	if resourcePacks != nil {
		diskRPs := make([]diskPackRecord, 0, len(resourcePacks))
		for _, p := range resourcePacks {
			diskRPs = append(diskRPs, diskPackRecord{
				PackID:  p.PackID,
				Version: p.Version,
			})
		}
		data, err := json.MarshalIndent(diskRPs, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal resource packs: %w", err)
		}
		if err := os.WriteFile(filepath.Join(worldDir, "world_resource_packs.json"), data, 0644); err != nil {
			return fmt.Errorf("failed to write resource packs: %w", err)
		}
	}

	return nil
}

// ImportWorldArchive imports a .mcworld or .zip world archive into the server worlds directory
func (wm *WorldManager) ImportWorldArchive(serverPath, archivePath string) (*models.World, error) {
	if _, err := os.Stat(archivePath); err != nil {
		return nil, fmt.Errorf("archive file not found: %w", err)
	}

	tempDir, err := os.MkdirTemp("", "mcworld_import_*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open world archive: %w", err)
	}
	defer r.Close()

	if err := security.ExtractZipSafely(&r.Reader, tempDir, 2*1024*1024*1024, false); err != nil {
		return nil, fmt.Errorf("failed to extract world archive: %w", err)
	}

	// Search for directory containing level.dat
	worldSourceDir := ""
	var findLevelDat func(dir string) error
	findLevelDat = func(dir string) error {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return err
		}
		for _, e := range entries {
			if !e.IsDir() && strings.EqualFold(e.Name(), "level.dat") {
				worldSourceDir = dir
				return nil
			}
		}
		for _, e := range entries {
			if e.IsDir() {
				if err := findLevelDat(filepath.Join(dir, e.Name())); err != nil {
					return err
				}
				if worldSourceDir != "" {
					return nil
				}
			}
		}
		return nil
	}

	_ = findLevelDat(tempDir)
	if worldSourceDir == "" {
		worldSourceDir = tempDir
	}

	// Read world display name
	displayName := ""
	levelNameFile := filepath.Join(worldSourceDir, "levelname.txt")
	if data, err := os.ReadFile(levelNameFile); err == nil {
		displayName = strings.TrimSpace(string(data))
	}
	if displayName == "" {
		base := filepath.Base(archivePath)
		ext := filepath.Ext(base)
		displayName = strings.TrimSuffix(base, ext)
	}

	// Determine safe target folder name
	cleanName := strings.TrimSpace(displayName)
	for _, char := range []string{" ", "/", "\\", ":", "*", "?", "\"", "<", ">", "|"} {
		cleanName = strings.ReplaceAll(cleanName, char, "_")
	}
	if cleanName == "" {
		cleanName = fmt.Sprintf("imported_world_%d", time.Now().Unix())
	}

	worldsDir := filepath.Join(serverPath, "worlds")
	if err := os.MkdirAll(worldsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create worlds dir: %w", err)
	}

	targetFolder := cleanName
	counter := 1
	for {
		destPath := filepath.Join(worldsDir, targetFolder)
		if _, err := os.Stat(destPath); os.IsNotExist(err) {
			break
		}
		targetFolder = fmt.Sprintf("%s_%d", cleanName, counter)
		counter++
	}

	destWorldDir := filepath.Join(worldsDir, targetFolder)
	if err := copyDirectoryContents(worldSourceDir, destWorldDir); err != nil {
		return nil, fmt.Errorf("failed to copy world contents: %w", err)
	}

	// Ensure levelname.txt exists
	_ = os.WriteFile(filepath.Join(destWorldDir, "levelname.txt"), []byte(displayName), 0644)

	// Ensure pack json files exist
	bpFile := filepath.Join(destWorldDir, "world_behavior_packs.json")
	if _, err := os.Stat(bpFile); os.IsNotExist(err) {
		_ = os.WriteFile(bpFile, []byte("[]"), 0644)
	}
	rpFile := filepath.Join(destWorldDir, "world_resource_packs.json")
	if _, err := os.Stat(rpFile); os.IsNotExist(err) {
		_ = os.WriteFile(rpFile, []byte("[]"), 0644)
	}

	return &models.World{
		Name:          displayName,
		Folder:        targetFolder,
		LevelName:     displayName,
		IsActive:      false,
		BehaviorPacks: []models.WorldPackRecord{},
		ResourcePacks: []models.WorldPackRecord{},
		LastModified:  time.Now(),
	}, nil
}

func copyDirectoryContents(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		srcPath := filepath.Join(src, e.Name())
		dstPath := filepath.Join(dst, e.Name())
		if e.IsDir() {
			if err := copyDirectoryContents(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFileSafe(srcPath, dstPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func copyFileSafe(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// resolvePackInfo attempts to locate manifest.json in the world or server and resolves localized name
func resolvePackInfo(serverPath, worldDir, packID string, isResource bool) (string, string) {
	searchDirs := []string{}
	if isResource {
		searchDirs = append(searchDirs,
			filepath.Join(worldDir, "resource_packs"),
			filepath.Join(serverPath, "resource_packs"),
			filepath.Join(worldDir, "behavior_packs"),
			filepath.Join(serverPath, "behavior_packs"),
		)
	} else {
		searchDirs = append(searchDirs,
			filepath.Join(worldDir, "behavior_packs"),
			filepath.Join(serverPath, "behavior_packs"),
			filepath.Join(worldDir, "resource_packs"),
			filepath.Join(serverPath, "resource_packs"),
		)
	}

	for _, parentDir := range searchDirs {
		entries, err := os.ReadDir(parentDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			packFolder := filepath.Join(parentDir, e.Name())
			manifestPath := filepath.Join(packFolder, "manifest.json")
			name, desc := parseManifestAndLang(manifestPath, packFolder, packID)
			if name != "" {
				return name, desc
			}
		}
	}

	// Also check worldDir root manifest.json
	name, desc := parseManifestAndLang(filepath.Join(worldDir, "manifest.json"), worldDir, packID)
	if name != "" {
		return name, desc
	}

	// Fallback to world's own levelname or folder if this is a world template pack
	levelName := filepath.Base(worldDir)
	if data, err := os.ReadFile(filepath.Join(worldDir, "levelname.txt")); err == nil {
		if t := strings.TrimSpace(string(data)); t != "" {
			levelName = t
		}
	}
	levelName = cleanMinecraftColorCodes(levelName)
	if isResource {
		return fmt.Sprintf("%s (Resource Pack)", levelName), ""
	}
	return fmt.Sprintf("%s (Behavior Pack)", levelName), ""
}

type rawPackManifest struct {
	Header struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		UUID        string `json:"uuid"`
	} `json:"header"`
	Modules []struct {
		Type string `json:"type"`
		UUID string `json:"uuid"`
	} `json:"modules"`
}

func parseManifestAndLang(manifestPath, packFolder, targetUUID string) (string, string) {
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return "", ""
	}
	var mf rawPackManifest
	if err := json.Unmarshal(data, &mf); err != nil {
		return "", ""
	}

	matches := strings.EqualFold(mf.Header.UUID, targetUUID)
	if !matches {
		for _, m := range mf.Modules {
			if strings.EqualFold(m.UUID, targetUUID) {
				matches = true
				break
			}
		}
	}
	if !matches {
		return "", ""
	}

	name := mf.Header.Name
	desc := mf.Header.Description

	// Check if name is a localization token (e.g. "pack.name")
	langMap := loadLangFiles(packFolder)
	if locName, ok := langMap[strings.ToLower(name)]; ok && locName != "" {
		name = locName
	} else if locName, ok := langMap["pack.name"]; ok && locName != "" && (strings.HasPrefix(name, "pack.") || name == "") {
		name = locName
	}

	if locDesc, ok := langMap[strings.ToLower(desc)]; ok && locDesc != "" {
		desc = locDesc
	} else if locDesc, ok := langMap["pack.description"]; ok && locDesc != "" && (strings.HasPrefix(desc, "pack.") || desc == "") {
		desc = locDesc
	}

	name = cleanMinecraftColorCodes(name)
	desc = cleanMinecraftColorCodes(desc)
	return name, desc
}

func loadLangFiles(packFolder string) map[string]string {
	res := make(map[string]string)
	textsDir := filepath.Join(packFolder, "texts")
	candFiles := []string{
		filepath.Join(textsDir, "en_US.lang"),
		filepath.Join(textsDir, "en_GB.lang"),
	}

	// If neither exists, check all .lang files in textsDir
	if entries, err := os.ReadDir(textsDir); err == nil {
		for _, e := range entries {
			if strings.HasSuffix(strings.ToLower(e.Name()), ".lang") {
				candFiles = append(candFiles, filepath.Join(textsDir, e.Name()))
			}
		}
	}

	for _, f := range candFiles {
		data, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") || !strings.Contains(line, "=") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.ToLower(strings.TrimSpace(parts[0]))
				v := strings.TrimSpace(parts[1])
				if idx := strings.Index(v, "\t#"); idx != -1 {
					v = strings.TrimSpace(v[:idx])
				}
				if _, exists := res[k]; !exists {
					res[k] = v
				}
			}
		}
		if len(res) > 0 {
			break
		}
	}
	return res
}

func cleanMinecraftColorCodes(s string) string {
	reg := regexp.MustCompile(`§[0-9a-fk-or]`)
	clean := reg.ReplaceAllString(s, "")
	clean = strings.TrimSpace(clean)
	return clean
}



