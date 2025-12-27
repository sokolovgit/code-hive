#!/bin/sh
# =============================================================================
# Service Entrypoint Script
# =============================================================================
# Handles service startup for development and production environments.
#
# Features:
#   - Waits for dependencies if needed
#   - Rebuilds libs if source changed (dev mode)
#   - Executes the main command
# =============================================================================

set -e

echo "🚀 Starting ${SERVICE_NAME:-service}..."
echo "   Environment: ${NODE_ENV:-development}"
echo "   Command: $@"

# If in development mode and libs source is mounted, rebuild them
if [ "$NODE_ENV" = "development" ] && [ -d "/app/libs/nestjs/src" ]; then
    echo "📦 Checking if libs need rebuild..."
    
    # Check if libs/nestjs/dist exists, if not rebuild
    if [ ! -d "/app/libs/nestjs/dist" ]; then
        echo "   Building @code-hive/nestjs..."
        pnpm --filter "@code-hive/nestjs" build 2>/dev/null || true
    fi
    
    if [ ! -d "/app/libs/types/dist" ]; then
        echo "   Building @code-hive/types..."
        pnpm --filter "@code-hive/types" build 2>/dev/null || true
    fi
fi

# Execute the main command
echo "✅ Starting service..."
exec "$@"

