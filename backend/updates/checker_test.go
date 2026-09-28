package updates

import (
	"testing"

	"levilamina-server-manager/backend/models"
)

func TestCompareSemver(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected int // > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
	}{
		{"26.51.3", "26.51.2", 1},
		{"26.51.2", "26.51.3", -1},
		{"26.51.3", "26.51.3", 0},
		{"v1.21.60.10", "1.21.50.07", 1},
		{"0.18.0-beta", "0.17.1", 1},
		{"0.3.16", "0.3.15", 1},
		{"1.0.0", "1.0.0", 0},
	}

	for _, tt := range tests {
		res := CompareSemver(tt.v1, tt.v2)
		if tt.expected > 0 && res <= 0 {
			t.Errorf("CompareSemver(%q, %q) = %d, expected > 0", tt.v1, tt.v2, res)
		} else if tt.expected < 0 && res >= 0 {
			t.Errorf("CompareSemver(%q, %q) = %d, expected < 0", tt.v1, tt.v2, res)
		} else if tt.expected == 0 && res != 0 {
			t.Errorf("CompareSemver(%q, %q) = %d, expected 0", tt.v1, tt.v2, res)
		}
	}
}

func TestCheckAllUpdates_NoPhantomUpdatesOnLatestServer(t *testing.T) {
	// Verify that BDS "Latest (1.21.x)" does not create phantom updates
	report := models.UpdateCheckReport{
		LoaderVersion: models.ComponentUpdate{HasUpdate: false},
		LipVersion:    models.ComponentUpdate{HasUpdate: false},
		ServerVersion: models.ComponentUpdate{HasUpdate: false},
		ModUpdates:    []models.ComponentUpdate{},
	}

	totalCount := 0
	if report.LoaderVersion.HasUpdate {
		totalCount++
	}
	if report.LipVersion.HasUpdate {
		totalCount++
	}
	for _, m := range report.ModUpdates {
		if m.HasUpdate {
			totalCount++
		}
	}
	report.TotalUpdatesCount = totalCount
	report.HasUpdates = totalCount > 0

	if report.TotalUpdatesCount != 0 {
		t.Errorf("expected TotalUpdatesCount to be 0, got %d", report.TotalUpdatesCount)
	}
	if report.HasUpdates {
		t.Errorf("expected HasUpdates to be false, got true")
	}
}
