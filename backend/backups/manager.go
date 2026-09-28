package backups

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"levilamina-server-manager/backend/models"
	"levilamina-server-manager/backend/security"
)

type BackupManager struct{}

func NewBackupManager() *BackupManager {
	return &BackupManager{}
}

// CreateBackup creates a .zip backup of a full server or a specific world
func (bm *BackupManager) CreateBackup(serverID, serverName, serverPath, backupType, worldName, description string) (*models.Backup, error) {
	backupsDir := filepath.Join(serverPath, "backups")
	if err := os.MkdirAll(backupsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create backups folder: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	var fileName string
	var sourceDir string

	if backupType == "WORLD" && worldName != "" {
		fileName = fmt.Sprintf("backup_%s_%s_%s.zip", sanitizeForFileName(serverName), sanitizeForFileName(worldName), timestamp)
		sourceDir = filepath.Join(serverPath, "worlds", worldName)
	} else {
		fileName = fmt.Sprintf("backup_%s_FULL_%s.zip", sanitizeForFileName(serverName), timestamp)
		sourceDir = serverPath
	}

	destZip := filepath.Join(backupsDir, fileName)
	zipFile, err := os.Create(destZip)
	if err != nil {
		return nil, fmt.Errorf("failed to create backup file %s: %w", destZip, err)
	}
	defer zipFile.Close()

	archive := zip.NewWriter(zipFile)
	defer archive.Close()

	var totalBytes int64

	err = filepath.Walk(sourceDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		// Skip backups folder itself when doing full server backup to prevent infinite recursion
		rel, err := filepath.Rel(serverPath, path)
		if err == nil {
			if strings.HasPrefix(rel, "backups") {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		if relPath == "." {
			return nil
		}

		header.Name = strings.ReplaceAll(relPath, "\\", "/")
		if info.IsDir() {
			header.Name += "/"
		} else {
			header.Method = zip.Deflate
		}

		writer, err := archive.CreateHeader(header)
		if err != nil {
			return err
		}

		if !info.IsDir() {
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()
			n, err := io.Copy(writer, file)
			if err != nil {
				return err
			}
			totalBytes += n
		}

		return nil
	})

	if err != nil {
		_ = os.Remove(destZip)
		return nil, fmt.Errorf("error during backup archiving: %w", err)
	}

	fi, err := zipFile.Stat()
	var finalSize int64
	if err == nil {
		finalSize = fi.Size()
	}

	return &models.Backup{
		ID:          fileName,
		ServerID:    serverID,
		ServerName:  serverName,
		FileName:    fileName,
		FilePath:    destZip,
		CreatedAt:   time.Now(),
		SizeBytes:   finalSize,
		Type:        backupType,
		Description: description,
		WorldName:   worldName,
	}, nil
}

// ListBackups scans serverPath/backups for existing zip archives
func (bm *BackupManager) ListBackups(serverID, serverName, serverPath string) ([]models.Backup, error) {
	backups := make([]models.Backup, 0)
	backupsDir := filepath.Join(serverPath, "backups")
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return backups, nil
		}
		return backups, err
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}

		bType := "FULL"
		if strings.Contains(e.Name(), "PRE_INSTALL") {
			bType = "PRE_INSTALL"
		} else if strings.Contains(e.Name(), "PRE_UPDATE") {
			bType = "PRE_UPDATE"
		} else if strings.Contains(e.Name(), "WORLD") {
			bType = "WORLD"
		}

		backups = append(backups, models.Backup{
			ID:          e.Name(),
			ServerID:    serverID,
			ServerName:  serverName,
			FileName:    e.Name(),
			FilePath:    filepath.Join(backupsDir, e.Name()),
			CreatedAt:   fi.ModTime(),
			SizeBytes:   fi.Size(),
			Type:        bType,
			Description: "Automated/Manual Backup",
		})
	}

	return backups, nil
}

// RestoreBackup restores a backup archive back into the server or world directory
func (bm *BackupManager) RestoreBackup(serverPath, backupFilePath string) error {
	file, err := os.Open(backupFilePath)
	if err != nil {
		return fmt.Errorf("failed to open backup archive: %w", err)
	}
	defer file.Close()

	fi, err := file.Stat()
	if err != nil {
		return err
	}

	zr, err := zip.NewReader(file, fi.Size())
	if err != nil {
		return fmt.Errorf("invalid backup zip file: %w", err)
	}

	// Restore into serverPath with security validation
	return security.ExtractZipSafely(zr, serverPath, 10*1024*1024*1024, true)
}

func sanitizeForFileName(s string) string {
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, ":", "_")
	return s
}

// PruneOldBackups deletes oldest backups in serverPath/backups if count exceeds maxRetained
func (bm *BackupManager) PruneOldBackups(serverPath string, maxRetained int) (int, error) {
	if maxRetained <= 0 {
		return 0, nil
	}
	backupsDir := filepath.Join(serverPath, "backups")
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	type fileWithTime struct {
		name    string
		modTime time.Time
	}
	var zipFiles []fileWithTime

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		zipFiles = append(zipFiles, fileWithTime{
			name:    e.Name(),
			modTime: fi.ModTime(),
		})
	}

	if len(zipFiles) <= maxRetained {
		return 0, nil
	}

	// Sort oldest first
	sort.Slice(zipFiles, func(i, j int) bool {
		return zipFiles[i].modTime.Before(zipFiles[j].modTime)
	})

	deletedCount := 0
	toDelete := len(zipFiles) - maxRetained
	for i := 0; i < toDelete; i++ {
		if err := os.Remove(filepath.Join(backupsDir, zipFiles[i].name)); err == nil {
			deletedCount++
		}
	}

	return deletedCount, nil
}
