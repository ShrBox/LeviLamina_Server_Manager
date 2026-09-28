package worlds

import (
	"os"
	"path/filepath"
	"testing"

	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/server"
)

func TestListWorlds_PurgesBedrockLevelWhenNotActive(t *testing.T) {
	tempDir := t.TempDir()
	worldsDir := filepath.Join(tempDir, "worlds")
	_ = os.MkdirAll(filepath.Join(worldsDir, "World"), 0755)
	_ = os.WriteFile(filepath.Join(worldsDir, "World", "levelname.txt"), []byte("World"), 0644)

	// Create unwanted Bedrock level folder
	_ = os.MkdirAll(filepath.Join(worldsDir, "Bedrock level"), 0755)

	// Setup server.properties with level-name=World
	propsFile := filepath.Join(tempDir, "server.properties")
	_ = os.WriteFile(propsFile, []byte("level-name=World\n"), 0644)

	wm := NewWorldManager()
	list, err := wm.ListWorlds(tempDir)
	if err != nil {
		t.Fatalf("ListWorlds failed: %v", err)
	}

	for _, w := range list {
		if w.Folder == "Bedrock level" || w.Name == "Bedrock level" {
			t.Errorf("ListWorlds returned Bedrock level when active world is World")
		}
	}

	// Verify Bedrock level was purged from disk
	if _, err := os.Stat(filepath.Join(worldsDir, "Bedrock level")); !os.IsNotExist(err) {
		t.Errorf("expected Bedrock level to be purged from disk by ListWorlds")
	}
}

func TestCreateWorldWithOptions_PurgesBedrockLevel(t *testing.T) {
	tempDir := t.TempDir()
	worldsDir := filepath.Join(tempDir, "worlds")
	_ = os.MkdirAll(filepath.Join(worldsDir, "Bedrock level"), 0755)

	propsFile := filepath.Join(tempDir, "server.properties")
	_ = os.WriteFile(propsFile, []byte("level-name=OldWorld\n"), 0644)

	wm := NewWorldManager()
	err := wm.CreateWorldWithOptions(tempDir, models.WorldCreateOptions{
		FolderName:  "AdventureZone",
		DisplayName: "AdventureZone",
		Gamemode:    "survival",
		SetActive:   true,
	})
	if err != nil {
		t.Fatalf("CreateWorldWithOptions failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(worldsDir, "Bedrock level")); !os.IsNotExist(err) {
		t.Errorf("expected Bedrock level to be purged from disk")
	}

	// Verify server.properties has level-name=AdventureZone
	props, err := server.LoadProperties(tempDir)
	if err != nil {
		t.Fatal(err)
	}
	if props.Get("level-name", "") != "AdventureZone" {
		t.Errorf("expected level-name=AdventureZone, got %s", props.Get("level-name", ""))
	}
}

func TestListWorlds_ResolvesTemplatePackNames(t *testing.T) {
	tempDir := t.TempDir()
	worldsDir := filepath.Join(tempDir, "worlds")
	worldDir := filepath.Join(worldsDir, "TemplateWorld")
	_ = os.MkdirAll(worldDir, 0755)
	_ = os.WriteFile(filepath.Join(worldDir, "levelname.txt"), []byte("Better on Bedrock"), 0644)

	// Create world_behavior_packs.json
	wbJson := `[{"pack_id":"2a9fe0a6-c49f-491b-be78-fc9b6040a231","version":[1,2,1]}]`
	_ = os.WriteFile(filepath.Join(worldDir, "world_behavior_packs.json"), []byte(wbJson), 0644)

	// Create embedded behavior pack with pack.name localization
	bpDir := filepath.Join(worldDir, "behavior_packs", "bp0")
	_ = os.MkdirAll(filepath.Join(bpDir, "texts"), 0755)

	manifestJson := `{
		"format_version": 2,
		"header": {
			"name": "pack.name",
			"description": "pack.description",
			"uuid": "2a9fe0a6-c49f-491b-be78-fc9b6040a231",
			"version": [1, 2, 1]
		}
	}`
	_ = os.WriteFile(filepath.Join(bpDir, "manifest.json"), []byte(manifestJson), 0644)
	_ = os.WriteFile(filepath.Join(bpDir, "texts", "en_US.lang"), []byte("pack.name=Better on Bedrock v1.2.1 - Behavior Pack\npack.description=A great modpack!\n"), 0644)

	propsFile := filepath.Join(tempDir, "server.properties")
	_ = os.WriteFile(propsFile, []byte("level-name=TemplateWorld\n"), 0644)

	wm := NewWorldManager()
	list, err := wm.ListWorlds(tempDir)
	if err != nil {
		t.Fatalf("ListWorlds failed: %v", err)
	}

	if len(list) != 1 {
		t.Fatalf("expected 1 world, got %d", len(list))
	}

	w := list[0]
	if len(w.BehaviorPacks) != 1 {
		t.Fatalf("expected 1 behavior pack, got %d", len(w.BehaviorPacks))
	}

	bp := w.BehaviorPacks[0]
	if bp.Name != "Better on Bedrock v1.2.1 - Behavior Pack" {
		t.Errorf("expected pack name 'Better on Bedrock v1.2.1 - Behavior Pack', got '%s'", bp.Name)
	}
	if bp.Description != "A great modpack!" {
		t.Errorf("expected pack description 'A great modpack!', got '%s'", bp.Description)
	}
}
