package extensions

import (
	"archive/zip"
	"bufio"
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var (
	ansiRegex     = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)
	resultLineRe  = regexp.MustCompile(`^\s*(\d+)\.\s+(.*?)\s+\((.*?)\)\s+\[(.*?)\]\s*([✓X])?`)
)

//go:embed bin/marketplace_runtime.pkg
var embeddedMarketplacePkg []byte

func stripAnsiColor(s string) string {
	return ansiRegex.ReplaceAllString(s, "")
}

// EnsureRustcoinEngine auto-extracts the embedded Marketplace runtime files strictly inside the app files directory
func (m *ExtensionManager) EnsureRustcoinEngine() string {
	targetDir := filepath.Join(m.configDir, "bin")
	_ = os.MkdirAll(targetDir, 0755)

	exePath := filepath.Join(targetDir, "rustcoin.exe")
	keysPath := filepath.Join(targetDir, "keys.tsv")

	// If already extracted and valid, return exePath
	if fi, err := os.Stat(exePath); err == nil && fi.Size() > 100000 {
		if _, kErr := os.Stat(keysPath); kErr == nil {
			return exePath
		}
	}

	if len(embeddedMarketplacePkg) > 0 {
		zr, err := zip.NewReader(bytes.NewReader(embeddedMarketplacePkg), int64(len(embeddedMarketplacePkg)))
		if err == nil {
			for _, f := range zr.File {
				outPath := filepath.Join(targetDir, filepath.Base(f.Name))
				rc, err := f.Open()
				if err != nil {
					continue
				}
				mode := f.Mode()
				if strings.HasSuffix(strings.ToLower(f.Name), ".exe") {
					mode = 0755
				}
				outFile, err := os.OpenFile(outPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
				if err == nil {
					_, _ = io.Copy(outFile, rc)
					outFile.Close()
				}
				rc.Close()
			}
		}
	}

	if fi, err := os.Stat(exePath); err == nil && !fi.IsDir() {
		return exePath
	}
	return ""
}

// FindRustcoinExe returns the Marketplace CLI executable located strictly within the app files
func (m *ExtensionManager) FindRustcoinExe() string {
	// First ensure embedded engine is extracted inside app files
	if extracted := m.EnsureRustcoinEngine(); extracted != "" {
		return extracted
	}

	candidate := filepath.Join(m.configDir, "bin", "rustcoin.exe")
	if fi, err := os.Stat(candidate); err == nil && !fi.IsDir() {
		return candidate
	}

	if path, err := exec.LookPath("rustcoin.exe"); err == nil {
		return path
	}

	return ""
}

// RustcoinItem represents an item parsed from Rustcoin CLI search output
type RustcoinItem struct {
	Index   int
	Title   string
	Creator string
	Type    string
	HasKey  bool
}

// DownloadViaRustcoin downloads and decrypts an addon using Rustcoin CLI
func (m *ExtensionManager) DownloadViaRustcoin(searchTerm string, onProgress func(string)) (string, error) {
	exePath := m.FindRustcoinExe()
	if exePath == "" {
		return "", fmt.Errorf("Rustcoin CLI executable not found on system")
	}

	workDir := filepath.Dir(exePath)
	packsDir := filepath.Join(workDir, "packs")
	_ = os.MkdirAll(packsDir, 0755)

	// Snapshot files before download to detect newly created file
	initialFiles := make(map[string]int64)
	if entries, err := os.ReadDir(packsDir); err == nil {
		for _, e := range entries {
			if info, err := e.Info(); err == nil {
				initialFiles[e.Name()] = info.ModTime().UnixNano()
			}
		}
	}

	cmd := exec.Command(exePath)
	cmd.Dir = workDir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return "", fmt.Errorf("failed to open stdin pipe to rustcoin: %w", err)
	}
	defer stdin.Close()

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("failed to open stdout pipe to rustcoin: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to start rustcoin process: %w", err)
	}

	defer func() {
		_ = cmd.Process.Kill()
	}()

	reader := bufio.NewReader(stdout)
	readChan := make(chan string, 100)
	errChan := make(chan error, 1)

	// Stream stdout line by line
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := reader.Read(buf)
			if n > 0 {
				readChan <- stripAnsiColor(string(buf[:n]))
			}
			if err != nil {
				if err != io.EOF {
					errChan <- err
				}
				close(readChan)
				return
			}
		}
	}()

	var accum strings.Builder

	readUntil := func(target string, timeout time.Duration) (string, error) {
		deadline := time.After(timeout)
		for {
			select {
			case chunk, ok := <-readChan:
				if !ok {
					return accum.String(), fmt.Errorf("process closed stdout before '%s'", target)
				}
				accum.WriteString(chunk)
				if onProgress != nil {
					// Extract clean status lines
					lines := strings.Split(chunk, "\n")
					for _, l := range lines {
						trimmed := strings.TrimSpace(l)
						if strings.HasPrefix(trimmed, "▸") || strings.HasPrefix(trimmed, "✓") || strings.HasPrefix(trimmed, "Downloading:") {
							onProgress(trimmed)
						}
					}
				}
				if strings.Contains(accum.String(), target) {
					res := accum.String()
					accum.Reset()
					return res, nil
				}
			case <-deadline:
				return accum.String(), fmt.Errorf("timeout waiting for '%s' (accum: %s)", target, accum.String())
			case err := <-errChan:
				return accum.String(), err
			}
		}
	}

	// 1. Wait for search prompt
	if onProgress != nil {
		onProgress("Authenticating with PlayFab engine...")
	}
	_, err = readUntil("Search [Filter: Default]:", 25*time.Second)
	if err != nil {
		return "", fmt.Errorf("Rustcoin engine login timeout: %w", err)
	}

	// 2. Send query
	cleanQuery := strings.TrimSpace(searchTerm)
	if onProgress != nil {
		onProgress(fmt.Sprintf("Searching catalog for '%s'...", cleanQuery))
	}
	if _, err := io.WriteString(stdin, cleanQuery+"\n"); err != nil {
		return "", fmt.Errorf("failed to send query: %w", err)
	}

	// 3. Wait for Action prompt or error
	actionOut, err := readUntil("Action:", 20*time.Second)
	if err != nil {
		return "", fmt.Errorf("failed searching catalog: %w", err)
	}

	// Parse search results to find best item
	lines := strings.Split(actionOut, "\n")
	var parsedItems []RustcoinItem
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if m := resultLineRe.FindStringSubmatch(l); m != nil {
			idx, _ := strconv.Atoi(m[1])
			parsedItems = append(parsedItems, RustcoinItem{
				Index:   idx,
				Title:   strings.TrimSpace(m[2]),
				Creator: strings.TrimSpace(m[3]),
				Type:    strings.TrimSpace(m[4]),
				HasKey:  m[5] == "✓",
			})
		}
	}

	if len(parsedItems) == 0 {
		return "", fmt.Errorf("no matching marketplace content found in Rustcoin catalog for '%s'", cleanQuery)
	}

	// Choose best matching item (prefer exact match or key available)
	selectedItem := parsedItems[0]
	for _, it := range parsedItems {
		if strings.EqualFold(it.Title, cleanQuery) {
			selectedItem = it
			break
		}
	}

	// 4. Send download command
	if onProgress != nil {
		onProgress(fmt.Sprintf("Requesting download for '%s'...", selectedItem.Title))
	}
	if _, err := io.WriteString(stdin, "d\n"); err != nil {
		return "", fmt.Errorf("failed to send download command: %w", err)
	}

	// 5. Wait for download item prompt
	_, err = readUntil("Download item(s)", 15*time.Second)
	if err != nil {
		return "", fmt.Errorf("Rustcoin prompt timeout: %w", err)
	}

	// 6. Send item index
	if _, err := io.WriteString(stdin, fmt.Sprintf("%d\n", selectedItem.Index)); err != nil {
		return "", fmt.Errorf("failed to send item index: %w", err)
	}

	// 7. Wait for download & decryption completion
	if onProgress != nil {
		onProgress("Downloading & decrypting DLC package...")
	}
	_, err = readUntil("saved to \"packs\"", 120*time.Second)
	if err != nil {
		return "", fmt.Errorf("download/decryption timeout or failure: %w", err)
	}

	// Clean quit
	_, _ = io.WriteString(stdin, "q\n")

	// 8. Find the newly downloaded file in packsDir
	var newestFile string
	var newestMod int64

	if entries, err := os.ReadDir(packsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			name := e.Name()
			prevMod, existed := initialFiles[name]
			if !existed || info.ModTime().UnixNano() > prevMod {
				if info.ModTime().UnixNano() > newestMod {
					newestMod = info.ModTime().UnixNano()
					newestFile = filepath.Join(packsDir, name)
				}
			}
		}
	}

	if newestFile == "" {
		// Fallback: check if any file in packsDir matches title
		if entries, err := os.ReadDir(packsDir); err == nil {
			for _, e := range entries {
				if strings.Contains(strings.ToLower(e.Name()), strings.ToLower(cleanQuery)) {
					return filepath.Join(packsDir, e.Name()), nil
				}
			}
		}
		return "", fmt.Errorf("decrypted package was saved but output file could not be resolved in %s", packsDir)
	}

	// If the downloaded package is a world template (.mctemplate or .mcworld), convert to clean .mcaddon ONLY IF it contains a behavior pack
	ext := strings.ToLower(filepath.Ext(newestFile))
	if ext == ".mctemplate" || ext == ".mcworld" || strings.Contains(strings.ToLower(newestFile), "world_template") {
		if onProgress != nil {
			onProgress("Checking template for gameplay behavior packs...")
		}
		if addonPath, err := m.ConvertWorldTemplateToAddon(newestFile); err == nil && addonPath != "" && addonPath != newestFile {
			newestFile = addonPath
			if onProgress != nil {
				onProgress("Behavior pack detected: converted world template to Add-on package (.mcaddon)")
			}
		} else {
			if onProgress != nil {
				onProgress("Stand-alone world template detected (no behavior pack). Preserving as dedicated World map.")
			}
		}
	}

	if onProgress != nil {
		onProgress("Decrypted package ready: " + filepath.Base(newestFile))
	}

	return newestFile, nil
}
