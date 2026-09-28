package database

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"levilamina-server-manager/backend/models"
)

type Database struct {
	mu           sync.RWMutex
	filePath     string
	data         storeData
}

type storeData struct {
	ActiveServerID string                   `json:"activeServerId"`
	Servers        map[string]models.Server `json:"servers"`
	Backups        map[string]models.Backup `json:"backups"`
	Preferences    map[string]string        `json:"preferences"`
}

func NewDatabase() (*Database, error) {
	userHome, err := os.UserHomeDir()
	if err != nil {
		userHome = "."
	}

	appDir := filepath.Join(userHome, ".llsm")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create llsm data directory: %w", err)
	}

	dbFile := filepath.Join(appDir, "store.json")
	return NewDatabaseWithPath(dbFile)
}

func NewDatabaseWithPath(dbFile string) (*Database, error) {
	dir := filepath.Dir(dbFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	db := &Database{
		filePath: dbFile,
		data: storeData{
			Servers:     make(map[string]models.Server),
			Backups:     make(map[string]models.Backup),
			Preferences: make(map[string]string),
		},
	}

	if data, err := os.ReadFile(dbFile); err == nil {
		_ = json.Unmarshal(data, &db.data)
		if db.data.Servers == nil {
			db.data.Servers = make(map[string]models.Server)
		}
		if db.data.Backups == nil {
			db.data.Backups = make(map[string]models.Backup)
		}
		if db.data.Preferences == nil {
			db.data.Preferences = make(map[string]string)
		}
	} else {
		_ = db.save()
	}

	return db, nil
}

func (db *Database) save() error {
	data, err := json.MarshalIndent(db.data, "", "  ")
	if err != nil {
		return err
	}
	tmpFile := db.filePath + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmpFile, db.filePath)
}

func (db *Database) GetServers() []models.Server {
	db.mu.RLock()
	defer db.mu.RUnlock()
	res := make([]models.Server, 0, len(db.data.Servers))
	for _, s := range db.data.Servers {
		res = append(res, s)
	}
	return res
}

func (db *Database) GetServer(id string) (*models.Server, bool) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	s, ok := db.data.Servers[id]
	return &s, ok
}

func (db *Database) SaveServer(s models.Server) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	s.UpdatedAt = time.Now()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = s.UpdatedAt
	}
	db.data.Servers[s.ID] = s
	if db.data.ActiveServerID == "" {
		db.data.ActiveServerID = s.ID
	}
	return db.save()
}

func (db *Database) DeleteServer(id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	delete(db.data.Servers, id)
	if db.data.ActiveServerID == id {
		db.data.ActiveServerID = ""
		for k := range db.data.Servers {
			db.data.ActiveServerID = k
			break
		}
	}
	return db.save()
}

func (db *Database) GetActiveServerID() string {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.data.ActiveServerID
}

func (db *Database) SetActiveServerID(id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.data.ActiveServerID = id
	return db.save()
}

func (db *Database) SaveBackup(b models.Backup) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.data.Backups[b.ID] = b
	return db.save()
}

func (db *Database) GetBackups(serverID string) []models.Backup {
	db.mu.RLock()
	defer db.mu.RUnlock()
	res := make([]models.Backup, 0)
	for _, b := range db.data.Backups {
		if serverID == "" || b.ServerID == serverID {
			res = append(res, b)
		}
	}
	return res
}

func (db *Database) GetPreference(key, defaultVal string) string {
	db.mu.RLock()
	defer db.mu.RUnlock()
	if v, ok := db.data.Preferences[key]; ok {
		return v
	}
	return defaultVal
}

func (db *Database) SetPreference(key, value string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	db.data.Preferences[key] = value
	return db.save()
}
