package bedrinth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"levilamina-server-manager/backend/lip"
	"levilamina-server-manager/backend/models"
)

const (
	IndexURL        = "https://lipr.levimc.org/index.json"
	CacheExpiration = 30 * time.Minute
)

type rawIndex struct {
	FormatVersion int                   `json:"format_version"`
	FormatUUID    string                `json:"format_uuid"`
	Packages      map[string]rawPackage `json:"packages"`
}

type rawPackage struct {
	StargazerCount int                   `json:"stargazer_count"`
	UpdatedAt      string                `json:"updated_at"`
	Info           rawInfo               `json:"info"`
	Variants       map[string]rawVariant `json:"variants"`
}

type rawInfo struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	AvatarURL   string   `json:"avatar_url"`
}

type rawVariant struct {
	Versions []string `json:"versions"`
}

type BedrinthClient struct {
	lipClient   *lip.LipClient
	cacheLock   sync.RWMutex
	cachedList  []models.BedrinthPackage
	lastFetched time.Time
	httpClient  *http.Client
}

func NewBedrinthClient(lipClient *lip.LipClient) *BedrinthClient {
	return &BedrinthClient{
		lipClient: lipClient,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// GetPackages returns all indexed Bedrinth packages, cached in-memory and on-disk
func (c *BedrinthClient) GetPackages() ([]models.BedrinthPackage, error) {
	c.cacheLock.RLock()
	if len(c.cachedList) > 0 && time.Since(c.lastFetched) < CacheExpiration {
		defer c.cacheLock.RUnlock()
		return c.cachedList, nil
	}
	c.cacheLock.RUnlock()

	c.cacheLock.Lock()
	defer c.cacheLock.Unlock()

	// Double check after acquiring write lock
	if len(c.cachedList) > 0 && time.Since(c.lastFetched) < CacheExpiration {
		return c.cachedList, nil
	}

	// 1. Attempt network fetch
	packages, err := c.fetchFromNetwork()
	if err == nil && len(packages) > 0 {
		c.cachedList = packages
		c.lastFetched = time.Now()
		_ = c.saveDiskCache(packages)
		return packages, nil
	}

	// 2. Fallback to disk cache if network fails or is offline
	if cachedDisk, diskErr := c.loadDiskCache(); diskErr == nil && len(cachedDisk) > 0 {
		c.cachedList = cachedDisk
		c.lastFetched = time.Now()
		return cachedDisk, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to fetch Bedrinth package index: %w", err)
	}

	return nil, fmt.Errorf("no packages available in Bedrinth index")
}

// ForceRefresh forces a fresh network fetch of the Bedrinth package index, bypassing the cache
func (c *BedrinthClient) ForceRefresh() ([]models.BedrinthPackage, error) {
	c.cacheLock.Lock()
	defer c.cacheLock.Unlock()

	packages, err := c.fetchFromNetwork()
	if err == nil && len(packages) > 0 {
		c.cachedList = packages
		c.lastFetched = time.Now()
		_ = c.saveDiskCache(packages)
		return packages, nil
	}

	if len(c.cachedList) > 0 {
		return c.cachedList, nil
	}
	return nil, err
}

func (c *BedrinthClient) fetchFromNetwork() ([]models.BedrinthPackage, error) {
	req, err := http.NewRequest("GET", IndexURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "LeviLaminaServerManager/1.0 (Windows NT 10.0; Win64; x64)")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error %d: %s", resp.StatusCode, resp.Status)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var idx rawIndex
	if err := json.Unmarshal(bodyBytes, &idx); err != nil {
		return nil, fmt.Errorf("failed to parse index JSON: %w", err)
	}

	var result []models.BedrinthPackage
	for tooth, pkg := range idx.Packages {
		// Collect unique versions
		versionSet := make(map[string]struct{})
		for _, variant := range pkg.Variants {
			for _, v := range variant.Versions {
				if v != "" {
					versionSet[v] = struct{}{}
				}
			}
		}
		var versions []string
		for v := range versionSet {
			versions = append(versions, v)
		}
		// Sort versions descending
		sort.Slice(versions, func(i, j int) bool {
			return versions[i] > versions[j]
		})

		cleanTags := pkg.Info.Tags
		if cleanTags == nil {
			cleanTags = []string{}
		}

		result = append(result, models.BedrinthPackage{
			Tooth:       tooth,
			Name:        pkg.Info.Name,
			Description: pkg.Info.Description,
			AvatarURL:   pkg.Info.AvatarURL,
			Tags:        cleanTags,
			Stars:       pkg.StargazerCount,
			UpdatedAt:   pkg.UpdatedAt,
			Versions:    versions,
		})
	}

	// Sort by stars descending by default (popular packages first)
	sort.Slice(result, func(i, j int) bool {
		if result[i].Stars != result[j].Stars {
			return result[i].Stars > result[j].Stars
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})

	return result, nil
}

func (c *BedrinthClient) getCacheFilePath() string {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "bedrinth_index.json")
	}
	dir := filepath.Join(userHome, ".llsm", "cache")
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "bedrinth_index.json")
}

func (c *BedrinthClient) saveDiskCache(packages []models.BedrinthPackage) error {
	path := c.getCacheFilePath()
	data, err := json.Marshal(packages)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (c *BedrinthClient) loadDiskCache() ([]models.BedrinthPackage, error) {
	path := c.getCacheFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var packages []models.BedrinthPackage
	if err := json.Unmarshal(data, &packages); err != nil {
		return nil, err
	}
	return packages, nil
}

// InstallPackage invokes lip install <tooth> on the target server
func (c *BedrinthClient) InstallPackage(serverPath string, tooth string, version string) (lip.CommandResult, error) {
	pkgSpec := tooth
	if version != "" && !strings.EqualFold(version, "latest") {
		pkgSpec = fmt.Sprintf("%s@%s", tooth, version)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	res, err := c.lipClient.RunLipCommand(ctx, serverPath, "install", pkgSpec, "-y")
	if res == nil {
		return lip.CommandResult{Success: false, Error: "nil result"}, err
	}
	return *res, err
}

// UninstallPackage invokes lip uninstall <tooth> on the target server
func (c *BedrinthClient) UninstallPackage(serverPath string, tooth string) (lip.CommandResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	res, err := c.lipClient.RunLipCommand(ctx, serverPath, "uninstall", tooth, "-y")
	if res == nil {
		return lip.CommandResult{Success: false, Error: "nil result"}, err
	}
	return *res, err
}
