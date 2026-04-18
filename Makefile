.PHONY: help db db-stop db-init db-reset stripe stripe-stop build dev api worker deploy \
       test-build test-standalone test-split test-standalone-down test-split-down

help:
	@echo "Available commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make dev           - Start all services (Web + API + Worker) via SERVICE_MODE=all"
	@echo "    make api           - Start API service only (Hono :3002)"
	@echo "    make worker        - Start Worker service only (BullMQ :3001)"
	@echo ""
	@echo "  Database:"
	@echo "    make db            - Start local PostgreSQL + Redis (Docker Compose)"
	@echo "    make db-stop       - Stop local database containers"
	@echo "    make db-init       - Incremental sync schema + seed (safe to run repeatedly)"
	@echo "    make db-reset      - Destroy all data and re-initialize from scratch"
	@echo ""
	@echo "  Integrations:"
	@echo "    make stripe        - Start Stripe CLI webhook listener"
	@echo "    make stripe-stop   - Stop Stripe CLI container"
	@echo ""
	@echo "  Build & Deploy:"
	@echo "    make build         - Build Next.js application"
	@echo "    make deploy        - Print deployment instructions"
	@echo ""
	@echo "  Testing (Docker):"
	@echo "    make test-build          - Build unified Docker image for testing"
	@echo "    make test-standalone     - Test SERVICE_MODE=all (single container)"
	@echo "    make test-split          - Test SERVICE_MODE=web/api/worker (three containers)"
	@echo "    make test-standalone-down - Stop standalone test containers"
	@echo "    make test-split-down     - Stop split test containers"

db:
	docker compose up -d

db-stop:
	docker compose down

db-init:
	docker compose up -d
	pnpm db:push
	pnpm db:seed

db-reset:
	docker compose down -v
	docker compose up -d
	pnpm db:push
	pnpm db:seed

stripe:
	docker compose --profile stripe up stripe-cli

stripe-stop:
	docker compose --profile stripe stop stripe-cli

build:
	pnpm build

dev:
	SERVICE_MODE=all pnpm dev:all

api:
	pnpm api:dev

worker:
	pnpm worker:dev

deploy:
	@echo "Deployment is handled via GitOps (Argo CD)."
	@echo "Push to dev/pre/prod branch to trigger the CI pipeline."
	@echo ""
	@echo "SERVICE_MODE options for Kubernetes Deployments:"
	@echo "  all    - Single pod runs Web + API + Worker (dev/small-scale)"
	@echo "  web    - Next.js only"
	@echo "  api    - Hono API only"
	@echo "  worker - BullMQ Worker only"

# --- Docker Testing ---

test-build:
	pnpm build
	docker build -t vibevideo-test .

test-standalone:
	docker compose -f docker-compose.test.yml --profile standalone up -d
	@echo "Waiting 10s for services to start..."
	@sleep 10
	node scripts/test-service-mode.mjs standalone

test-split:
	docker compose -f docker-compose.test.yml --profile split up -d
	@echo "Waiting 10s for services to start..."
	@sleep 10
	node scripts/test-service-mode.mjs split

test-standalone-down:
	docker compose -f docker-compose.test.yml --profile standalone down -v

test-split-down:
	docker compose -f docker-compose.test.yml --profile split down -v

