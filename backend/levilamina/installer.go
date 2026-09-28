// Package levilamina manages the lifecycle, version detection, and installation
// of the LeviLamina modloader framework for Bedrock Dedicated Server.
package levilamina

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"levilamina-server-manager/backend/lip"
)

// LeviLaminaManager coordinates LeviLamina detection and package manager commands.
type LeviLaminaManager struct {
	lipClient *lip.LipClient
}

// NewLeviLaminaManager initializes a LeviLaminaManager backed by the provided lip client.
func NewLeviLaminaManager(lipClient *lip.LipClient) *LeviLaminaManager {
	return &LeviLaminaManager{
		lipClient: lipClient,
	}
}

// IsInstalled checks if the modified server loader binary (bedrock_server_mod.exe)
// or tooth_lock.json exists in the target server directory.
func (lm *LeviLaminaManager) IsInstalled(serverPath string) bool {
	modExe := filepath.Join(serverPath, "bedrock_server_mod.exe")
	if _, err := os.Stat(modExe); err == nil {
		return true
	}
	lockPath := filepath.Join(serverPath, "tooth_lock.json")
	if _, err := os.Stat(lockPath); err == nil {
		return true
	}
	return false
}

// DetectVersion tries to detect LeviLamina version from tooth_lock.json, manifest, or server files
func (lm *LeviLaminaManager) DetectVersion(serverPath string) string {
	// 1. Check plugins/LeviLamina/manifest.json
	manifestPath := filepath.Join(serverPath, "plugins", "LeviLamina", "manifest.json")
	if data, err := os.ReadFile(manifestPath); err == nil {
		var m struct {
			Version string `json:"version"`
		}
		if err := json.Unmarshal(data, &m); err == nil && m.Version != "" {
			return m.Version
		}
	}

	// 2. Check tooth_lock.json (LIP v3 lock file)
	lockPath := filepath.Join(serverPath, "tooth_lock.json")
	if data, err := os.ReadFile(lockPath); err == nil {
		var lock struct {
			Packages []struct {
				Manifest struct {
					Tooth   string `json:"tooth"`
					Version string `json:"version"`
				} `json:"manifest"`
			} `json:"packages"`
		}
		if err := json.Unmarshal(data, &lock); err == nil {
			for _, pkg := range lock.Packages {
				if strings.Contains(strings.ToLower(pkg.Manifest.Tooth), "levilamina") && pkg.Manifest.Version != "" {
					return pkg.Manifest.Version
				}
			}
		}
	}

	// 3. Check legacy tooth.json
	toothFiles := []string{
		filepath.Join(serverPath, "tooth.json"),
		filepath.Join(serverPath, ".lip", "tooth.json"),
	}
	for _, tf := range toothFiles {
		if data, err := os.ReadFile(tf); err == nil {
			str := string(data)
			if strings.Contains(str, "LeviLamina") {
				return "Latest"
			}
		}
	}

	if lm.IsInstalled(serverPath) {
		return "Installed"
	}
	return "Not Installed"
}

// InstallViaLip executes `lip install github.com/LiteLDev/LeviLamina` in server directory
func (lm *LeviLaminaManager) InstallViaLip(ctx context.Context, serverPath string, version string) (*lip.CommandResult, error) {
	pkg := "github.com/LiteLDev/LeviLamina"
	if version != "" && version != "latest" {
		pkg = fmt.Sprintf("%s@%s", pkg, version)
	}
	return lm.lipClient.InstallPackage(ctx, serverPath, pkg)
}
