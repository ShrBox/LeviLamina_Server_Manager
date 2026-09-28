package addons

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"levilamina-server-manager/backend/models"
)

// AddonAnalyzer inspects archives for Bedrock packs
type AddonAnalyzer struct{}

func NewAddonAnalyzer() *AddonAnalyzer {
	return &AddonAnalyzer{}
}

// AnalyzeArchive reads a .mcaddon, .mcpack, or .zip archive and returns structured analysis
func (a *AddonAnalyzer) AnalyzeArchive(archivePath string) (*models.AddonAnalysisResult, error) {
	file, err := os.Open(archivePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open archive %s: %w", archivePath, err)
	}
	defer file.Close()

	fi, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to stat archive: %w", err)
	}

	zipReader, err := zip.NewReader(file, fi.Size())
	if err != nil {
		return nil, fmt.Errorf("invalid zip/archive format: %w", err)
	}

	result := &models.AddonAnalysisResult{
		FileName:      filepath.Base(archivePath),
		Valid:         false,
		Warnings:      make([]string, 0),
		Errors:        make([]string, 0),
		DetectedPacks: make([]models.SubPackInfo, 0),
		Compatibility: models.CompatOK,
	}

	// Check if archive contains nested .mcpack files (.mcaddon format)
	var nestedPacks []*zip.File
	var manifests []*zip.File
	var hasContentsJson bool

	for _, f := range zipReader.File {
		cleanName := path.Clean(strings.ReplaceAll(f.Name, "\\", "/"))

		// Check for contents.json which may indicate encrypted Marketplace pack
		if strings.EqualFold(path.Base(cleanName), "contents.json") {
			hasContentsJson = true
		}

		if strings.EqualFold(path.Ext(cleanName), ".mcpack") {
			nestedPacks = append(nestedPacks, f)
		} else if strings.EqualFold(path.Base(cleanName), "manifest.json") {
			manifests = append(manifests, f)
		}
	}

	if hasContentsJson {
		result.IsEncrypted = a.checkEncryption(zipReader)
		if result.IsEncrypted {
			result.Warnings = append(result.Warnings, "Archive contains encrypted content (Marketplace pack). Raw manifests may not be fully inspectable.")
		}
	}

	// Case 1: Nested .mcpack files found in archive
	if len(nestedPacks) > 0 {
		for _, np := range nestedPacks {
			subResult, err := a.analyzeNestedMcpack(np)
			if err != nil {
				result.Warnings = append(result.Warnings, fmt.Sprintf("Warning in nested pack %s: %v", np.Name, err))
				continue
			}
			result.DetectedPacks = append(result.DetectedPacks, *subResult)
			if subResult.Type == models.AddonTypeBehavior {
				result.HasBehaviorPack = true
			} else if subResult.Type == models.AddonTypeResource {
				result.HasResourcePack = true
			}
			for _, m := range subResult.Modules {
				if m.Type == "script" {
					result.HasScript = true
				}
			}
		}
	}

	// Case 2: One or more manifest.json in archive directly
	if len(manifests) > 0 {
		for _, mf := range manifests {
			subResult, err := a.analyzeManifestFile(mf)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Error reading %s: %v", mf.Name, err))
				continue
			}
			result.DetectedPacks = append(result.DetectedPacks, *subResult)
			if subResult.Type == models.AddonTypeBehavior {
				result.HasBehaviorPack = true
			} else if subResult.Type == models.AddonTypeResource {
				result.HasResourcePack = true
			}
			for _, m := range subResult.Modules {
				if m.Type == "script" {
					result.HasScript = true
				}
			}
		}
	}

	if len(result.DetectedPacks) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, "No valid manifest.json or .mcpack found in the archive")
		result.Compatibility = models.CompatIncompat
		return result, nil
	}

	// Aggregate info for top-level result
	primaryPack := result.DetectedPacks[0]
	result.Name = primaryPack.Name
	if len(result.DetectedPacks) > 1 && result.HasBehaviorPack && result.HasResourcePack {
		result.Type = models.AddonTypeCombined
	} else {
		result.Type = primaryPack.Type
	}

	_, verStr := ParseVersion(primaryPack.Version)
	result.Version = verStr
	result.UUID = primaryPack.UUID
	result.Modules = primaryPack.Modules
	result.Valid = true

	// Check compatibility engine
	if result.HasScript {
		result.Warnings = append(result.Warnings, "Pack contains Bedrock Script API modules. Ensure Beta APIs or required module versions are supported.")
	}

	return result, nil
}

func (a *AddonAnalyzer) analyzeManifestFile(zf *zip.File) (*models.SubPackInfo, error) {
	rc, err := zf.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, err
	}

	m, err := ParseManifestBytes(data)
	if err != nil {
		return nil, err
	}

	subType := models.AddonTypeResource
	hasData := false
	hasRes := false

	for _, mod := range m.Modules {
		if mod.Type == "data" || mod.Type == "script" {
			hasData = true
		} else if mod.Type == "resources" {
			hasRes = true
		}
	}

	if hasData && hasRes {
		subType = models.AddonTypeCombined
	} else if hasData {
		subType = models.AddonTypeBehavior
	} else if hasRes {
		subType = models.AddonTypeResource
	}

	verNums, _ := ParseVersion(m.Header.Version)

	subInfo := &models.SubPackInfo{
		SubPath: path.Dir(zf.Name),
		Type:    subType,
		Name:    m.Header.Name,
		UUID:    m.Header.UUID,
		Version: verNums,
		Modules: ConvertModules(m.Modules),
	}

	return subInfo, nil
}

func (a *AddonAnalyzer) analyzeNestedMcpack(zf *zip.File) (*models.SubPackInfo, error) {
	rc, err := zf.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, rc); err != nil {
		return nil, err
	}

	subReader, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		return nil, fmt.Errorf("could not open nested mcpack: %w", err)
	}

	for _, f := range subReader.File {
		cleanName := path.Clean(strings.ReplaceAll(f.Name, "\\", "/"))
		if strings.EqualFold(path.Base(cleanName), "manifest.json") {
			mRc, err := f.Open()
			if err != nil {
				return nil, err
			}
			mData, err := io.ReadAll(mRc)
			mRc.Close()
			if err != nil {
				return nil, err
			}

			m, err := ParseManifestBytes(mData)
			if err != nil {
				return nil, err
			}

			subType := models.AddonTypeResource
			hasData := false
			for _, mod := range m.Modules {
				if mod.Type == "data" || mod.Type == "script" {
					hasData = true
				}
			}
			if hasData {
				subType = models.AddonTypeBehavior
			}

			verNums, _ := ParseVersion(m.Header.Version)
			return &models.SubPackInfo{
				SubPath: zf.Name,
				Type:    subType,
				Name:    m.Header.Name,
				UUID:    m.Header.UUID,
				Version: verNums,
				Modules: ConvertModules(m.Modules),
			}, nil
		}
	}

	return nil, fmt.Errorf("no manifest.json found in nested mcpack %s", zf.Name)
}

func (a *AddonAnalyzer) checkEncryption(zr *zip.Reader) bool {
	// Bedrock encrypted content often has 0x00 magic or signatures in contents.json
	for _, f := range zr.File {
		if strings.EqualFold(path.Base(f.Name), "contents.json") {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			defer rc.Close()
			header := make([]byte, 16)
			n, _ := rc.Read(header)
			if n >= 4 && (header[0] == 0x00 && header[1] == 0x00 && header[2] == 0x00 && header[3] == 0x00) {
				return true
			}
		}
	}
	return false
}
