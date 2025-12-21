#!/bin/sh
set -e

# Install dependencies to ensure workspace packages are linked
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build libs to ensure dist files are available
echo "Building libs..."
pnpm --filter @code-hive/nestjs build || true

# Run the original command
exec "$@"

