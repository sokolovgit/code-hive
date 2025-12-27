# =============================================================================
# Users Service Dockerfile
# =============================================================================
# Extends the base image with users-service specific configuration.
#
# BUILD (standalone):
#   docker build -t codehive-users:latest -f infra/docker/services/users.Dockerfile .
#
# The base image must be built first, or use docker compose which handles this.
# =============================================================================

ARG BASE_IMAGE=codehive-base:latest
FROM ${BASE_IMAGE} AS base

# Service metadata
ENV SERVICE_NAME=users-service
ENV npm_package_name=@code-hive/users-service
ENV npm_package_version=1.0.0

WORKDIR /app

# -----------------------------------------------------------------------------
# Development Stage
# -----------------------------------------------------------------------------
FROM base AS development

# Copy service package.json and tsconfig
COPY apps/services/users/package.json ./apps/services/users/
COPY apps/services/users/tsconfig*.json ./apps/services/users/

# Copy entrypoint script
COPY infra/docker/services/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Source code will be mounted via volume for hot-reload
# If not mounted, copy it here as fallback
COPY apps/services/users/src ./apps/services/users/src

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["pnpm", "--filter", "@code-hive/users-service", "dev"]

# -----------------------------------------------------------------------------
# Builder Stage - Build for production
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy service source
COPY apps/services/users ./apps/services/users

# Build the service
RUN pnpm --filter "@code-hive/users-service" build

# -----------------------------------------------------------------------------
# Production Stage
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION:-22}-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs app

# Copy built application
COPY --from=builder --chown=app:nodejs /app/apps/services/users/dist ./dist
COPY --from=builder --chown=app:nodejs /app/apps/services/users/package.json ./
COPY --from=builder --chown=app:nodejs /app/node_modules ./node_modules

# Service metadata
ENV SERVICE_NAME=users-service
ENV NODE_ENV=production

USER app

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

