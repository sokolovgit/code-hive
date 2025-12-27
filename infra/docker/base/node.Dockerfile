# =============================================================================
# Base Node.js Image for All Services
# =============================================================================
# This image contains:
#   - Node.js with pnpm
#   - Workspace dependencies installed
#   - Shared libraries built
#
# BUILD:
#   docker build -t codehive-base:latest -f infra/docker/base/node.Dockerfile .
#
# Build context should be the monorepo root.
# =============================================================================

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base

# Install pnpm and essential tools
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    apk add --no-cache curl dumb-init

WORKDIR /app

# Configure pnpm for monorepo compatibility
RUN echo "shamefully-hoist=true" > .npmrc && \
    echo "prefer-frozen-lockfile=true" >> .npmrc

# -----------------------------------------------------------------------------
# Dependencies Stage - Install workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY turbo.json ./

# Copy service package.json files (only services that exist)
COPY apps/services/users/package.json ./apps/services/users/

# Copy library package.json files
COPY libs/nestjs/package.json ./libs/nestjs/
COPY libs/types/package.json ./libs/types/

# Install all dependencies
RUN pnpm install

# -----------------------------------------------------------------------------
# Libs Stage - Build shared libraries
# -----------------------------------------------------------------------------
FROM deps AS libs

# Copy library source code
COPY libs ./libs

# Build all shared libraries
RUN pnpm --filter "@code-hive/nestjs" build || echo "nestjs lib build skipped"
RUN pnpm --filter "@code-hive/types" build || echo "types lib build skipped"

# -----------------------------------------------------------------------------
# Final Base Image - Ready for service-specific builds
# -----------------------------------------------------------------------------
FROM libs AS final

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs app

# Labels
LABEL org.opencontainers.image.source="https://github.com/code-hive/code-hive"
LABEL org.opencontainers.image.description="Code Hive Node.js Base Image"

# Default entrypoint
ENTRYPOINT ["dumb-init", "--"]
