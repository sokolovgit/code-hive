#!/bin/bash

# Development script for starting infrastructure and services
# Usage: ./scripts/dev.sh [infra|services|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"

cd "$INFRA_DIR"

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

case "${1:-all}" in
  infra)
    echo "🚀 Starting infrastructure services..."
    docker-compose up -d
    echo "✅ Infrastructure started"
    echo "📊 View logs: docker-compose logs -f"
    ;;
  services)
    echo "🚀 Starting application services..."
    if [ ! -f docker-compose.services.yml ]; then
      echo "❌ docker-compose.services.yml not found"
      echo "💡 Copy docker-compose.services.yml.example and customize it"
      exit 1
    fi
    docker-compose -f docker-compose.yml -f docker-compose.services.yml up
    ;;
  all)
    echo "🚀 Starting infrastructure..."
    docker-compose up -d
    echo "⏳ Waiting for services to be healthy..."
    docker-compose ps
    echo ""
    echo "✅ Infrastructure ready!"
    echo ""
    echo "💡 To start services:"
    echo "   Option A (recommended): Run services locally"
    echo "     cd $ROOT_DIR && pnpm dev"
    echo ""
    echo "   Option B: Run services in Docker"
    echo "     cd $INFRA_DIR && docker-compose -f docker-compose.yml -f docker-compose.services.yml up"
    ;;
  stop)
    echo "🛑 Stopping all services..."
    docker-compose down
    if [ -f docker-compose.services.yml ]; then
      docker-compose -f docker-compose.yml -f docker-compose.services.yml down
    fi
    ;;
  logs)
    docker-compose logs -f "${2:-}"
    ;;
  *)
    echo "Usage: $0 [infra|services|all|stop|logs [service]]"
    exit 1
    ;;
esac

