.PHONY: setup start-cluster deploy-demo wait-pods build build-frontend build-backend run dev dev-bg chaos restore status stop clean

CLUSTER_MEMORY := 4096
CLUSTER_CPUS := 2
PORT := 8080

# Default: full setup
setup: start-cluster deploy-demo wait-pods build

# Full dev mode (cluster + deploy + build + run)
dev: setup run

# Start minikube cluster
start-cluster:
	@echo "Starting minikube with Docker driver ($(CLUSTER_MEMORY)MB, $(CLUSTER_CPUS) CPUs)..."
	minikube start --driver=docker --memory=$(CLUSTER_MEMORY) --cpus=$(CLUSTER_CPUS)
	@echo "Minikube started!"
	@echo "Run 'eval $$(minikube docker-env)' to use minikube's Docker daemon"

# Deploy Google Cloud microservices-demo
deploy-demo:
	@echo "Deploying microservices-demo..."
	kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/microservices-demo/main/release/kubernetes-manifests.yaml
	@echo "Microservices deployed!"

# Wait for all pods to be ready
wait-pods:
	@echo "Waiting for pods to be ready (this may take a few minutes)..."
	kubectl wait --for=condition=ready pod --all --timeout=300s || true
	@echo "Pod status:"
	kubectl get pods

# Build everything
build: build-frontend build-backend

# Build frontend
build-frontend:
	@echo "Building frontend..."
	cd frontend && npm install
	cd frontend && npm run build
	@echo "Frontend built!"

# Build Go backend
build-backend:
	@echo "Building Go backend..."
	go mod tidy
	go build -o kubesight main.go
	@echo "Backend built! Binary: ./kubesight"

# Run KubeSight server
run:
	@echo "Starting KubeSight on http://localhost:$(PORT)"
	./kubesight

# Run in background (output to kubesight.log)
run-bg:
	@echo "Starting KubeSight in background on http://localhost:$(PORT)"
	./kubesight > kubesight.log 2>&1 &
	@echo "PID: $$!"
	@echo "Logs: tail -f kubesight.log"
	@sleep 1
	@curl -s http://localhost:$(PORT) > /dev/null 2>&1 && echo "KubeSight is running!" || echo "Starting..."

# Stop background server
stop-bg:
	@pkill -f "./kubesight" 2>/dev/null || echo "KubeSight not running"
	@echo "KubeSight stopped"

# Trigger chaos - scale payment service to 0
chaos:
	@echo "Triggering chaos: scaling paymentservice to 0..."
	kubectl scale deployment/paymentservice --replicas=0
	@echo "Chaos triggered! Check the UI to see failure detection."

# Restore payment service
restore:
	@echo "Restoring paymentservice to 1 replica..."
	kubectl scale deployment/paymentservice --replicas=1
	@echo "Service restored!"

# Show status
status:
	@echo "=== Minikube Status ==="
	@minikube status 2>/dev/null || echo "  minikube stopped"
	@echo ""
	@echo "=== Pods ==="
	@kubectl get pods 2>/dev/null || echo "  no cluster access"
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc 2>/dev/null || echo "  no cluster access"
	@echo ""
	@echo "=== KubeSight ==="
	@curl -s http://localhost:$(PORT)/api/topology > /dev/null 2>&1 && echo "  running on http://localhost:$(PORT)" || echo "  not running"

# Open KubeSight in browser
open:
	@curl -s http://localhost:$(PORT) > /dev/null 2>&1 && \
		(open http://localhost:$(PORT) || xdg-open http://localhost:$(PORT) || echo "Open http://localhost:$(PORT) in your browser") || \
		echo "KubeSight not running. Run 'make run' first."

# Stop minikube
stop:
	@echo "Stopping minikube..."
	minikube stop
	@echo "Minikube stopped!"

# Clean everything - stop and delete cluster, remove build artifacts
clean:
	@echo "Cleaning up..."
	-minikube delete 2>/dev/null || true
	-rm -rf frontend/node_modules frontend/dist kubesight kubesight.log
	@echo "Cleaned!"

# Help
help:
	@echo "KubeSight Makefile Targets:"
	@echo ""
	@echo "  Setup & Run:"
	@echo "    make setup       - Start cluster, deploy demo, wait for pods, build"
	@echo "    make dev         - Full setup + run server (interactive)"
	@echo "    make run         - Start KubeSight server (requires build)"
	@echo "    make run-bg      - Start server in background"
	@echo ""
	@echo "  Cluster Management:"
	@echo "    make start-cluster   - Start minikube"
	@echo "    make deploy-demo     - Deploy microservices-demo"
	@echo "    make wait-pods       - Wait for all pods ready"
	@echo "    make stop            - Stop minikube"
	@echo "    make clean           - Delete minikube + clean build artifacts"
	@echo ""
	@echo "  Build:"
	@echo "    make build           - Build frontend + backend"
	@echo "    make build-frontend  - npm install + build"
	@echo "    make build-backend   - go build"
	@echo ""
	@echo "  Testing:"
	@echo "    make chaos           - Scale paymentservice to 0 (test failure)"
	@echo "    make restore         - Restore paymentservice to 1"
	@echo ""
	@echo "  Utilities:"
	@echo "    make status          - Show cluster + app status"
	@echo "    make open            - Open KubeSight in browser"
	@echo "    make help            - Show this help"
