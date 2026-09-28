package extensions

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGetToolCoinCatalogRealPacks(t *testing.T) {
	tempDir := t.TempDir()
	packsDir := filepath.Join(tempDir, "packs")
	_ = os.MkdirAll(packsDir, 0755)

	// Create dummy test packs so test is self-contained
	for i := 1; i <= 5; i++ {
		dummyPack := filepath.Join(packsDir, fmt.Sprintf("test_pack_%d.mcaddon", i))
		f, _ := os.Create(dummyPack)
		zw := zip.NewWriter(f)
		w, _ := zw.Create("manifest.json")
		_, _ = w.Write([]byte(fmt.Sprintf(`{
			"format_version": 2,
			"header": {"name": "Test Pack %d", "uuid": "00000000-0000-0000-0000-00000000000%d", "version": [1, 0, 0]},
			"modules": [{"type": "data", "uuid": "11111111-1111-1111-1111-11111111111%d", "version": [1, 0, 0]}]
		}`, i, i, i)))
		// Add pack_icon.png
		iw, _ := zw.Create("pack_icon.png")
		_, _ = iw.Write([]byte("fake png"))
		_ = zw.Close()
		_ = f.Close()
	}

	extMgr := NewExtensionManager(tempDir)
	items := extMgr.GetToolCoinCatalog("", "all")

	if len(items) == 0 {
		t.Fatalf("expected catalog items, got 0")
	}

	foundRealPacks := 0
	seenNames := make(map[string]bool)
	for _, item := range items {
		lowerName := strings.ToLower(item.Name)
		if seenNames[lowerName] {
			t.Errorf("Duplicate item detected in catalog: %s (ID: %s)", item.Name, item.ID)
		}
		seenNames[lowerName] = true

		if item.IsInstalled {
			foundRealPacks++
			// Check that name does not contain raw translation keys
			if strings.HasPrefix(item.Name, "pack.") {
				t.Errorf("Pack name should not be raw translation key: %s", item.Name)
			}
		}
	}

	if foundRealPacks < 5 {
		t.Errorf("Expected at least 5 local packs, got %d", foundRealPacks)
	}
}

func TestResolvedMarketplaceItems(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("Cannot find user home dir")
	}
	llsmDir := filepath.Join(home, ".llsm")
	extMgr := NewExtensionManager(llsmDir)

	testCases := []struct {
		marketUUID      string
		expectedTitle   string
		expectedCreator string
	}{
		{
			marketUUID:      "000ed90d-5497-4d32-990e-c44f007542c4",
			expectedTitle:   "The Grumpus Tale",
			expectedCreator: "The Hive",
		},
		{
			marketUUID:      "001ea2b9-3821-466c-b144-0edb9d07d42c",
			expectedTitle:   "Noob Pro Hacker Witch House",
			expectedCreator: "In Mine",
		},
		{
			marketUUID:      "0028db15-17bc-490b-ab7c-44d2a97779d8",
			expectedTitle:   "Mine & Magic",
			expectedCreator: "JFCrafters",
		},
		{
			marketUUID:      "002d007c-3d8b-41f5-b700-bce583a8da3c",
			expectedTitle:   "Ships in Bottles",
			expectedCreator: "Pixelusion",
		},
		{
			marketUUID:      "0047a8fa-8f3c-4a2f-8b0b-1c169a3cb915",
			expectedTitle:   "WEAPONS++ ELEMENTS",
			expectedCreator: "Kubo Studios",
		},
		{
			marketUUID:      "026e14b6-f712-4f7b-80b9-4e2a57c50fd7",
			expectedTitle:   "Paleocraft: Dinosaur Breakout",
			expectedCreator: "CompyCraft",
		},
		{
			marketUUID:      "053bbc6a-d0e6-4f11-a0c5-d855b546b9fa",
			expectedTitle:   "More TNT! Add-On",
			expectedCreator: "Tsunami Studios",
		},
		{
			marketUUID:      "06e1dcb8-237e-4b3c-971e-ad6a8b32126d",
			expectedTitle:   "Spark Portals Add-On",
			expectedCreator: "Spark Universe",
		},
		{
			marketUUID:      "16931b99-90af-4343-8022-a0c457c04161",
			expectedTitle:   "DragonFire Lite Add-On",
			expectedCreator: "Spectral Studios",
		},
		{
			marketUUID:      "2433f972-5f59-43cb-900a-9ccf68f09e25",
			expectedTitle:   "Chest Pets Add-On 1.1",
			expectedCreator: "Float Studios",
		},
		{
			marketUUID:      "25d24ab1-c492-409e-b4a7-41d8fe2d6fa7",
			expectedTitle:   "Security Add-On",
			expectedCreator: "4KS Studios",
		},
	}

	for _, tc := range testCases {
		meta := extMgr.catalog.Resolve(tc.marketUUID, "", "world_template")
		t.Logf("Resolved %s: Title=%q, Creator=%q, Thumb=%s", tc.marketUUID[:8], meta.Title, meta.Creator, meta.ThumbnailURL)

		if meta.Title != tc.expectedTitle {
			t.Errorf("Expected title %q, got %q", tc.expectedTitle, meta.Title)
		}
		if meta.Creator != tc.expectedCreator {
			t.Errorf("Expected creator %q, got %q", tc.expectedCreator, meta.Creator)
		}
		if !strings.HasPrefix(meta.ThumbnailURL, "https://") {
			t.Errorf("Expected official CDN https:// thumbnail URL, got %q", meta.ThumbnailURL)
		}
	}
}

func TestGetToolCoinCatalogLiveItems(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("Cannot find user home dir")
	}
	llsmDir := filepath.Join(home, ".llsm")
	extMgr := NewExtensionManager(llsmDir)

	resp, err := extMgr.GetToolCoinCatalogLive("", "all", 1, 24)
	if err != nil {
		t.Fatalf("GetToolCoinCatalogLive failed: %v", err)
	}

	t.Logf("Total count: %d, Page items: %d", resp.TotalCount, len(resp.Items))
	if len(resp.Items) == 0 {
		t.Fatalf("expected items on page 1, got 0")
	}

	for i, it := range resp.Items[:10] {
		t.Logf("[%d] ID=%s Name=%q Author=%q Thumb=%s", i, it.ID[:8], it.Name, it.Author, it.ThumbnailURL)
		if strings.HasPrefix(it.Name, "World Template #") || strings.HasPrefix(it.Name, "Bedrock Add-On #") {
			t.Errorf("Item %s should have authentic title, but has fallback title %q", it.ID[:8], it.Name)
		}
		if strings.HasPrefix(it.ThumbnailURL, "data:image/svg") {
			t.Errorf("Item %s should have real thumbnail, but has fallback SVG", it.ID[:8])
		}
	}
}


