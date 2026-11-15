.PHONY: all build up down restart logs seed test test-backend test-ml test-e2e dev-backend dev-ml dev-frontend build-frontend train-ml

all: build up

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

seed:
	cd backend && go run ./cmd/seed

test: test-backend test-ml

test-backend:
	cd backend && go test -v ./tests/...

test-ml:
	cd ml-service && pytest -v

test-e2e:
	cd backend && go test -v -run TestE2EComprehensiveBankingAndFraudPipeline ./tests/...

train-ml:
	cd ml-service && python training/train_all.py

build-frontend:
	cd frontend && npm run build

dev-backend:
	cd backend && go run ./cmd/api

dev-ml:
	cd ml-service && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-frontend:
	cd frontend && npm run dev
