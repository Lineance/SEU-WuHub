# SEU-WuHub

SEU-WuHub 当前处于架构骨架阶段。本仓库只进行了工程化基础设施环境配置的补齐，无业务逻辑。

## Repository Layout

- `backend/`: FastAPI、数据访问、检索、采集与摄取骨架
- `frontend/`: React + TypeScript 前端骨架
- `scripts/`: 运维脚本占位

## Tooling

- Backend: Python 3.13, FastAPI, Ruff, Pytest
- Frontend: Node.js 22, React 19, TypeScript, ESLint, Prettier, Vitest
- Containers: Docker Compose for local tooling and future app runtime

## Quick Start

### Backend

```powershell
cd backend && uv sync --extra dev
```

### Frontend

```powershell
npm install --prefix frontend
```

## Common Commands

```powershell
make backend-lint
make backend-format
make backend-test
make frontend-lint
make frontend-format
make frontend-test
make docker-build
```

If `make` is unavailable on Windows, run the underlying commands shown in the Makefile directly.

## Notes

- Existing application code remains placeholder-only by design.
- Docker files and Compose are added as environment scaffolding; full runtime depends on later business implementation.
- Configuration files under `config/` are still templates and must be populated before real integration work.
