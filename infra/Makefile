.PHONY: help setup up down logs ps build-base clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Setup environment files from templates
	@./scripts/setup-env.sh

up: ## Start infrastructure services
	docker-compose up -d
	@echo "✅ Infrastructure started"
	@echo "📊 View logs: make logs"

down: ## Stop infrastructure services
	docker-compose down

logs: ## Show infrastructure logs (usage: make logs SERVICE=postgres)
	docker-compose logs -f $(SERVICE)

ps: ## Show infrastructure service status
	docker-compose ps

build-base: ## Build base Docker images
	@echo "🔨 Building base Node.js image..."
	docker build -f docker/base/node.Dockerfile -t code-hive-node-base:latest ../..
	@echo "✅ Base images built"

clean: ## Remove all containers, volumes, and networks
	docker-compose down -v
	@echo "🧹 Cleaned up"

restart: down up ## Restart infrastructure services

health: ## Check health of all services
	docker-compose ps
	@echo ""
	@echo "Testing connections..."
	@docker-compose exec -T postgres pg_isready -U postgres || echo "❌ PostgreSQL not ready"
	@docker-compose exec -T redis redis-cli ping || echo "❌ Redis not ready"

