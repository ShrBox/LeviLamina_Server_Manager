package security

import (
	"archive/zip"
	"bytes"
	"testing"
)

func TestSanitizeExtractPath(t *testing.T) {
	destDir := `C:\Minecraft\Server`

	// Safe relative paths
	safe, err := SanitizeExtractPath(destDir, "behavior_packs/my_pack/manifest.json")
	if err != nil {
		t.Fatalf("expected safe path to succeed, got %v", err)
	}
	if safe != `C:\Minecraft\Server\behavior_packs\my_pack\manifest.json` {
		t.Errorf("unexpected safe path: %s", safe)
	}

	// Path traversal attempts
	traversalPaths := []string{
		"../escape.txt",
		"../../windows/system32/cmd.exe",
		"sub/../../escape.txt",
		`..\..\..\malicious.dll`,
	}

	for _, p := range traversalPaths {
		_, err := SanitizeExtractPath(destDir, p)
		if err == nil {
			t.Errorf("expected path traversal attack %q to be blocked, but it passed!", p)
		}
	}
}

func TestExtractZipSafely_RejectsDangerousExecutables(t *testing.T) {
	tempDir := t.TempDir()

	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	f, err := zw.Create("malicious.exe")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.Write([]byte("fake executable"))
	zw.Close()

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatal(err)
	}

	err = ExtractZipSafely(zr, tempDir, 1024*1024, false)
	if err == nil {
		t.Error("expected ExtractZipSafely to reject .exe payload when allowBinaries is false, but succeeded")
	}
}
