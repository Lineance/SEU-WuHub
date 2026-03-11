FROM python:3.13-alpine AS builder
WORKDIR /app
RUN apk add --no-cache gcc musl-dev
COPY pyproject.toml .
RUN pip install --no-cache-dir granian uvicorn

FROM python:3.13-alpine AS runtime
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin/granian /usr/local/bin/granian
COPY . .
EXPOSE 8000
CMD ["granian", "--interface", "asgi", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "app.main:app"]