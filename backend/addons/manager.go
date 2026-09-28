package addons

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"levilamina-server-manager/backend/models"
)

type AddonManager struct {
	analyzer  *AddonAnalyzer
	installer *AddonInstaller
}

func NewAddonManager() *AddonManager {
	return &AddonManager{
		analyzer:  NewAddonAnalyzer(),
		installer: NewAddonInstaller(),
	}
}

// ListInstalledAddons scans server's behavior_packs and resource_packs and matches with world registrations
func (am *AddonManager) ListInstalledAddons(serverPath string) ([]models.Addon, error) {
	addonsMap := make(map[string]*models.Addon)

	bpRoot := filepath.Join(serverPath, "behavior_packs")
	rpRoot := filepath.Join(serverPath, "resource_packs")

	// Scan Behavior Packs first
	am.scanPacksDir(bpRoot, models.AddonTypeBehavior, addonsMap)
	// Scan Resource Packs and link to matching behavior packs
	am.scanPacksDir(rpRoot, models.AddonTypeResource, addonsMap)

	// Scan Worlds to check pack assignment
	worldsRoot := filepath.Join(serverPath, "worlds")
	worldEntries, err := os.ReadDir(worldsRoot)
	if err == nil {
		for _, w := range worldEntries {
			if !w.IsDir() {
				continue
			}
			folderName := w.Name()
			levelName := folderName
			if data, err := os.ReadFile(filepath.Join(worldsRoot, folderName, "levelname.txt")); err == nil {
				t := strings.TrimSpace(string(data))
				if t != "" {
					levelName = t
				}
			}

			// Check world_behavior_packs.json
			bpFile := filepath.Join(worldsRoot, folderName, "world_behavior_packs.json")
			if data, err := os.ReadFile(bpFile); err == nil {
				var recs []models.WorldPackRecord
				if json.Unmarshal(data, &recs) == nil {
					for _, r := range recs {
						for _, addon := range addonsMap {
							if strings.EqualFold(addon.UUID, r.PackID) ||
								(addon.BehaviorUUID != "" && strings.EqualFold(addon.BehaviorUUID, r.PackID)) ||
								(addon.ResourceUUID != "" && strings.EqualFold(addon.ResourceUUID, r.PackID)) {
								if !containsString(addon.AssignedWorlds, folderName) {
									addon.AssignedWorlds = append(addon.AssignedWorlds, folderName)
								}
								if levelName != folderName && !containsString(addon.AssignedWorlds, levelName) {
									addon.AssignedWorlds = append(addon.AssignedWorlds, levelName)
								}
								addon.Enabled = true
							}
						}
					}
				}
			}

			// Check world_resource_packs.json
			rpFile := filepath.Join(worldsRoot, folderName, "world_resource_packs.json")
			if data, err := os.ReadFile(rpFile); err == nil {
				var recs []models.WorldPackRecord
				if json.Unmarshal(data, &recs) == nil {
					for _, r := range recs {
						for _, addon := range addonsMap {
							if strings.EqualFold(addon.UUID, r.PackID) ||
								(addon.BehaviorUUID != "" && strings.EqualFold(addon.BehaviorUUID, r.PackID)) ||
								(addon.ResourceUUID != "" && strings.EqualFold(addon.ResourceUUID, r.PackID)) {
								if !containsString(addon.AssignedWorlds, folderName) {
									addon.AssignedWorlds = append(addon.AssignedWorlds, folderName)
								}
								if levelName != folderName && !containsString(addon.AssignedWorlds, levelName) {
									addon.AssignedWorlds = append(addon.AssignedWorlds, levelName)
								}
								addon.Enabled = true
							}
						}
					}
				}
			}

			// Also check physical embedded pack directories in world
			for _, packType := range []string{"behavior_packs", "resource_packs"} {
				wPackDir := filepath.Join(worldsRoot, folderName, packType)
				pType := models.AddonTypeBehavior
				if packType == "resource_packs" {
					pType = models.AddonTypeResource
				}
				if entries, err := os.ReadDir(wPackDir); err == nil {
					for _, e := range entries {
						if !e.IsDir() {
							continue
						}
						packFolder := filepath.Join(wPackDir, e.Name())
						mPath := filepath.Join(packFolder, "manifest.json")
						if mData, err := os.ReadFile(mPath); err == nil {
							am.processSinglePack(packFolder, e.Name(), mData, pType, addonsMap)
							var mf RawManifest
							if json.Unmarshal(mData, &mf) == nil && mf.Header.UUID != "" {
								for _, addon := range addonsMap {
									if strings.EqualFold(addon.UUID, mf.Header.UUID) ||
										strings.EqualFold(addon.BehaviorUUID, mf.Header.UUID) ||
										strings.EqualFold(addon.ResourceUUID, mf.Header.UUID) {
										if !containsString(addon.AssignedWorlds, folderName) {
											addon.AssignedWorlds = append(addon.AssignedWorlds, folderName)
										}
										if levelName != folderName && !containsString(addon.AssignedWorlds, levelName) {
											addon.AssignedWorlds = append(addon.AssignedWorlds, levelName)
										}
										addon.Enabled = true
									}
								}
							}
						}
					}
				}
			}
		}
	}

	result := make([]models.Addon, 0, len(addonsMap))
	for _, a := range addonsMap {
		folder := filepath.Base(a.Path)
		if isVanillaInternalPack(folder, a.Name, a.UUID) ||
			isVanillaInternalPack(folder, a.Name, a.BehaviorUUID) ||
			isVanillaInternalPack(folder, a.Name, a.ResourceUUID) {
			continue
		}
		result = append(result, *a)
	}

	return result, nil
}

func (am *AddonManager) scanPacksDir(dir string, pType models.AddonType, addonsMap map[string]*models.Addon) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		packPath := filepath.Join(dir, e.Name())
		manifestPath := filepath.Join(packPath, "manifest.json")

		data, err := os.ReadFile(manifestPath)
		if err != nil {
			// Check if manifest.json is inside immediate subdirectories (e.g. wrapper directories)
			subEntries, sErr := os.ReadDir(packPath)
			if sErr == nil {
				for _, se := range subEntries {
					if se.IsDir() {
						subPackPath := filepath.Join(packPath, se.Name())
						subManifest := filepath.Join(subPackPath, "manifest.json")
						if sData, err := os.ReadFile(subManifest); err == nil {
							am.processSinglePack(subPackPath, se.Name(), sData, pType, addonsMap)
						}
					}
				}
			}
			continue
		}

		am.processSinglePack(packPath, e.Name(), data, pType, addonsMap)
	}
}

func (am *AddonManager) processSinglePack(packPath, folderName string, data []byte, pType models.AddonType, addonsMap map[string]*models.Addon) {
	m, err := ParseManifestBytes(data)
	if err != nil {
		return
	}

	uuid := m.Header.UUID
	verInts, verStr := ParseVersion(m.Header.Version)
	_, minEngStr := ParseVersion(m.Header.MinEngineVersion)
	packName := resolvePackDisplayName(packPath, m.Header.Name)
	packDesc := resolvePackDescription(packPath, m.Header.Description)

	// Strictly exclude skin packs (character skins, not gameplay add-ons)
	for _, mod := range m.Modules {
		modType := strings.ToLower(mod.Type)
		if modType == "skin_pack" || strings.Contains(modType, "skin") {
			return
		}
	}
	if _, err := os.Stat(filepath.Join(packPath, "skins.json")); err == nil {
		return
	}

	// Filter out BDS built-in internal vanilla pack folders and editor addons
	if isVanillaInternalPack(folderName, packName, uuid) {
		return
	}

	// Search for an existing addon to merge (by UUID, dependency, folder name, or display name)
	var existing *models.Addon
	if a, ok := addonsMap[uuid]; ok {
		existing = a
	} else {
		for _, a := range addonsMap {
			// Match by dependency pointing to the other pack
			for _, dep := range m.Dependencies {
				if dep.UUID != "" && (strings.EqualFold(dep.UUID, a.UUID) || strings.EqualFold(dep.UUID, a.BehaviorUUID) || strings.EqualFold(dep.UUID, a.ResourceUUID)) {
					existing = a
					break
				}
			}
			if existing != nil {
				break
			}
			// Match by reverse dependency
			for _, dep := range a.Dependencies {
				if dep.UUID != "" && strings.EqualFold(dep.UUID, uuid) {
					existing = a
					break
				}
			}
			if existing != nil {
				break
			}
			// Match by identical base folder name (e.g. "packname" or "Physics_Pro")
			baseA := strings.TrimSuffix(strings.TrimSuffix(filepath.Base(a.Path), "_bp"), "_rp")
			baseB := strings.TrimSuffix(strings.TrimSuffix(folderName, "_bp"), "_rp")
			if baseA != "" && baseB != "" && strings.EqualFold(baseA, baseB) {
				existing = a
				break
			}
			// Match by resolved non-empty display name
			if packName != "" && !strings.HasPrefix(strings.ToLower(packName), "pack.") && strings.EqualFold(a.Name, packName) {
				existing = a
				break
			}
		}
	}

	if existing != nil {
		// Merge into existing combined addon
		if pType == models.AddonTypeBehavior {
			existing.HasBehaviorPack = true
			existing.BehaviorUUID = uuid
			existing.BehaviorVersion = verInts
		} else {
			existing.HasResourcePack = true
			existing.ResourceUUID = uuid
			existing.ResourceVersion = verInts
		}
		existing.Type = models.AddonTypeCombined
		if existing.Name == "" || strings.HasPrefix(strings.ToLower(existing.Name), "pack.") {
			existing.Name = packName
		}
		if existing.Description == "" && packDesc != "" {
			existing.Description = packDesc
		}
		for _, mod := range m.Modules {
			if mod.Type == "script" {
				existing.HasScript = true
				break
			}
		}
	} else {
		hasScript := false
		for _, mod := range m.Modules {
			if mod.Type == "script" {
				hasScript = true
				break
			}
		}

		deps := make([]models.PackDependency, len(m.Dependencies))
		for i, d := range m.Dependencies {
			deps[i] = models.PackDependency{
				UUID:       d.UUID,
				ModuleName: d.ModuleName,
				Version:    d.Version,
			}
		}

		newAddon := &models.Addon{
			ID:               uuid,
			Name:             packName,
			Description:      packDesc,
			Version:          verStr,
			UUID:             uuid,
			Type:             pType,
			HasBehaviorPack:  pType == models.AddonTypeBehavior,
			HasResourcePack:  pType == models.AddonTypeResource,
			HasScript:        hasScript,
			MinEngineVersion: minEngStr,
			Modules:          ConvertModules(m.Modules),
			Dependencies:     deps,
			AssignedWorlds:   make([]string, 0),
			Path:             packPath,
		}
		if pType == models.AddonTypeBehavior {
			newAddon.BehaviorUUID = uuid
			newAddon.BehaviorVersion = verInts
		} else {
			newAddon.ResourceUUID = uuid
			newAddon.ResourceVersion = verInts
		}

		addonsMap[uuid] = newAddon
	}
}

func containsString(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

func isVanillaInternalPack(folderName, packName, packUUID string) bool {
	f := strings.ToLower(strings.TrimSpace(folderName))
	p := strings.ToLower(strings.TrimSpace(packName))
	u := strings.ToLower(strings.TrimSpace(packUUID))

	// Exclude all skin packs (character skins, not gameplay add-ons)
	if strings.Contains(f, "skinpack") || strings.Contains(f, "skin_pack") || strings.Contains(f, "skin pack") || strings.HasSuffix(f, "skins") ||
		strings.Contains(p, "skinpack") || strings.Contains(p, "skin_pack") || strings.Contains(p, "skin pack") || strings.HasSuffix(p, "skin") {
		return true
	}

	// Match folder name
	if f == "editor" || strings.HasPrefix(f, "editor_") || strings.HasPrefix(f, "editor") ||
		f == "vanilla" || strings.HasPrefix(f, "vanilla_") || strings.HasPrefix(f, "vanilla") ||
		strings.HasPrefix(f, "chemistry") ||
		strings.HasPrefix(f, "experimental") ||
		strings.HasPrefix(f, "server_") {
		return true
	}

	// Match pack display / manifest name
	if p == "editor" || strings.HasPrefix(p, "editor ") || p == "editor client resources" ||
		strings.HasPrefix(p, "editor client") ||
		p == "vanilla" || strings.HasPrefix(p, "vanilla ") ||
		strings.HasPrefix(p, "chemistry") {
		return true
	}

	// Known Mojang BDS internal pack UUID prefixes
	// 3222066e-a740-410a-b31c-343d22b64d0d (Editor BP/RP)
	// 9fa442fa-68ab-4008-8e6f-40c4adfb1016 (Editor resources)
	// 0663ee00-47be-43c9-94b1-e23a31525b6a (Chemistry / Education)
	if strings.HasPrefix(u, "3222066e") || strings.HasPrefix(u, "9fa442fa") || strings.HasPrefix(u, "0663ee00") {
		return true
	}

	return false
}

func cleanMinecraftFormatting(text string) string {
	if idx := strings.Index(text, "\t"); idx != -1 {
		text = text[:idx]
	}
	if idx := strings.Index(text, "##"); idx != -1 {
		text = text[:idx]
	}
	text = strings.TrimSpace(text)
	reg := regexp.MustCompile(`§[0-9a-fk-or]`)
	text = reg.ReplaceAllString(text, "")
	return strings.TrimSpace(text)
}

func resolvePackDisplayName(packPath, rawName string) string {
	rawName = strings.TrimSpace(rawName)
	if rawName != "" && !strings.HasPrefix(strings.ToLower(rawName), "pack.") && !strings.HasPrefix(strings.ToLower(rawName), "resourcepack.") && !strings.HasPrefix(strings.ToLower(rawName), "behaviorpack.") {
		return cleanMinecraftFormatting(rawName)
	}

	langPath := filepath.Join(packPath, "texts", "en_US.lang")
	if data, err := os.ReadFile(langPath); err == nil {
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "##") || strings.HasPrefix(line, "//") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				if strings.EqualFold(k, "pack.name") || (rawName != "" && strings.EqualFold(k, rawName)) {
					cleaned := cleanMinecraftFormatting(v)
					if cleaned != "" {
						return cleaned
					}
				}
			}
		}
	}

	folderBase := filepath.Base(packPath)
	cleaned := strings.ReplaceAll(strings.ReplaceAll(folderBase, "_", " "), "-", " ")
	return cleanMinecraftFormatting(cleaned)
}

func resolvePackDescription(packPath, rawDesc string) string {
	rawDesc = strings.TrimSpace(rawDesc)
	if rawDesc != "" && !strings.HasPrefix(strings.ToLower(rawDesc), "pack.") && !strings.HasPrefix(strings.ToLower(rawDesc), "resourcepack.") && !strings.HasPrefix(strings.ToLower(rawDesc), "behaviorpack.") {
		return cleanMinecraftFormatting(rawDesc)
	}

	langPath := filepath.Join(packPath, "texts", "en_US.lang")
	if data, err := os.ReadFile(langPath); err == nil {
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "##") || strings.HasPrefix(line, "//") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				if strings.EqualFold(k, "pack.description") || (rawDesc != "" && strings.EqualFold(k, rawDesc)) {
					cleaned := cleanMinecraftFormatting(v)
					if cleaned != "" {
						return cleaned
					}
				}
			}
		}
	}

	return ""
}

// UninstallAddon completely removes an addon from server directories and all world registrations
func (am *AddonManager) UninstallAddon(serverPath, addonUUID string) error {
	addons, err := am.ListInstalledAddons(serverPath)
	if err != nil {
		return err
	}

	var target *models.Addon
	for _, a := range addons {
		if strings.EqualFold(a.UUID, addonUUID) ||
			strings.EqualFold(a.BehaviorUUID, addonUUID) ||
			strings.EqualFold(a.ResourceUUID, addonUUID) ||
			strings.EqualFold(a.ID, addonUUID) {
			target = &a
			break
		}
	}

	uuidsToRemove := []string{addonUUID}
	if target != nil {
		if target.UUID != "" && !containsString(uuidsToRemove, target.UUID) {
			uuidsToRemove = append(uuidsToRemove, target.UUID)
		}
		if target.BehaviorUUID != "" && !containsString(uuidsToRemove, target.BehaviorUUID) {
			uuidsToRemove = append(uuidsToRemove, target.BehaviorUUID)
		}
		if target.ResourceUUID != "" && !containsString(uuidsToRemove, target.ResourceUUID) {
			uuidsToRemove = append(uuidsToRemove, target.ResourceUUID)
		}
	}

	// 1. Clean up world registrations in all worlds
	worldsRoot := filepath.Join(serverPath, "worlds")
	if worldEntries, err := os.ReadDir(worldsRoot); err == nil {
		for _, w := range worldEntries {
			if !w.IsDir() {
				continue
			}
			folderName := w.Name()
			for _, u := range uuidsToRemove {
				_ = am.installer.UnregisterWorldPack(serverPath, folderName, "behavior", u)
				_ = am.installer.UnregisterWorldPack(serverPath, folderName, "resource", u)
			}
		}
	}

	// 2. Remove physical pack folders from behavior_packs and resource_packs
	for _, pDir := range []string{filepath.Join(serverPath, "behavior_packs"), filepath.Join(serverPath, "resource_packs")} {
		entries, err := os.ReadDir(pDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			subPath := filepath.Join(pDir, e.Name())
			mPath := filepath.Join(subPath, "manifest.json")
			if data, err := os.ReadFile(mPath); err == nil {
				var mf RawManifest
				if json.Unmarshal(data, &mf) == nil {
					for _, u := range uuidsToRemove {
						if strings.EqualFold(mf.Header.UUID, u) {
							_ = os.RemoveAll(subPath)
							break
						}
					}
				}
			}
		}
	}

	// 3. Remove physical path if defined on target
	if target != nil && target.Path != "" {
		_ = os.RemoveAll(target.Path)
	}

	// 4. Sync valid_known_packs.json
	_ = am.installer.SyncValidKnownPacks(serverPath)

	return nil
}

// ExportAddon packages an installed addon into a standalone .mcaddon or .mcpack archive
func (am *AddonManager) ExportAddon(serverPath, addonUUID, destDir string) (string, error) {
	addons, err := am.ListInstalledAddons(serverPath)
	if err != nil {
		return "", err
	}

	var target *models.Addon
	for _, a := range addons {
		if strings.EqualFold(a.UUID, addonUUID) ||
			strings.EqualFold(a.BehaviorUUID, addonUUID) ||
			strings.EqualFold(a.ResourceUUID, addonUUID) ||
			strings.EqualFold(a.ID, addonUUID) {
			target = &a
			break
		}
	}
	if target == nil {
		return "", fmt.Errorf("addon with UUID %s not found", addonUUID)
	}

	// If destDir is empty, default to user's Downloads folder
	if strings.TrimSpace(destDir) == "" {
		if home, err := os.UserHomeDir(); err == nil {
			destDir = filepath.Join(home, "Downloads")
		}
	}
	_ = os.MkdirAll(destDir, 0755)

	safeName := sanitizeFolderName(target.Name)
	if safeName == "" {
		safeName = "Addon_" + target.UUID
		if len(safeName) > 14 {
			safeName = safeName[:14]
		}
	}

	bpRoot := filepath.Join(serverPath, "behavior_packs")
	rpRoot := filepath.Join(serverPath, "resource_packs")

	var bpDir, rpDir string
	if target.HasBehaviorPack {
		bpDir = findPackDirByUUID(bpRoot, target.BehaviorUUID, target.UUID)
	}
	if target.HasResourcePack {
		rpDir = findPackDirByUUID(rpRoot, target.ResourceUUID, target.UUID)
	}

	if bpDir == "" && rpDir == "" && target.Path != "" {
		if strings.Contains(strings.ToLower(target.Path), "behavior_packs") {
			bpDir = target.Path
		} else {
			rpDir = target.Path
		}
	}

	var outFilePath string
	if bpDir != "" && rpDir != "" {
		// Both BP and RP -> generate complete .mcaddon
		outFilePath = filepath.Join(destDir, fmt.Sprintf("%s.mcaddon", safeName))
		outFile, err := os.Create(outFilePath)
		if err != nil {
			return "", err
		}
		defer outFile.Close()

		zw := zip.NewWriter(outFile)

		// Pack BP
		bpZipBuf := new(bytes.Buffer)
		bpZw := zip.NewWriter(bpZipBuf)
		if err := addDirToZip(bpZw, bpDir, ""); err != nil {
			_ = zw.Close()
			return "", err
		}
		_ = bpZw.Close()

		wBP, err := zw.Create(fmt.Sprintf("%s_BP.mcpack", safeName))
		if err != nil {
			_ = zw.Close()
			return "", err
		}
		if _, err := io.Copy(wBP, bpZipBuf); err != nil {
			_ = zw.Close()
			return "", err
		}

		// Pack RP
		rpZipBuf := new(bytes.Buffer)
		rpZw := zip.NewWriter(rpZipBuf)
		if err := addDirToZip(rpZw, rpDir, ""); err != nil {
			_ = zw.Close()
			return "", err
		}
		_ = rpZw.Close()

		wRP, err := zw.Create(fmt.Sprintf("%s_RP.mcpack", safeName))
		if err != nil {
			_ = zw.Close()
			return "", err
		}
		if _, err := io.Copy(wRP, rpZipBuf); err != nil {
			_ = zw.Close()
			return "", err
		}

		if err := zw.Close(); err != nil {
			return "", err
		}
	} else {
		// Single pack -> generate .mcpack
		singleDir := bpDir
		suffix := "_BP"
		if singleDir == "" {
			singleDir = rpDir
			suffix = "_RP"
		}
		if singleDir == "" {
			return "", fmt.Errorf("could not locate physical pack directory on server")
		}

		outFilePath = filepath.Join(destDir, fmt.Sprintf("%s%s.mcpack", safeName, suffix))
		outFile, err := os.Create(outFilePath)
		if err != nil {
			return "", err
		}
		defer outFile.Close()

		zw := zip.NewWriter(outFile)
		if err := addDirToZip(zw, singleDir, ""); err != nil {
			_ = zw.Close()
			return "", err
		}
		if err := zw.Close(); err != nil {
			return "", err
		}
	}

	return outFilePath, nil
}

// ToggleAddonForWorld granularly activates or deactivates an addon for a specific world
func (am *AddonManager) ToggleAddonForWorld(serverPath, worldName, addonUUID string, enable bool) error {
	addons, err := am.ListInstalledAddons(serverPath)
	if err != nil {
		return err
	}

	var target *models.Addon
	for _, a := range addons {
		if strings.EqualFold(a.UUID, addonUUID) ||
			strings.EqualFold(a.BehaviorUUID, addonUUID) ||
			strings.EqualFold(a.ResourceUUID, addonUUID) ||
			strings.EqualFold(a.ID, addonUUID) {
			target = &a
			break
		}
	}
	if target == nil {
		return fmt.Errorf("addon not found")
	}

	if enable {
		if target.HasBehaviorPack {
			targetUUID := target.BehaviorUUID
			if targetUUID == "" {
				targetUUID = target.UUID
			}
			ver := target.BehaviorVersion
			if len(ver) == 0 {
				ver = []int{1, 0, 0}
			}
			if err := am.installer.RegisterWorldPack(serverPath, worldName, "behavior", targetUUID, ver); err != nil {
				return err
			}
		}
		if target.HasResourcePack {
			targetUUID := target.ResourceUUID
			if targetUUID == "" {
				targetUUID = target.UUID
			}
			ver := target.ResourceVersion
			if len(ver) == 0 {
				ver = []int{1, 0, 0}
			}
			if err := am.installer.RegisterWorldPack(serverPath, worldName, "resource", targetUUID, ver); err != nil {
				return err
			}
		}
	} else {
		uuids := []string{target.UUID}
		if target.BehaviorUUID != "" {
			uuids = append(uuids, target.BehaviorUUID)
		}
		if target.ResourceUUID != "" {
			uuids = append(uuids, target.ResourceUUID)
		}
		for _, u := range uuids {
			_ = am.installer.UnregisterWorldPack(serverPath, worldName, "behavior", u)
			_ = am.installer.UnregisterWorldPack(serverPath, worldName, "resource", u)
		}
	}
	return nil
}

func findPackDirByUUID(root string, uuids ...string) string {
	entries, err := os.ReadDir(root)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		candidate := filepath.Join(root, e.Name())
		mPath := filepath.Join(candidate, "manifest.json")
		if data, err := os.ReadFile(mPath); err == nil {
			var mf RawManifest
			if json.Unmarshal(data, &mf) == nil {
				for _, u := range uuids {
					if u != "" && strings.EqualFold(mf.Header.UUID, u) {
						return candidate
					}
				}
			}
		}
	}
	return ""
}

func addDirToZip(zw *zip.Writer, srcDir, prefix string) error {
	return filepath.Walk(srcDir, func(p string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, p)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		zipPath := filepath.ToSlash(filepath.Join(prefix, rel))
		if fi.IsDir() {
			zipPath += "/"
			_, err = zw.Create(zipPath)
			return err
		}

		w, err := zw.Create(zipPath)
		if err != nil {
			return err
		}
		f, err := os.Open(p)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(w, f)
		return err
	})
}

