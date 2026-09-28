package extensions

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindRustcoinExe(t *testing.T) {
	mgr := NewExtensionManager(t.TempDir())
	exe := mgr.FindRustcoinExe()
	if exe == "" {
		t.Fatalf("expected to find Rustcoin CLI executable on system, but got empty string")
	}
	t.Logf("Found Rustcoin CLI executable at: %s", exe)

	if fi, err := os.Stat(exe); err != nil || fi.IsDir() {
		t.Fatalf("Rustcoin CLI executable at %s does not exist or is a directory", exe)
	}
}

func TestGetAllPackageDirs(t *testing.T) {
	temp := t.TempDir()
	_ = os.MkdirAll(filepath.Join(temp, "packs"), 0755)
	mgr := NewExtensionManager(temp)
	dirs := mgr.GetAllPackageDirs("")
	if len(dirs) == 0 {
		t.Fatalf("expected package directories to be found")
	}
	t.Logf("Discovered package directories: %v", dirs)
}

func TestListToolCoinDownloadsWithPacks(t *testing.T) {
	mgr := NewExtensionManager(t.TempDir())
	packs, err := mgr.ListToolCoinDownloads("")
	if err != nil {
		t.Fatalf("unexpected error listing packages: %v", err)
	}
	t.Logf("Discovered %d downloaded packages across all locations", len(packs))
	for _, p := range packs {
		t.Logf("  Package: %s (Type: %s, Size: %s, Path: %s)", p.Name, p.Type, p.SizeFormatted, p.Path)
	}
}

func TestDownloadViaRustcoin(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration download test in short mode")
	}

	mgr := NewExtensionManager(t.TempDir())
	var progressLogs []string
	path, err := mgr.DownloadViaRustcoin("Furniture", func(status string) {
		progressLogs = append(progressLogs, status)
		t.Logf("[Rustcoin Progress] %s", status)
	})

	if err != nil {
		t.Fatalf("DownloadViaRustcoin failed: %v", err)
	}

	t.Logf("Downloaded and decrypted package at: %s", path)
	if fi, err := os.Stat(path); err != nil || fi.Size() == 0 {
		t.Fatalf("expected non-empty downloaded file at %s", path)
	}

	ext := filepath.Ext(path)
	if ext != ".mcaddon" && ext != ".mcpack" && ext != ".zip" {
		t.Fatalf("unexpected extension for downloaded pack: %s", ext)
	}
}
