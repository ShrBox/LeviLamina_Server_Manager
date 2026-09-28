package server

import (
	"os"
	"path/filepath"
	"testing"

	"levilamina-server-manager/backend/database"
	"levilamina-server-manager/backend/levilamina"
	"levilamina-server-manager/backend/lip"
)

func TestCreateServer_NeverUsesBedrockLevel(t *testing.T) {
	tempDir := t.TempDir()
	db, err := database.NewDatabaseWithPath(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}

	lipClient := lip.NewLipClient()
	llMgr := levilamina.NewLeviLaminaManager(lipClient)
	sm := NewServerManager(db, lipClient, llMgr)

	serverLocation := filepath.Join(tempDir, "myserver")
	srv, err := sm.CreateServer(CreateServerOptions{
		Name:      "TestServer",
		Location:  serverLocation,
		WorldName: "", // Intentionally empty to test default fallback
	})
	if err != nil {
		t.Fatalf("CreateServer failed: %v", err)
	}

	if srv.ActiveWorld != "World" {
		t.Errorf("expected ActiveWorld to default to 'World', got '%s'", srv.ActiveWorld)
	}

	// Verify server.properties has level-name=World
	props, err := LoadProperties(serverLocation)
	if err != nil {
		t.Fatalf("failed to load server.properties: %v", err)
	}
	if props.Get("level-name", "") != "World" {
		t.Errorf("expected level-name=World, got %s", props.Get("level-name", ""))
	}

	// Verify worlds/World exists
	if _, err := os.Stat(filepath.Join(serverLocation, "worlds", "World")); os.IsNotExist(err) {
		t.Errorf("expected worlds/World directory to exist")
	}

	// Verify worlds/Bedrock level does NOT exist
	if _, err := os.Stat(filepath.Join(serverLocation, "worlds", "Bedrock level")); !os.IsNotExist(err) {
		t.Errorf("unwanted worlds/Bedrock level directory was created")
	}
}

func TestRescanServer_PurgesBedrockLevelAndRestoresRealWorld(t *testing.T) {
	tempDir := t.TempDir()
	db, err := database.NewDatabaseWithPath(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}

	lipClient := lip.NewLipClient()
	llMgr := levilamina.NewLeviLaminaManager(lipClient)
	sm := NewServerManager(db, lipClient, llMgr)

	serverLocation := filepath.Join(tempDir, "test_rescan")
	srv, err := sm.CreateServer(CreateServerOptions{
		Name:      "RescanTest",
		Location:  serverLocation,
		WorldName: "CustomWorld",
	})
	if err != nil {
		t.Fatalf("CreateServer failed: %v", err)
	}

	// Simulate Mojang BDS zip overwrite creating "Bedrock level"
	bedrockLevelDir := filepath.Join(serverLocation, "worlds", "Bedrock level")
	_ = os.MkdirAll(bedrockLevelDir, 0755)
	props, _ := LoadProperties(serverLocation)
	props.Set("level-name", "Bedrock level")
	_ = props.Save()

	// Run RescanServer
	updated, err := sm.RescanServer(srv.ID)
	if err != nil {
		t.Fatalf("RescanServer failed: %v", err)
	}

	// ActiveWorld should remain CustomWorld and NOT degrade to Bedrock level
	if updated.ActiveWorld != "CustomWorld" {
		t.Errorf("expected ActiveWorld to remain 'CustomWorld', got '%s'", updated.ActiveWorld)
	}

	// server.properties level-name must be restored
	propsAfter, _ := LoadProperties(serverLocation)
	if propsAfter.Get("level-name", "") != "CustomWorld" {
		t.Errorf("expected level-name in props to be 'CustomWorld', got '%s'", propsAfter.Get("level-name", ""))
	}

	// worlds/Bedrock level must have been purged
	if _, err := os.Stat(bedrockLevelDir); !os.IsNotExist(err) {
		t.Errorf("expected worlds/Bedrock level to be purged from disk")
	}
}

func TestSetActiveWorld_PurgesBedrockLevel(t *testing.T) {
	tempDir := t.TempDir()
	db, err := database.NewDatabaseWithPath(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}

	lipClient := lip.NewLipClient()
	llMgr := levilamina.NewLeviLaminaManager(lipClient)
	sm := NewServerManager(db, lipClient, llMgr)

	serverLocation := filepath.Join(tempDir, "test_active")
	srv, err := sm.CreateServer(CreateServerOptions{
		Name:      "ActiveTest",
		Location:  serverLocation,
		WorldName: "MyWorld",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Create dummy Bedrock level with a db folder inside
	bedrockLevelDir := filepath.Join(serverLocation, "worlds", "Bedrock level", "db")
	_ = os.MkdirAll(bedrockLevelDir, 0755)

	// SetActiveWorld to MyWorld
	if err := sm.SetActiveWorld(srv.ID, "MyWorld"); err != nil {
		t.Fatalf("SetActiveWorld failed: %v", err)
	}

	// Bedrock level should be deleted completely
	if _, err := os.Stat(filepath.Join(serverLocation, "worlds", "Bedrock level")); !os.IsNotExist(err) {
		t.Errorf("expected Bedrock level to be deleted even if it had a db/ folder")
	}
}
