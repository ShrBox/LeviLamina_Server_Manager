package compatibility

import (
	"fmt"
	"strconv"
	"strings"

	"levilamina-server-manager/backend/models"
)

type CompatibilityEngine struct{}

func NewCompatibilityEngine() *CompatibilityEngine {
	return &CompatibilityEngine{}
}

type FullCompatibilityReport struct {
	MinecraftVersion  string                    `json:"minecraftVersion"`
	LeviLaminaVersion string                    `json:"leviLaminaVersion"`
	TotalItems        int                       `json:"totalItems"`
	CompatibleCount   int                       `json:"compatibleCount"`
	WarningCount      int                       `json:"warningCount"`
	IncompatibleCount int                       `json:"incompatibleCount"`
	UnknownCount      int                       `json:"unknownCount"`
	Items             []models.CompatibilityItem `json:"items"`
}

// CheckCompatibility analyzes server mods and addons against current Minecraft and LeviLamina versions
func (ce *CompatibilityEngine) CheckCompatibility(
	mcVersion string,
	llVersion string,
	installedMods []models.Mod,
	installedAddons []models.Addon,
) *FullCompatibilityReport {
	report := &FullCompatibilityReport{
		MinecraftVersion:  mcVersion,
		LeviLaminaVersion: llVersion,
		Items:             make([]models.CompatibilityItem, 0),
	}

	// 1. Check LeviLamina loader status
	if llVersion == "" || llVersion == "Not Installed" {
		report.Items = append(report.Items, models.CompatibilityItem{
			Name:            "LeviLamina Framework",
			Type:            "CORE",
			Status:          models.CompatWarning,
			Details:         "LeviLamina is not detected. Server will run as standard BDS without mod loader features.",
			RequiredVersion: "Latest",
			CurrentVersion:  "None",
		})
		report.WarningCount++
	} else {
		report.Items = append(report.Items, models.CompatibilityItem{
			Name:            "LeviLamina Framework",
			Type:            "CORE",
			Status:          models.CompatOK,
			Details:         "LeviLamina is installed and active.",
			RequiredVersion: "Any",
			CurrentVersion:  llVersion,
		})
		report.CompatibleCount++
	}

	// 2. Check Mods
	for _, mod := range installedMods {
		status := models.CompatOK
		details := "Compatible with LeviLamina."

		if !mod.Enabled {
			status = models.CompatUnknown
			details = "Mod is currently disabled."
			report.UnknownCount++
		} else if mod.LeviLaminaVersion != "" && llVersion != "Latest" && mod.LeviLaminaVersion != llVersion {
			status = models.CompatWarning
			details = fmt.Sprintf("Built for LeviLamina %s; current version is %s.", mod.LeviLaminaVersion, llVersion)
			report.WarningCount++
		} else {
			report.CompatibleCount++
		}

		report.Items = append(report.Items, models.CompatibilityItem{
			Name:            mod.Name,
			Type:            "MOD",
			Status:          status,
			Details:         details,
			RequiredVersion: mod.LeviLaminaVersion,
			CurrentVersion:  mod.Version,
		})
	}

	// 3. Check Add-Ons
	for _, addon := range installedAddons {
		status := models.CompatOK
		details := "Add-On format and manifests are valid."

		if addon.IsEncrypted {
			status = models.CompatWarning
			details = "Marketplace encrypted content. Internal scripts cannot be verified."
			report.WarningCount++
		} else if addon.MinEngineVersion != "" && mcVersion != "" {
			cmp := compareVersions(addon.MinEngineVersion, mcVersion)
			if cmp > 0 {
				status = models.CompatIncompat
				details = fmt.Sprintf("Requires Minecraft %s or newer, but server is running %s.", addon.MinEngineVersion, mcVersion)
				report.IncompatibleCount++
			} else {
				report.CompatibleCount++
			}
		} else if addon.MinEngineVersion == "" {
			status = models.CompatUnknown
			details = "No minimum engine version specified in manifest. Compatibility unknown."
			report.UnknownCount++
		} else {
			report.CompatibleCount++
		}

		report.Items = append(report.Items, models.CompatibilityItem{
			Name:            addon.Name,
			Type:            "ADDON",
			Status:          status,
			Details:         details,
			RequiredVersion: ">= " + addon.MinEngineVersion,
			CurrentVersion:  addon.Version,
		})
	}

	report.TotalItems = len(report.Items)
	return report
}

// compareVersions returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
func compareVersions(v1, v2 string) int {
	p1 := parseVersionSlice(v1)
	p2 := parseVersionSlice(v2)

	l := len(p1)
	if len(p2) > l {
		l = len(p2)
	}

	for i := 0; i < l; i++ {
		var n1, n2 int
		if i < len(p1) {
			n1 = p1[i]
		}
		if i < len(p2) {
			n2 = p2[i]
		}
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}
	return 0
}

func parseVersionSlice(v string) []int {
	parts := strings.Split(strings.TrimSpace(v), ".")
	res := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			res = append(res, n)
		}
	}
	return res
}
