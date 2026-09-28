package server

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"levilamina-server-manager/backend/database"
	"levilamina-server-manager/backend/levilamina"
	"levilamina-server-manager/backend/lip"
	"levilamina-server-manager/backend/models"
)

type ServerManager struct {
	db          *database.Database
	lipClient   *lip.LipClient
	llManager   *levilamina.LeviLaminaManager
}

func NewServerManager(db *database.Database, lipClient *lip.LipClient, llManager *levilamina.LeviLaminaManager) *ServerManager {
	return &ServerManager{
		db:        db,
		lipClient: lipClient,
		llManager: llManager,
	}
}

type CreateServerOptions struct {
	Name              string `json:"name"`
	Location          string `json:"location"`
	MinecraftVersion  string `json:"minecraftVersion"`
	LeviLaminaVersion string `json:"leviLaminaVersion"`
	Port              int    `json:"port"`
	WorldName         string `json:"worldName"`
	Gamemode          string `json:"gamemode"`
	Difficulty        string `json:"difficulty"`
}

// CreateServer sets up directory and default BDS/LeviLamina structure
func (sm *ServerManager) CreateServer(opts CreateServerOptions) (*models.Server, error) {
	if opts.Name == "" {
		return nil, fmt.Errorf("server name is required")
	}
	if opts.Location == "" {
		return nil, fmt.Errorf("server location path is required")
	}
	if opts.Port <= 0 {
		opts.Port = 19132
	}
	if opts.WorldName == "" {
		opts.WorldName = "World"
	}
	if opts.Gamemode == "" {
		opts.Gamemode = "survival"
	}
	if opts.Difficulty == "" {
		opts.Difficulty = "easy"
	}

	serverDir := opts.Location
	if err := os.MkdirAll(serverDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create server folder: %w", err)
	}

	// Create required BDS folders
	for _, sub := range []string{"behavior_packs", "resource_packs", "plugins", "worlds", "backups"} {
		if err := os.MkdirAll(filepath.Join(serverDir, sub), 0755); err != nil {
			return nil, err
		}
	}

	// Create initial world
	worldDir := filepath.Join(serverDir, "worlds", opts.WorldName)
	if err := os.MkdirAll(worldDir, 0755); err != nil {
		return nil, err
	}
	_ = os.WriteFile(filepath.Join(worldDir, "levelname.txt"), []byte(opts.WorldName), 0644)
	_ = os.WriteFile(filepath.Join(worldDir, "world_behavior_packs.json"), []byte("[]"), 0644)
	_ = os.WriteFile(filepath.Join(worldDir, "world_resource_packs.json"), []byte("[]"), 0644)

	// Create server.properties
	propsFile := filepath.Join(serverDir, "server.properties")
	propsContent := fmt.Sprintf(`# Minecraft Bedrock Dedicated Server Properties
server-name=%s
gamemode=%s
force-gamemode=false
difficulty=%s
allow-cheats=false
max-players=10
online-mode=true
white-list=false
server-port=%d
server-portv6=%d
view-distance=32
tick-distance=4
player-idle-timeout=30
max-threads=8
level-name=%s
level-seed=
level-type=DEFAULT
default-player-permission-level=member
texturepack-required=false
content-log-file-enabled=true
transport=raknet
spawn-protection-radius=16
compression-threshold=1
compression-algorithm=zlib
server-authoritative-movement=server-auth
player-movement-score-threshold=20
player-movement-action-direction-threshold=0.85
player-movement-distance-threshold=0.3
player-movement-duration-threshold-in-ms=500
correct-player-movement=false
server-authoritative-block-breaking=false
emit-server-telemetry=true
`, opts.Name, opts.Gamemode, opts.Difficulty, opts.Port, opts.Port+1, opts.WorldName)

	if err := os.WriteFile(propsFile, []byte(propsContent), 0644); err != nil {
		return nil, fmt.Errorf("failed to write server.properties: %w", err)
	}

	// Create default whitelist and permissions
	_ = os.WriteFile(filepath.Join(serverDir, "whitelist.json"), []byte("[]"), 0644)
	_ = os.WriteFile(filepath.Join(serverDir, "permissions.json"), []byte("[]"), 0644)

	id := fmt.Sprintf("srv-%d", time.Now().UnixNano())
	server := models.Server{
		ID:                id,
		Name:              opts.Name,
		Path:              serverDir,
		MinecraftVersion:  opts.MinecraftVersion,
		LeviLaminaVersion: opts.LeviLaminaVersion,
		Status:            models.StatusOffline,
		Port:              opts.Port,
		ActiveWorld:       opts.WorldName,
		AutoRestart:       true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := sm.db.SaveServer(server); err != nil {
		return nil, err
	}

	return &server, nil
}

// RescanServer updates server metadata by inspecting directory files
func (sm *ServerManager) RescanServer(id string) (*models.Server, error) {
	s, found := sm.db.GetServer(id)
	if !found {
		return nil, fmt.Errorf("server %s not found in database", id)
	}

	// 1. Inspect server.properties
	if props, err := LoadProperties(s.Path); err == nil {
		if sName := props.Get("server-name", ""); sName != "" {
			s.Name = sName
		}
		if port := props.GetInt("server-port", 0); port > 0 {
			s.Port = port
		}
		world := strings.TrimSpace(props.Get("level-name", ""))
		if world != "" {
			if strings.EqualFold(world, "Bedrock level") && s.ActiveWorld != "" && !strings.EqualFold(s.ActiveWorld, "Bedrock level") {
				// Prevent server.properties from reverting to "Bedrock level"
				props.Set("level-name", s.ActiveWorld)
				_ = props.Save()
				_ = os.RemoveAll(filepath.Join(s.Path, "worlds", "Bedrock level"))
			} else if strings.EqualFold(world, "Bedrock level") {
				// Search for existing real world folder
				entries, _ := os.ReadDir(filepath.Join(s.Path, "worlds"))
				foundWorld := ""
				for _, e := range entries {
					if e.IsDir() && !strings.EqualFold(e.Name(), "Bedrock level") {
						foundWorld = e.Name()
						break
					}
				}
				if foundWorld != "" {
					s.ActiveWorld = foundWorld
					props.Set("level-name", foundWorld)
					_ = props.Save()
					_ = os.RemoveAll(filepath.Join(s.Path, "worlds", "Bedrock level"))
				} else {
					s.ActiveWorld = "World"
					props.Set("level-name", "World")
					_ = props.Save()
					_ = os.RemoveAll(filepath.Join(s.Path, "worlds", "Bedrock level"))
				}
			} else {
				s.ActiveWorld = world
			}
		}
	}

	// 2. Inspect LeviLamina
	if sm.llManager.IsInstalled(s.Path) {
		s.LeviLaminaVersion = sm.llManager.DetectVersion(s.Path)
	}

	// 3. Inspect LIP
	_, lipFound := sm.lipClient.FindLipPath(s.Path)
	s.LipInstalled = lipFound

	_ = sm.db.SaveServer(*s)
	return s, nil
}

// ImportExistingServer inspects an existing BDS / LeviLamina directory and adds it to the manager
func (sm *ServerManager) ImportExistingServer(serverPath string) (*models.Server, error) {
	if _, err := os.Stat(serverPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("directory does not exist: %s", serverPath)
	}

	props, err := LoadProperties(serverPath)
	serverName := filepath.Base(serverPath)
	port := 19132
	activeWorld := "World"

	if err == nil {
		if sn := props.Get("server-name", ""); sn != "" {
			serverName = sn
		}
		if p := props.GetInt("server-port", 0); p > 0 {
			port = p
		}
		if ln := strings.TrimSpace(props.Get("level-name", "")); ln != "" {
			activeWorld = ln
		}
	}

	// If activeWorld is "Bedrock level", search for actual custom world folder
	if strings.EqualFold(activeWorld, "Bedrock level") {
		entries, _ := os.ReadDir(filepath.Join(serverPath, "worlds"))
		for _, e := range entries {
			if e.IsDir() && !strings.EqualFold(e.Name(), "Bedrock level") {
				activeWorld = e.Name()
				if props != nil {
					props.Set("level-name", activeWorld)
					_ = props.Save()
				}
				_ = os.RemoveAll(filepath.Join(serverPath, "worlds", "Bedrock level"))
				break
			}
		}
	}

	// Detect versions
	llVer := sm.llManager.DetectVersion(serverPath)
	_, lipFound := sm.lipClient.FindLipPath(serverPath)

	id := fmt.Sprintf("srv-%d", time.Now().UnixNano())
	server := models.Server{
		ID:                id,
		Name:              serverName,
		Path:              serverPath,
		MinecraftVersion:  "Detected",
		LeviLaminaVersion: llVer,
		LipInstalled:      lipFound,
		Status:            models.StatusOffline,
		Port:              port,
		ActiveWorld:       activeWorld,
		AutoRestart:       false,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := sm.db.SaveServer(server); err != nil {
		return nil, err
	}

	return &server, nil
}

// OpenFolder reveals the server folder in Windows Explorer
func (sm *ServerManager) OpenFolder(folderPath string) error {
	cmd := exec.Command("explorer.exe", folderPath)
	return cmd.Start()
}

// SetActiveWorld changes the active level-name in server.properties and updates the server record
func (sm *ServerManager) SetActiveWorld(serverID, worldFolder string) error {
	s, found := sm.db.GetServer(serverID)
	if !found {
		return fmt.Errorf("server %s not found", serverID)
	}

	worldFolder = strings.TrimSpace(worldFolder)
	if worldFolder == "" {
		return fmt.Errorf("world folder cannot be empty")
	}

	actualFolder := worldFolder
	worldPath := filepath.Join(s.Path, "worlds", actualFolder)

	// If direct folder doesn't exist, search worlds directory for matching folder name or matching levelname.txt
	if _, err := os.Stat(worldPath); os.IsNotExist(err) {
		entries, readErr := os.ReadDir(filepath.Join(s.Path, "worlds"))
		if readErr == nil {
			matched := false
			for _, e := range entries {
				if !e.IsDir() {
					continue
				}
				// 1. Check case-insensitive folder match
				if strings.EqualFold(e.Name(), worldFolder) {
					actualFolder = e.Name()
					matched = true
					break
				}
				// 2. Check levelname.txt inside folder
				lnameFile := filepath.Join(s.Path, "worlds", e.Name(), "levelname.txt")
				if data, err := os.ReadFile(lnameFile); err == nil {
					if strings.EqualFold(strings.TrimSpace(string(data)), worldFolder) {
						actualFolder = e.Name()
						matched = true
						break
					}
				}
			}
			if !matched {
				// If not found, create the folder so BDS has a valid folder to load
				if mkErr := os.MkdirAll(worldPath, 0755); mkErr == nil {
					_ = os.WriteFile(filepath.Join(worldPath, "levelname.txt"), []byte(worldFolder), 0644)
					actualFolder = worldFolder
				} else {
					return fmt.Errorf("world '%s' does not exist in server worlds directory", worldFolder)
				}
			}
		} else {
			return fmt.Errorf("failed to inspect worlds directory: %w", readErr)
		}
	}

	// Update server.properties with the actual physical folder name and ensure raknet
	props, err := LoadProperties(s.Path)
	if err != nil {
		return fmt.Errorf("failed to load server.properties: %w", err)
	}
	props.Set("level-name", actualFolder)
	if props.Get("transport", "") == "" || strings.EqualFold(props.Get("transport", ""), "nethernet") {
		props.Set("transport", "raknet")
	}
	if err := props.Save(); err != nil {
		return fmt.Errorf("failed to save server.properties: %w", err)
	}

	// Single world policy: Clean up any unused/unwanted 'Bedrock level' placeholder unconditionally
	if !strings.EqualFold(actualFolder, "Bedrock level") {
		_ = os.RemoveAll(filepath.Join(s.Path, "worlds", "Bedrock level"))
	}

	s.ActiveWorld = actualFolder
	s.UpdatedAt = time.Now()
	return sm.db.SaveServer(*s)
}

