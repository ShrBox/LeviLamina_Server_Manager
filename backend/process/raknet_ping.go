package process

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
)

// RakNet offline message ID magic bytes (16 bytes)
var raknetMagic = []byte{
	0x00, 0xff, 0xff, 0x00,
	0xfe, 0xfe, 0xfe, 0xfe,
	0xfd, 0xfd, 0xfd, 0xfd,
	0x12, 0x34, 0x56, 0x78,
}

type BedrockServerPing struct {
	Online         bool          `json:"online"`
	Latency        time.Duration `json:"latency"`
	LatencyMs      int           `json:"latencyMs"`
	ServerName     string        `json:"serverName"`
	Protocol       int           `json:"protocol"`
	Version        string        `json:"version"`
	CurrentPlayers int           `json:"currentPlayers"`
	MaxPlayers     int           `json:"maxPlayers"`
	WorldName      string        `json:"worldName"`
	GameMode       string        `json:"gameMode"`
	Port4          int           `json:"port4"`
	Port6          int           `json:"port6"`
}

// PingBedrockServer sends an Unconnected Ping packet (0x01) to a Bedrock server over UDP
func PingBedrockServer(host string, port int, timeout time.Duration) (*BedrockServerPing, error) {
	if host == "" {
		host = "127.0.0.1"
	}
	if port <= 0 {
		port = 19132
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	raddr, err := net.ResolveUDPAddr("udp4", addr)
	if err != nil {
		return nil, err
	}

	conn, err := net.DialUDP("udp4", nil, raddr)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	// Construct ID_UNCONNECTED_PING packet (0x01)
	buf := new(bytes.Buffer)
	buf.WriteByte(0x01) // Packet ID

	// Timestamp (8 bytes, uint64)
	startTime := time.Now()
	timestamp := uint64(startTime.UnixNano() / int64(time.Millisecond))
	_ = binary.Write(buf, binary.BigEndian, timestamp)

	// Magic offline ID (16 bytes)
	buf.Write(raknetMagic)

	// Client GUID (8 bytes, random or 2)
	clientGUID := uint64(0x0102030405060708)
	_ = binary.Write(buf, binary.BigEndian, clientGUID)

	// Send ping
	_, err = conn.Write(buf.Bytes())
	if err != nil {
		return nil, err
	}

	// Read response (ID_UNCONNECTED_PONG 0x1c)
	resp := make([]byte, 2048)
	n, _, err := conn.ReadFrom(resp)
	if err != nil {
		return nil, err
	}

	latency := time.Since(startTime)

	if n < 35 || resp[0] != 0x1c {
		return nil, fmt.Errorf("invalid raknet pong response")
	}

	// Read string length (at offset 33, uint16 big endian)
	strLen := binary.BigEndian.Uint16(resp[33:35])
	if int(35+strLen) > n {
		return nil, fmt.Errorf("pong payload truncated")
	}

	pongStr := string(resp[35 : 35+strLen])
	parts := strings.Split(pongStr, ";")
	// Format: MCPE;ServerName;Protocol;Version;CurrentPlayers;MaxPlayers;ServerGUID;WorldName;GameMode;GameModeNumeric;Port4;Port6;

	ping := &BedrockServerPing{
		Online:    true,
		Latency:   latency,
		LatencyMs: int(latency.Milliseconds()),
	}

	if len(parts) > 1 {
		ping.ServerName = parts[1]
	}
	if len(parts) > 2 {
		ping.Protocol, _ = strconv.Atoi(parts[2])
	}
	if len(parts) > 3 {
		ping.Version = parts[3]
	}
	if len(parts) > 4 {
		ping.CurrentPlayers, _ = strconv.Atoi(parts[4])
	}
	if len(parts) > 5 {
		ping.MaxPlayers, _ = strconv.Atoi(parts[5])
	}
	if len(parts) > 7 {
		ping.WorldName = parts[7]
	}
	if len(parts) > 8 {
		ping.GameMode = parts[8]
	}
	if len(parts) > 10 {
		ping.Port4, _ = strconv.Atoi(parts[10])
	}
	if len(parts) > 11 {
		ping.Port6, _ = strconv.Atoi(parts[11])
	}

	return ping, nil
}
