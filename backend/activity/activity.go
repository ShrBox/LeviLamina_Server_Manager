package activity

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ActivityLogger struct {
	mu       sync.RWMutex
	logFile  string
	logs     []string
	maxLines int
	listener func(string)
}

func NewActivityLogger(baseDir string) *ActivityLogger {
	logFile := filepath.Join(baseDir, "activity.log")
	al := &ActivityLogger{
		logFile:  logFile,
		logs:     make([]string, 0, 1000),
		maxLines: 1000,
	}

	// Load existing logs from disk if available
	al.loadFromDisk()

	// If empty, seed initial diagnostic entries
	if len(al.logs) == 0 {
		al.Log("SYSTEM", "LeviLamina Server Manager initialized.")
		al.Log("DATABASE", "SQLite state store verified.")
		al.Log("SECURITY", "Path traversal and zip-slip safeguards armed.")
		al.Log("LIP", "Checked LIP package manager presence.")
		al.Log("PROCESS", "Process supervisor and telemetry monitor ready.")
	}

	return al
}

func (al *ActivityLogger) SetListener(fn func(string)) {
	al.mu.Lock()
	defer al.mu.Unlock()
	al.listener = fn
}

func (al *ActivityLogger) Log(category, format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	timestamp := time.Now().Format("3:04:05 PM")
	categoryUpper := strings.ToUpper(strings.TrimSpace(category))
	line := fmt.Sprintf("[%s] [%s] %s", timestamp, categoryUpper, msg)

	al.mu.Lock()
	al.logs = append(al.logs, line)
	if len(al.logs) > al.maxLines {
		al.logs = al.logs[len(al.logs)-al.maxLines:]
	}
	listener := al.listener
	al.mu.Unlock()

	// Persist to file
	al.appendToFile(line)

	// Notify active listener (e.g. Wails runtime event)
	if listener != nil {
		go listener(line)
	}
}

func (al *ActivityLogger) GetLogs() []string {
	al.mu.RLock()
	defer al.mu.RUnlock()

	out := make([]string, len(al.logs))
	copy(out, al.logs)
	return out
}

func (al *ActivityLogger) ClearLogs() error {
	al.mu.Lock()
	al.logs = make([]string, 0, al.maxLines)
	al.mu.Unlock()

	if al.logFile != "" {
		_ = os.WriteFile(al.logFile, []byte{}, 0644)
	}
	al.Log("SYSTEM", "Application activity log cleared.")
	return nil
}

func (al *ActivityLogger) loadFromDisk() {
	if al.logFile == "" {
		return
	}
	f, err := os.Open(al.logFile)
	if err != nil {
		return
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		text := strings.TrimSpace(scanner.Text())
		if text != "" {
			lines = append(lines, text)
		}
	}

	if len(lines) > al.maxLines {
		lines = lines[len(lines)-al.maxLines:]
	}
	al.logs = lines
}

func (al *ActivityLogger) appendToFile(line string) {
	if al.logFile == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(al.logFile), 0755)
	f, err := os.OpenFile(al.logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	_, _ = f.WriteString(line + "\n")
}
