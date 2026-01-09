# Local Development Infrastructure

This directory contains all Docker-based infrastructure configuration for local development.

## Structure

```
infra/docker/
├── databases/          # Database configurations (PostgreSQL, MongoDB, Redis)
├── observability/      # Observability stack (Grafana Agent, Loki, Prometheus, Tempo, Grafana)
└── services/          # Service Dockerfiles
```

## Quick Start

1. **Start all infrastructure:**

   ```bash
   docker compose up --build
   ```

2. **Stop and remove all containers (with volumes):**
   ```bash
   docker compose down -v
   ```

## Services

### Databases

- **PostgreSQL**: `postgres:5432` - Single instance with logical databases (users_db, auth_db, payment_db, gateway_db)
- **MongoDB**: `mongodb:27017` - Single instance with logical databases
- **Redis**: `redis:6379` - Cache and queue storage

### Observability

- **Grafana**: `http://localhost:4000` (admin/password)
- **Loki**: `http://loki:3100` - Log aggregation
- **Prometheus**: `http://localhost:9090` - Metrics storage
- **Tempo**: `http://tempo:3200` - Trace storage
- **Grafana Agent**: Log collection and OTLP receiver

### Application Services

- **users-service**: `http://localhost:3000`
- **auth-service**: `http://localhost:3001` (when added)
- **payment-service**: `http://localhost:3002` (when added)
- **gateway-service**: `http://localhost:3003` (when added)

See [PORTS.md](./PORTS.md) for complete port allocation table.

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `DATABASE_URL_*` - Service-specific database URLs
- `OTLP_URL` - OpenTelemetry endpoint (default: `http://grafana-agent:4317`)
- `OTLP_PROTOCOL` - OTLP protocol: `grpc` or `http` (default: `grpc`)
- `SERVICE_NAME` - Required per service
- `NODE_ENV` - Environment (default: `development`)

## Credentials

All services use:

- **Username**: `admin`
- **Password**: `password`

⚠️ **Security Note**: These credentials are for local development only!

## Logging

- Services log JSON to stdout
- Grafana Agent automatically collects logs from all containers
- Logs are labeled with `service` (container name) and `env` (NODE_ENV)
- View logs in Grafana → Explore → Loki datasource

## Tracing

- Services export OTLP traces to Grafana Agent (default: `http://grafana-agent:4317` via gRPC)
- Grafana Agent receives traces and forwards them to Tempo
- View traces in Grafana → Explore → Tempo datasource
- Traces are automatically correlated with logs

## Metrics

- Services export OTLP metrics or expose `/metrics` endpoint
- Prometheus scrapes metrics from services
- View metrics in Grafana → Explore → Prometheus datasource

## Network

All services run on the `backend-net` Docker network. Services resolve each other by container name (e.g., `postgres`, `redis`, `tempo`).

## Volumes

All persistent data is stored in named Docker volumes:

- `code-hive_postgres_data`
- `code-hive_mongodb_data`
- `code-hive_redis_data`
- `code-hive_loki_data`
- `code-hive_prometheus_data`
- `code-hive_tempo_data`
- `code-hive_grafana_data`

To reset all data: `docker compose down -v`
