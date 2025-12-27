#!/bin/bash

# Simple infrastructure startup script
# Usage: ./start.sh [services...]
# Examples:
#   ./start.sh              # Start all services
#   ./start.sh postgres redis  # Start only postgres and redis
#   ./start.sh --minimal     # Start only essential services (postgres, redis)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from template..."
  if [ -f env.template ]; then
    cp env.template .env
    echo "✅ Created .env file. Please review and update if needed."
  else
    echo "❌ Error: env.template not found"
    exit 1
  fi
fi

# Parse arguments
if [ "$1" = "--minimal" ]; then
  SERVICES="postgres redis"
  echo "🚀 Starting minimal infrastructure (postgres, redis)..."
elif [ $# -eq 0 ]; then
  SERVICES=""
  echo "🚀 Starting all infrastructure services..."
else
  SERVICES="$@"
  echo "🚀 Starting services: $SERVICES"
fi

# Start services
if [ -z "$SERVICES" ]; then
  docker-compose up -d
else
  docker-compose up -d $SERVICES
fi

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose ps

# Check for unhealthy services
UNHEALTHY=$(docker-compose ps --format json | jq -r '.[] | select(.Health != "healthy" and .State == "running") | .Name' 2>/dev/null || echo "")

if [ -n "$UNHEALTHY" ]; then
  echo ""
  echo "⚠️  Some services are not healthy yet:"
  echo "$UNHEALTHY"
  echo ""
  echo "💡 Check logs with: docker-compose logs -f [service-name]"
else
  echo ""
  echo "✅ All services are healthy!"
fi

echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker-compose logs -f [service]"
echo "   Stop:         docker-compose down"
echo "   Status:       docker-compose ps"
echo "   Restart:      docker-compose restart [service]"

