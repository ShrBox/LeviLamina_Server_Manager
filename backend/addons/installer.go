// Package addons handles scanning, validating, and installing Bedrock Add-Ons (.mcpack, .mcaddon).
// It maintains consistency between filesystem pack roots and world pack JSON bindings.
package addons

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/security"
	"levilamina-server-manager/backend/server"
)

// AddonInstaller performs transactional installation of Bedrock Add-Ons
// into server roots and world directories, with automatic rollback on error.
type AddonInstaller struct {
	analyzer *AddonAnalyzer
}

// NewAddonInstaller creates an AddonInstaller instance.
func NewAddonInstaller() *AddonInstaller {
	return &AddonInstaller{
		analyzer: NewAddonAnalyzer(),
	}
}

// InstallOptions specifies installation parameters for an addon archive.
type InstallOptions struct {
	EnableBehavior bool   `json:"enableBehavior"`
	EnableResource bool   `json:"enableResource"`
	TargetWorld    string `json:"targetWorld"`
	CreateBackup   bool   `json:"createBackup"`
}

// InstalledPackResult describes the outcome of an addon installation.
type InstalledPackResult struct {
	Success       bool     `json:"success"`
	PackName      string   `json:"packName"`
	UUID          string   `json:"uuid"`
	InstalledBPs  []string `json:"installedBPs"`
	InstalledRPs  []string `json:"installedRPs"`
	WorldUpdated  bool     `json:"worldUpdated"`
	BackupCreated string   `json:"backupCreated,omitempty"`
	Message       string   `json:"message"`
}

// InstallAddon unpacks an addon archive, copies packs into server roots and
// targeted world directories, and registers pack UUIDs in world_*_packs.json.
// If any stage fails, all filesystem changes are rolled back.
func (ai *AddonInstaller) InstallAddon(serverPath, archivePath string, opts InstallOptions) (*InstalledPackResult, error) {
	// Step 1: Analyze first
	analysis, err := ai.analyzer.AnalyzeArchive(archivePath)
	if err != nil {
		return nil, fmt.Errorf("analysis failed: %w", err)
	}
	if !analysis.Valid {
		return nil, fmt.Errorf("invalid addon archive: %s", strings.Join(analysis.Errors, "; "))
	}

	// Step 2: Create temp extraction dir
	tempDir, err := os.MkdirTemp("", "llsm-addon-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir) // Clean up temp dir

	// Open zip
	archiveFile, err := os.Open(archivePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open archive: %w", err)
	}
	defer archiveFile.Close()

	fi, err := archiveFile.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to stat archive: %w", err)
	}

	zr, err := zip.NewReader(archiveFile, fi.Size())
	if err != nil {
		return nil, fmt.Errorf("failed to read zip: %w", err)
	}

	// Extract to tempDir safely
	if err := security.ExtractZipSafely(zr, tempDir, 1024*1024*1024, false); err != nil {
		return nil, fmt.Errorf("safe extraction failed: %w", err)
	}

	// Tracks files/directories created so we can roll them back if anything fails
	var installedDirs []string
	var backupWorldDir string

	rollback := func(reason error) error {
		// Remove created directories
		for _, d := range installedDirs {
			_ = os.RemoveAll(d)
		}
		// Restore world files if backup created
		if backupWorldDir != "" && opts.TargetWorld != "" {
			actualFolder := ResolveWorldFolder(serverPath, opts.TargetWorld)
			worldDir := filepath.Join(serverPath, "worlds", actualFolder)
			_ = restoreFile(filepath.Join(backupWorldDir, "world_behavior_packs.json"), filepath.Join(worldDir, "world_behavior_packs.json"))
			_ = restoreFile(filepath.Join(backupWorldDir, "world_resource_packs.json"), filepath.Join(worldDir, "world_resource_packs.json"))
			_ = os.RemoveAll(backupWorldDir)
		}
		return fmt.Errorf("installation failed and changes were rolled back: %w", reason)
	}

	// Prepare backup of target world configurations if specified
	var backupPath string
	if opts.TargetWorld != "" {
		actualFolder := ResolveWorldFolder(serverPath, opts.TargetWorld)
		worldDir := filepath.Join(serverPath, "worlds", actualFolder)
		if _, err := os.Stat(worldDir); err == nil {
			backupWorldDir, err = os.MkdirTemp("", "llsm-worldbackup-*")
			if err == nil {
				_ = copyFile(filepath.Join(worldDir, "world_behavior_packs.json"), filepath.Join(backupWorldDir, "world_behavior_packs.json"))
				_ = copyFile(filepath.Join(worldDir, "world_resource_packs.json"), filepath.Join(backupWorldDir, "world_resource_packs.json"))
				backupPath = backupWorldDir
			}
		}
	}

	// Ensure server pack folders exist
	bpRoot := filepath.Join(serverPath, "behavior_packs")
	rpRoot := filepath.Join(serverPath, "resource_packs")
	if err := os.MkdirAll(bpRoot, 0755); err != nil {
		return nil, rollback(err)
	}
	if err := os.MkdirAll(rpRoot, 0755); err != nil {
		return nil, rollback(err)
	}

	result := &InstalledPackResult{
		Success:       false,
		PackName:      analysis.Name,
		UUID:          analysis.UUID,
		InstalledBPs:  make([]string, 0),
		InstalledRPs:  make([]string, 0),
		BackupCreated: backupPath,
	}

	// Process each detected pack
	for _, p := range analysis.DetectedPacks {
		sanitizedName := sanitizeFolderName(p.Name)
		if sanitizedName == "" || strings.EqualFold(sanitizedName, "packname") || strings.EqualFold(sanitizedName, "pack") {
			if analysis.Name != "" && !strings.EqualFold(analysis.Name, "pack.name") {
				sanitizedName = sanitizeFolderName(analysis.Name)
			} else {
				sanitizedName = p.UUID
			}
		}
		if p.Type == models.AddonTypeBehavior {
			sanitizedName = strings.TrimSuffix(sanitizedName, "_bp") + "_bp"
		} else if p.Type == models.AddonTypeResource {
			sanitizedName = strings.TrimSuffix(sanitizedName, "_rp") + "_rp"
		}

		// Look for pack content in tempDir
		var packSrcDir string
		if p.SubPath != "" && p.SubPath != "." {
			packSrcDir = filepath.Join(tempDir, p.SubPath)
		} else {
			packSrcDir = tempDir
		}

		// Handle if nested mcpack file
		if strings.HasSuffix(strings.ToLower(p.SubPath), ".mcpack") {
			nestedZip := filepath.Join(tempDir, p.SubPath)
			subExtDir := filepath.Join(tempDir, "extracted_"+sanitizedName)
			if err := extractNestedZip(nestedZip, subExtDir); err != nil {
				return nil, rollback(fmt.Errorf("failed to unpack nested pack %s: %w", p.SubPath, err))
			}
			packSrcDir = subExtDir
		}

		var destDir string
		if p.Type == models.AddonTypeBehavior {
			destDir = filepath.Join(bpRoot, sanitizedName)
			if err := copyDirectory(packSrcDir, destDir); err != nil {
				return nil, rollback(fmt.Errorf("failed to copy behavior pack: %w", err))
			}
			installedDirs = append(installedDirs, destDir)
			result.InstalledBPs = append(result.InstalledBPs, sanitizedName)

			// Dual location: also copy to world behavior_packs if target world specified
			if opts.TargetWorld != "" {
				actualFolder := ResolveWorldFolder(serverPath, opts.TargetWorld)
				worldBpDir := filepath.Join(serverPath, "worlds", actualFolder, "behavior_packs", sanitizedName)
				_ = copyDirectory(packSrcDir, worldBpDir)
			}

			// Register in world if requested
			if opts.TargetWorld != "" && opts.EnableBehavior {
				if err := ai.RegisterWorldPack(serverPath, opts.TargetWorld, "behavior", p.UUID, p.Version); err != nil {
					return nil, rollback(fmt.Errorf("failed to register behavior pack in world: %w", err))
				}
				result.WorldUpdated = true
			}

		} else if p.Type == models.AddonTypeResource {
			destDir = filepath.Join(rpRoot, sanitizedName)
			if err := copyDirectory(packSrcDir, destDir); err != nil {
				return nil, rollback(fmt.Errorf("failed to copy resource pack: %w", err))
			}
			installedDirs = append(installedDirs, destDir)
			result.InstalledRPs = append(result.InstalledRPs, sanitizedName)

			// Dual location: also copy to world resource_packs if target world specified
			if opts.TargetWorld != "" {
				actualFolder := ResolveWorldFolder(serverPath, opts.TargetWorld)
				worldRpDir := filepath.Join(serverPath, "worlds", actualFolder, "resource_packs", sanitizedName)
				_ = copyDirectory(packSrcDir, worldRpDir)
			}

			// Register in world if requested
			if opts.TargetWorld != "" && opts.EnableResource {
				if err := ai.RegisterWorldPack(serverPath, opts.TargetWorld, "resource", p.UUID, p.Version); err != nil {
					return nil, rollback(fmt.Errorf("failed to register resource pack in world: %w", err))
				}
				result.WorldUpdated = true
			}
		}
	}

	// Always sync BDS valid_known_packs.json registry
	_ = ai.SyncValidKnownPacks(serverPath)

	result.Success = true
	result.Message = fmt.Sprintf("Add-On '%s' installed successfully.", analysis.Name)
	return result, nil
}

// ValidKnownPack represents an entry in BDS valid_known_packs.json
type ValidKnownPack struct {
	FileSystem string `json:"file_system"`
	Path       string `json:"path"`
	UUID       string `json:"uuid"`
	Version    []int  `json:"version"`
}

// SyncValidKnownPacks scans server behavior_packs and resource_packs (and active world packs)
// and ensures valid_known_packs.json is populated so BDS registers custom packs and serves them to clients.
func (ai *AddonInstaller) SyncValidKnownPacks(serverPath string) error {
	registryPath := filepath.Join(serverPath, "valid_known_packs.json")
	packMap := make(map[string]ValidKnownPack)

	// Load existing valid_known_packs.json if present to preserve standard packages
	if data, err := os.ReadFile(registryPath); err == nil {
		var existing []ValidKnownPack
		if err := json.Unmarshal(data, &existing); err == nil {
			for _, p := range existing {
				if p.UUID != "" {
					packMap[strings.ToLower(p.UUID)] = p
				}
			}
		}
	}

	// Helper to scan directory for manifest.json
	scanDir := func(baseFolder string) {
		root := filepath.Join(serverPath, baseFolder)
		entries, err := os.ReadDir(root)
		if err != nil {
			return
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			mPath := filepath.Join(root, e.Name(), "manifest.json")
			mData, mErr := os.ReadFile(mPath)
			if mErr != nil {
				continue
			}
			var mf RawManifest
			if err := json.Unmarshal(mData, &mf); err != nil {
				continue
			}
			if mf.Header.UUID == "" {
				continue
			}
			verInts, _ := ParseVersion(mf.Header.Version)
			relPath := baseFolder + "/" + e.Name()
			packMap[strings.ToLower(mf.Header.UUID)] = ValidKnownPack{
				FileSystem: "RawPath",
				Path:       relPath,
				UUID:       mf.Header.UUID,
				Version:    verInts,
			}
		}
	}

	scanDir("behavior_packs")
	scanDir("resource_packs")

	// Also scan worlds/ for embedded packs
	worldsDir := filepath.Join(serverPath, "worlds")
	if wEntries, err := os.ReadDir(worldsDir); err == nil {
		for _, w := range wEntries {
			if !w.IsDir() {
				continue
			}
			scanDir("worlds/" + w.Name() + "/behavior_packs")
			scanDir("worlds/" + w.Name() + "/resource_packs")
		}
	}

	var result []ValidKnownPack
	for _, p := range packMap {
		result = append(result, p)
	}

	formatted, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(registryPath, formatted, 0644)
}

// ResolveWorldFolder resolves any world identifier (display name, folder, or empty) to the physical folder on disk
func ResolveWorldFolder(serverPath, worldNameOrFolder string) string {
	worldNameOrFolder = strings.TrimSpace(worldNameOrFolder)
	worldsDir := filepath.Join(serverPath, "worlds")

	if worldNameOrFolder != "" {
		// 1. Direct folder existence check
		dirPath := filepath.Join(worldsDir, worldNameOrFolder)
		if fi, err := os.Stat(dirPath); err == nil && fi.IsDir() {
			return worldNameOrFolder
		}

		// 2. Search subdirectories for matching folder name or levelname.txt
		entries, err := os.ReadDir(worldsDir)
		if err == nil {
			for _, e := range entries {
				if !e.IsDir() {
					continue
				}
				if strings.EqualFold(e.Name(), worldNameOrFolder) {
					return e.Name()
				}
				lnameBytes, err := os.ReadFile(filepath.Join(worldsDir, e.Name(), "levelname.txt"))
				if err == nil && strings.EqualFold(strings.TrimSpace(string(lnameBytes)), worldNameOrFolder) {
					return e.Name()
				}
			}
		}
	}

	// 3. Fall back to active world level-name in server.properties
	if props, err := server.LoadProperties(serverPath); err == nil {
		lvl := props.Get("level-name", "")
		if lvl != "" {
			if fi, err := os.Stat(filepath.Join(worldsDir, lvl)); err == nil && fi.IsDir() {
				return lvl
			}
		}
	}

	// 4. Fall back to first folder in worlds/
	entries, err := os.ReadDir(worldsDir)
	if err == nil {
		for _, e := range entries {
			if e.IsDir() {
				return e.Name()
			}
		}
	}

	if worldNameOrFolder != "" {
		return worldNameOrFolder
	}
	return "world"
}

// RegisterWorldPack updates world_behavior_packs.json or world_resource_packs.json
func (ai *AddonInstaller) RegisterWorldPack(serverPath, worldName, packType, packUUID string, version []int) error {
	var fileName string
	var folderName string
	if packType == "behavior" {
		fileName = "world_behavior_packs.json"
		folderName = "behavior_packs"
	} else {
		fileName = "world_resource_packs.json"
		folderName = "resource_packs"
	}

	actualFolder := ResolveWorldFolder(serverPath, worldName)
	worldDir := filepath.Join(serverPath, "worlds", actualFolder)
	if err := os.MkdirAll(worldDir, 0755); err != nil {
		return err
	}

	// Also ensure pack is present in world's own behavior_packs/resource_packs folder
	serverRootPackDir := filepath.Join(serverPath, folderName)
	worldPackDir := filepath.Join(worldDir, folderName)
	if entries, err := os.ReadDir(serverRootPackDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			mBytes, mErr := os.ReadFile(filepath.Join(serverRootPackDir, e.Name(), "manifest.json"))
			if mErr == nil {
				var mf RawManifest
				if jErr := json.Unmarshal(mBytes, &mf); jErr == nil && strings.EqualFold(mf.Header.UUID, packUUID) {
					_ = copyDirectory(filepath.Join(serverRootPackDir, e.Name()), filepath.Join(worldPackDir, e.Name()))
					break
				}
			}
		}
	}

	filePath := filepath.Join(worldDir, fileName)
	var records []models.WorldPackRecord

	if data, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(data, &records)
	}

	// Check if already registered
	found := false
	for i, r := range records {
		if strings.EqualFold(r.PackID, packUUID) {
			records[i].Version = version
			found = true
			break
		}
	}
	if !found {
		records = append(records, models.WorldPackRecord{
			PackID:  packUUID,
			Version: version,
		})
	}

	formatted, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(filePath, formatted, 0644); err != nil {
		return err
	}

	// Sync BDS valid_known_packs.json registry
	_ = ai.SyncValidKnownPacks(serverPath)
	return nil
}

// UnregisterWorldPack removes a pack registration from a world
func (ai *AddonInstaller) UnregisterWorldPack(serverPath, worldName, packType, packUUID string) error {
	var fileName string
	if packType == "behavior" {
		fileName = "world_behavior_packs.json"
	} else {
		fileName = "world_resource_packs.json"
	}

	actualFolder := ResolveWorldFolder(serverPath, worldName)
	filePath := filepath.Join(serverPath, "worlds", actualFolder, fileName)
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil // nothing to unregister if file doesn't exist
	}

	var records []models.WorldPackRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return err
	}

	var updated []models.WorldPackRecord
	for _, r := range records {
		if !strings.EqualFold(r.PackID, packUUID) {
			updated = append(updated, r)
		}
	}

	formatted, err := json.MarshalIndent(updated, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(filePath, formatted, 0644); err != nil {
		return err
	}

	// Also clean up any embedded pack folder in the world's behavior_packs or resource_packs
	var packFolderName string
	if packType == "behavior" {
		packFolderName = "behavior_packs"
	} else {
		packFolderName = "resource_packs"
	}
	worldPackRoot := filepath.Join(serverPath, "worlds", actualFolder, packFolderName)
	if entries, err := os.ReadDir(worldPackRoot); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			sub := filepath.Join(worldPackRoot, e.Name())
			if mBytes, mErr := os.ReadFile(filepath.Join(sub, "manifest.json")); mErr == nil {
				var mf RawManifest
				if jErr := json.Unmarshal(mBytes, &mf); jErr == nil && strings.EqualFold(mf.Header.UUID, packUUID) {
					_ = os.RemoveAll(sub)
				}
			}
		}
	}

	// Sync BDS valid_known_packs.json registry
	_ = ai.SyncValidKnownPacks(serverPath)
	return nil
}

func sanitizeFolderName(name string) string {
	reg := regexp.MustCompile(`[^a-zA-Z0-9_\-\s]`)
	cleaned := reg.ReplaceAllString(name, "")
	cleaned = strings.TrimSpace(cleaned)
	return strings.ReplaceAll(cleaned, " ", "_")
}

func extractNestedZip(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	return security.ExtractZipSafely(&r.Reader, destDir, 500*1024*1024, false)
}

func copyFile(src, dst string) error {
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

func restoreFile(backup, target string) error {
	if _, err := os.Stat(backup); os.IsNotExist(err) {
		return nil
	}
	return copyFile(backup, target)
}

func copyDirectory(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDirectory(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}
	return nil
}
