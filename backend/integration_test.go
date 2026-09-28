package backend

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"levilamina-server-manager/backend/addons"
	"levilamina-server-manager/backend/database"
	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/server"
)

func TestEndToEnd_ServerManagerWorkflow(t *testing.T) {
	tempBase := t.TempDir()
	serverDir := filepath.Join(tempBase, "SurvivalSMP")

	testDBPath := filepath.Join(tempBase, "test_store.json")
	testDB, err := database.NewDatabaseWithPath(testDBPath)
	if err != nil {
		t.Fatalf("failed to init test database: %v", err)
	}
	app, err := NewAppWithDB(testDB)
	if err != nil {
		t.Fatalf("failed to initialize App: %v", err)
	}

	// 1. Create Server via Wizard options
	srv, err := app.CreateServer(server.CreateServerOptions{
		Name:              "Survival SMP",
		Location:          serverDir,
		MinecraftVersion:  "1.21.60",
		LeviLaminaVersion: "Latest",
		Port:              19132,
		WorldName:         "SurvivalWorld",
		Gamemode:          "survival",
		Difficulty:        "normal",
	})
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	if srv.Name != "Survival SMP" {
		t.Errorf("expected server name 'Survival SMP', got %s", srv.Name)
	}

	// Verify folders created
	for _, folder := range []string{"behavior_packs", "resource_packs", "plugins", "worlds/SurvivalWorld", "backups"} {
		path := filepath.Join(serverDir, folder)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("expected folder %s to exist", path)
		}
	}

	// Verify server.properties created
	props, err := app.GetServerProperties(srv.ID)
	if err != nil {
		t.Fatalf("failed to read server properties: %v", err)
	}
	if props["server-name"] != "Survival SMP" {
		t.Errorf("expected server-name 'Survival SMP', got %s", props["server-name"])
	}
	if props["gamemode"] != "survival" {
		t.Errorf("expected gamemode 'survival', got %s", props["gamemode"])
	}

	// 2. Create a test .mcaddon archive with Behavior Pack and Resource Pack
	addonPath := filepath.Join(tempBase, "EconomyAddon.mcaddon")
	createTestMcaddon(t, addonPath)

	// 3. Deep Analysis of the Add-on archive
	analysis, err := app.AnalyzeAddon(addonPath)
	if err != nil {
		t.Fatalf("failed to analyze addon: %v", err)
	}
	if !analysis.Valid {
		t.Errorf("expected analysis to be valid")
	}
	if !analysis.HasBehaviorPack || !analysis.HasResourcePack {
		t.Errorf("expected BP and RP to be detected: BP=%v, RP=%v", analysis.HasBehaviorPack, analysis.HasResourcePack)
	}
	if analysis.UUID != "11111111-2222-3333-4444-555555555555" {
		t.Errorf("unexpected UUID: %s", analysis.UUID)
	}

	// 4. Install Add-on into World
	installResult, err := app.InstallAddon(srv.ID, addonPath, addons.InstallOptions{
		EnableBehavior: true,
		EnableResource: true,
		TargetWorld:    "SurvivalWorld",
		CreateBackup:   true,
	})
	if err != nil {
		t.Fatalf("failed to install addon: %v", err)
	}
	if !installResult.Success {
		t.Errorf("expected installation success: %s", installResult.Message)
	}

	// 5. Verify World pack registration files
	worldDir := filepath.Join(serverDir, "worlds", "SurvivalWorld")
	bpJsonFile := filepath.Join(worldDir, "world_behavior_packs.json")
	bpData, err := os.ReadFile(bpJsonFile)
	if err != nil {
		t.Fatalf("failed to read world_behavior_packs.json: %v", err)
	}

	var bpRecords []models.WorldPackRecord
	if err := json.Unmarshal(bpData, &bpRecords); err != nil {
		t.Fatalf("malformed world_behavior_packs.json: %v", err)
	}

	foundBP := false
	for _, r := range bpRecords {
		if r.PackID == "11111111-2222-3333-4444-555555555555" {
			foundBP = true
			break
		}
	}
	if !foundBP {
		t.Errorf("pack UUID not registered in world_behavior_packs.json")
	}

	// 6. Test Backups Creation
	backup, err := app.CreateBackup(srv.ID, "FULL", "", "Pre-test Snapshot")
	if err != nil {
		t.Fatalf("failed to create backup: %v", err)
	}
	if _, err := os.Stat(backup.FilePath); os.IsNotExist(err) {
		t.Errorf("expected backup file to exist on disk at %s", backup.FilePath)
	}

	backupsList, err := app.ListBackups(srv.ID)
	if err != nil {
		t.Fatalf("failed to list backups: %v", err)
	}
	if len(backupsList) == 0 {
		t.Errorf("expected at least 1 backup in list")
	}

	// 7. Test Compatibility Check
	compat, err := app.CheckCompatibility(srv.ID)
	if err != nil {
		t.Fatalf("failed to run compatibility check: %v", err)
	}
	if compat.TotalItems == 0 {
		t.Errorf("expected compatibility items to be found")
	}
}

func createTestMcaddon(t *testing.T, targetPath string) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Add Behavior Pack manifest
	bpManifest := `{
		"format_version": 2,
		"header": {
			"name": "Economy BP",
			"description": "Behavior pack for Economy",
			"uuid": "11111111-2222-3333-4444-555555555555",
			"version": [1, 0, 0],
			"min_engine_version": [1, 21, 0]
		},
		"modules": [
			{"type": "data", "uuid": "11111111-2222-3333-4444-555555555556", "version": [1, 0, 0]}
		]
	}`
	fBP, err := zw.Create("behavior_pack/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fBP.Write([]byte(bpManifest))

	// Add Resource Pack manifest
	rpManifest := `{
		"format_version": 2,
		"header": {
			"name": "Economy RP",
			"description": "Resource pack for Economy",
			"uuid": "22222222-3333-4444-5555-666666666666",
			"version": [1, 0, 0],
			"min_engine_version": [1, 21, 0]
		},
		"modules": [
			{"type": "resources", "uuid": "22222222-3333-4444-5555-666666666667", "version": [1, 0, 0]}
		]
	}`
	fRP, err := zw.Create("resource_pack/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fRP.Write([]byte(rpManifest))

	zw.Close()

	if err := os.WriteFile(targetPath, buf.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}
}
