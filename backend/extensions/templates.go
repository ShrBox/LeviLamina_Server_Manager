package extensions

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// PackManifest represents the minimal structure of a Minecraft Bedrock manifest.json
type PackManifest struct {
	FormatVersion int `json:"format_version"`
	Header        struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		UUID        string `json:"uuid"`
		Version     any    `json:"version"`
	} `json:"header"`
	Modules []struct {
		Type        string `json:"type"`
		UUID        string `json:"uuid"`
		Version     any    `json:"version"`
		Description string `json:"description"`
	} `json:"modules"`
}

// ConvertWorldTemplateToAddon converts a .mctemplate or .mcworld into a standard .mcaddon,
// extracting all behavior and resource packs while strictly excluding skin packs.
func (m *ExtensionManager) ConvertWorldTemplateToAddon(templatePath string) (string, error) {
	if _, err := os.Stat(templatePath); err != nil {
		return "", fmt.Errorf("source template not found: %w", err)
	}

	r, err := zip.OpenReader(templatePath)
	if err != nil {
		return "", fmt.Errorf("failed to open template archive: %w", err)
	}
	defer r.Close()

	// 1. Locate all manifests and determine which are behavior packs or resource packs
	type packInfo struct {
		isBehavior bool
		isResource bool
		baseDir    string // e.g., "behavior_packs/bp0/"
		name       string
	}

	var foundPacks []packInfo

	for _, f := range r.File {
		cleanName := strings.ReplaceAll(f.Name, "\\", "/")
		base := path.Base(cleanName)

		if strings.EqualFold(base, "manifest.json") {
			// Skip skin packs completely
			lowerPath := strings.ToLower(cleanName)
			if strings.Contains(lowerPath, "skin_pack") || strings.Contains(lowerPath, "skinpack") || strings.Contains(lowerPath, "/skins/") {
				continue
			}

			// Read manifest
			rc, err := f.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				continue
			}

			var mf PackManifest
			if err := json.Unmarshal(data, &mf); err != nil {
				continue
			}

			// Strictly exclude skin packs by header name or module type
			lowerHeaderName := strings.ToLower(mf.Header.Name)
			if strings.Contains(lowerHeaderName, "skinpack") || strings.Contains(lowerHeaderName, "skin_pack") || strings.Contains(lowerHeaderName, "skin pack") || strings.Contains(lowerHeaderName, "skins") {
				continue
			}

			isSkin := false
			isBehavior := false
			isResource := false

			for _, mod := range mf.Modules {
				modType := strings.ToLower(mod.Type)
				if modType == "skin_pack" || strings.Contains(modType, "skin") {
					isSkin = true
					break
				}
				if modType == "data" || modType == "script" || modType == "javascript" {
					isBehavior = true
				}
				if modType == "resources" {
					isResource = true
				}
			}

			if isSkin {
				continue // Strictly exclude skin packs
			}

			// Fallback path heuristics if module type wasn't explicit
			if !isBehavior && !isResource {
				if strings.Contains(lowerPath, "behavior_pack") || strings.Contains(lowerPath, "_bp") || strings.Contains(lowerPath, "/bp") {
					isBehavior = true
				} else if strings.Contains(lowerPath, "resource_pack") || strings.Contains(lowerPath, "_rp") || strings.Contains(lowerPath, "/rp") {
					isResource = true
				}
			}

			if isBehavior || isResource {
				packDir := path.Dir(cleanName)
				if !strings.HasSuffix(packDir, "/") && packDir != "." {
					packDir += "/"
				}
				if packDir == "./" {
					packDir = ""
				}

				name := mf.Header.Name
				if name == "" {
					name = path.Base(strings.TrimSuffix(packDir, "/"))
				}

				foundPacks = append(foundPacks, packInfo{
					isBehavior: isBehavior,
					isResource: isResource,
					baseDir:    packDir,
					name:       cleanMinecraftFormatting(name),
				})
			}
		}
	}

	// If no behavior or resource packs found, nothing to convert
	if len(foundPacks) == 0 {
		return templatePath, nil
	}

	// CRITICAL RULE:
	// A World Template is only treated as an Add-On if it contains a Behavior Pack.
	// If it only has a Resource Pack or no packs at all, it represents a dedicated World map
	// and must NOT be converted to an addon.
	hasBehavior := false
	for _, pack := range foundPacks {
		if pack.isBehavior {
			hasBehavior = true
			break
		}
	}
	if !hasBehavior {
		return templatePath, nil
	}

	// 2. Determine target .mcaddon path
	dir := filepath.Dir(templatePath)
	base := filepath.Base(templatePath)
	ext := filepath.Ext(base)
	cleanName := strings.TrimSuffix(base, ext)
	cleanName = strings.ReplaceAll(cleanName, " (world_template)", "")
	cleanName = strings.ReplaceAll(cleanName, " (world)", "")
	cleanName = strings.TrimSpace(cleanName)

	addonPath := filepath.Join(dir, fmt.Sprintf("%s (addon).mcaddon", cleanName))

	outZipFile, err := os.Create(addonPath)
	if err != nil {
		return "", fmt.Errorf("failed to create addon output archive: %w", err)
	}
	defer outZipFile.Close()

	zw := zip.NewWriter(outZipFile)

	// 3. For each pack, create an inner .mcpack inside the .mcaddon
	bpCount := 0
	rpCount := 0

	for _, pack := range foundPacks {
		var packFileName string
		if pack.isBehavior {
			bpCount++
			if bpCount == 1 {
				packFileName = fmt.Sprintf("%s_BP.mcpack", cleanName)
			} else {
				packFileName = fmt.Sprintf("%s_BP_%d.mcpack", cleanName, bpCount)
			}
		} else {
			rpCount++
			if rpCount == 1 {
				packFileName = fmt.Sprintf("%s_RP.mcpack", cleanName)
			} else {
				packFileName = fmt.Sprintf("%s_RP_%d.mcpack", cleanName, rpCount)
			}
		}

		// Create in-memory inner zip
		var innerBuf bytes.Buffer
		innerZw := zip.NewWriter(&innerBuf)

		for _, zf := range r.File {
			cleanF := strings.ReplaceAll(zf.Name, "\\", "/")

			// Exclude skin packs
			lowerF := strings.ToLower(cleanF)
			if strings.Contains(lowerF, "skin_pack") || strings.Contains(lowerF, "skinpack") || strings.Contains(lowerF, "/skins/") {
				continue
			}

			// Check if file belongs to this pack's directory
			if strings.HasPrefix(cleanF, pack.baseDir) {
				relPath := strings.TrimPrefix(cleanF, pack.baseDir)
				if relPath == "" || strings.HasSuffix(relPath, "/") {
					continue
				}

				w, err := innerZw.Create(relPath)
				if err != nil {
					continue
				}
				rc, err := zf.Open()
				if err != nil {
					continue
				}
				_, _ = io.Copy(w, rc)
				rc.Close()
			}
		}

		_ = innerZw.Close()

		// Write inner .mcpack into outer .mcaddon
		w, err := zw.Create(packFileName)
		if err != nil {
			continue
		}
		_, _ = io.Copy(w, &innerBuf)
	}

	if err := zw.Close(); err != nil {
		return "", fmt.Errorf("failed to finalize addon zip: %w", err)
	}

	// 4. Remove original .mctemplate file so it doesn't linger as a whole world
	_ = r.Close()
	_ = os.Remove(templatePath)

	return addonPath, nil
}
