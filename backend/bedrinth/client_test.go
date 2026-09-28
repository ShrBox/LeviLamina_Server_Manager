package bedrinth

import (
	"testing"

	"levilamina-server-manager/backend/lip"
)

func TestGetPackages(t *testing.T) {
	client := NewBedrinthClient(lip.NewLipClient())
	pkgs, err := client.GetPackages()
	if err != nil {
		t.Fatalf("Failed to fetch Bedrinth packages: %v", err)
	}
	if len(pkgs) == 0 {
		t.Fatalf("Expected Bedrinth packages, got 0")
	}
	t.Logf("Successfully fetched %d Bedrinth packages from index", len(pkgs))

	// Verify sample package fields
	first := pkgs[0]
	t.Logf("Top package: %s (%s) - %d stars - %d versions", first.Name, first.Tooth, first.Stars, len(first.Versions))
	if first.Tooth == "" {
		t.Errorf("Expected non-empty Tooth for top package")
	}
}
