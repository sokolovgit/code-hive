# Docker Images

## Directory Structure

```
infra/docker/
├── base/
│   ├── node.Dockerfile     # Base image with pnpm, deps, built libs
│   └── README.md           # This file
└── services/
    ├── entrypoint.sh       # Shared entrypoint script
    ├── users.Dockerfile    # Users service
    ├── auth.Dockerfile     # Auth service (template)
    └── payment.Dockerfile  # Payment service (template)
```

## Base Image

The base image (`codehive-base:latest`) contains:

- Node.js 22 with pnpm
- All workspace dependencies installed
- Shared libraries (`@code-hive/nestjs`, `@code-hive/types`) built
- Non-root user configured

### Building the Base Image

```bash
# From monorepo root
docker build -t codehive-base:latest -f infra/docker/base/node.Dockerfile .

# Or via Make
make base
```

## Service Images

Each service has its own Dockerfile that extends the base image.

### Creating a New Service Dockerfile

1. Copy the template:

   ```bash
   cp infra/docker/services/users.Dockerfile infra/docker/services/your-service.Dockerfile
   ```

2. Update in the new Dockerfile:
   - `SERVICE_NAME` environment variable
   - `npm_package_name` environment variable
   - Copy paths for your service
   - Build commands

3. Add to `docker-compose.yml`:
   ```yaml
   your-service:
     build:
       <<: *build-common
       dockerfile: infra/docker/services/your-service.Dockerfile
       target: development
     # ... rest of config
   ```

## Entrypoint Script

The shared `entrypoint.sh` handles:

- Service startup logging
- Rebuilding libs if source changed (dev mode)
- Signal handling via dumb-init

## Build Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    node.Dockerfile                          │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐ │
│  │  base   │ -> │   deps   │ -> │  libs   │ -> │  final  │ │
│  │ (node)  │    │ (install)│    │ (build) │    │ (ready) │ │
│  └─────────┘    └──────────┘    └─────────┘    └─────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼ codehive-base:latest
┌─────────────────────────────────────────────────────────────┐
│                  users.Dockerfile                           │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐│
│  │ development │    │   builder   │    │   production     ││
│  │ (hot-reload)│    │   (build)   │    │ (minimal runtime)││
│  └─────────────┘    └─────────────┘    └──────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Why This Pattern?

1. **Fast rebuilds** - Base image cached, only service changes trigger rebuild
2. **Consistent dependencies** - All services use same base
3. **Minimal volumes** - Only source code mounted for hot-reload
4. **Clean separation** - Docker files in infra, source in apps
5. **Production-ready** - Same Dockerfiles for dev and prod
