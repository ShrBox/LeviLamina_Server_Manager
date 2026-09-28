// Package server manages server configuration files (server.properties),
// preflight network diagnostics, and world synchronization.
package server

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sys/windows"

	"levilamina-server-manager/backend/models"
)

// PreflightEngine performs automated pre-launch diagnostics and auto-repair.
// It verifies VC++ runtimes, OneDrive folder conflicts, Windows UWP loopback exemptions,
// server.properties validity, and Windows Firewall inbound UDP rules.
type PreflightEngine struct{}

// NewPreflightEngine creates a new PreflightEngine instance.
func NewPreflightEngine() *PreflightEngine {
	return &PreflightEngine{}
}

// RunPreflight diagnoses and automatically resolves network, firewall, loopback,
// and configuration issues before the server process is launched.
func (pe *PreflightEngine) RunPreflight(serverPath string, addonSync func(string) error) (*models.JoinHealthReport, error) {
	isAdmin := isRunningAsAdmin()

	report := &models.JoinHealthReport{
		Success:           true,
		FixedIssues:       make([]string, 0),
		Warnings:          make([]string, 0),
		PortIPv4:          19132,
		PortIPv6:          19133,
		IsAdmin:           isAdmin,
		VCRedistInstalled: checkVCRedist(),
	}

	// ---------------- 1. Check Visual C++ Redistributable ----------------
	if !report.VCRedistInstalled {
		report.Warnings = append(report.Warnings, "Microsoft Visual C++ 2015-2022 Redistributable (x64) was not found in System32. Bedrock Dedicated Server requires this runtime to launch. Download from https://aka.ms/vs/17/release/vc_redist.x64.exe if BDS fails to start.")
	}

	// ---------------- 2. Check Server Folder Health & OneDrive Lock ----------------
	checkServerFolderHealth(serverPath, report)

	// ---------------- 3. Fix Windows UWP Loopback Exemption ----------------
	// This is the #1 reason why hosts/friends on Windows 10/11 cannot join local servers ("Unable to connect to world")
	pe.fixLoopbackExemption(report, isAdmin)

	// ---------------- 4. Inspect & Sanitize server.properties ----------------
	props, err := LoadProperties(serverPath)
	if err == nil {
		modified := false

		// Verify transport is raknet (nethernet can break external UDP joins)
		currTransport := props.Get("transport", "")
		if currTransport == "" || strings.EqualFold(currTransport, "nethernet") {
			props.Set("transport", "raknet")
			modified = true
			report.FixedIssues = append(report.FixedIssues, "Corrected server network transport protocol to 'raknet' for reliable external connections.")
		}

		// Read and validate IPv4 port
		p4, p4Err := strconv.Atoi(props.Get("server-port", "19132"))
		if p4Err != nil || p4 <= 0 || p4 > 65535 {
			p4 = 19132
			props.Set("server-port", "19132")
			modified = true
			report.FixedIssues = append(report.FixedIssues, "Restored valid default IPv4 server-port (19132).")
		}
		report.PortIPv4 = p4

		// Read and validate IPv6 port (must be distinct from IPv4 port)
		p6Str := props.Get("server-portv6", "")
		p6, p6Err := strconv.Atoi(p6Str)
		if p6Str == "" || p6Err != nil || p6 <= 0 || p6 > 65535 || p6 == p4 {
			p6 = p4 + 1
			if p6 > 65535 {
				p6 = p4 - 1
			}
			props.Set("server-portv6", strconv.Itoa(p6))
			modified = true
			report.FixedIssues = append(report.FixedIssues, fmt.Sprintf("Configured distinct IPv6 port (%d) to prevent port binding collisions.", p6))
		}
		report.PortIPv6 = p6

		// Check Whitelist / Allowlist status and files (BDS 1.21 uses allow-list, older uses white-list)
		allowListActive := strings.EqualFold(props.Get("allow-list", "false"), "true") ||
			strings.EqualFold(props.Get("white-list", "false"), "true")

		if allowListActive {
			wlPath := filepath.Join(serverPath, "whitelist.json")
			alPath := filepath.Join(serverPath, "allowlist.json")
			if _, wlErr := os.Stat(wlPath); os.IsNotExist(wlErr) {
				_ = os.WriteFile(wlPath, []byte("[]"), 0644)
			}
			if _, alErr := os.Stat(alPath); os.IsNotExist(alErr) {
				_ = os.WriteFile(alPath, []byte("[]"), 0644)
			}
			report.Warnings = append(report.Warnings, "Player allow-list is ENABLED. Only players explicitly registered in allowlist.json or whitelist.json can connect.")
		}

		// Ensure permissions.json exists
		permPath := filepath.Join(serverPath, "permissions.json")
		if _, permErr := os.Stat(permPath); os.IsNotExist(permErr) {
			_ = os.WriteFile(permPath, []byte("[]"), 0644)
			report.FixedIssues = append(report.FixedIssues, "Created missing permissions.json file.")
		}

		// Validate max-players
		maxP, maxErr := strconv.Atoi(props.Get("max-players", "10"))
		if maxErr != nil || maxP <= 0 {
			props.Set("max-players", "10")
			modified = true
			report.FixedIssues = append(report.FixedIssues, "Restored valid default max-players count (10).")
		}

		// Clean server-name of newlines that break RakNet pong ping
		sName := props.Get("server-name", "Dedicated Server")
		cleanName := strings.ReplaceAll(strings.ReplaceAll(sName, "\r", ""), "\n", " ")
		cleanName = strings.TrimSpace(cleanName)
		if cleanName == "" {
			cleanName = "Dedicated Server"
		}
		if cleanName != sName {
			props.Set("server-name", cleanName)
			modified = true
			report.FixedIssues = append(report.FixedIssues, "Cleaned illegal newline characters from 'server-name'.")
		}

		if modified {
			_ = props.Save()
			report.PropertiesFixed = true
		} else {
			report.PropertiesFixed = true
		}
	} else {
		report.Warnings = append(report.Warnings, fmt.Sprintf("Could not parse server.properties: %v", err))
	}

	// ---------------- 5. Configure Windows Defender Firewall Rules ----------------
	pe.configureFirewallRules(serverPath, report.PortIPv4, report.PortIPv6, report, isAdmin)

	// ---------------- 6. Synchronize Resource/Behavior Packs (valid_known_packs.json) ----------------
	if addonSync != nil {
		if syncErr := addonSync(serverPath); syncErr == nil {
			report.PacksSynced = true
		} else {
			report.Warnings = append(report.Warnings, fmt.Sprintf("Failed to sync pack registry: %v", syncErr))
		}
	}

	// ---------------- 7. Test Port Availability & Clean Lingering Instances ----------------
	pe.verifyPortsAndCleanZombies(report.PortIPv4, report)

	// ---------------- 8. Detect Local LAN IP & Join Guidance ----------------
	lanIP := getPreferredLanIP()
	if lanIP != "" {
		report.LanIP = lanIP
		report.FixedIssues = append(report.FixedIssues, fmt.Sprintf("Detected local LAN address: %s. Other players on your local Wi-Fi or LAN can connect using this IP on port %d.", lanIP, report.PortIPv4))
	}

	return report, nil
}

func isRunningAsAdmin() bool {
	token := windows.GetCurrentProcessToken()
	return token.IsElevated()
}

func getSystem32Exe(name string) string {
	sysRoot := os.Getenv("SystemRoot")
	if sysRoot == "" {
		sysRoot = `C:\Windows`
	}
	candidate := filepath.Join(sysRoot, "System32", name)
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	return name
}

func checkVCRedist() bool {
	sysRoot := os.Getenv("SystemRoot")
	if sysRoot == "" {
		sysRoot = `C:\Windows`
	}
	vc1 := filepath.Join(sysRoot, "System32", "vcruntime140.dll")
	vc2 := filepath.Join(sysRoot, "System32", "msvcp140.dll")
	_, err1 := os.Stat(vc1)
	_, err2 := os.Stat(vc2)
	return err1 == nil && err2 == nil
}

func checkServerFolderHealth(serverPath string, report *models.JoinHealthReport) {
	lowerPath := strings.ToLower(serverPath)
	if strings.Contains(lowerPath, "onedrive") {
		report.Warnings = append(report.Warnings, "Server folder is located inside Microsoft OneDrive. Background cloud sync locks Minecraft LevelDB database files, causing crashes and world corruption. Move the server folder to a local directory (e.g. C:\\MinecraftServers).")
	}

	probeFile := filepath.Join(serverPath, fmt.Sprintf(".llsm_probe_%d.tmp", time.Now().UnixNano()))
	if err := os.WriteFile(probeFile, []byte("ok"), 0644); err != nil {
		report.Warnings = append(report.Warnings, fmt.Sprintf("Write access to server folder is restricted (%v). Server files may fail to save properly.", err))
	} else {
		_ = os.Remove(probeFile)
	}

	bdsExe := filepath.Join(serverPath, "bedrock_server.exe")
	if info, err := os.Stat(bdsExe); err == nil {
		if info.Size() < 100*1024 {
			report.Warnings = append(report.Warnings, "bedrock_server.exe appears corrupted or incomplete (file size is less than 100KB). Please reinstall BDS core files.")
		}
	}
}

func getPreferredLanIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ip4 := ipnet.IP.To4(); ip4 != nil {
				if ip4[0] == 192 && ip4[1] == 168 {
					return ip4.String()
				}
				if ip4[0] == 10 {
					return ip4.String()
				}
				if ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31 {
					return ip4.String()
				}
			}
		}
	}
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ip4 := ipnet.IP.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}
	return ""
}

func (pe *PreflightEngine) fixLoopbackExemption(report *models.JoinHealthReport, isAdmin bool) {
	cni := getSystem32Exe("CheckNetIsolation.exe")

	var wg sync.WaitGroup
	var err1, err2, err3 error

	wg.Add(3)
	go func() {
		defer wg.Done()
		cmd1 := exec.Command(cni, "LoopbackExemption", "-a", "-n=Microsoft.MinecraftUWP_8wekyb3d8bbwe")
		cmd1.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		err1 = cmd1.Run()
	}()

	go func() {
		defer wg.Done()
		cmd2 := exec.Command(cni, "LoopbackExemption", "-a", "-p=S-1-15-2-1958404141-86561845-1752920682-3514627264-3686427144-123375016-47567913")
		cmd2.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		err2 = cmd2.Run()
	}()

	go func() {
		defer wg.Done()
		cmd3 := exec.Command(cni, "LoopbackExemption", "-a", "-n=Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe")
		cmd3.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		err3 = cmd3.Run()
	}()

	wg.Wait()

	if err1 == nil || err2 == nil || err3 == nil {
		report.LoopbackFixed = true
		report.FixedIssues = append(report.FixedIssues, "Granted Windows UWP Loopback Exemption for Minecraft and Minecraft Preview clients (enables joining local servers on the same PC).")
	} else if !isAdmin {
		report.Warnings = append(report.Warnings, "Could not automatically grant Windows UWP Loopback Exemption (requires Administrator). If connecting to the server from the same PC, please launch LLSM as Administrator.")
	}
}

func (pe *PreflightEngine) configureFirewallRules(serverPath string, p4, p6 int, report *models.JoinHealthReport, isAdmin bool) {
	netsh := getSystem32Exe("netsh.exe")

	if !isAdmin {
		report.Warnings = append(report.Warnings, "Manager is not running with Administrator privileges. Windows Firewall rules could not be configured automatically. If external players cannot connect, run LLSM as Administrator or allow port 19132 UDP in Windows Defender Firewall.")
		return
	}

	// 1. Clean previous rules concurrently
	cleanRule := func(name string) {
		delCmd := exec.Command(netsh, "advfirewall", "firewall", "delete", "rule", fmt.Sprintf("name=%s", name))
		delCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		_ = delCmd.Run()
	}

	var cleanWg sync.WaitGroup
	rulesToClean := []string{
		"LeviLamina BDS UDP Ports",
		"LeviLamina Server Mod Executable",
		"LeviLamina Vanilla BDS Executable",
	}
	cleanWg.Add(len(rulesToClean))
	for _, ruleName := range rulesToClean {
		go func(r string) {
			defer cleanWg.Done()
			cleanRule(r)
		}(ruleName)
	}
	cleanWg.Wait()

	// 2. Add firewall rules concurrently
	var addWg sync.WaitGroup

	// Inbound rule for UDP ports
	portsArg := fmt.Sprintf("%d,%d", p4, p6)
	addWg.Add(1)
	go func() {
		defer addWg.Done()
		fwPorts := exec.Command(netsh, "advfirewall", "firewall", "add", "rule",
			"name=LeviLamina BDS UDP Ports",
			"dir=in",
			"action=allow",
			"protocol=UDP",
			fmt.Sprintf("localport=%s", portsArg),
			"profile=any",
		)
		fwPorts.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		if err := fwPorts.Run(); err == nil {
			report.FirewallRulesAdded = true
			report.FixedIssues = append(report.FixedIssues, fmt.Sprintf("Configured Windows Defender Firewall inbound rule for UDP ports %d & %d.", p4, p6))
		} else {
			report.Warnings = append(report.Warnings, fmt.Sprintf("Failed to register firewall rule for UDP ports %d & %d: %v", p4, p6, err))
		}
	}()

	// Inbound rule for bedrock_server_mod.exe
	modExe := filepath.Join(serverPath, "bedrock_server_mod.exe")
	if _, err := os.Stat(modExe); err == nil {
		addWg.Add(1)
		go func() {
			defer addWg.Done()
			fwMod := exec.Command(netsh, "advfirewall", "firewall", "add", "rule",
				"name=LeviLamina Server Mod Executable",
				"dir=in",
				"action=allow",
				fmt.Sprintf("program=%s", modExe),
				"enable=yes",
				"profile=any",
			)
			fwMod.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
			_ = fwMod.Run()
		}()
	}

	// Inbound rule for bedrock_server.exe
	bdsExe := filepath.Join(serverPath, "bedrock_server.exe")
	if _, err := os.Stat(bdsExe); err == nil {
		addWg.Add(1)
		go func() {
			defer addWg.Done()
			fwBds := exec.Command(netsh, "advfirewall", "firewall", "add", "rule",
				"name=LeviLamina Vanilla BDS Executable",
				"dir=in",
				"action=allow",
				fmt.Sprintf("program=%s", bdsExe),
				"enable=yes",
				"profile=any",
			)
			fwBds.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
			_ = fwBds.Run()
		}()
	}

	addWg.Wait()
}

func (pe *PreflightEngine) verifyPortsAndCleanZombies(targetPort int, report *models.JoinHealthReport) {
	testConn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("0.0.0.0"), Port: targetPort})
	if err != nil {
		// Port occupied - kill orphaned BDS instances
		taskkill := getSystem32Exe("taskkill.exe")
		killMod := exec.Command(taskkill, "/F", "/IM", "bedrock_server_mod.exe", "/T")
		killMod.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		_ = killMod.Run()

		killBds := exec.Command(taskkill, "/F", "/IM", "bedrock_server.exe", "/T")
		killBds.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		_ = killBds.Run()

		time.Sleep(500 * time.Millisecond)

		if testConn2, err2 := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("0.0.0.0"), Port: targetPort}); err2 == nil {
			testConn2.Close()
			report.PortsAvailable = true
			report.FixedIssues = append(report.FixedIssues, fmt.Sprintf("Cleared orphaned server process occupying UDP port %d.", targetPort))
		} else {
			report.PortsAvailable = false
			report.Warnings = append(report.Warnings, fmt.Sprintf("UDP port %d is still in use by another application on your system.", targetPort))
		}
	} else {
		testConn.Close()
		report.PortsAvailable = true
	}
}
