package backend

import (
	"os"
	"path/filepath"
	"testing"

	"levilamina-server-manager/backend/database"
)

func TestSettingsPersistence(t *testing.T) {
	app := &App{}
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("failed to get user home: %v", err)
	}

	settingsPath := filepath.Join(home, ".llsm", "app_settings.json")
	// backup existing if present
	original, _ := os.ReadFile(settingsPath)
	defer func() {
		if original != nil {
			_ = os.WriteFile(settingsPath, original, 0644)
		} else {
			_ = os.Remove(settingsPath)
		}
	}()

	testJSON := `{"themeMode":"light","accentColor":"cyan","customAccentHex":"#06b6d4","autoRestartOnCrash":true}`

	// 1. Save settings
	if err := app.SaveAppSettings(testJSON); err != nil {
		t.Fatalf("SaveAppSettings failed: %v", err)
	}

	// 2. Read back
	retrieved, err := app.GetAppSettings()
	if err != nil {
		t.Fatalf("GetAppSettings failed: %v", err)
	}

	if retrieved != testJSON {
		t.Fatalf("Expected %s, got %s", testJSON, retrieved)
	}
}

func TestGetServerIPs(t *testing.T) {
	app := &App{}
	ips := app.GetServerIPs()
	t.Logf("Detected IPs: %+v", ips)
	if ips["lan"] == "" || ips["lan"] == "127.0.0.1" {
		t.Logf("LAN IP defaulted to 127.0.0.1")
	}
}

func TestGetDefaultServerLocation(t *testing.T) {
	app := &App{}
	loc := app.GetDefaultServerLocation("My Survival World")
	if loc == "" {
		t.Errorf("expected non-empty location")
	}
	if !filepath.IsAbs(loc) {
		t.Errorf("expected absolute path, got %s", loc)
	}
	t.Logf("Computed default server location: %s", loc)
}

func TestGetNextAvailablePort(t *testing.T) {
	db, err := database.NewDatabase()
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	app, _ := NewAppWithDB(db)
	port := app.GetNextAvailablePort()
	if port < 19132 || port > 65535 {
		t.Errorf("invalid port returned: %d", port)
	}
	t.Logf("Next available port: %d", port)
}


