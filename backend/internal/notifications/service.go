package notifications

import (
	"encoding/json"
	"time"

	"github.com/bank-investigation/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationService struct {
	db *gorm.DB
}

func NewNotificationService(db *gorm.DB) *NotificationService {
	return &NotificationService{db: db}
}

func (s *NotificationService) Send(
	userID uuid.UUID,
	notifType string,
	channel string,
	title string,
	message string,
	metadata interface{},
) (*models.Notification, error) {
	var metaJSON string
	if metadata != nil {
		if b, err := json.Marshal(metadata); err == nil {
			metaJSON = string(b)
		}
	}

	notif := models.Notification{
		UserID:    userID,
		Type:      notifType,
		Channel:   channel,
		Title:     title,
		Message:   message,
		IsRead:    false,
		Metadata:  metaJSON,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.db.Create(&notif).Error; err != nil {
		return nil, err
	}

	return &notif, nil
}

func (s *NotificationService) GetUserNotifications(userID uuid.UUID, limit, offset int) ([]models.Notification, int64, int64, error) {
	var list []models.Notification
	var total int64
	var unreadCount int64

	s.db.Model(&models.Notification{}).Where("user_id = ?", userID).Count(&total)
	s.db.Model(&models.Notification{}).Where("user_id = ? AND is_read = false", userID).Count(&unreadCount)

	if limit <= 0 {
		limit = 20
	}

	err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&list).Error

	return list, total, unreadCount, err
}

func (s *NotificationService) MarkAsRead(id uuid.UUID, userID uuid.UUID) error {
	return s.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (s *NotificationService) MarkAllAsRead(userID uuid.UUID) error {
	return s.db.Model(&models.Notification{}).
		Where("user_id = ?", userID).
		Update("is_read", true).Error
}

