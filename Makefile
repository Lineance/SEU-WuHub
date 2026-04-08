PYTHON ?= uv run python
NPM ?= pnpm
COMPOSE ?= docker compose
RUFF ?= ruff
BANDIT ?= bandit
MYPY ?= mypy

.PHONY: backend-install backend-lint backend-format backend-typecheck backend-typecheck-strict backend-security backend-test backend-dev frontend-install frontend-lint frontend-format frontend-test frontend-dev lint format typecheck security test docker-build docker-up docker-down dev

# Backend
backend-install:
	cd backend && uv sync --extra dev

backend-lint:
	$(RUFF) check backend

backend-format:
	$(RUFF) format backend

backend-typecheck:
	$(MYPY) backend

backend-typecheck-strict:
	cd backend && uv run python -m mypy --strict --explicit-package-bases .

backend-security:
	$(BANDIT) -c backend/pyproject.toml -r backend

backend-test:
	uv run --project backend python -m pytest backend/tests

backend-dev:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
frontend-install:
	cd frontend && $(NPM) install

frontend-lint:
	cd frontend && $(NPM) run lint

frontend-format:
	cd frontend && $(NPM) run format

frontend-test:
	cd frontend && $(NPM) run test -- --run

frontend-dev:
	cd frontend && $(NPM) run dev

# Combined
lint: backend-lint frontend-lint
format: backend-format frontend-format
typecheck: backend-typecheck
security: backend-security
test: backend-test frontend-test

dev:
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo ""
	$(MAKE) backend-dev &
	$(MAKE) frontend-dev

# Docker
docker-build:
	$(COMPOSE) build

docker-up:
	$(COMPOSE) up --build

docker-down:
	$(COMPOSE) down --remove-orphans