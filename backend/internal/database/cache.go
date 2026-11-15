package database

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/bank-investigation/backend/internal/config"
	"github.com/redis/go-redis/v9"
)

type CacheService interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Del(ctx context.Context, keys ...string) error
	Incr(ctx context.Context, key string) (int64, error)
	IncrBy(ctx context.Context, key string, value int64) (int64, error)
	Expire(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Ping(ctx context.Context) error
}

// RedisCache implementation
type RedisCache struct {
	client *redis.Client
}

func (r *RedisCache) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

func (r *RedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return r.client.Set(ctx, key, value, ttl).Err()
}

func (r *RedisCache) Del(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

func (r *RedisCache) Incr(ctx context.Context, key string) (int64, error) {
	return r.client.Incr(ctx, key).Result()
}

func (r *RedisCache) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	return r.client.IncrBy(ctx, key, value).Result()
}

func (r *RedisCache) Expire(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return r.client.Expire(ctx, key, ttl).Result()
}

func (r *RedisCache) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// InMemoryCache fallback implementation
type memItem struct {
	value      string
	numVal     int64
	expiration time.Time
}

type InMemoryCache struct {
	mu    sync.RWMutex
	items map[string]memItem
}

func NewInMemoryCache() *InMemoryCache {
	c := &InMemoryCache{
		items: make(map[string]memItem),
	}
	// Background cleanup of expired keys
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		for range ticker.C {
			c.mu.Lock()
			now := time.Now()
			for k, v := range c.items {
				if !v.expiration.IsZero() && now.After(v.expiration) {
					delete(c.items, k)
				}
			}
			c.mu.Unlock()
		}
	}()
	return c
}

func (m *InMemoryCache) Get(ctx context.Context, key string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	item, ok := m.items[key]
	if !ok || (!item.expiration.IsZero() && time.Now().After(item.expiration)) {
		return "", redis.Nil
	}
	return item.value, nil
}

func (m *InMemoryCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var exp time.Time
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}
	valStr := fmt.Sprintf("%v", value)
	var num int64
	if n, err := strconv.ParseInt(valStr, 10, 64); err == nil {
		num = n
	}
	m.items[key] = memItem{
		value:      valStr,
		numVal:     num,
		expiration: exp,
	}
	return nil
}

func (m *InMemoryCache) Del(ctx context.Context, keys ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range keys {
		delete(m.items, k)
	}
	return nil
}

func (m *InMemoryCache) Incr(ctx context.Context, key string) (int64, error) {
	return m.IncrBy(ctx, key, 1)
}

func (m *InMemoryCache) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	item, ok := m.items[key]
	if !ok || (!item.expiration.IsZero() && time.Now().After(item.expiration)) {
		item = memItem{
			value:      strconv.FormatInt(value, 10),
			numVal:     value,
			expiration: time.Time{},
		}
		m.items[key] = item
		return value, nil
	}
	item.numVal += value
	item.value = strconv.FormatInt(item.numVal, 10)
	m.items[key] = item
	return item.numVal, nil
}

func (m *InMemoryCache) Expire(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	item, ok := m.items[key]
	if !ok || (!item.expiration.IsZero() && time.Now().After(item.expiration)) {
		return false, nil
	}
	item.expiration = time.Now().Add(ttl)
	m.items[key] = item
	return true, nil
}

func (m *InMemoryCache) Ping(ctx context.Context) error {
	return nil
}

// Factory
func NewCacheService(cfg *config.Config) CacheService {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[Cache] Redis not available at %s:%s (%v). Falling back to resilient in-memory cache.", cfg.RedisHost, cfg.RedisPort, err)
		return NewInMemoryCache()
	}

	log.Printf("[Cache] Connected successfully to Redis at %s:%s", cfg.RedisHost, cfg.RedisPort)
	return &RedisCache{client: client}
}

