package server

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type ServerProperties struct {
	lines        []propertyLine
	propsMap     map[string]string
	originalPath string
}

type propertyLine struct {
	isComment bool
	key       string
	value     string
	raw       string
}

// LoadProperties reads server.properties while retaining comments and line ordering
func LoadProperties(serverPath string) (*ServerProperties, error) {
	propsFile := filepath.Join(serverPath, "server.properties")
	file, err := os.Open(propsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to open server.properties: %w", err)
	}
	defer file.Close()

	sp := &ServerProperties{
		lines:        make([]propertyLine, 0),
		propsMap:     make(map[string]string),
		originalPath: propsFile,
	}

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			sp.lines = append(sp.lines, propertyLine{
				isComment: true,
				raw:       line,
			})
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			sp.propsMap[k] = v
			sp.lines = append(sp.lines, propertyLine{
				isComment: false,
				key:       k,
				value:     v,
				raw:       line,
			})
		} else {
			sp.lines = append(sp.lines, propertyLine{
				isComment: true,
				raw:       line,
			})
		}
	}

	return sp, scanner.Err()
}

func (sp *ServerProperties) Get(key string, defaultVal string) string {
	if val, ok := sp.propsMap[key]; ok {
		return val
	}
	return defaultVal
}

func (sp *ServerProperties) GetInt(key string, defaultVal int) int {
	if val, ok := sp.propsMap[key]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func (sp *ServerProperties) GetBool(key string, defaultVal bool) bool {
	if val, ok := sp.propsMap[key]; ok {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return defaultVal
}

func (sp *ServerProperties) Set(key string, value string) {
	sp.propsMap[key] = value
	found := false
	for i, l := range sp.lines {
		if !l.isComment && l.key == key {
			sp.lines[i].value = value
			sp.lines[i].raw = fmt.Sprintf("%s=%s", key, value)
			found = true
			break
		}
	}
	if !found {
		newLine := propertyLine{
			isComment: false,
			key:       key,
			value:     value,
			raw:       fmt.Sprintf("%s=%s", key, value),
		}
		sp.lines = append(sp.lines, newLine)
	}
}

// GetAll returns a copy of all properties as a key-value map
func (sp *ServerProperties) GetAll() map[string]string {
	res := make(map[string]string, len(sp.propsMap))
	for k, v := range sp.propsMap {
		res[k] = v
	}
	return res
}

// Save writes back the properties to disk, preserving comment structure
func (sp *ServerProperties) Save() error {
	var sb strings.Builder
	for _, l := range sp.lines {
		if l.isComment {
			sb.WriteString(l.raw)
			sb.WriteString("\r\n")
		} else {
			sb.WriteString(fmt.Sprintf("%s=%s\r\n", l.key, l.value))
		}
	}
	return os.WriteFile(sp.originalPath, []byte(sb.String()), 0644)
}
