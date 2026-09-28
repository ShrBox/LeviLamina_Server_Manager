package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPreflightEngine_SanitizesPropertiesAndGeneratesFiles(t *testing.T) {
	tempDir := t.TempDir()

	// Setup a server.properties with missing portv6 and nethernet transport
	propsContent := "server-name=TestServer\ntransport=nethernet\nserver-port=19132\nwhite-list=true\n"
	_ = os.WriteFile(filepath.Join(tempDir, "server.properties"), []byte(propsContent), 0644)

	pe := NewPreflightEngine()
	report, err := pe.RunPreflight(tempDir, nil)
	if err != nil {
		t.Fatalf("RunPreflight failed: %v", err)
	}

	if !report.Success {
		t.Fatalf("expected report.Success to be true")
	}

	// Verify server.properties has been sanitized
	props, err := LoadProperties(tempDir)
	if err != nil {
		t.Fatalf("failed to reload properties: %v", err)
	}

	if props.Get("transport", "") != "raknet" {
		t.Errorf("expected transport=raknet, got %s", props.Get("transport", ""))
	}

	if props.Get("server-portv6", "") != "19133" {
		t.Errorf("expected server-portv6=19133, got %s", props.Get("server-portv6", ""))
	}

	// Verify whitelist.json and permissions.json exist
	if _, err := os.Stat(filepath.Join(tempDir, "whitelist.json")); os.IsNotExist(err) {
		t.Errorf("expected whitelist.json to be created")
	}
	if _, err := os.Stat(filepath.Join(tempDir, "permissions.json")); os.IsNotExist(err) {
		t.Errorf("expected permissions.json to be created")
	}
}
