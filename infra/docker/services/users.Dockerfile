# Service-specific Dockerfile for Users Service
# This extends the base node image with service-specific configuration

FROM code-hive-node-base:latest AS base

WORKDIR /app

# Copy libs first so workspace packages are available
COPY libs ./libs

# Copy service-specific files
COPY apps/services/users/package.json ./apps/services/users/
COPY apps/services/users/tsconfig*.json ./apps/services/users/

# Install dependencies to link workspace packages
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
# Copy entrypoint script
COPY infra/docker/services/users-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Dependencies are already installed in base image
# Volume mounts will handle code changes
CMD ["pnpm", "--filter", "@code-hive/users-service", "dev"]

# Production stage
FROM base AS production
COPY apps/services/users ./apps/services/users
RUN pnpm --filter @code-hive/users-service build
CMD ["node", "apps/services/users/dist/main.js"]

