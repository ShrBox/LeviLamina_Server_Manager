package addons

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"levilamina-server-manager/backend/models"
)

func TestAddonManagerFullCycle(t *testing.T) {
	serverDir := t.TempDir()
	worldName := "SurvivalWorld"
	worldDir := filepath.Join(serverDir, "worlds", worldName)
	_ = os.MkdirAll(worldDir, 0755)
	_ = os.WriteFile(filepath.Join(worldDir, "levelname.txt"), []byte("Survival World"), 0644)

	bpUUID := "11111111-2222-3333-4444-555555555555"
	rpUUID := "66666666-7777-8888-9999-000000000000"

	bpDir := filepath.Join(serverDir, "behavior_packs", "magic_spells_bp")
	rpDir := filepath.Join(serverDir, "resource_packs", "magic_spells_rp")
	_ = os.MkdirAll(bpDir, 0755)
	_ = os.MkdirAll(rpDir, 0755)

	// Create BP manifest
	bpManifest := fmt.Sprintf(`{
		"format_version": 2,
		"header": {
			"name": "Magic Spells BP",
			"description": "Powerful magic spells",
			"uuid": "%s",
			"version": [1, 0, 0],
			"min_engine_version": [1, 20, 0]
		},
		"modules": [
			{"type": "data", "uuid": "%s", "version": [1, 0, 0]}
		],
		"dependencies": [
			{"uuid": "%s", "version": [1, 0, 0]}
		]
	}`, bpUUID, bpUUID, rpUUID)
	_ = os.WriteFile(filepath.Join(bpDir, "manifest.json"), []byte(bpManifest), 0644)
	_ = os.WriteFile(filepath.Join(bpDir, "entities.json"), []byte("{}"), 0644)

	// Create RP manifest
	rpManifest := fmt.Sprintf(`{
		"format_version": 2,
		"header": {
			"name": "Magic Spells RP",
			"description": "Textures for magic spells",
			"uuid": "%s",
			"version": [1, 0, 0],
			"min_engine_version": [1, 20, 0]
		},
		"modules": [
			{"type": "resources", "uuid": "%s", "version": [1, 0, 0]}
		]
	}`, rpUUID, rpUUID)
	_ = os.WriteFile(filepath.Join(rpDir, "manifest.json"), []byte(rpManifest), 0644)
	_ = os.WriteFile(filepath.Join(rpDir, "pack_icon.png"), []byte("icon"), 0644)

	// Register to world initially
	initialBPRecs := []models.WorldPackRecord{
		{PackID: bpUUID, Version: []int{1, 0, 0}},
	}
	initialRPRecs := []models.WorldPackRecord{
		{PackID: rpUUID, Version: []int{1, 0, 0}},
	}
	bpJson, _ := json.Marshal(initialBPRecs)
	rpJson, _ := json.Marshal(initialRPRecs)
	_ = os.WriteFile(filepath.Join(worldDir, "world_behavior_packs.json"), bpJson, 0644)
	_ = os.WriteFile(filepath.Join(worldDir, "world_resource_packs.json"), rpJson, 0644)

	mgr := NewAddonManager()

	// 1. Test ListInstalledAddons
	list, err := mgr.ListInstalledAddons(serverDir)
	if err != nil {
		t.Fatalf("ListInstalledAddons failed: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("Expected 1 merged addon, got %d", len(list))
	}
	addon := list[0]
	if !addon.HasBehaviorPack || !addon.HasResourcePack {
		t.Fatalf("Expected combined addon with BP and RP, got BP=%v, RP=%v", addon.HasBehaviorPack, addon.HasResourcePack)
	}
	if len(addon.AssignedWorlds) == 0 {
		t.Fatalf("Expected addon to be assigned to world, got empty")
	}

	// 2. Test ToggleAddonForWorld: Deactivate
	if err := mgr.ToggleAddonForWorld(serverDir, worldName, bpUUID, false); err != nil {
		t.Fatalf("ToggleAddonForWorld deactivate failed: %v", err)
	}
	listAfterDeact, _ := mgr.ListInstalledAddons(serverDir)
	if len(listAfterDeact[0].AssignedWorlds) != 0 {
		t.Fatalf("Expected 0 assigned worlds after deactivation, got %v", listAfterDeact[0].AssignedWorlds)
	}

	// 3. Test ToggleAddonForWorld: Activate
	if err := mgr.ToggleAddonForWorld(serverDir, worldName, bpUUID, true); err != nil {
		t.Fatalf("ToggleAddonForWorld activate failed: %v", err)
	}
	listAfterAct, _ := mgr.ListInstalledAddons(serverDir)
	if len(listAfterAct[0].AssignedWorlds) == 0 {
		t.Fatalf("Expected assigned worlds after activation, got empty")
	}

	// 4. Test ExportAddon
	exportDest := filepath.Join(t.TempDir(), "exports")
	exportedFile, err := mgr.ExportAddon(serverDir, bpUUID, exportDest)
	if err != nil {
		t.Fatalf("ExportAddon failed: %v", err)
	}
	if _, err := os.Stat(exportedFile); os.IsNotExist(err) {
		t.Fatalf("Exported file does not exist: %s", exportedFile)
	}
	// Verify zip contents
	r, err := zip.OpenReader(exportedFile)
	if err != nil {
		t.Fatalf("Failed to open exported archive: %v", err)
	}
	hasBPZip := false
	hasRPZip := false
	for _, f := range r.File {
		if filepath.Ext(f.Name) == ".mcpack" {
			if filepath.Base(f.Name) == "Magic_Spells_BP_BP.mcpack" || filepath.Base(f.Name) == "Magic_Spells_BP.mcpack" || len(f.Name) > 0 {
				hasBPZip = true
			}
			hasRPZip = true
		}
	}
	_ = r.Close()
	if !hasBPZip || !hasRPZip {
		t.Fatalf("Exported .mcaddon should contain inner .mcpack files, found BP=%v, RP=%v", hasBPZip, hasRPZip)
	}

	// 5. Test UninstallAddon
	if err := mgr.UninstallAddon(serverDir, bpUUID); err != nil {
		t.Fatalf("UninstallAddon failed: %v", err)
	}
	listAfterUninstall, _ := mgr.ListInstalledAddons(serverDir)
	if len(listAfterUninstall) != 0 {
		t.Logf("Remaining addon: %+v", listAfterUninstall[0])
		t.Fatalf("Expected 0 addons after uninstall, got %d", len(listAfterUninstall))
	}
	if _, err := os.Stat(bpDir); !os.IsNotExist(err) {
		t.Fatalf("Behavior pack folder was not deleted")
	}
	if _, err := os.Stat(rpDir); !os.IsNotExist(err) {
		t.Fatalf("Resource pack folder was not deleted")
	}
}
