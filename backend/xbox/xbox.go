package xbox

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"levilamina-server-manager/backend/models"
)

const (
	// Official Minecraft Bedrock / Launcher Client ID for Microsoft Device Code Flow
	MicrosoftClientID = "00000000402b5328"
	DefaultAvatarURL  = "https://unavatar.io/xboxgamertag/%s"
)

type XboxManager struct {
	configDir  string
	client     *http.Client
	tokenCache map[string]string
	cacheLock  sync.RWMutex
}

func NewXboxManager(configDir string) *XboxManager {
	return &XboxManager{
		configDir:  configDir,
		client:     &http.Client{Timeout: 15 * time.Second},
		tokenCache: make(map[string]string),
	}
}

func (m *XboxManager) profileFilePath() string {
	return filepath.Join(m.configDir, "xbox_profile.json")
}

// DetectLeviLauncherAccount is disabled to prevent unwanted auto-linking
func (m *XboxManager) DetectLeviLauncherAccount() (*models.XboxAccount, error) {
	return nil, fmt.Errorf("automatic account sniffing is disabled")
}

func (m *XboxManager) defaultGamerpic(gamertag string) string {
	initial := "X"
	if len(gamertag) > 0 {
		initial = strings.ToUpper(string(gamertag[0]))
	}
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%%" y1="0%%" x2="100%%" y2="100%%"><stop offset="0%%" stop-color="#10b981"/><stop offset="100%%" stop-color="#047857"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(#g)"/><text x="32" y="42" font-family="Segoe UI, sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle">%s</text></svg>`, initial)
	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg))
}

// FetchAvatarBase64 fetches the Xbox avatar image from unavatar.io and returns a data URL
func (m *XboxManager) FetchAvatarBase64(gamertag string) string {
	if strings.TrimSpace(gamertag) == "" {
		return m.defaultGamerpic("X")
	}

	avatarURL := fmt.Sprintf(DefaultAvatarURL, url.PathEscape(gamertag))
	req, err := http.NewRequest("GET", avatarURL, nil)
	if err != nil {
		return m.defaultGamerpic(gamertag)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
	resp, err := m.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return m.defaultGamerpic(gamertag)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil || len(data) < 100 {
		return m.defaultGamerpic(gamertag)
	}

	// Strictly validate magic bytes to avoid HTML error pages or corrupted responses
	trimmed := bytes.TrimSpace(data)
	if bytes.HasPrefix(trimmed, []byte("<!DOCTYPE")) || bytes.HasPrefix(trimmed, []byte("<html")) || bytes.Contains(trimmed, []byte("Server Error")) {
		return m.defaultGamerpic(gamertag)
	}

	mimeType := "image/webp"
	if bytes.HasPrefix(data, []byte("\x89PNG")) {
		mimeType = "image/png"
	} else if bytes.HasPrefix(data, []byte("\xFF\xD8\xFF")) {
		mimeType = "image/jpeg"
	} else if bytes.HasPrefix(data, []byte("RIFF")) && len(data) > 12 && string(data[8:12]) == "WEBP" {
		mimeType = "image/webp"
	} else if bytes.HasPrefix(data, []byte("<svg")) {
		mimeType = "image/svg+xml"
	}

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(data))
}

// GetSavedXboxAccount returns the saved account, or auto-detects from LeviLauncher if none is saved
func (m *XboxManager) GetSavedXboxAccount() (*models.XboxAccount, error) {
	filePath := m.profileFilePath()
	if data, err := os.ReadFile(filePath); err == nil {
		var acc models.XboxAccount
		if err := json.Unmarshal(data, &acc); err == nil && acc.Gamertag != "" {
			// Heal broken or legacy avatar URLs (e.g., base64 404 HTML, missing avatars, or legacy domain)
			isCorrupted := strings.Contains(acc.AvatarURL, "PCFET0") || 
				strings.Contains(acc.AvatarURL, "avatar-ssl.xboxlive.com") || 
				acc.AvatarURL == "" || 
				strings.HasPrefix(acc.AvatarURL, "http")

			if isCorrupted {
				b64 := m.FetchAvatarBase64(acc.Gamertag)
				if b64 != "" && strings.HasPrefix(b64, "data:") {
					acc.AvatarURL = b64
					_ = m.SaveXboxAccount(acc)
				}
			}
			return &acc, nil
		}
	}

	return &models.XboxAccount{
		Gamertag:   "",
		XUID:       "",
		AvatarURL:  "",
		IsLoggedIn: false,
		Source:     "",
	}, nil
}

// SaveXboxAccount persists the Xbox profile to disk
func (m *XboxManager) SaveXboxAccount(acc models.XboxAccount) error {
	acc.UpdatedAt = time.Now().Format(time.RFC3339)
	if (acc.AvatarURL == "" || strings.HasPrefix(acc.AvatarURL, "https://avatar-ssl.xboxlive.com")) && acc.Gamertag != "" {
		b64 := m.FetchAvatarBase64(acc.Gamertag)
		if b64 != "" {
			acc.AvatarURL = b64
		} else {
			acc.AvatarURL = fmt.Sprintf(DefaultAvatarURL, url.PathEscape(acc.Gamertag))
		}
	}
	acc.IsLoggedIn = acc.Gamertag != ""

	data, err := json.MarshalIndent(acc, "", "  ")
	if err != nil {
		return err
	}

	_ = os.MkdirAll(m.configDir, 0755)
	return os.WriteFile(m.profileFilePath(), data, 0644)
}

// ClearXboxAccount signs out the active Xbox profile
func (m *XboxManager) ClearXboxAccount() error {
	filePath := m.profileFilePath()
	_ = os.Remove(filePath)
	return nil
}

// AddXboxAccountAsOp adds the Xbox profile as an operator in the server's permissions.json
func (m *XboxManager) AddXboxAccountAsOp(serverPath string, gamertag string, xuid string) error {
	if strings.TrimSpace(gamertag) == "" && strings.TrimSpace(xuid) == "" {
		return fmt.Errorf("gamertag or xuid is required")
	}

	permFile := filepath.Join(serverPath, "permissions.json")
	type PermEntry struct {
		Permission string `json:"permission"`
		XUID       string `json:"xuid,omitempty"`
		Gamertag   string `json:"gamertag,omitempty"`
	}

	var perms []PermEntry
	if data, err := os.ReadFile(permFile); err == nil {
		_ = json.Unmarshal(data, &perms)
	}

	// Check if already in permissions
	exists := false
	for i, p := range perms {
		if (xuid != "" && p.XUID == xuid) || (gamertag != "" && strings.EqualFold(p.Gamertag, gamertag)) {
			perms[i].Permission = "operator"
			if p.XUID == "" && xuid != "" {
				perms[i].XUID = xuid
			}
			exists = true
			break
		}
	}

	if !exists {
		perms = append(perms, PermEntry{
			Permission: "operator",
			XUID:       xuid,
			Gamertag:   gamertag,
		})
	}

	updated, err := json.MarshalIndent(perms, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(permFile, updated, 0644)
}

// StartXboxDeviceAuth initiates Microsoft Device Code OAuth flow
func (m *XboxManager) StartXboxDeviceAuth() (*models.DeviceAuthResponse, error) {
	data := url.Values{}
	data.Set("client_id", MicrosoftClientID)
	data.Set("scope", "service::user.auth.xboxlive.com::MBI_SSL")
	data.Set("response_type", "device_code")

	req, err := http.NewRequest("POST", "https://login.live.com/oauth20_connect.srf", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("device auth network request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("device auth returned %d: %s", resp.StatusCode, string(body))
	}

	var res struct {
		UserCode        string `json:"user_code"`
		DeviceCode      string `json:"device_code"`
		VerificationURI string `json:"verification_uri"`
		ExpiresIn       int    `json:"expires_in"`
		Interval        int    `json:"interval"`
		Message         string `json:"message"`
	}

	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}

	if res.VerificationURI == "" {
		res.VerificationURI = "https://www.microsoft.com/link"
	}

	return &models.DeviceAuthResponse{
		UserCode:        res.UserCode,
		DeviceCode:      res.DeviceCode,
		VerificationURI: res.VerificationURI,
		ExpiresIn:       res.ExpiresIn,
		Interval:        res.Interval,
		Message:         res.Message,
	}, nil
}

// PollXboxDeviceAuth checks if the user completed authorization on microsoft.com/devicelogin
func (m *XboxManager) PollXboxDeviceAuth(deviceCode string) (*models.XboxAccount, error) {
	var accessToken string

	m.cacheLock.RLock()
	cachedToken, exists := m.tokenCache[deviceCode]
	m.cacheLock.RUnlock()

	if exists && cachedToken != "" {
		accessToken = cachedToken
	} else {
		data := url.Values{}
		data.Set("client_id", MicrosoftClientID)
		data.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")
		data.Set("device_code", deviceCode)

		req, err := http.NewRequest("POST", "https://login.live.com/oauth20_token.srf", strings.NewReader(data.Encode()))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

		resp, err := m.client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		body, _ := io.ReadAll(resp.Body)
		var tokenRes struct {
			AccessToken string `json:"access_token"`
			Error       string `json:"error"`
			ErrorDesc   string `json:"error_description"`
		}
		if err := json.Unmarshal(body, &tokenRes); err != nil {
			return nil, err
		}

		if tokenRes.Error != "" {
			if tokenRes.Error == "authorization_pending" {
				return nil, fmt.Errorf("pending")
			}
			return nil, fmt.Errorf("%s: %s", tokenRes.Error, tokenRes.ErrorDesc)
		}

		if tokenRes.AccessToken == "" {
			return nil, fmt.Errorf("pending")
		}

		accessToken = tokenRes.AccessToken
		m.cacheLock.Lock()
		m.tokenCache[deviceCode] = accessToken
		m.cacheLock.Unlock()
	}

	// Exchange Access Token for Xbox Live User Token
	callXblAuth := func(ticket string) (*http.Response, []byte, error) {
		body, _ := json.Marshal(map[string]any{
			"Properties": map[string]any{
				"AuthMethod": "RPS",
				"SiteName":   "user.auth.xboxlive.com",
				"RpsTicket":  ticket,
			},
			"RelyingParty": "http://auth.xboxlive.com",
			"TokenType":    "JWT",
		})
		req, _ := http.NewRequest("POST", "https://user.auth.xboxlive.com/user/authenticate", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("x-xbl-contract-version", "1")
		resp, err := m.client.Do(req)
		if err != nil {
			return nil, nil, err
		}
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return resp, data, nil
	}

	ticket := accessToken
	if !strings.HasPrefix(ticket, "d=") && !strings.HasPrefix(ticket, "t=") {
		ticket = "d=" + ticket
	}

	xblResp, xblData, err := callXblAuth(ticket)
	if err != nil {
		return nil, fmt.Errorf("Xbox Live connection failed: %w", err)
	}

	// If 401, retry without "d=" prefix just in case the token format differs
	if xblResp.StatusCode == http.StatusUnauthorized && strings.HasPrefix(ticket, "d=") {
		retryResp, retryData, retryErr := callXblAuth(strings.TrimPrefix(ticket, "d="))
		if retryErr == nil && retryResp.StatusCode == http.StatusOK {
			xblResp = retryResp
			xblData = retryData
		}
	}

	// Check status code and extract specific Microsoft/Xbox error reasons
	if xblResp.StatusCode != http.StatusOK {
		xErr := xblResp.Header.Get("X-Err")
		if xErr == "" {
			var errObj struct {
				XErr    any    `json:"XErr"`
				Message string `json:"Message"`
			}
			if json.Unmarshal(xblData, &errObj) == nil && errObj.XErr != nil {
				xErr = fmt.Sprintf("%v", errObj.XErr)
			}
		}

		switch xErr {
		case "2148916233":
			return nil, fmt.Errorf("This Microsoft account has no Xbox profile yet. Please visit xbox.com or launch the Xbox App once to choose your Gamertag.")
		case "2148916235":
			return nil, fmt.Errorf("Xbox Live service is currently not available in your region.")
		case "2148916236", "2148916237":
			return nil, fmt.Errorf("Adult age verification is required on account.microsoft.com.")
		case "2148916238":
			return nil, fmt.Errorf("This child account requires parental consent from a Microsoft family organizer.")
		default:
			if xblResp.StatusCode == http.StatusUnauthorized {
				return nil, fmt.Errorf("Microsoft authentication succeeded, but your account does not have an active Xbox Live profile. Please log into xbox.com once to create your Gamertag, then try again.")
			}
			if len(xblData) > 0 {
				return nil, fmt.Errorf("Xbox Live authentication failed (%d): %s", xblResp.StatusCode, string(xblData))
			}
			return nil, fmt.Errorf("Xbox Live authentication failed (HTTP %d). Ensure your Microsoft account has an active Xbox profile.", xblResp.StatusCode)
		}
	}

	var xblResult struct {
		Token         string `json:"Token"`
		DisplayClaims struct {
			XUI []struct {
				UHS string `json:"uhs"`
			} `json:"xui"`
		} `json:"DisplayClaims"`
	}
	if err := json.Unmarshal(xblData, &xblResult); err != nil || len(xblResult.DisplayClaims.XUI) == 0 {
		return nil, fmt.Errorf("failed to parse Xbox Live response: %s", string(xblData))
	}

	uhs := xblResult.DisplayClaims.XUI[0].UHS

	// Exchange for XSTS Token using http://xboxlive.com to get gamertag & xuid
	xstsReqBody, _ := json.Marshal(map[string]any{
		"Properties": map[string]any{
			"SandboxId":  "RETAIL",
			"UserTokens": []string{xblResult.Token},
		},
		"RelyingParty": "http://xboxlive.com",
		"TokenType":    "JWT",
	})

	xstsReq, _ := http.NewRequest("POST", "https://xsts.auth.xboxlive.com/xsts/authorize", bytes.NewReader(xstsReqBody))
	xstsReq.Header.Set("Content-Type", "application/json")
	xstsReq.Header.Set("Accept", "application/json")
	xstsReq.Header.Set("x-xbl-contract-version", "1")

	xstsResp, err := m.client.Do(xstsReq)
	if err != nil {
		return nil, fmt.Errorf("XSTS authorize failed: %w", err)
	}
	defer xstsResp.Body.Close()
	xstsData, _ := io.ReadAll(xstsResp.Body)

	if xstsResp.StatusCode != http.StatusOK {
		var xstsErr struct {
			XErr     any    `json:"XErr"`
			Message  string `json:"Message"`
			Redirect string `json:"Redirect"`
		}
		_ = json.Unmarshal(xstsData, &xstsErr)
		xErrStr := fmt.Sprintf("%v", xstsErr.XErr)
		switch xErrStr {
		case "2148916233":
			return nil, fmt.Errorf("This Microsoft account has no Xbox profile. Visit xbox.com to setup your Gamertag.")
		case "2148916238":
			return nil, fmt.Errorf("Child account requires parental consent.")
		default:
			return nil, fmt.Errorf("XSTS authorization failed (HTTP %d, Code: %s): %s", xstsResp.StatusCode, xErrStr, xstsErr.Message)
		}
	}

	var xstsResult struct {
		Token         string `json:"Token"`
		DisplayClaims struct {
			XUI []struct {
				UHS string `json:"uhs"`
				XID string `json:"xid"`
				GTG string `json:"gtg"`
			} `json:"xui"`
		} `json:"DisplayClaims"`
	}
	_ = json.Unmarshal(xstsData, &xstsResult)

	// Acquire PlayFab session token in background for live Marketplace queries
	go func(userToken string) {
		pfXstsBody, _ := json.Marshal(map[string]any{
			"Properties": map[string]any{
				"SandboxId":  "RETAIL",
				"UserTokens": []string{userToken},
			},
			"RelyingParty": "http://playfab.xboxlive.com",
			"TokenType":    "JWT",
		})
		pfXstsReq, err := http.NewRequest("POST", "https://xsts.auth.xboxlive.com/xsts/authorize", bytes.NewReader(pfXstsBody))
		if err != nil {
			return
		}
		pfXstsReq.Header.Set("Content-Type", "application/json")
		pfXstsReq.Header.Set("Accept", "application/json")
		pfXstsReq.Header.Set("x-xbl-contract-version", "1")

		if resp, err := m.client.Do(pfXstsReq); err == nil {
			defer resp.Body.Close()
			var pfXstsRes struct {
				Token string `json:"Token"`
			}
			data, _ := io.ReadAll(resp.Body)
			if json.Unmarshal(data, &pfXstsRes) == nil && pfXstsRes.Token != "" {
				pfLoginBody, _ := json.Marshal(map[string]any{
					"CreateAccount": true,
					"TitleId":       "b980a380",
					"XboxToken":     pfXstsRes.Token,
				})
				pfLoginReq, _ := http.NewRequest("POST", "https://b980a380.playfabapi.com/Client/LoginWithXbox", bytes.NewReader(pfLoginBody))
				pfLoginReq.Header.Set("Content-Type", "application/json")
				pfLoginReq.Header.Set("X-PlayFab-TitleId", "b980a380")
				if pfResp, err := m.client.Do(pfLoginReq); err == nil {
					defer pfResp.Body.Close()
					pfData, _ := io.ReadAll(pfResp.Body)
					_ = os.WriteFile(filepath.Join(m.configDir, "playfab_entity_token.json"), pfData, 0644)
				}
			}
		}
	}(xblResult.Token)

	gamertag := ""
	xuid := ""
	if len(xstsResult.DisplayClaims.XUI) > 0 {
		gamertag = xstsResult.DisplayClaims.XUI[0].GTG
		xuid = xstsResult.DisplayClaims.XUI[0].XID
	}

	if gamertag == "" {
		gamertag = "XboxUser_" + uhs[:6]
	}

	avatarBase64 := m.FetchAvatarBase64(gamertag)

	acc := &models.XboxAccount{
		Gamertag:   gamertag,
		XUID:       xuid,
		AvatarURL:  avatarBase64,
		IsLoggedIn: true,
		Source:     "microsoft",
		UpdatedAt:  time.Now().Format(time.RFC3339),
	}

	_ = m.SaveXboxAccount(*acc)
	m.cacheLock.Lock()
	delete(m.tokenCache, deviceCode)
	m.cacheLock.Unlock()
	return acc, nil
}
