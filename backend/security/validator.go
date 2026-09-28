package security

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

var DangerousExtensions = map[string]bool{
	".exe": true,
	".bat": true,
	".cmd": true,
	".vbs": true,
	".ps1": true,
	".scr": true,
	".pif": true,
}

// SanitizeExtractPath prevents zip slip and path traversal vulnerabilities
func SanitizeExtractPath(destDir, targetPath string) (string, error) {
	// Clean and join
	cleanedDest := filepath.Clean(destDir)
	cleanTarget := filepath.Clean(targetPath)

	// Check for path traversal elements
	if strings.Contains(cleanTarget, "..") {
		return "", fmt.Errorf("security error: path traversal attempt detected: %s", targetPath)
	}

	fullPath := filepath.Join(cleanedDest, cleanTarget)

	// Ensure the fullPath starts with cleanedDest
	rel, err := filepath.Rel(cleanedDest, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || strings.HasPrefix(rel, string(filepath.Separator)) {
		return "", fmt.Errorf("security error: destination escapes sandbox directory: %s", targetPath)
	}

	return fullPath, nil
}

// ExtractZipSafely extracts zip files with strict size limits and path validation
func ExtractZipSafely(zipReader *zip.Reader, targetDir string, maxSizeBytes int64, allowBinaries bool) error {
	var totalBytes int64 = 0

	for _, file := range zipReader.File {
		// Enforce size limit against zip bombs
		if file.UncompressedSize64 > 500*1024*1024 { // 500MB per file limit
			return fmt.Errorf("file %s exceeds maximum allowed uncompressed size", file.Name)
		}

		totalBytes += int64(file.UncompressedSize64)
		if maxSizeBytes > 0 && totalBytes > maxSizeBytes {
			return fmt.Errorf("archive exceeds total extraction size limit of %d bytes", maxSizeBytes)
		}

		// Check for forbidden executable files if allowBinaries is false
		ext := strings.ToLower(filepath.Ext(file.Name))
		if !allowBinaries && DangerousExtensions[ext] {
			return fmt.Errorf("security error: archive contains forbidden executable payload %s", file.Name)
		}

		destPath, err := SanitizeExtractPath(targetDir, file.Name)
		if err != nil {
			return err
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, 0755); err != nil {
				return fmt.Errorf("failed to create directory %s: %w", destPath, err)
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return fmt.Errorf("failed to create parent dir for %s: %w", destPath, err)
		}

		srcFile, err := file.Open()
		if err != nil {
			return fmt.Errorf("failed to open zipped file %s: %w", file.Name, err)
		}

		dstFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			srcFile.Close()
			return fmt.Errorf("failed to create target file %s: %w", destPath, err)
		}

		// Copy with limit
		copied, err := io.Copy(dstFile, io.LimitReader(srcFile, int64(file.UncompressedSize64)+1))
		srcFile.Close()
		dstFile.Close()

		if err != nil {
			return fmt.Errorf("error extracting %s: %w", file.Name, err)
		}
		if copied > int64(file.UncompressedSize64) {
			return fmt.Errorf("decompression bomb detected in %s", file.Name)
		}
	}

	return nil
}
