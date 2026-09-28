package addons

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestParseManifestBytes_Valid(t *testing.T) {
	manifestJSON := `{
		"format_version": 2,
		"header": {
			"name": "Custom Economy",
			"description": "An awesome economy addon",
			"uuid": "205a9096-7241-471f-bdfa-bfaef388f8d9",
			"version": [1, 2, 0],
			"min_engine_version": [1, 21, 0]
		},
		"modules": [
			{
				"type": "data",
				"uuid": "4c9d5e3a-7182-4f33-8a3c-b26a45970c1a",
				"version": [1, 2, 0]
			},
			{
				"type": "script",
				"language": "javascript",
				"entry": "scripts/main.js",
				"uuid": "8b51d451-b0f3-42e7-8f55-c54173820a4b",
				"version": [1, 2, 0]
			}
		],
		"dependencies": [
			{
				"module_name": "@minecraft/server",
				"version": "1.13.0"
			}
		]
	}`

	m, err := ParseManifestBytes([]byte(manifestJSON))
	if err != nil {
		t.Fatalf("unexpected error parsing manifest: %v", err)
	}

	if m.Header.Name != "Custom Economy" {
		t.Errorf("expected name 'Custom Economy', got '%s'", m.Header.Name)
	}

	if m.Header.UUID != "205a9096-7241-471f-bdfa-bfaef388f8d9" {
		t.Errorf("expected uuid 205a9096-7241-471f-bdfa-bfaef388f8d9, got %s", m.Header.UUID)
	}

	vSlice, vStr := ParseVersion(m.Header.Version)
	if vStr != "1.2.0" || len(vSlice) != 3 {
		t.Errorf("version parse mismatch: got %v, %s", vSlice, vStr)
	}

	if len(m.Modules) != 2 {
		t.Fatalf("expected 2 modules, got %d", len(m.Modules))
	}

	if m.Modules[1].Type != "script" {
		t.Errorf("expected module 1 to be script, got %s", m.Modules[1].Type)
	}
}

func TestParseManifestBytes_Malformed(t *testing.T) {
	invalidJSON := `{"format_version": 2, "header": { "name": "Broken"`
	_, err := ParseManifestBytes([]byte(invalidJSON))
	if err == nil {
		t.Error("expected error for malformed json, got nil")
	}
}

func TestAddonAnalyzer_AnalyzeArchive(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "test_addon.mcpack")

	// Create test zip archive
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	manifestData := `{
		"format_version": 2,
		"header": {
			"name": "Test Behavior Pack",
			"description": "Test BP",
			"uuid": "3046f414-2db2-475a-a384-cbba9ef4931f",
			"version": [1, 0, 0],
			"min_engine_version": [1, 21, 0]
		},
		"modules": [
			{"type": "data", "uuid": "3146f414-2db2-475a-a384-cbba9ef4931f", "version": [1, 0, 0]}
		]
	}`

	f, err := zw.Create("manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.Write([]byte(manifestData))
	zw.Close()

	if err := os.WriteFile(archivePath, buf.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}

	analyzer := NewAddonAnalyzer()
	res, err := analyzer.AnalyzeArchive(archivePath)
	if err != nil {
		t.Fatalf("unexpected error analyzing archive: %v", err)
	}

	if !res.Valid {
		t.Errorf("expected archive to be valid")
	}
	if !res.HasBehaviorPack {
		t.Errorf("expected behavior pack detected")
	}
	if res.UUID != "3046f414-2db2-475a-a384-cbba9ef4931f" {
		t.Errorf("unexpected UUID: %s", res.UUID)
	}
}
