# ============================================================================
# Code Hive Infrastructure - Makefile
# ============================================================================
# Simplified commands using Docker Compose profiles
#
# PROFILES:
#   core         - postgres, redis
#   otel         - OpenTelemetry Collector
#   observability - grafana, prometheus, loki, tempo, promtail
#   exporters    - node-exporter, postgres-exporter
#   tools        - adminer, redis-commander, mailpit
#   services     - users-service, auth-service, payment-service
# ============================================================================

.PHONY: help dev full observability core tools up down logs restart clean ps build rebuild shell base

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# Default target
help:
	@echo ""
	@echo "$(CYAN)Code Hive Infrastructure$(RESET)"
	@echo ""
	@echo "$(GREEN)Quick Start:$(RESET)"
	@echo "  make dev            Start databases + services (fast development)"
	@echo "  make full           Start everything including observability"
	@echo "  make down           Stop all running containers"
	@echo ""
	@echo "$(GREEN)Selective Startup:$(RESET)"
	@echo "  make core           Start only databases (postgres, redis)"
	@echo "  make observability  Start monitoring stack (grafana, prometheus, etc.)"
	@echo "  make tools          Start dev tools (adminer, redis-commander, mailpit)"
	@echo "  make services       Start only microservices"
	@echo ""
	@echo "$(GREEN)Build:$(RESET)"
	@echo "  make base           Build base Docker image"
	@echo "  make build          Build all service images"
	@echo "  make rebuild        Rebuild all images without cache"
	@echo ""
	@echo "$(GREEN)Operations:$(RESET)"
	@echo "  make ps             Show running containers"
	@echo "  make logs           Follow all logs"
	@echo "  make logs-<name>    Follow specific service logs"
	@echo "  make restart        Restart all services"
	@echo ""
	@echo "$(GREEN)Database:$(RESET)"
	@echo "  make db             Connect to PostgreSQL shell"
	@echo "  make db-list        List all databases"
	@echo ""
	@echo "$(GREEN)Cleanup:$(RESET)"
	@echo "  make clean          Stop and remove containers, networks"
	@echo "  make clean-volumes  Stop and remove everything including data"
	@echo ""
	@echo "$(YELLOW)Access URLs (after startup):$(RESET)"
	@echo "  Users Service:      http://localhost:3000"
	@echo "  Grafana:            http://localhost:3001 (admin/password)"
	@echo "  Prometheus:         http://localhost:9090"
	@echo "  Adminer (DB UI):    http://localhost:8080"
	@echo "  Redis Commander:    http://localhost:8081"
	@echo "  Mailpit:            http://localhost:8025"
	@echo ""

# ============================================================================
# BUILD COMMANDS
# ============================================================================

# Build the base image (required before services)
base:
	@echo "$(CYAN)Building base image...$(RESET)"
	@docker compose --profile build build base
	@echo "$(GREEN)✓ Base image ready: codehive-base:latest$(RESET)"

# Build all service images
build: base
	@echo "$(CYAN)Building service images...$(RESET)"
	@docker compose --profile services build
	@echo "$(GREEN)✓ Service images built$(RESET)"

# Rebuild without cache
rebuild:
	@echo "$(CYAN)Rebuilding all images (no cache)...$(RESET)"
	@docker compose --profile build build --no-cache base
	@docker compose --profile services build --no-cache
	@echo "$(GREEN)✓ All images rebuilt$(RESET)"

# ============================================================================
# QUICK START COMMANDS
# ============================================================================

# Development mode: databases + otel + services
dev: base
	@echo "$(CYAN)Starting development environment...$(RESET)"
	@docker compose --profile core --profile otel --profile services up -d --build
	@echo ""
	@echo "$(GREEN)✓ Development environment ready!$(RESET)"
	@echo ""
	@echo "Services:"
	@echo "  Users Service:  http://localhost:3000"
	@echo "  PostgreSQL:     localhost:5432"
	@echo "  Redis:          localhost:6379"
	@echo ""
	@echo "Run 'make logs' to follow logs, 'make tools' for dev utilities"

# Full mode: everything including observability
full: base
	@echo "$(CYAN)Starting full environment with observability...$(RESET)"
	@docker compose \
		--profile core \
		--profile otel \
		--profile observability \
		--profile exporters \
		--profile services \
		up -d --build
	@echo ""
	@echo "$(GREEN)✓ Full environment ready!$(RESET)"
	@echo ""
	@echo "Services:"
	@echo "  Users Service:  http://localhost:3000"
	@echo "  Grafana:        http://localhost:3001 (admin/password)"
	@echo "  Prometheus:     http://localhost:9090"
	@echo "  Tempo:          http://localhost:3200"
	@echo "  Loki:           http://localhost:3100"

# ============================================================================
# SELECTIVE STARTUP
# ============================================================================

# Core databases only
core:
	@echo "$(CYAN)Starting core databases...$(RESET)"
	@docker compose --profile core up -d
	@echo "$(GREEN)✓ Databases ready!$(RESET)"
	@echo "  PostgreSQL: localhost:5432"
	@echo "  Redis:      localhost:6379"

# Observability stack only
observability:
	@echo "$(CYAN)Starting observability stack...$(RESET)"
	@docker compose --profile observability --profile exporters up -d
	@echo "$(GREEN)✓ Observability ready!$(RESET)"
	@echo "  Grafana:    http://localhost:3001"
	@echo "  Prometheus: http://localhost:9090"
	@echo "  Tempo:      http://localhost:3200"
	@echo "  Loki:       http://localhost:3100"

# Dev tools only (requires core)
tools:
	@echo "$(CYAN)Starting development tools...$(RESET)"
	@docker compose --profile core --profile tools up -d
	@echo "$(GREEN)✓ Dev tools ready!$(RESET)"
	@echo "  Adminer:          http://localhost:8080"
	@echo "  Redis Commander:  http://localhost:8081"
	@echo "  Mailpit:          http://localhost:8025"

# Microservices only (requires core + base)
services: base
	@echo "$(CYAN)Starting microservices...$(RESET)"
	@docker compose --profile core --profile otel --profile services up -d --build
	@echo "$(GREEN)✓ Services ready!$(RESET)"

# ============================================================================
# OPERATIONS
# ============================================================================

# Stop all containers
down:
	@echo "$(CYAN)Stopping all containers...$(RESET)"
	@docker compose --profile core --profile otel --profile observability --profile exporters --profile tools --profile services down
	@echo "$(GREEN)✓ All containers stopped$(RESET)"

# Show container status
ps:
	@docker compose --profile core --profile otel --profile observability --profile exporters --profile tools --profile services ps

# Follow all logs
logs:
	@docker compose --profile core --profile otel --profile observability --profile exporters --profile tools --profile services logs -f

# Restart all
restart:
	@docker compose --profile core --profile otel --profile observability --profile exporters --profile tools --profile services restart

# ============================================================================
# SERVICE-SPECIFIC LOGS
# ============================================================================

logs-users:
	@docker compose logs -f users-service

logs-auth:
	@docker compose logs -f auth-service

logs-payment:
	@docker compose logs -f payment-service

logs-postgres:
	@docker compose logs -f postgres

logs-redis:
	@docker compose logs -f redis

logs-grafana:
	@docker compose logs -f grafana

logs-otel:
	@docker compose logs -f otel-collector

logs-tempo:
	@docker compose logs -f tempo

logs-loki:
	@docker compose logs -f loki

logs-prometheus:
	@docker compose logs -f prometheus

# ============================================================================
# DATABASE COMMANDS
# ============================================================================

db:
	@docker compose exec postgres psql -U admin -d postgres

db-list:
	@docker compose exec postgres psql -U admin -d postgres -c "\l"

db-users:
	@docker compose exec postgres psql -U admin -d users_db

db-auth:
	@docker compose exec postgres psql -U admin -d auth_db

db-payment:
	@docker compose exec postgres psql -U admin -d payment_db

# ============================================================================
# SHELL ACCESS
# ============================================================================

shell-users:
	@docker compose exec users-service sh

shell-postgres:
	@docker compose exec postgres sh

shell-redis:
	@docker compose exec redis sh

# ============================================================================
# CLEANUP
# ============================================================================

# Stop and remove containers/networks (preserves volumes)
clean:
	@echo "$(CYAN)Cleaning up containers and networks...$(RESET)"
	@docker compose --profile core --profile otel --profile observability --profile exporters --profile tools --profile services --profile build down --remove-orphans
	@echo "$(GREEN)✓ Cleanup complete$(RESET)"

# Full cleanup including volumes (WARNING: deletes all data)
clean-volumes:
	@echo "$(YELLOW)⚠ WARNING: This will delete all data including databases!$(RESET)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker compose --profile core --profile otel --profile observability --profile exporters --profile tools --profile services --profile build down -v --remove-orphans
	@echo "$(GREEN)✓ Full cleanup complete$(RESET)"

# Remove base image
clean-images:
	@echo "$(CYAN)Removing base image...$(RESET)"
	@docker rmi codehive-base:latest 2>/dev/null || true
	@echo "$(GREEN)✓ Images removed$(RESET)"

# Prune unused Docker resources
prune:
	@echo "$(CYAN)Pruning unused Docker resources...$(RESET)"
	@docker system prune -f
	@echo "$(GREEN)✓ Prune complete$(RESET)"
