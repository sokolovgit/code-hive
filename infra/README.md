# Infrastructure Setup

This directory contains the Docker infrastructure configuration for the Code Hive monorepo.

## Architecture Overview

The infrastructure follows a **layered approach**:

1. **Shared Infrastructure** (`docker-compose.yml`) - Databases, message brokers, and other shared services
2. **Development Overrides** (`docker-compose.override.yml`) - Development-specific configurations
3. **Service Definitions** (`docker-compose.services.yml`) - Application services (optional, for Docker-based development)
4. **Base Images** (`docker/base/`) - Reusable Docker images for services

## Best Practices

### ✅ Recommended Approach

1. **Shared Infrastructure Compose** - All databases, message brokers, and shared services in one file
2. **Service-Specific Dockerfiles** - Each service has its own Dockerfile extending base images
3. **Override Pattern** - Use `docker-compose.override.yml` for environment-specific configs
4. **Network Isolation** - All services on the same Docker network for service discovery
5. **Health Checks** - All infrastructure services have health checks for proper startup ordering

### ❌ Anti-Patterns to Avoid

- ❌ Don't put application services in the shared infrastructure compose
- ❌ Don't duplicate infrastructure services across multiple compose files
- ❌ Don't hardcode credentials (use environment variables)
- ❌ Don't expose services unnecessarily (use internal networks)

## Quick Start

### 1. Setup Environment

```bash
# Option A: Use setup script (recommended)
cd infra
make setup

# Option B: Manual setup
cp infra/env.template infra/.env
# Edit infra/.env with your configuration
```

### 2. Start Infrastructure

```bash
# Start all infrastructure services
cd infra
docker-compose up -d

# Or start specific services
docker-compose up -d postgres redis

# View logs
docker-compose logs -f

# Stop infrastructure
docker-compose down
```

### 3. Development Setup

For local development, you typically have two options:

#### Option A: Infrastructure in Docker, Services Locally (Recommended)

```bash
# Start infrastructure
cd infra
docker-compose up -d

# Run services locally with pnpm
cd ../..
pnpm dev
```

**Benefits:**

- Fast hot-reload
- Easy debugging
- No Docker overhead for code changes
- Services connect to Docker infrastructure via localhost

#### Option B: Everything in Docker

```bash
# Copy and customize service compose file
cp infra/docker-compose.services.yml.example infra/docker-compose.services.yml

# Start everything
cd infra
docker-compose -f docker-compose.yml -f docker-compose.services.yml up
```

**Benefits:**

- Consistent environment
- Isolated from host system
- Good for testing Docker builds

### 4. Enable Development Tools (Optional)

```bash
# Copy override file
cp infra/docker-compose.override.yml.example infra/docker-compose.override.yml

# Start with development tools (pgAdmin, Redis Commander)
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

Access:

- **pgAdmin**: http://localhost:8080 (admin@codehive.local / admin)
- **Redis Commander**: http://localhost:8081

## File Structure

```
infra/
├── docker-compose.yml              # Shared infrastructure (databases, brokers)
├── docker-compose.override.yml     # Development overrides (optional)
├── docker-compose.services.yml     # Application services (optional)
├── .env                            # Environment variables (gitignored)
├── env.template                    # Environment template
├── README.md                       # This file
└── docker/
    ├── base/                       # Base Docker images
    │   ├── node.Dockerfile
    │   └── python.Dockerfile
    └── services/                   # Service-specific Dockerfiles
        └── users.Dockerfile
```

## Services

### PostgreSQL

- **Port**: 5432 (configurable via `POSTGRES_PORT`)
- **Database**: `codehive` (configurable via `POSTGRES_DB`)
- **User**: `postgres` (configurable via `POSTGRES_USER`)
- **Password**: `postgres` (configurable via `POSTGRES_PASSWORD`)
- **Connection String**: `postgresql://postgres:postgres@localhost:5432/codehive`

### Redis

- **Port**: 6379 (configurable via `REDIS_PORT`)
- **Password**: `redis` (configurable via `REDIS_PASSWORD`)
- **Connection String**: `redis://:redis@localhost:6379`
- **Use Cases**: BullMQ queues, caching, sessions

## Building Base Images

Before using service-specific Dockerfiles, build the base images:

```bash
# Build base Node.js image
docker build -f infra/docker/base/node.Dockerfile -t code-hive-node-base:latest .

# Build base Python image (if needed)
docker build -f infra/docker/base/python.Dockerfile -t code-hive-python-base:latest .
```

## Environment Variables

All services should use environment variables for configuration. See `.env.example` for available variables.

### Service Environment Variables

Each service should define its own environment variables. Example for users service:

```bash
# apps/services/users/.env.example
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codehive
REDIS_URL=redis://:redis@localhost:6379
```

## Networking

All services are on the `code-hive-network` Docker network, allowing them to communicate using service names:

- `postgres` - PostgreSQL database
- `redis` - Redis server
- `users-service` - Users microservice
- `auth-service` - Auth microservice
- etc.

## Data Persistence

Volumes are used for data persistence:

- `postgres_data` - PostgreSQL data
- `redis_data` - Redis data
- `pgadmin_data` - pgAdmin configuration (if enabled)

To reset data:

```bash
docker-compose down -v  # Removes volumes
```

## Health Checks

All infrastructure services have health checks to ensure proper startup ordering:

```bash
# Check service health
docker-compose ps

# Wait for services to be healthy
docker-compose up -d --wait
```

## Production Considerations

For production:

1. **Use managed services** (AWS RDS, ElastiCache, etc.) instead of Docker containers
2. **Use secrets management** (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Use separate compose files** for production (`docker-compose.prod.yml`)
4. **Enable SSL/TLS** for all connections
5. **Use read replicas** for databases
6. **Implement backup strategies**
7. **Use resource limits** in compose files
8. **Monitor and log** all services

## Troubleshooting

### Services can't connect to database

1. Check if infrastructure is running: `docker-compose ps`
2. Verify network: `docker network ls | grep code-hive`
3. Check connection string format
4. Verify credentials in `.env`

### Port conflicts

If ports are already in use:

1. Change ports in `.env` file
2. Or stop conflicting services
3. Check: `lsof -i :5432` (for PostgreSQL)

### Volume permissions

If you encounter permission issues:

```bash
# Fix PostgreSQL volume permissions
docker-compose down
sudo chown -R 999:999 infra/postgres_data
docker-compose up -d
```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
- [Docker Networking](https://docs.docker.com/network/)
