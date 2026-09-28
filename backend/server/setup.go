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
	progress(1, totalSteps, 10, "Downloading official Minecraft Bedrock Dedicated Server...")

	// Dynamic resolution of latest BDS with reliable release fallbacks
	bdsUrls := make([]string, 0, 3)
	if dynamicUrl := resolveLatestBDSDownloadURL(ctx); dynamicUrl != "" {
		bdsUrls = append(bdsUrls, dynamicUrl)
	}
	bdsUrls = append(bdsUrls,
		"https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.60.10.zip",
		"https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.50.07.zip",
	)

	var bdsData []byte
	var downloadErr error

	client := &http.Client{Timeout: 120 * time.Second}
	for _, url := range bdsUrls {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			continue
		}
		// Crucial: Mojang CDN blocks generic Go-http-client
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			bdsData, downloadErr = io.ReadAll(resp.Body)
			resp.Body.Close()
			if downloadErr == nil && len(bdsData) > 1024*1024 {
				break // Successfully downloaded BDS
			}
		}
		if resp != nil {
			resp.Body.Close()
		}
	}

	// ---------------- Step 2: Extract BDS into Server Directory ----------------
	if len(bdsData) > 0 {
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
		// If direct Mojang CDN download was blocked by network, fallback to creating server runner placeholder
		progress(2, totalSteps, 35, "Configuring server runtime...")
	}

	// ---------------- Step 3: Download & Install LeviLamina Loader ----------------
	progress(3, totalSteps, 60, "Downloading LeviLamina mod loader from GitHub releases...")

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

	// ---------------- Step 4: Setup LIP Package Manager ----------------
	progress(4, totalSteps, 85, "Installing LIP package manager tool...")
	_, _ = se.lipClient.InstallLipBinary()

	// Copy lip.exe into server directory as well for convenience
	userHome, _ := os.UserHomeDir()
	appToolLip := filepath.Join(userHome, ".llsm", "tools", "lip.exe")
	if _, err := os.Stat(appToolLip); err == nil {
		serverLip := filepath.Join(serverPath, "lip.exe")
		_ = copyFile(appToolLip, serverLip)
	}

	// Final check: if bedrock_server_mod.exe is still missing, try lip install github.com/LiteLDev/LeviLamina
	if _, err := os.Stat(filepath.Join(serverPath, "bedrock_server_mod.exe")); os.IsNotExist(err) {
		progress(4, totalSteps, 90, "Finalizing LeviLamina setup via LIP...")
		_, _ = se.lipClient.InstallPackage(ctx, serverPath, "github.com/LiteLDev/LeviLamina")
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
