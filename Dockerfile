# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.26-alpine AS go-builder
WORKDIR /app

# Copy go mod files and create kubesight directory
COPY go.mod go.sum ./
RUN mkdir -p kubesight

# Copy all source to kubesight (matching module name)
COPY main.go ./kubesight/
COPY backend/ ./kubesight/backend/
COPY styles.css ./kubesight/

# Also copy go.mod/go.sum to kubesight for module resolution
COPY go.mod go.sum ./kubesight/

# Build from inside kubesight directory
WORKDIR /app/kubesight
RUN CGO_ENABLED=0 go build -o server .

# Stage 3: Runtime
FROM alpine:latest
WORKDIR /app
COPY --from=go-builder /app/kubesight/server ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["./server"]