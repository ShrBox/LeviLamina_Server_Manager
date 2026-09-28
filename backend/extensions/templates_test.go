package extensions

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConvertWorldTemplateToAddon(t *testing.T) {
	tempDir := t.TempDir()
	extMgr := NewExtensionManager(tempDir)

	// Create a dummy .mctemplate with:
	// - behavior_packs/bp0/manifest.json (BP)
	// - resource_packs/rp0/manifest.json (RP)
	// - skin_packs/sp0/manifest.json (Skin Pack - MUST BE EXCLUDED!)
	// - db/000001.ldb (World data - MUST BE EXCLUDED!)
	templatePath := filepath.Join(tempDir, "Test Adventure (world_template).mctemplate")
	f, err := os.Create(templatePath)
	if err != nil {
		t.Fatalf("failed to create dummy template: %v", err)
	}

	zw := zip.NewWriter(f)

	// 1. Behavior Pack
	w, _ := zw.Create("behavior_packs/bp0/manifest.json")
	_, _ = w.Write([]byte(`{
		"format_version": 2,
		"header": {"name": "Test BP", "uuid": "11111111-1111-1111-1111-111111111111", "version": [1, 0, 0]},
		"modules": [{"type": "data", "uuid": "22222222-2222-2222-2222-222222222222", "version": [1, 0, 0]}]
	}`))
	w, _ = zw.Create("behavior_packs/bp0/entities/custom_mob.json")
	_, _ = w.Write([]byte(`{"test": true}`))

	// 2. Resource Pack
	w, _ = zw.Create("resource_packs/rp0/manifest.json")
	_, _ = w.Write([]byte(`{
		"format_version": 2,
		"header": {"name": "Test RP", "uuid": "33333333-3333-3333-3333-333333333333", "version": [1, 0, 0]},
		"modules": [{"type": "resources", "uuid": "44444444-4444-4444-4444-444444444444", "version": [1, 0, 0]}]
	}`))
	w, _ = zw.Create("resource_packs/rp0/textures/item.png")
	_, _ = w.Write([]byte(`dummy png data`))

	// 3. Skin Pack (Must be excluded!)
	w, _ = zw.Create("skin_packs/sp0/manifest.json")
	_, _ = w.Write([]byte(`{
		"format_version": 2,
		"header": {"name": "Test Skin", "uuid": "55555555-5555-5555-5555-555555555555", "version": [1, 0, 0]},
		"modules": [{"type": "skin_pack", "uuid": "66666666-6666-6666-6666-666666666666", "version": [1, 0, 0]}]
	}`))
	w, _ = zw.Create("skin_packs/sp0/skin.png")
	_, _ = w.Write([]byte(`skin data`))

	// 4. World Save Data
	w, _ = zw.Create("db/000001.ldb")
	_, _ = w.Write([]byte(`world level db data`))

	_ = zw.Close()
	_ = f.Close()

	// Convert template
	addonPath, err := extMgr.ConvertWorldTemplateToAddon(templatePath)
	if err != nil {
		t.Fatalf("ConvertWorldTemplateToAddon failed: %v", err)
	}

	if !strings.HasSuffix(addonPath, ".mcaddon") {
		t.Fatalf("Expected .mcaddon extension, got: %s", addonPath)
	}

	if _, err := os.Stat(templatePath); !os.IsNotExist(err) {
		t.Errorf("Expected original template file to be removed, but it still exists")
	}

	// Verify contents of the generated .mcaddon
	zr, err := zip.OpenReader(addonPath)
	if err != nil {
		t.Fatalf("failed to open generated addon: %v", err)
	}
	defer zr.Close()

	hasBP := false
	hasRP := false
	hasSkin := false

	for _, file := range zr.File {
		name := strings.ToLower(file.Name)
		if strings.Contains(name, "_bp.mcpack") {
			hasBP = true
		}
		if strings.Contains(name, "_rp.mcpack") {
			hasRP = true
		}
		if strings.Contains(name, "skin") {
			hasSkin = true
		}
	}

	if !hasBP {
		t.Errorf("Generated .mcaddon missing behavior pack .mcpack")
	}
	if !hasRP {
		t.Errorf("Generated .mcaddon missing resource pack .mcpack")
	}
	if hasSkin {
		t.Errorf("Generated .mcaddon contains skin pack, but skin packs must be excluded!")
	}
}

func TestConvertWorldTemplateWithoutBehaviorPack(t *testing.T) {
	tempDir := t.TempDir()
	extMgr := NewExtensionManager(tempDir)

	// Create a template that ONLY has a resource pack and world save data (no BP!)
	templatePath := filepath.Join(tempDir, "The Grumpus Tale (world_template).mctemplate")
	f, err := os.Create(templatePath)
	if err != nil {
		t.Fatalf("failed to create dummy template: %v", err)
	}

	zw := zip.NewWriter(f)

	// Resource Pack only
	w, _ := zw.Create("resource_packs/rp0/manifest.json")
	_, _ = w.Write([]byte(`{
		"format_version": 2,
		"header": {"name": "Grumpus RP", "uuid": "33333333-3333-3333-3333-333333333333", "version": [1, 0, 0]},
		"modules": [{"type": "resources", "uuid": "44444444-4444-4444-4444-444444444444", "version": [1, 0, 0]}]
	}`))

	// Skin Pack (must be ignored)
	w, _ = zw.Create("skin_packs/TheGrumpusTaleSkinPack/manifest.json")
	_, _ = w.Write([]byte(`{
		"format_version": 2,
		"header": {"name": "TheGrumpusTaleSkinPack", "uuid": "55555555-5555-5555-5555-555555555555", "version": [1, 0, 0]},
		"modules": [{"type": "skin_pack", "uuid": "66666666-6666-6666-6666-666666666666", "version": [1, 0, 0]}]
	}`))

	// World level dat
	w, _ = zw.Create("level.dat")
	_, _ = w.Write([]byte(`dummy level dat`))
	w, _ = zw.Create("levelname.txt")
	_, _ = w.Write([]byte(`The Grumpus Tale`))

	_ = zw.Close()
	_ = f.Close()

	// Calling ConvertWorldTemplateToAddon should NOT convert it because there is no Behavior Pack!
	resultPath, err := extMgr.ConvertWorldTemplateToAddon(templatePath)
	if err != nil {
		t.Fatalf("ConvertWorldTemplateToAddon returned error: %v", err)
	}

	if resultPath != templatePath {
		t.Fatalf("Expected template to remain untouched (%s), but got %s", templatePath, resultPath)
	}

	// Verify the original .mctemplate file still exists on disk
	if _, err := os.Stat(templatePath); os.IsNotExist(err) {
		t.Fatalf("Original template file was deleted, but it should be preserved as a world map")
	}
}

func TestInstallWorldTemplateAsSeparateWorld(t *testing.T) {
	tempDir := t.TempDir()
	serverDir := filepath.Join(tempDir, "server")
	_ = os.MkdirAll(serverDir, 0755)

	extMgr := NewExtensionManager(tempDir)

	// Create a dummy .mctemplate with world data
	templatePath := filepath.Join(tempDir, "Noob Pro Hacker Witch House (world_template).mctemplate")
	f, err := os.Create(templatePath)
	if err != nil {
		t.Fatalf("failed to create dummy template: %v", err)
	}

	zw := zip.NewWriter(f)
	w, _ := zw.Create("world_template/level.dat")
	_, _ = w.Write([]byte(`level binary data`))
	w, _ = zw.Create("world_template/levelname.txt")
	_, _ = w.Write([]byte(`Witch House Adventure`))
	w, _ = zw.Create("world_template/db/000001.ldb")
	_, _ = w.Write([]byte(`chunk data`))
	_ = zw.Close()
	_ = f.Close()

	// Install package
	if err := extMgr.InstallToolCoinPackage(serverDir, templatePath); err != nil {
		t.Fatalf("InstallToolCoinPackage failed: %v", err)
	}

	// Verify the world was created in server/worlds/Witch_House_Adventure
	expectedWorldDir := filepath.Join(serverDir, "worlds", "Witch_House_Adventure")
	if _, err := os.Stat(expectedWorldDir); os.IsNotExist(err) {
		t.Fatalf("Expected world directory at %s, but not found", expectedWorldDir)
	}

	// Verify level.dat exists in the created world
	levelDat := filepath.Join(expectedWorldDir, "level.dat")
	if _, err := os.Stat(levelDat); os.IsNotExist(err) {
		t.Fatalf("Expected level.dat at %s, but not found", levelDat)
	}

	// Verify levelname.txt exists
	levelNameTxt := filepath.Join(expectedWorldDir, "levelname.txt")
	if data, err := os.ReadFile(levelNameTxt); err != nil || string(data) != "Witch House Adventure" {
		t.Fatalf("Expected levelname.txt to contain 'Witch House Adventure', got '%s'", string(data))
	}
}


