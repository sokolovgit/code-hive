# Code Hive Infrastructure

Modern, profile-based Docker infrastructure for microservices with full observability.

## Quick Start

```bash
cd infra

# Development mode (fast startup)
make dev

# Full mode (with monitoring)
make full

# Stop everything
make down
```

## Architecture

### Profile-Based Design

Single `docker-compose.yml` with profiles:

| Profile         | Services                          | Purpose                |
| --------------- | --------------------------------- | ---------------------- |
| `core`          | postgres, redis                   | Essential databases    |
| `otel`          | otel-collector                    | OpenTelemetry pipeline |
| `observability` | grafana, prometheus, loki, tempo  | Full monitoring        |
| `exporters`     | node-exporter, postgres-exporter  | Metrics exporters      |
| `tools`         | adminer, redis-commander, mailpit | Dev utilities          |
| `services`      | users-service, ...                | App microservices      |

### Docker Image Hierarchy

```
codehive-base:latest          <- Base image (node + deps + libs)
    │
    ├── users-service:dev     <- Extends base
    ├── auth-service:dev      <- Extends base
    └── payment-service:dev   <- Extends base
```

All Dockerfiles are in `infra/docker/`:

```
infra/docker/
├── base/
│   └── node.Dockerfile       # Base image
└── services/
    ├── entrypoint.sh         # Shared entrypoint
    ├── users.Dockerfile      # Users service
    └── ...                   # Other services
```

## Commands

### Quick Start

| Command     | Description                         |
| ----------- | ----------------------------------- |
| `make dev`  | Start databases + services          |
| `make full` | Start everything with observability |
| `make down` | Stop all containers                 |

### Selective

| Command              | Description     |
| -------------------- | --------------- |
| `make core`          | Only databases  |
| `make observability` | Only monitoring |
| `make tools`         | Dev utilities   |

### Build

| Command        | Description           |
| -------------- | --------------------- |
| `make base`    | Build base image      |
| `make build`   | Build all images      |
| `make rebuild` | Rebuild without cache |

### Operations

| Command           | Description           |
| ----------------- | --------------------- |
| `make ps`         | Container status      |
| `make logs`       | Follow all logs       |
| `make logs-users` | Service-specific logs |

## Access URLs

| Service         | URL                   | Credentials    |
| --------------- | --------------------- | -------------- |
| Users Service   | http://localhost:3000 | -              |
| Grafana         | http://localhost:3001 | admin/password |
| Adminer         | http://localhost:8080 | admin/password |
| Redis Commander | http://localhost:8081 | -              |
| Mailpit         | http://localhost:8025 | -              |

## Adding a New Service

### 1. Create Dockerfile

```bash
cp infra/docker/services/users.Dockerfile infra/docker/services/your-service.Dockerfile
```

Edit and update:

- `SERVICE_NAME=your-service`
- `npm_package_name=@code-hive/your-service`
- Copy paths

### 2. Add database

Edit `config/postgres/init-databases.sql`:

```sql
CREATE DATABASE your_service_db;
GRANT ALL PRIVILEGES ON DATABASE your_service_db TO admin;
```

### 3. Add to docker-compose.yml

```yaml
your-service:
  build:
    <<: *build-common
    dockerfile: infra/docker/services/your-service.Dockerfile
    target: development
  container_name: ${PROJECT_NAME:-codehive}-your-service
  profiles: ["services"]
  environment:
    <<: *service-env
    SERVICE_NAME: your-service
    PORT: 3001
    DATABASE_URL: postgresql://${POSTGRES_USER:-admin}:${POSTGRES_PASSWORD:-password}@postgres:5432/your_service_db
  ports:
    - "3001:3001"
  volumes:
    - ${WORKSPACE_ROOT:-..}/apps/services/your-service/src:/app/apps/services/your-service/src
    - ${WORKSPACE_ROOT:-..}/libs/nestjs/src:/app/libs/nestjs/src
  <<: *service-common
  depends_on:
    <<: *service-depends
```

## Volume Strategy

### Development

Only source code is mounted (for hot-reload):

```yaml
volumes:
  - ./apps/services/users/src:/app/apps/services/users/src
  - ./libs/nestjs/src:/app/libs/nestjs/src
```

Everything else (deps, configs) is in the Docker image.

### Production

No mounts - everything baked in.

## File Structure

```
infra/
├── docker-compose.yml          # Unified compose
├── Makefile                    # Commands
├── docker/
│   ├── base/
│   │   └── node.Dockerfile     # Base image
│   └── services/
│       ├── entrypoint.sh       # Shared entrypoint
│       └── *.Dockerfile        # Service Dockerfiles
└── config/
    ├── grafana/
    ├── loki/
    ├── otel-collector/
    ├── postgres/
    ├── prometheus/
    ├── promtail/
    └── tempo/
```

## Troubleshooting

### Base image not found

```bash
make base  # Build base image first
```

### Hot-reload not working

Ensure only `src/` directories are mounted, not entire service.

### Database connection failed

```bash
make ps    # Check postgres is healthy
make db    # Connect manually
```
