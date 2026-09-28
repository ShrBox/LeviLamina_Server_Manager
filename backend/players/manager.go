package players

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/server"
)

type PlayerManager struct{}

func NewPlayerManager() *PlayerManager {
	return &PlayerManager{}
}

// Bedrock permissions.json struct
type PermissionEntry struct {
	Permission string `json:"permission"`
	XUID       string `json:"xuid"`
}

// Bedrock allowlist.json struct
type AllowlistEntry struct {
	IgnoresPlayerLimit bool   `json:"ignoresPlayerLimit"`
	Name               string `json:"name"`
	XUID               string `json:"xuid"`
}

// GetOverview gathers online players, operators, allowlisted players, and bans
func (pm *PlayerManager) GetOverview(serverPath string, onlinePlayers []models.ServerPlayer) (*models.PlayersOverview, error) {
	ops, _ := pm.GetOperators(serverPath)
	if ops == nil {
		ops = make([]models.ServerPlayer, 0)
	}
	allowlist, _ := pm.GetAllowlist(serverPath)
	if allowlist == nil {
		allowlist = make([]models.ServerPlayer, 0)
	}
	bans, _ := pm.GetBannedPlayers(serverPath)
	if bans == nil {
		bans = make([]models.BanEntry, 0)
	}
	if onlinePlayers == nil {
		onlinePlayers = make([]models.ServerPlayer, 0)
	}

	// Check if allow-list is enabled in server.properties
	allowListEnabled := false
	if props, err := server.LoadProperties(serverPath); err == nil {
		allowListEnabled = props.GetBool("allow-list", false) || props.GetBool("white-list", false)
	}

	// Enrich online players with their permission & whitelist status
	opMap := make(map[string]string)
	for _, o := range ops {
		opMap[o.XUID] = string(o.Permission)
	}
	whiteMap := make(map[string]bool)
	for _, w := range allowlist {
		if w.XUID != "" {
			whiteMap[w.XUID] = true
		}
		if w.Name != "" {
			whiteMap[strings.ToLower(w.Name)] = true
		}
	}
	banMap := make(map[string]bool)
	for _, b := range bans {
		if b.XUID != "" {
			banMap[b.XUID] = true
		}
		if b.Name != "" {
			banMap[strings.ToLower(b.Name)] = true
		}
	}

	enrichedOnline := make([]models.ServerPlayer, len(onlinePlayers))
	for i, p := range onlinePlayers {
		ep := p
		if perm, ok := opMap[p.XUID]; ok {
			ep.Permission = models.PlayerPermission(perm)
		} else {
			ep.Permission = models.PermissionMember
		}
		ep.IsWhitelisted = whiteMap[p.XUID] || whiteMap[strings.ToLower(p.Name)]
		ep.IsBanned = banMap[p.XUID] || banMap[strings.ToLower(p.Name)]
		enrichedOnline[i] = ep
	}

	return &models.PlayersOverview{
		OnlinePlayers:    enrichedOnline,
		Operators:        ops,
		Allowlist:        allowlist,
		BannedPlayers:    bans,
		AllowListEnabled: allowListEnabled,
	}, nil
}

// GetOperators reads permissions.json
func (pm *PlayerManager) GetOperators(serverPath string) ([]models.ServerPlayer, error) {
	filePath := filepath.Join(serverPath, "permissions.json")
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return []models.ServerPlayer{}, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var entries []PermissionEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return []models.ServerPlayer{}, nil
	}

	result := make([]models.ServerPlayer, 0, len(entries))
	for _, e := range entries {
		result = append(result, models.ServerPlayer{
			XUID:       e.XUID,
			Name:       "XUID: " + e.XUID,
			Permission: models.PlayerPermission(e.Permission),
		})
	}
	return result, nil
}

// SetOperator adds or updates a player's permission in permissions.json
func (pm *PlayerManager) SetOperator(serverPath, xuid, permission string) error {
	filePath := filepath.Join(serverPath, "permissions.json")
	var entries []PermissionEntry

	if data, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(data, &entries)
	}

	found := false
	newEntries := make([]PermissionEntry, 0, len(entries))
	for _, e := range entries {
		if e.XUID == xuid {
			found = true
			if permission != "" && permission != "member" {
				e.Permission = permission
				newEntries = append(newEntries, e)
			}
			// if "member" or empty, remove it from operator entries
		} else {
			newEntries = append(newEntries, e)
		}
	}

	if !found && permission != "" && permission != "member" {
		newEntries = append(newEntries, PermissionEntry{
			Permission: permission,
			XUID:       xuid,
		})
	}

	data, err := json.MarshalIndent(newEntries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// GetAllowlist reads allowlist.json / whitelist.json
func (pm *PlayerManager) GetAllowlist(serverPath string) ([]models.ServerPlayer, error) {
	targetFile := filepath.Join(serverPath, "allowlist.json")
	if _, err := os.Stat(targetFile); os.IsNotExist(err) {
		targetFile = filepath.Join(serverPath, "whitelist.json")
		if _, err := os.Stat(targetFile); os.IsNotExist(err) {
			return []models.ServerPlayer{}, nil
		}
	}

	data, err := os.ReadFile(targetFile)
	if err != nil {
		return nil, err
	}

	var entries []AllowlistEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return []models.ServerPlayer{}, nil
	}

	result := make([]models.ServerPlayer, 0, len(entries))
	for _, e := range entries {
		result = append(result, models.ServerPlayer{
			Name:          e.Name,
			XUID:          e.XUID,
			IsWhitelisted: true,
			IgnoresLimit:  e.IgnoresPlayerLimit,
			Permission:    models.PermissionMember,
		})
	}
	return result, nil
}

// AddAllowlistPlayer adds a player to allowlist.json
func (pm *PlayerManager) AddAllowlistPlayer(serverPath, name, xuid string, ignoresLimit bool) error {
	filePath := filepath.Join(serverPath, "allowlist.json")
	var entries []AllowlistEntry

	if data, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(data, &entries)
	}

	// Check if already present
	for i, e := range entries {
		if (xuid != "" && e.XUID == xuid) || (name != "" && strings.EqualFold(e.Name, name)) {
			entries[i].Name = name
			if xuid != "" {
				entries[i].XUID = xuid
			}
			entries[i].IgnoresPlayerLimit = ignoresLimit
			data, _ := json.MarshalIndent(entries, "", "  ")
			return os.WriteFile(filePath, data, 0644)
		}
	}

	entries = append(entries, AllowlistEntry{
		Name:               name,
		XUID:               xuid,
		IgnoresPlayerLimit: ignoresLimit,
	})

	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// RemoveAllowlistPlayer removes player from allowlist.json
func (pm *PlayerManager) RemoveAllowlistPlayer(serverPath, target string) error {
	filePath := filepath.Join(serverPath, "allowlist.json")
	var entries []AllowlistEntry

	if data, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(data, &entries)
	}

	filtered := make([]AllowlistEntry, 0, len(entries))
	for _, e := range entries {
		if e.XUID != target && !strings.EqualFold(e.Name, target) {
			filtered = append(filtered, e)
		}
	}

	data, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// ToggleAllowlist updates allow-list in server.properties
func (pm *PlayerManager) ToggleAllowlist(serverPath string, enabled bool) error {
	props, err := server.LoadProperties(serverPath)
	if err != nil {
		return err
	}
	if enabled {
		props.Set("allow-list", "true")
	} else {
		props.Set("allow-list", "false")
	}
	return props.Save()
}

// GetBannedPlayers reads banned-players.json
func (pm *PlayerManager) GetBannedPlayers(serverPath string) ([]models.BanEntry, error) {
	filePath := filepath.Join(serverPath, "banned-players.json")
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return make([]models.BanEntry, 0), nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return make([]models.BanEntry, 0), err
	}

	entries := make([]models.BanEntry, 0)
	if err := json.Unmarshal(data, &entries); err != nil {
		return make([]models.BanEntry, 0), nil
	}
	return entries, nil
}

// BanPlayer adds an entry to banned-players.json
func (pm *PlayerManager) BanPlayer(serverPath, name, xuid, reason, bannedBy string) error {
	filePath := filepath.Join(serverPath, "banned-players.json")
	var entries []models.BanEntry

	if data, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(data, &entries)
	}

	if reason == "" {
		reason = "Banned by server administrator"
	}
	if bannedBy == "" {
		bannedBy = "Admin"
	}

	// Remove duplicate if already banned
	filtered := make([]models.BanEntry, 0, len(entries)+1)
	for _, e := range entries {
		if (xuid != "" && e.XUID == xuid) || (name != "" && strings.EqualFold(e.Name, name)) {
			continue
		}
		filtered = append(filtered, e)
	}

	filtered = append(filtered, models.BanEntry{
		Name:     name,
		XUID:     xuid,
		Reason:   reason,
		BannedAt: time.Now(),
		BannedBy: bannedBy,
	})

	data, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// UnbanPlayer removes entry from banned-players.json
func (pm *PlayerManager) UnbanPlayer(serverPath, target string) error {
	filePath := filepath.Join(serverPath, "banned-players.json")
	var entries []models.BanEntry

	if data, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(data, &entries)
	}

	filtered := make([]models.BanEntry, 0, len(entries))
	for _, e := range entries {
		if e.XUID != target && !strings.EqualFold(e.Name, target) {
			filtered = append(filtered, e)
		}
	}

	data, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}
