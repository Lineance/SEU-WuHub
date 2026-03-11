PYTHON ?= uv run python
NPM ?= npm
COMPOSE ?= docker compose
RUFF ?= ruff
BANDIT ?= bandit
MYPY ?= mypy

.PHONY: backend-install backend-lint backend-format backend-typecheck backend-security backend-test frontend-install frontend-lint frontend-format frontend-test lint format typecheck security test docker-build docker-up docker-down

# Backend
backend-install:
	cd backend && uv sync --extra dev

backend-lint:
	$(RUFF) check backend

backend-format:
	$(RUFF) format backend

backend-typecheck:
	$(MYPY) backend

backend-security:
	$(BANDIT) -c backend/pyproject.toml -r backend

backend-test:
	cd backend && uv run pytest tests

# Frontend
frontend-install:
	$(NPM) install --prefix frontend

frontend-lint:
	$(NPM) run --prefix frontend lint

frontend-format:
	$(NPM) run --prefix frontend format

frontend-test:
	$(NPM) run --prefix frontend test -- --run

# Combined
lint: backend-lint frontend-lint
format: backend-format frontend-format
typecheck: backend-typecheck
security: backend-security
test: backend-test frontend-test

# Docker
docker-build:
	$(COMPOSE) build

docker-up:
	$(COMPOSE) up --build

docker-down:
	$(COMPOSE) down --remove-orphans