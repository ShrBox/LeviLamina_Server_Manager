package addons

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"levilamina-server-manager/backend/models"
)

// RawManifest represents Bedrock pack manifest structure
type RawManifest struct {
	FormatVersion any                   `json:"format_version"`
	Header        RawManifestHeader     `json:"header"`
	Modules       []RawManifestModule   `json:"modules"`
	Dependencies  []RawDependency       `json:"dependencies,omitempty"`
	Capabilities  []string              `json:"capabilities,omitempty"`
	Subpacks      []RawSubpack          `json:"subpacks,omitempty"`
}

type RawManifestHeader struct {
	Name             string `json:"name"`
	Description      string `json:"description"`
	UUID             string `json:"uuid"`
	Version          any    `json:"version"`
	MinEngineVersion any    `json:"min_engine_version,omitempty"`
}

type RawManifestModule struct {
	Type        string `json:"type"`
	UUID        string `json:"uuid"`
	Version     any    `json:"version"`
	Description string `json:"description,omitempty"`
	Language    string `json:"language,omitempty"`
	Entry       string `json:"entry,omitempty"`
}

type RawDependency struct {
	UUID       string `json:"uuid,omitempty"`
	ModuleName string `json:"module_name,omitempty"`
	Version    any    `json:"version"`
}

type RawSubpack struct {
	FolderName string `json:"folder_name"`
	Name       string `json:"name"`
	MemoryTier int    `json:"memory_tier"`
}

// ParseVersion converts varied version formats (e.g. [1,2,0] or "1.2.0") into int slice and string
func ParseVersion(v any) ([]int, string) {
	if v == nil {
		return []int{1, 0, 0}, "1.0.0"
	}
	switch val := v.(type) {
	case []any:
		nums := make([]int, 0, len(val))
		strParts := make([]string, 0, len(val))
		for _, item := range val {
			if n, ok := item.(float64); ok {
				nums = append(nums, int(n))
				strParts = append(strParts, strconv.Itoa(int(n)))
			}
		}
		if len(nums) == 0 {
			return []int{1, 0, 0}, "1.0.0"
		}
		return nums, strings.Join(strParts, ".")
	case string:
		parts := strings.Split(val, ".")
		nums := make([]int, 0, len(parts))
		for _, p := range parts {
			if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
				nums = append(nums, n)
			}
		}
		if len(nums) == 0 {
			return []int{1, 0, 0}, val
		}
		return nums, val
	default:
		return []int{1, 0, 0}, "1.0.0"
	}
}

// ParseManifestBytes parses and validates a manifest JSON byte slice
func ParseManifestBytes(data []byte) (*RawManifest, error) {
	// Strip BOM if present
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		data = data[3:]
	}

	var m RawManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("malformed manifest JSON: %w", err)
	}

	if m.Header.UUID == "" {
		return nil, fmt.Errorf("manifest missing required header UUID")
	}

	if len(m.Modules) == 0 {
		return nil, fmt.Errorf("manifest contains no modules")
	}

	return &m, nil
}

// ConvertToModel converts raw manifest to models.PackModule slice
func ConvertModules(raw []RawManifestModule) []models.PackModule {
	res := make([]models.PackModule, len(raw))
	for i, m := range raw {
		v, _ := ParseVersion(m.Version)
		res[i] = models.PackModule{
			Type:        m.Type,
			UUID:        m.UUID,
			Version:     v,
			Description: m.Description,
			Language:    m.Language,
			Entry:       m.Entry,
		}
	}
	return res
}
