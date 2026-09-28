package addons

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestInstallAndListAddons(t *testing.T) {
	// Create a dummy server directory
	serverDir := t.TempDir()
	worldName := "Bedrock level"
	worldDir := filepath.Join(serverDir, "worlds", worldName)
	_ = os.MkdirAll(worldDir, 0755)
	_ = os.WriteFile(filepath.Join(worldDir, "levelname.txt"), []byte(worldName), 0644)

	// Check if a real test pack is provided via env, otherwise generate a mock .mcpack
	packPath := os.Getenv("TEST_PACK_PATH")
	if packPath == "" || !func() bool { _, err := os.Stat(packPath); return err == nil }() {
		// Generate a clean mock mcpack
		packPath = filepath.Join(serverDir, "test_addon.mcpack")
		zipFile, err := os.Create(packPath)
		if err != nil {
			t.Fatalf("failed to create mock pack: %v", err)
		}
		zw := zip.NewWriter(zipFile)
		manifestContent := `{
			"format_version": 2,
			"header": {
				"name": "Test Backpack Pack",
				"description": "Unit test addon pack",
				"uuid": "b06822ec-99e5-4712-ba22-e4d0b13d2a7f",
				"version": [1, 0, 0],
				"min_engine_version": [1, 20, 0]
			},
			"modules": [
				{
					"type": "data",
					"uuid": "7a37e193-4a0b-465d-b0dc-51b66df87723",
					"version": [1, 0, 0]
				}
			]
		}`
		w, err := zw.Create("manifest.json")
		if err != nil {
			t.Fatalf("failed to create manifest in zip: %v", err)
		}
		_, _ = w.Write([]byte(manifestContent))
		_ = zw.Close()
		_ = zipFile.Close()
	}

	installer := NewAddonInstaller()
	opts := InstallOptions{
		EnableBehavior: true,
		EnableResource: true,
		TargetWorld:    worldName,
		CreateBackup:   false,
	}

	res, err := installer.InstallAddon(serverDir, packPath, opts)
	if err != nil {
		t.Fatalf("InstallAddon failed: %v", err)
	}

	if !res.Success {
		t.Fatalf("expected install success, got failure: %s", res.Message)
	}

	// Now list installed addons using AddonManager
	mgr := NewAddonManager()
	installed, err := mgr.ListInstalledAddons(serverDir)
	if err != nil {
		t.Fatalf("ListInstalledAddons failed: %v", err)
	}

	if len(installed) == 0 {
		t.Fatalf("expected at least 1 installed addon, got 0")
	}

	addon := installed[0]
	t.Logf("Detected installed addon: Name=%s, Type=%s, Enabled=%v, AssignedWorlds=%v",
		addon.Name, addon.Type, addon.Enabled, addon.AssignedWorlds)

	if !addon.Enabled {
		t.Errorf("Expected addon to be enabled, got false")
	}

	if len(addon.AssignedWorlds) == 0 {
		t.Errorf("Expected addon to have assigned worlds, got empty")
	}
}
