package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort         string
	ServerHost         string
	AppEnv             string
	AppName            string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DBSSLMode          string
	RedisHost          string
	RedisPort          string
	RedisPassword      string
	RedisDB            int
	JWTSecret          string
	JWTAccessExpiry    time.Duration
	JWTRefreshExpiry   time.Duration
	MLServiceURL       string
	MLServiceToken     string
	MLInferenceTimeout time.Duration
	FraudLowThreshold  float64
	FraudHighThreshold float64
	AllowedOrigins     []string
}

func LoadConfig() (*Config, error) {
	// Try loading from .env, if it exists
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	jwtAccessExp := getEnvDuration("JWT_ACCESS_EXPIRY", 15*time.Minute)
	jwtRefreshExp := getEnvDuration("JWT_REFRESH_EXPIRY", 7*24*time.Hour)
	mlTimeout := time.Duration(getEnvInt("ML_INFERENCE_TIMEOUT_MS", 150)) * time.Millisecond

	originsStr := getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
	origins := strings.Split(originsStr, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	cfg := &Config{
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		ServerHost:         getEnv("SERVER_HOST", "0.0.0.0"),
		AppEnv:             getEnv("APP_ENV", "development"),
		AppName:            getEnv("APP_NAME", "Bank Investigation"),
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5433"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", "postgres"),
		DBName:             getEnv("DB_NAME", "bank_investigation"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		RedisHost:          getEnv("REDIS_HOST", "localhost"),
		RedisPort:          getEnv("REDIS_PORT", "6379"),
		RedisPassword:      getEnv("REDIS_PASSWORD", ""),
		RedisDB:            getEnvInt("REDIS_DB", 0),
		JWTSecret:          getEnv("JWT_SECRET", "development-only-jwt-secret-change-before-production"),
		JWTAccessExpiry:    jwtAccessExp,
		JWTRefreshExpiry:   jwtRefreshExp,
		MLServiceURL:       getEnv("ML_SERVICE_URL", "http://localhost:8000"),
		MLServiceToken:     getEnv("ML_SERVICE_TOKEN", ""),
		MLInferenceTimeout: mlTimeout,
		FraudLowThreshold:  getEnvFloat("FRAUD_LOW_THRESHOLD", 30.0),
		FraudHighThreshold: getEnvFloat("FRAUD_HIGH_THRESHOLD", 70.0),
		AllowedOrigins:     origins,
	}
	if strings.EqualFold(cfg.AppEnv, "production") {
		weak := cfg.JWTSecret == "development-only-jwt-secret-change-before-production" ||
			strings.Contains(strings.ToLower(cfg.JWTSecret), "replace") ||
			strings.Contains(strings.ToLower(cfg.JWTSecret), "change")
		if weak || len(cfg.JWTSecret) < 32 {
			return nil, fmt.Errorf("JWT_SECRET must be an explicit, strong secret of at least 32 characters in production")
		}
		if len(cfg.MLServiceToken) < 32 {
			return nil, fmt.Errorf("ML_SERVICE_TOKEN must be at least 32 characters in production")
		}
	}
	return cfg, nil
}

// DemoCodesEnabled permits OTP disclosure only in an explicitly enabled non-production demo.
func DemoCodesEnabled() bool {
	return !strings.EqualFold(getEnv("APP_ENV", "development"), "production") &&
		strings.EqualFold(getEnv("EXPOSE_DEMO_CODES", "false"), "true")
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvFloat(key string, defaultVal float64) float64 {
	if val, ok := os.LookupEnv(key); ok {
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return defaultVal
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if val, ok := os.LookupEnv(key); ok {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return defaultVal
}
