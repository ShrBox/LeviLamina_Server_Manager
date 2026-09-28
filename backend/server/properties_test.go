package server

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestServerProperties_PreservesCommentsAndUpdates(t *testing.T) {
	tempDir := t.TempDir()
	propsFile := filepath.Join(tempDir, "server.properties")

	originalContent := `# Minecraft Server Properties
# Do not edit unless you know what you are doing
server-name=Original Name
gamemode=survival
max-players=20
custom-unknown-setting=my_custom_value
`

	if err := os.WriteFile(propsFile, []byte(originalContent), 0644); err != nil {
		t.Fatal(err)
	}

	sp, err := LoadProperties(tempDir)
	if err != nil {
		t.Fatalf("failed to load properties: %v", err)
	}

	if sp.Get("server-name", "") != "Original Name" {
		t.Errorf("expected Original Name, got %s", sp.Get("server-name", ""))
	}
	if sp.GetInt("max-players", 0) != 20 {
		t.Errorf("expected 20, got %d", sp.GetInt("max-players", 0))
	}
	if sp.Get("custom-unknown-setting", "") != "my_custom_value" {
		t.Errorf("expected custom_unknown_setting preserved")
	}

	// Modify one property
	sp.Set("server-name", "Survival SMP 2026")
	sp.Set("difficulty", "hard")

	if err := sp.Save(); err != nil {
		t.Fatalf("failed to save properties: %v", err)
	}

	savedBytes, err := os.ReadFile(propsFile)
	if err != nil {
		t.Fatal(err)
	}
	savedStr := string(savedBytes)

	if !strings.Contains(savedStr, "# Minecraft Server Properties") {
		t.Error("lost comments in saved server.properties")
	}
	if !strings.Contains(savedStr, "server-name=Survival SMP 2026") {
		t.Error("server-name was not updated")
	}
	if !strings.Contains(savedStr, "custom-unknown-setting=my_custom_value") {
		t.Error("unknown settings were lost")
	}
	if !strings.Contains(savedStr, "difficulty=hard") {
		t.Error("newly added difficulty was not written")
	}
}
