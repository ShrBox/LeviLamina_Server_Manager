package lip

import (
	"os"
	"testing"
)

func TestInstallLipBinary(t *testing.T) {
	c := NewLipClient()
	path, err := c.InstallLipBinary()
	if err != nil {
		t.Fatalf("InstallLipBinary failed: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("Downloaded lip.exe does not exist at %s", path)
	}
	t.Logf("Successfully installed lip at: %s", path)
}
