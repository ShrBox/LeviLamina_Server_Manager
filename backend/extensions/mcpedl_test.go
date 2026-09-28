package extensions

import (
	"os"
	"strings"
	"testing"
)

func TestMCPEDLFallbackCatalog(t *testing.T) {
	client := NewMCPEDLClient()
	res := client.getFallbackCatalog("", "", 1, 20)
	if len(res.Items) == 0 {
		t.Fatalf("expected non-empty fallback items, got 0")
	}

	foundFurni := false
	for _, it := range res.Items {
		if it.Slug == "furnicraft-furniture" {
			foundFurni = true
			if it.Name == "" || it.DownloadURL == "" {
				t.Errorf("furnicraft missing name or downloadURL")
			}
		}
	}
	if !foundFurni {
		t.Errorf("furnicraft-furniture not found in fallback catalog")
	}
}

func TestMCPEDLFiles(t *testing.T) {
	client := NewMCPEDLClient()
	files := client.getFallbackFiles("furnicraft-furniture")
	if len(files) < 2 {
		t.Fatalf("expected at least 2 files for furnicraft (RP & BP), got %d", len(files))
	}
	if files[0].DownloadURL == "" {
		t.Errorf("expected non-empty download URL")
	}
}

func TestMCPEDLLiveSearch(t *testing.T) {
	client := NewMCPEDLClient()
	res, err := client.GetCatalogLive("guns", "all", "latest", 1, 10)
	if err != nil {
		t.Fatalf("unexpected error searching MCPEDL: %v", err)
	}
	if len(res.Items) == 0 {
		t.Fatalf("expected search results for 'guns', got 0")
	}
	t.Logf("Found %d items for 'guns' (total count: %d). First item: %s", len(res.Items), res.TotalCount, res.Items[0].Name)

	resBackpack, err := client.GetCatalogLive("backpack", "addons", "latest", 1, 10)
	if err != nil {
		t.Fatalf("unexpected error searching backpack: %v", err)
	}
	if len(resBackpack.Items) == 0 {
		t.Fatalf("expected search results for 'backpack', got 0")
	}
	t.Logf("Found %d items for 'backpack' in addons (total count: %d). First item: %s", len(resBackpack.Items), resBackpack.TotalCount, resBackpack.Items[0].Name)

	// Test category mismatch fallback: searching for 'guns' while category is 'maps'
	resMismatch, err := client.GetCatalogLive("guns", "maps", "latest", 1, 10)
	if err != nil {
		t.Fatalf("unexpected error searching guns in maps: %v", err)
	}
	if len(resMismatch.Items) == 0 {
		t.Fatalf("expected search results for 'guns' even with mismatched category, got 0")
	}
	t.Logf("Found %d items for 'guns' with category 'maps' (fallback worked). First item: %s", len(resMismatch.Items), resMismatch.Items[0].Name)
}

func TestMCPEDLDownloadSlugResolution(t *testing.T) {
	client := NewMCPEDLClient()
	files, err := client.GetItemFiles("dinosaur-saga-add-on")
	if err != nil {
		t.Fatalf("failed to resolve files for dinosaur-saga-add-on: %v", err)
	}
	if len(files) == 0 {
		t.Fatalf("expected at least 1 file for dinosaur-saga-add-on, got 0")
	}
	t.Logf("Resolved %d file(s) for dinosaur-saga-add-on: URL=%s", len(files), files[0].DownloadURL)
	if files[0].DownloadURL == "" || !strings.Contains(files[0].DownloadURL, "forgecdn.net") {
		t.Errorf("expected forgecdn URL, got: %s", files[0].DownloadURL)
	}

	tmpFile, err := client.DownloadItemFile(files[0].DownloadURL, files[0].FileName)
	if err != nil {
		t.Fatalf("failed to download resolved file: %v", err)
	}
	defer os.Remove(tmpFile)
	t.Logf("Successfully downloaded pack to temporary file: %s", tmpFile)
}

