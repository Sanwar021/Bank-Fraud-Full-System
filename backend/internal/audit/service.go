package audit

import (
	"encoding/json"
	"time"

	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditService struct {
	db *gorm.DB
}

func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

func (s *AuditService) Log(
	actorID *uuid.UUID,
	actorRole string,
	action string,
	targetType string,
	targetID string,
	ipAddress string,
	outcome string,
	details interface{},
) error {
	var detailsJSON string
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsJSON = string(b)
		}
	}

	entry := models.AuditLog{
		ActorID:    actorID,
		ActorRole:  actorRole,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		IPAddress:  ipAddress,
		Outcome:    outcome,
		Details:    detailsJSON,
		CreatedAt:  time.Now().UTC(),
	}

	return s.db.Create(&entry).Error
}

func (s *AuditService) ListLogs(limit, offset int, action, targetType string) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if targetType != "" {
		query = query.Where("target_type = ?", targetType)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 50
	}

	err := query.Order("created_at DESC").
		Preload("Actor").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error

	return logs, total, err
}
