package config

import "testing"

func TestProductionRejectsWeakSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "development-only-jwt-secret-change-before-production")
	t.Setenv("ML_SERVICE_TOKEN", "a-valid-ml-service-token-that-is-long-enough")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected production configuration to reject a weak JWT secret")
	}
}

func TestProductionAcceptsExplicitStrongSecrets(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "test-production-jwt-secret-with-strong-length-123")
	t.Setenv("ML_SERVICE_TOKEN", "test-production-ml-token-with-strong-length-456")
	if _, err := LoadConfig(); err != nil {
		t.Fatalf("expected strong production configuration to load: %v", err)
	}
}

func TestDemoCodesNeverEnabledInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("EXPOSE_DEMO_CODES", "true")
	if DemoCodesEnabled() {
		t.Fatal("demo codes must never be exposed in production")
	}
}
