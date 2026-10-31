// Package protocol is the shared wire contract. Coordinate changes with all owners.
package protocol

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"

	"feeders/internal/model"
)

const Version = 1
const MaxMessageBytes = 8192

type Envelope struct {
	ProtocolVersion int             `json:"protocol_version"`
	Type            string          `json:"type"`
	RequestID       string          `json:"request_id"`
	Payload         json.RawMessage `json:"payload"`
}

type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type PlayerInput struct {
	Seq uint64  `json:"seq"`
	X   float64 `json:"x"`
	Y   float64 `json:"y"`
	Z   float64 `json:"z"`
	Yaw float64 `json:"yaw"`
}

func (p PlayerInput) Valid() bool {
	if p.Seq == 0 || p.Seq > 9007199254740991 {
		return false
	}
	for _, n := range []float64{p.X, p.Y, p.Z, p.Yaw} {
		if math.IsNaN(n) || math.IsInf(n, 0) {
			return false
		}
	}
	return true
}

// DecodeInput rejects omitted/null coordinates instead of interpreting them as zero.
func DecodeInput(data []byte) (PlayerInput, error) {
	var p PlayerInput
	if err := DecodePayload(data, &p); err != nil {
		return p, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return p, err
	}
	for _, key := range []string{"seq", "x", "y", "z", "yaw"} {
		value, ok := fields[key]
		if !ok || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return p, errors.New("missing input field: " + key)
		}
	}
	if !p.Valid() {
		return p, errors.New("invalid player input")
	}
	return p, nil
}

type Capabilities struct {
	Movement bool `json:"movement"`
	World    bool `json:"world"`
	Agents   bool `json:"agents"`
}

type PlayerReady struct {
	User         model.User        `json:"user"`
	State        model.PlayerState `json:"state"`
	Capabilities Capabilities      `json:"capabilities"`
}

// PlayerSnapshotItem represents one player's state in the 20Hz world snapshot.
type PlayerSnapshotItem struct {
	ID       string  `json:"id"`
	Username string  `json:"name"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Yaw      float64 `json:"yaw"`
}

// WorldSnapshot is the 20Hz server broadcast of player positions.
type WorldSnapshot struct {
	ServerTime int64                `json:"server_time"`
	Players    []PlayerSnapshotItem `json:"players"`
}

// Citation represents a verified source citation from the station knowledge base.
type Citation struct {
	SourceTitle string `json:"source_title"`
	Section     string `json:"section"`
	Excerpt     string `json:"excerpt"`
	Confidence  string `json:"confidence"`
}

// AgentTalkRequest is sent by the client when communicating with a crew member.
type AgentTalkRequest struct {
	PlayerID string `json:"player_id,omitempty"`
	AgentID  string `json:"agent_id"`
	Text     string `json:"text"`
}

// AgentReply is sent by the server with the AI's response and source citations.
type AgentReply struct {
	AgentID   string    `json:"agent_id"`
	AgentName string    `json:"agent_name"`
	Text      string    `json:"text"`
	Citation  *Citation `json:"citation,omitempty"`
}

// GameActionRequest is sent by the client to propose or execute a cycle operation.
type GameActionRequest struct {
	Action string `json:"action"`
}

// InvestigationSolveRequest is sent by the client to submit 3 clues.
type InvestigationSolveRequest struct {
	Clues []string `json:"clues"`
}

func Message(kind, requestID string, payload any) (Envelope, error) {
	b, err := json.Marshal(payload)
	return Envelope{Version, kind, requestID, b}, err
}

func Decode(data []byte) (Envelope, error) {
	var e Envelope
	if len(data) > MaxMessageBytes {
		return e, errors.New("message too large")
	}
	if err := DecodePayload(data, &e); err != nil {
		return e, err
	}
	if e.ProtocolVersion != Version {
		return e, errors.New("unsupported protocol version")
	}
	if len(e.Type) == 0 || len(e.Type) > 64 || len(e.RequestID) == 0 || len(e.RequestID) > 128 {
		return e, errors.New("invalid type or request_id")
	}
	p := bytes.TrimSpace(e.Payload)
	if len(p) == 0 || p[0] != '{' {
		return e, errors.New("payload must be an object")
	}
	return e, nil
}

func DecodePayload(data []byte, target any) error {
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(target); err != nil {
		return err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return errors.New("expected one JSON value")
	}
	return nil
}
