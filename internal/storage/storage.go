package storage

import (
	"context"
	"errors"
	"feeders/internal/model"
)

var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("already exists")

// Implementations must be safe for concurrent calls. CreateAccount is atomic.
type Accounts interface {
	CreateAccount(context.Context, model.Account) error
	FindAccount(context.Context, string) (model.Account, error)
}

type Players interface {
	LoadPlayer(context.Context, string) (model.PlayerState, error)
	SavePlayer(context.Context, model.PlayerState) error
}

// Stage 6: Learning state and mistake tracking
type MistakeRecord struct {
	UserID    string `json:"user_id"`
	Topic     string `json:"topic"`
	Forecast  string `json:"forecast"`
	Actual    string `json:"actual"`
	Timestamp int64  `json:"timestamp"`
}

type PassportRecord struct {
	UserID          string   `json:"user_id"`
	MasteredTopics  []string `json:"mastered_topics"`
	CompletedQuests []string `json:"completed_quests"`
	ExperimentRuns  int      `json:"experiment_runs"`
	ClearanceLevel  string   `json:"clearance_level"`
	Score           int      `json:"score"`
	UpdatedAt       int64    `json:"updated_at"`
}

type LearningStore interface {
	SaveMistake(ctx context.Context, mistake MistakeRecord) error
	GetLearningHistory(ctx context.Context, userID string) ([]MistakeRecord, error)
	SavePassport(ctx context.Context, passport PassportRecord) error
	GetPassport(ctx context.Context, userID string) (PassportRecord, error)
}
