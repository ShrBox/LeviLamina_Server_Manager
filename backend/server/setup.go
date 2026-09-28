package server

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"levilamina-server-manager/backend/lip"
	"levilamina-server-manager/backend/security"
)

var bdsDownloadRegex = regexp.MustCompile(`https://www\.minecraft\.net/bedrockdedicatedserver/bin-win/bedrock-server-[0-9\.]+\.zip`)

func resolveLatestBDSDownloadURL(ctx context.Context) string {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.minecraft.net/en-us/download/server/bedrock", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err == nil {
			match := bdsDownloadRegex.FindString(string(body))
			if match != "" {
				return match
			}
		}
	}
	return ""
}

type SetupProgressCallback func(step int, totalSteps int, percent int, status string)

type ServerSetupEngine struct {
	lipClient *lip.LipClient
}

func NewServerSetupEngine(lipClient *lip.LipClient) *ServerSetupEngine {
	return &ServerSetupEngine{
		lipClient: lipClient,
	}
}

// GitHubRelease represents GitHub API release response
type GitHubRelease struct {
	TagName string        `json:"tag_name"`
	Assets  []GitHubAsset `json:"assets"`
}

type GitHubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

// CheckServerFiles verifies if bedrock_server_mod.exe or bedrock_server.exe exist
func (se *ServerSetupEngine) CheckServerFiles(serverPath string) (hasBDS bool, hasLeviLamina bool) {
	if _, err := os.Stat(filepath.Join(serverPath, "bedrock_server.exe")); err == nil {
		hasBDS = true
	}
	if _, err := os.Stat(filepath.Join(serverPath, "bedrock_server_mod.exe")); err == nil {
		hasLeviLamina = true
	}
	return
}

// AutomateServerSetup downloads BDS, installs LeviLamina, and installs LIP
func (se *ServerSetupEngine) AutomateServerSetup(ctx context.Context, serverPath string, progress SetupProgressCallback) error {
	if err := os.MkdirAll(serverPath, 0755); err != nil {
		return fmt.Errorf("failed to access server directory: %w", err)
	}

	totalSteps := 4

	// ---------------- Step 1: Download Bedrock Dedicated Server ----------------
	bdsExePath := filepath.Join(serverPath, "bedrock_server.exe")
	bdsAlreadyPresent := false
	if fi, err := os.Stat(bdsExePath); err == nil && fi.Size() > 10*1024*1024 {
		bdsAlreadyPresent = true
		progress(1, totalSteps, 25, "Bedrock Dedicated Server binary already present.")
	} else {
		progress(1, totalSteps, 10, "Downloading official Minecraft Bedrock Dedicated Server...")
	}

	userHome, _ := os.UserHomeDir()
	cacheDir := filepath.Join(userHome, ".llsm", "cache")
	cacheZip := filepath.Join(cacheDir, "bds-cache.zip")

	var bdsData []byte

	if !bdsAlreadyPresent {
		// Fast Path 1: Check local disk cache
		if fi, err := os.Stat(cacheZip); err == nil && fi.Size() > 20*1024*1024 {
			if data, err := os.ReadFile(cacheZip); err == nil {
				if _, zErr := zip.NewReader(bytes.NewReader(data), int64(len(data))); zErr == nil {
					bdsData = data
					progress(1, totalSteps, 25, "Loaded Bedrock Dedicated Server from local cache.")
				}
			}
		}

		// Fast Path 2: Download with strict validation if not cached
		if len(bdsData) == 0 {
			bdsUrls := make([]string, 0, 3)
			if dynamicUrl := resolveLatestBDSDownloadURL(ctx); dynamicUrl != "" {
				bdsUrls = append(bdsUrls, dynamicUrl)
			}
			bdsUrls = append(bdsUrls,
				"https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.60.10.zip",
				"https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.50.07.zip",
			)

			client := &http.Client{Timeout: 90 * time.Second}
			for _, url := range bdsUrls {
				req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
				if err != nil {
					continue
				}
				req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

				resp, err := client.Do(req)
				if err == nil && resp.StatusCode == http.StatusOK {
					data, readErr := io.ReadAll(resp.Body)
					resp.Body.Close()
					if readErr == nil && len(data) > 20*1024*1024 {
						// Validate zip integrity before accepting
						if _, zErr := zip.NewReader(bytes.NewReader(data), int64(len(data))); zErr == nil {
							bdsData = data
							_ = os.MkdirAll(cacheDir, 0755)
							_ = os.WriteFile(cacheZip, data, 0644)
							break
						}
					}
				} else if resp != nil {
					resp.Body.Close()
				}
			}
		}
	}

	// ---------------- Step 2: Extract BDS into Server Directory ----------------
	if bdsAlreadyPresent {
		progress(2, totalSteps, 50, "Bedrock Dedicated Server runtime files verified.")
	} else if len(bdsData) > 0 {
		progress(2, totalSteps, 35, "Extracting Bedrock Dedicated Server files...")
		zr, err := zip.NewReader(bytes.NewReader(bdsData), int64(len(bdsData)))
		if err != nil {
			return fmt.Errorf("failed to read BDS archive: %w", err)
		}

		// Back up existing configuration files so BDS extraction doesn't overwrite custom settings
		var origPropsData, origWhitelistData, origPermissionsData []byte
		if data, err := os.ReadFile(filepath.Join(serverPath, "server.properties")); err == nil && len(data) > 0 {
			origPropsData = data
		}
		if data, err := os.ReadFile(filepath.Join(serverPath, "whitelist.json")); err == nil && len(data) > 0 {
			origWhitelistData = data
		}
		if data, err := os.ReadFile(filepath.Join(serverPath, "permissions.json")); err == nil && len(data) > 0 {
			origPermissionsData = data
		}

		// Extract safely, allowing binaries (.exe, .dll) for the server itself
		if err := security.ExtractZipSafely(zr, serverPath, 2*1024*1024*1024, true); err != nil {
			return fmt.Errorf("failed to extract BDS files: %w", err)
		}

		// Restore custom properties and files so Mojang defaults never overwrite user configuration
		if len(origPropsData) > 0 {
			_ = os.WriteFile(filepath.Join(serverPath, "server.properties"), origPropsData, 0644)
		}
		if len(origWhitelistData) > 0 {
			_ = os.WriteFile(filepath.Join(serverPath, "whitelist.json"), origWhitelistData, 0644)
		}
		if len(origPermissionsData) > 0 {
			_ = os.WriteFile(filepath.Join(serverPath, "permissions.json"), origPermissionsData, 0644)
		}
	} else {
		// If download failed and BDS is not present, check if bdsdown tool exists in server
		bdsDownPath := filepath.Join(serverPath, "bdsdown.exe")
		if _, err := os.Stat(bdsDownPath); err == nil {
			progress(2, totalSteps, 40, "Downloading BDS via bdsdown tool...")
			cmd := exec.CommandContext(ctx, bdsDownPath)
			cmd.Dir = serverPath
			_ = cmd.Run()
		}
		if _, err := os.Stat(bdsExePath); err == nil {
			progress(2, totalSteps, 50, "BDS runtime initialized successfully.")
		} else {
			return fmt.Errorf("could not download Bedrock Dedicated Server from network. Please check your internet connection and retry.")
		}
	}

	// ---------------- Step 3: Download & Install LeviLamina Loader ----------------
	hasLL := false
	if _, err := os.Stat(filepath.Join(serverPath, "bedrock_server_mod.exe")); err == nil {
		hasLL = true
	}
	if !hasLL {
		if _, err := os.Stat(filepath.Join(serverPath, "tooth_lock.json")); err == nil {
			hasLL = true
		}
	}

	if hasLL {
		progress(3, totalSteps, 75, "LeviLamina mod loader already installed and verified.")
	} else {
		progress(3, totalSteps, 60, "Downloading LeviLamina mod loader from GitHub releases...")

		client := &http.Client{Timeout: 90 * time.Second}
		llAssetUrl, err := se.findLatestLeviLaminaAsset(ctx)
		if err == nil && llAssetUrl != "" {
			req, err := http.NewRequestWithContext(ctx, "GET", llAssetUrl, nil)
			if err == nil {
				req.Header.Set("User-Agent", "LeviLaminaServerManager/1.0")
				resp, err := client.Do(req)
				if err == nil && resp.StatusCode == http.StatusOK {
					llData, err := io.ReadAll(resp.Body)
					resp.Body.Close()
					if err == nil && len(llData) > 0 {
						progress(3, totalSteps, 75, "Extracting LeviLamina framework files...")
						zr, err := zip.NewReader(bytes.NewReader(llData), int64(len(llData)))
						if err == nil {
							_ = security.ExtractZipSafely(zr, serverPath, 1024*1024*1024, true)
						}
					}
				} else if resp != nil {
					resp.Body.Close()
				}
			}
		}
	}

	// ---------------- Step 4: Setup LIP Package Manager ----------------
	progress(4, totalSteps, 85, "Configuring LIP package manager...")
	lipPath, found := se.lipClient.FindLipPath(serverPath)
	if !found {
		progress(4, totalSteps, 86, "Installing LIP package manager tool...")
		var err error
		lipPath, err = se.lipClient.InstallLipBinary()
		if err != nil {
			// Non-fatal, continue server configuration
		}
	}

	// Copy lip.exe into server directory as well for convenience
	if lipPath != "" {
		serverLip := filepath.Join(serverPath, "lip.exe")
		if _, err := os.Stat(serverLip); os.IsNotExist(err) {
			_ = copyFile(lipPath, serverLip)
		}
	} else {
		userHome, _ := os.UserHomeDir()
		appToolLip := filepath.Join(userHome, ".llsm", "tools", "lip.exe")
		if _, err := os.Stat(appToolLip); err == nil {
			serverLip := filepath.Join(serverPath, "lip.exe")
			_ = copyFile(appToolLip, serverLip)
		}
	}

	// Final check: if neither bedrock_server_mod.exe nor tooth.json exists, install LeviLamina via LIP
	hasMod := false
	if _, err := os.Stat(filepath.Join(serverPath, "bedrock_server_mod.exe")); err == nil {
		hasMod = true
	}
	if !hasMod {
		if _, err := os.Stat(filepath.Join(serverPath, "tooth.json")); err == nil {
			hasMod = true
		}
	}
	if !hasMod {
		progress(4, totalSteps, 90, "Finalizing LeviLamina setup via LIP...")
		installCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		_, _ = se.lipClient.InstallPackage(installCtx, serverPath, "github.com/LiteLDev/LeviLamina")
		cancel()
	}

	// Guard: Ensure level-name in server.properties is NEVER "Bedrock level"
	if props, err := LoadProperties(serverPath); err == nil {
		lvl := strings.TrimSpace(props.Get("level-name", ""))
		if lvl == "" || strings.EqualFold(lvl, "Bedrock level") {
			targetWorld := "World"
			entries, rErr := os.ReadDir(filepath.Join(serverPath, "worlds"))
			if rErr == nil {
				for _, e := range entries {
					if e.IsDir() && !strings.EqualFold(e.Name(), "Bedrock level") {
						targetWorld = e.Name()
						break
					}
				}
			}
			props.Set("level-name", targetWorld)
			worldDir := filepath.Join(serverPath, "worlds", targetWorld)
			_ = os.MkdirAll(worldDir, 0755)
			_ = os.WriteFile(filepath.Join(worldDir, "levelname.txt"), []byte(targetWorld), 0644)
		}
		if props.Get("transport", "") == "" || strings.EqualFold(props.Get("transport", ""), "nethernet") {
			props.Set("transport", "raknet")
		}
		props.Set("allow-cheats", "true")
		_ = props.Save()
	}

	// Purge any unwanted "Bedrock level" world directory completely
	_ = os.RemoveAll(filepath.Join(serverPath, "worlds", "Bedrock level"))

	progress(4, totalSteps, 100, "Automated setup complete! Server is ready to start.")
	return nil
}

func (se *ServerSetupEngine) findLatestLeviLaminaAsset(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/LiteLDev/LeviLamina/releases/latest", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "LeviLaminaServerManager/1.0")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP error %d fetching GitHub releases", resp.StatusCode)
	}

	var rel GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return "", err
	}

	for _, a := range rel.Assets {
		name := strings.ToLower(a.Name)
		// Look for server release windows zip
		if strings.Contains(name, "server") && strings.Contains(name, "windows") && strings.HasSuffix(name, ".zip") {
			return a.BrowserDownloadURL, nil
		}
	}

	if len(rel.Assets) > 0 {
		return rel.Assets[0].BrowserDownloadURL, nil
	}

	return "", fmt.Errorf("no matching LeviLamina server asset found in release %s", rel.TagName)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
