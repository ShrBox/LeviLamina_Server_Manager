package mods

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"levilamina-server-manager/backend/models"
)

type ModManager struct{}

func NewModManager() *ModManager {
	return &ModManager{}
}

type LeviPluginManifest struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Description string   `json:"description"`
	Author      string   `json:"author"`
	Entry       string   `json:"entry"`
	Type        string   `json:"type"`
	DependsOn   []string `json:"dependson"`
	Dependencies []string `json:"dependencies"`
}

type LipTooth struct {
	Tooth       string   `json:"tooth"`
	Version     string   `json:"version"`
	Name        string   `json:"name"`
	Author      string   `json:"author"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

// ListMods scans plugins/ folder in the server
func (mm *ModManager) ListMods(serverPath string) ([]models.Mod, error) {
	pluginsDir := filepath.Join(serverPath, "plugins")
	if _, err := os.Stat(pluginsDir); os.IsNotExist(err) {
		return []models.Mod{}, nil
	}

	entries, err := os.ReadDir(pluginsDir)
	if err != nil {
		return []models.Mod{}, fmt.Errorf("failed to read plugins directory: %w", err)
	}

	// 1. Parse tooth_lock.json if present to extract required LeviLamina loader version for each mod
	lockMap := make(map[string]string) // name/slug -> required LeviLamina version
	lockFile := filepath.Join(serverPath, "tooth_lock.json")
	if lockData, lockErr := os.ReadFile(lockFile); lockErr == nil {
		var lock struct {
			Packages []struct {
				Files    []string `json:"files"`
				Manifest struct {
					Tooth   string `json:"tooth"`
					Version string `json:"version"`
					Info    struct {
						Name string `json:"name"`
					} `json:"info"`
					Variants []struct {
						Dependencies map[string]string `json:"dependencies"`
					} `json:"variants"`
				} `json:"manifest"`
			} `json:"packages"`
		}
		if json.Unmarshal(lockData, &lock) == nil {
			for _, pkg := range lock.Packages {
				var reqLL string
				for _, variant := range pkg.Manifest.Variants {
					if req, hasLL := variant.Dependencies["github.com/LiteLDev/LeviLamina"]; hasLL {
						reqLL = req
						break
					}
				}
				if reqLL != "" {
					if pkg.Manifest.Info.Name != "" {
						lockMap[strings.ToLower(pkg.Manifest.Info.Name)] = reqLL
					}
					toothSlug := filepath.Base(pkg.Manifest.Tooth)
					if toothSlug != "" {
						lockMap[strings.ToLower(toothSlug)] = reqLL
					}
				}
			}
		}
	}

	mods := make([]models.Mod, 0)

	for _, e := range entries {
		entryName := e.Name()
		fullPath := filepath.Join(pluginsDir, entryName)

		// Check if enabled or disabled
		isEnabled := !strings.HasSuffix(entryName, ".disabled")
		baseName := strings.TrimSuffix(entryName, ".disabled")

		if e.IsDir() {
			mod := models.Mod{
				Name:         baseName,
				Path:         fullPath,
				Enabled:      isEnabled,
				Dependencies: make([]string, 0),
			}

			// Try manifest.json
			manifestFile := filepath.Join(fullPath, "manifest.json")
			if data, err := os.ReadFile(manifestFile); err == nil {
				var pm LeviPluginManifest
				if err := json.Unmarshal(data, &pm); err == nil {
					if pm.Name != "" {
						mod.Name = pm.Name
					}
					mod.Version = pm.Version
					mod.Author = pm.Author
					mod.Description = pm.Description
					if len(pm.DependsOn) > 0 {
						mod.Dependencies = append(mod.Dependencies, pm.DependsOn...)
					}
					if len(pm.Dependencies) > 0 {
						mod.Dependencies = append(mod.Dependencies, pm.Dependencies...)
					}
				}
			}

			// Try tooth.json (LIP metadata)
			toothFile := filepath.Join(fullPath, "tooth.json")
			if data, err := os.ReadFile(toothFile); err == nil {
				mod.IsLIPPackage = true
				mod.ToothPath = toothFile
				var tooth LipTooth
				if err := json.Unmarshal(data, &tooth); err == nil {
					if mod.Author == "" {
						mod.Author = tooth.Author
					}
					if mod.Description == "" {
						mod.Description = tooth.Description
					}
					if mod.Version == "" {
						mod.Version = tooth.Version
					}
				}
			}

			// Look for configuration file
			possibleConfigs := []string{
				filepath.Join(fullPath, "config.json"),
				filepath.Join(fullPath, "settings.json"),
				filepath.Join(serverPath, "plugins", baseName+".json"),
			}
			for _, cfg := range possibleConfigs {
				if _, err := os.Stat(cfg); err == nil {
					mod.ConfigPath = cfg
					break
				}
			}

			// Check required LeviLamina version from lock map
			if reqLL, ok := lockMap[strings.ToLower(mod.Name)]; ok {
				mod.LeviLaminaVersion = reqLL
			} else if reqLL, ok := lockMap[strings.ToLower(baseName)]; ok {
				mod.LeviLaminaVersion = reqLL
			}

			mods = append(mods, mod)
		} else if strings.EqualFold(filepath.Ext(baseName), ".dll") {
			// Standalone DLL plugin
			modName := strings.TrimSuffix(baseName, filepath.Ext(baseName))
			mod := models.Mod{
				Name:         modName,
				Path:         fullPath,
				Enabled:      isEnabled,
				Version:      "1.0.0",
				Dependencies: make([]string, 0),
			}
			if reqLL, ok := lockMap[strings.ToLower(modName)]; ok {
				mod.LeviLaminaVersion = reqLL
			}
			mods = append(mods, mod)
		}
	}

	return mods, nil
}

// EnableMod toggles a mod to enabled by stripping .disabled suffix
func (mm *ModManager) EnableMod(modPath string) (string, error) {
	if !strings.HasSuffix(modPath, ".disabled") {
		return modPath, nil
	}
	target := strings.TrimSuffix(modPath, ".disabled")
	if err := os.Rename(modPath, target); err != nil {
		return "", fmt.Errorf("failed to enable mod: %w", err)
	}
	return target, nil
}

// DisableMod renames mod folder or file with .disabled suffix
func (mm *ModManager) DisableMod(modPath string) (string, error) {
	if strings.HasSuffix(modPath, ".disabled") {
		return modPath, nil
	}
	target := modPath + ".disabled"
	if err := os.Rename(modPath, target); err != nil {
		return "", fmt.Errorf("failed to disable mod: %w", err)
	}
	return target, nil
}

// RemoveMod permanently deletes a mod
func (mm *ModManager) RemoveMod(modPath string) error {
	return os.RemoveAll(modPath)
}

// ReadModConfig reads the JSON configuration of a mod
func (mm *ModManager) ReadModConfig(configPath string) (map[string]any, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	var res map[string]any
	if err := json.Unmarshal(data, &res); err != nil {
		return nil, err
	}
	return res, nil
}

// WriteModConfig safely saves mod configuration
func (mm *ModManager) WriteModConfig(configPath string, cfg map[string]any) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, data, 0644)
}
