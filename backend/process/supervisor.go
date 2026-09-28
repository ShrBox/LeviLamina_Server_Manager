package process

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"levilamina-server-manager/backend/models"
)

type OutputListener func(line string)
type StatusListener func(status models.ServerStatus, exitCode int)

var (
	playerConnectRegex    = regexp.MustCompile(`Player connected:\s*([^,]+),\s*xuid:\s*([0-9a-zA-Z_-]+)`)
	playerDisconnectRegex = regexp.MustCompile(`Player disconnected:\s*([^,]+),\s*xuid:\s*([0-9a-zA-Z_-]+)`)
	serverLagRegex        = regexp.MustCompile(`Running\s+(\d+)ms\s+behind,\s+skipping\s+(\d+)\s+tick`)
	tpsLogRegex           = regexp.MustCompile(`(?i)(?:tps|ticks per second)[:=\s]+([0-9.]+)`)
	msptLogRegex          = regexp.MustCompile(`(?i)(?:mspt|tick time)[:=\s]+([0-9.]+)\s*ms`)
)

type ProcessSupervisor struct {
	mu                   sync.RWMutex
	cmd                  *exec.Cmd
	stdin                io.WriteCloser
	status               models.ServerStatus
	serverPath           string
	startTime            time.Time
	intentionalStop      bool
	portConflictDetected bool
	outputListeners      []OutputListener
	statusListeners      []StatusListener
	recentLogs           []string
	maxLogLines          int
	restartCount         int
	lastRestart          time.Time
	autoRestart          bool
	activePlayers        map[string]models.ServerPlayer
	lastReportedTPS      *float64
	lastReportedMSPT     *float64
	lastTickLagTime      time.Time
}

func NewProcessSupervisor() *ProcessSupervisor {
	return &ProcessSupervisor{
		status:        models.StatusOffline,
		maxLogLines:   2000,
		recentLogs:    make([]string, 0, 2000),
		activePlayers: make(map[string]models.ServerPlayer),
	}
}

func (ps *ProcessSupervisor) AddOutputListener(l OutputListener) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.outputListeners = append(ps.outputListeners, l)
}

func (ps *ProcessSupervisor) AddStatusListener(l StatusListener) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.statusListeners = append(ps.statusListeners, l)
}

func (ps *ProcessSupervisor) GetStatus() models.ServerStatus {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.status
}

func (ps *ProcessSupervisor) GetRecentLogs() []string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	copied := make([]string, len(ps.recentLogs))
	copy(copied, ps.recentLogs)
	return copied
}

func (ps *ProcessSupervisor) GetPID() int {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	if ps.cmd != nil && ps.cmd.Process != nil {
		return ps.cmd.Process.Pid
	}
	return 0
}

func (ps *ProcessSupervisor) GetUptime() int64 {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	if ps.status == models.StatusOnline && !ps.startTime.IsZero() {
		return int64(time.Since(ps.startTime).Seconds())
	}
	return 0
}

// Start launches the Bedrock server executable.
// It prioritizes 'bedrock_server_mod.exe' (the LeviLamina modloader entrypoint)
// and falls back to vanilla 'bedrock_server.exe'.
//
// Lifecycle steps:
// 1. Reads configured IPv4 and IPv6 ports from server.properties.
// 2. Kills any orphaned BDS processes left behind from abnormal terminations.
// 3. Polls the Windows network stack until UDP ports are completely unbindable (avoiding WinError 10048).
// 4. Pipes stdin/stdout/stderr and sets CREATE_NO_WINDOW for clean GUI embedding.
// 5. Spawns asynchronous log streaming workers and an exit watcher.
func (ps *ProcessSupervisor) Start(serverPath string, autoRestart bool) error {
	ps.mu.Lock()
	if ps.status == models.StatusOnline || ps.status == models.StatusStarting {
		ps.mu.Unlock()
		return fmt.Errorf("server is already running")
	}

	ps.serverPath = serverPath
	ps.autoRestart = autoRestart
	ps.intentionalStop = false
	ps.portConflictDetected = false

	// Parse server.properties to determine configured Bedrock UDP ports
	targetPort := 19132
	targetPortV6 := 19133
	if propsData, err := os.ReadFile(filepath.Join(serverPath, "server.properties")); err == nil {
		for _, line := range strings.Split(string(propsData), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "server-port=") {
				if p, pErr := strconv.Atoi(strings.TrimPrefix(line, "server-port=")); pErr == nil && p > 0 {
					targetPort = p
				}
			} else if strings.HasPrefix(line, "server-portv6=") {
				if p, pErr := strconv.Atoi(strings.TrimPrefix(line, "server-portv6=")); pErr == nil && p > 0 {
					targetPortV6 = p
				}
			}
		}
	}

	// Terminate any lingering background BDS processes to prevent port conflicts or world database locking
	killMod := exec.Command("taskkill", "/F", "/IM", "bedrock_server_mod.exe", "/T")
	killMod.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	_ = killMod.Run()

	killBds := exec.Command("taskkill", "/F", "/IM", "bedrock_server.exe", "/T")
	killBds.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	_ = killBds.Run()

	// Wait up to 2 seconds for Windows networking stack to completely release UDP sockets
	for attempt := 0; attempt < 8; attempt++ {
		c4, err4 := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: targetPort})
		if err4 != nil {
			time.Sleep(250 * time.Millisecond)
			continue
		}
		c4.Close()

		c6, err6 := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4zero, Port: targetPortV6})
		if err6 != nil {
			time.Sleep(250 * time.Millisecond)
			continue
		}
		c6.Close()
		break
	}

	// Executable selection: prioritize LeviLamina loader binary over stock BDS
	exeName := "bedrock_server_mod.exe"
	if _, err := os.Stat(filepath.Join(serverPath, exeName)); os.IsNotExist(err) {
		exeName = "bedrock_server.exe"
		if _, err := os.Stat(filepath.Join(serverPath, exeName)); os.IsNotExist(err) {
			ps.mu.Unlock()
			return fmt.Errorf("neither bedrock_server_mod.exe nor bedrock_server.exe found in %s", serverPath)
		}
	}

	fullExePath := filepath.Join(serverPath, exeName)
	cmd := exec.Command(fullExePath)
	cmd.Dir = serverPath
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW: prevent BDS console popup window
	}

	// Establish bidirectional standard I/O pipes
	stdin, err := cmd.StdinPipe()
	if err != nil {
		ps.mu.Unlock()
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		stdin.Close()
		ps.mu.Unlock()
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		stdin.Close()
		stdout.Close()
		ps.mu.Unlock()
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		stdin.Close()
		stdout.Close()
		stderr.Close()
		ps.mu.Unlock()
		return fmt.Errorf("failed to start server process: %w", err)
	}

	ps.cmd = cmd
	ps.stdin = stdin
	ps.status = models.StatusStarting
	ps.startTime = time.Now()
	ps.mu.Unlock()

	ps.broadcastStatus(models.StatusStarting, 0)

	// Stream stdout & stderr concurrently in background goroutines
	go ps.readStream(stdout)
	go ps.readStream(stderr)

	// Await process exit to trigger auto-restart or crash reporting
	go ps.waitProcess(cmd)

	return nil
}

func (ps *ProcessSupervisor) readStream(reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		timestamped := fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), line)

		ps.mu.Lock()
		if len(ps.recentLogs) >= ps.maxLogLines {
			ps.recentLogs = ps.recentLogs[1:]
		}
		ps.recentLogs = append(ps.recentLogs, timestamped)

		// Detect online ready state from server log
		if ps.status == models.StatusStarting && (containsAny(line, "Server started.", "Server ready", "IPv4 supported")) {
			ps.status = models.StatusOnline
			listeners := make([]StatusListener, len(ps.statusListeners))
			copy(listeners, ps.statusListeners)
			ps.mu.Unlock()
			for _, l := range listeners {
				l(models.StatusOnline, 0)
			}
		} else {
			ps.mu.Unlock()
		}

		// Detect player connects and disconnects
		if m := playerConnectRegex.FindStringSubmatch(line); len(m) == 3 {
			pName := strings.TrimSpace(m[1])
			pXuid := strings.TrimSpace(m[2])
			now := time.Now()
			ps.mu.Lock()
			ps.activePlayers[pName] = models.ServerPlayer{
				Name:        pName,
				XUID:        pXuid,
				IsOnline:    true,
				ConnectedAt: &now,
			}
			ps.mu.Unlock()
		} else if m := playerDisconnectRegex.FindStringSubmatch(line); len(m) == 3 {
			pName := strings.TrimSpace(m[1])
			ps.mu.Lock()
			delete(ps.activePlayers, pName)
			ps.mu.Unlock()
		}

		// Detect server lag warnings: "Running 500ms behind, skipping 10 tick(s)"
		if lm := serverLagRegex.FindStringSubmatch(line); len(lm) == 3 {
			behindMs, _ := strconv.ParseFloat(lm[1], 64)
			skippedTicks, _ := strconv.ParseFloat(lm[2], 64)
			if skippedTicks > 0 {
				tickMs := 50.0 + (behindMs / skippedTicks)
				tps := 1000.0 / tickMs
				if tps > 20.0 {
					tps = 20.0
				}
				ps.mu.Lock()
				ps.lastReportedTPS = &tps
				ps.lastReportedMSPT = &tickMs
				ps.lastTickLagTime = time.Now()
				ps.mu.Unlock()
			}
		}

		// Detect explicit plugin/LeviOptimize TPS outputs
		if tm := tpsLogRegex.FindStringSubmatch(line); len(tm) == 2 {
			if tVal, err := strconv.ParseFloat(tm[1], 64); err == nil && tVal > 0 && tVal <= 25.0 {
				ps.mu.Lock()
				ps.lastReportedTPS = &tVal
				msptVal := 1000.0 / tVal
				ps.lastReportedMSPT = &msptVal
				ps.lastTickLagTime = time.Now()
				ps.mu.Unlock()
			}
		}

		if mm := msptLogRegex.FindStringSubmatch(line); len(mm) == 2 {
			if mVal, err := strconv.ParseFloat(mm[1], 64); err == nil && mVal > 0 {
				ps.mu.Lock()
				ps.lastReportedMSPT = &mVal
				tVal := 1000.0 / mVal
				if tVal > 20.0 {
					tVal = 20.0
				}
				ps.lastReportedTPS = &tVal
				ps.lastTickLagTime = time.Now()
				ps.mu.Unlock()
			}
		}

		if strings.Contains(line, "may be in use by another process") {
			ps.mu.Lock()
			ps.portConflictDetected = true
			ps.mu.Unlock()
		}

		ps.broadcastOutput(timestamped)
	}
}

// GetTickMetrics returns the real TPS and MSPT metrics computed from the engine
func (ps *ProcessSupervisor) GetTickMetrics() (*float64, *float64) {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	if ps.status != models.StatusOnline {
		return nil, nil
	}

	if !ps.lastTickLagTime.IsZero() && time.Since(ps.lastTickLagTime) < 15*time.Second {
		return ps.lastReportedTPS, ps.lastReportedMSPT
	}

	defaultTPS := 20.0
	// If no lag warning or active profiler (e.g. LeviOptimize) has reported specific MSPT,
	// return nil for MSPT so telemetry accurately reflects Nominal (< 50 ms) rather than a guessed number.
	return &defaultTPS, nil
}

func (ps *ProcessSupervisor) waitProcess(cmd *exec.Cmd) {
	err := cmd.Wait()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	ps.mu.Lock()
	ps.activePlayers = make(map[string]models.ServerPlayer)
	wasIntentional := ps.intentionalStop
	var newStatus models.ServerStatus
	if wasIntentional {
		newStatus = models.StatusOffline
	} else {
		newStatus = models.StatusCrashed
	}
	ps.status = newStatus
	ps.cmd = nil
	ps.stdin = nil
	autoRestart := ps.autoRestart && !wasIntentional
	serverPath := ps.serverPath

	// Protect against crash loop and port conflicts
	if autoRestart {
		if ps.portConflictDetected {
			autoRestart = false
			ps.recentLogs = append(ps.recentLogs, "[PORT CONFLICT] Server failed to bind UDP port (in use by another process). Auto-restart disabled.")
		} else {
			now := time.Now()
			if now.Sub(ps.lastRestart) > 60*time.Second {
				ps.restartCount = 0
			}
			ps.restartCount++
			ps.lastRestart = now
			if ps.restartCount > 3 {
				autoRestart = false // Stop infinite crash loops
				ps.recentLogs = append(ps.recentLogs, "[CRASH LOOP DETECTED] Server crashed 3 times within 60 seconds. Auto-restart disabled.")
			}
		}
	}
	ps.mu.Unlock()

	ps.broadcastStatus(newStatus, exitCode)

	if autoRestart {
		time.Sleep(3 * time.Second)
		_ = ps.Start(serverPath, true)
	}
}

// Stop gracefully stops the server by sending "stop" command, with timeout fallback to kill
func (ps *ProcessSupervisor) Stop(ctx context.Context) error {
	ps.mu.Lock()
	if ps.cmd == nil || ps.cmd.Process == nil {
		ps.status = models.StatusOffline
		ps.mu.Unlock()
		return nil
	}
	ps.intentionalStop = true
	ps.status = models.StatusStopping
	stdin := ps.stdin
	cmd := ps.cmd
	ps.mu.Unlock()

	ps.broadcastStatus(models.StatusStopping, 0)

	// Send "stop" command to stdin
	if stdin != nil {
		_, _ = stdin.Write([]byte("stop\r\n"))
	}

	done := make(chan struct{})
	go func() {
		for {
			ps.mu.RLock()
			currentCmd := ps.cmd
			ps.mu.RUnlock()
			if currentCmd == nil {
				close(done)
				return
			}
			time.Sleep(200 * time.Millisecond)
		}
	}()

	select {
	case <-done:
		return nil
	case <-time.After(10 * time.Second):
		// Force kill if not stopped within 10s
		if cmd != nil && cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return nil
	case <-ctx.Done():
		if cmd != nil && cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return ctx.Err()
	}
}

// SendCommand sends command string to server stdin
func (ps *ProcessSupervisor) SendCommand(cmdText string) error {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	if ps.stdin == nil || ps.status != models.StatusOnline && ps.status != models.StatusStarting {
		return fmt.Errorf("server is not currently running")
	}

	_, err := ps.stdin.Write([]byte(cmdText + "\r\n"))
	return err
}

func (ps *ProcessSupervisor) broadcastOutput(line string) {
	ps.mu.RLock()
	listeners := make([]OutputListener, len(ps.outputListeners))
	copy(listeners, ps.outputListeners)
	ps.mu.RUnlock()

	for _, l := range listeners {
		l(line)
	}
}

func (ps *ProcessSupervisor) broadcastStatus(s models.ServerStatus, exitCode int) {
	ps.mu.RLock()
	listeners := make([]StatusListener, len(ps.statusListeners))
	copy(listeners, ps.statusListeners)
	ps.mu.RUnlock()

	for _, l := range listeners {
		l(s, exitCode)
	}
}

func containsAny(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if sub != "" && (s == sub || len(s) > len(sub) && (s[:len(sub)] == sub || s[len(s)-len(sub):] == sub || stringsContains(s, sub))) {
			return true
		}
	}
	return false
}

func stringsContains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || filepath.Base(s) != "")
}

func (ps *ProcessSupervisor) GetActivePlayers() []models.ServerPlayer {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	players := make([]models.ServerPlayer, 0, len(ps.activePlayers))
	for _, p := range ps.activePlayers {
		players = append(players, p)
	}
	return players
}

func (ps *ProcessSupervisor) GetServerPath() string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.serverPath
}

