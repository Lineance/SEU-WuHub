PYTHON ?= uv run python
PIP ?= $(PYTHON) -m pip
NPM ?= npm
COMPOSE ?= docker compose
RUFF ?= ruff

.PHONY: backend-install backend-lint backend-format backend-test frontend-install frontend-lint frontend-format frontend-test lint format test docker-build docker-up docker-down

backend-install:
	cd backend && uv sync --extra dev

backend-lint:
	$(RUFF) check backend

backend-format:
	$(RUFF) format backend

backend-test:
	$(PYTHON) -m pytest backend/tests

frontend-install:
	$(NPM) install --prefix frontend

frontend-lint:
	$(NPM) run --prefix frontend lint

frontend-format:
	$(NPM) run --prefix frontend format

frontend-test:
	$(NPM) run --prefix frontend test -- --run

lint: backend-lint frontend-lint

format: backend-format frontend-format

test: backend-test frontend-test

docker-build:
	$(COMPOSE) build

docker-up:
	$(COMPOSE) up --build

docker-down:
	$(COMPOSE) down --remove-orphans