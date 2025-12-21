# Infrastructure Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Setup Environment

```bash
cd infra
make setup
# Or: ./scripts/setup-env.sh
```

### Step 2: Start Infrastructure

```bash
make up
# Or: docker-compose up -d
```

### Step 3: Run Your Services Locally

```bash
cd ../..
pnpm dev
```

That's it! Your services will connect to the Docker infrastructure.

## 📋 Common Commands

```bash
# Start infrastructure
make up

# Stop infrastructure
make down

# View logs
make logs SERVICE=postgres
make logs SERVICE=redis

# Check status
make ps

# Restart
make restart

# Clean everything (removes volumes)
make clean
```

## 🔧 Development Workflow

### Recommended: Infrastructure in Docker, Services Locally

1. **Start infrastructure once:**

   ```bash
   cd infra && make up
   ```

2. **Run services locally for development:**
   ```bash
   cd ../..
   pnpm dev
   ```

**Why?** Fast hot-reload, easy debugging, no Docker overhead.

### Alternative: Everything in Docker

1. **Build base images:**

   ```bash
   cd infra
   make build-base
   ```

2. **Setup services compose:**

   ```bash
   cp docker-compose.services.yml.example docker-compose.services.yml
   ```

3. **Start everything:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.services.yml up
   ```

## 🔗 Service URLs

- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **pgAdmin** (if enabled): http://localhost:8080
- **Redis Commander** (if enabled): http://localhost:8081

## 🐛 Troubleshooting

**Services can't connect?**

- Check infrastructure is running: `make ps`
- Verify `.env` file exists and has correct values
- Check service logs: `make logs`

**Port already in use?**

- Change ports in `infra/.env`
- Or stop conflicting services

**Need to reset data?**

```bash
make clean  # Removes all volumes
make up     # Start fresh
```

## 📚 More Information

See [README.md](./README.md) for detailed documentation.
