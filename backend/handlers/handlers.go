package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"kubesight/backend/k8s"
)

// ErrorResponse represents a structured error response
type ErrorResponse struct {
	Error     string            `json:"error"`
	Code      string            `json:"code"`
	Details   string            `json:"details,omitempty"`
	Timestamp time.Time         `json:"timestamp"`
}

// WriteError writes a structured error response
func WriteError(w http.ResponseWriter, status int, code string, message string, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error:     message,
		Code:      code,
		Details:   details,
		Timestamp: time.Now(),
	})
}

type Handler struct {
	client *k8s.Client
	upgrader websocket.Upgrader
	startTime time.Time
}

func New(client *k8s.Client) *Handler {
	return &Handler{
		client: client,
		startTime: time.Now(),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
		},
	}
}

func (h *Handler) GetTopology(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", 
			"Method not allowed", fmt.Sprintf("Expected GET, got %s", r.Method))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	topology, err := h.client.GetTopology(ctx)
	if err != nil {
		log.Printf("Failed to get topology: %v", err)
		WriteError(w, http.StatusInternalServerError, "TOPOLOGY_ERROR", 
			"Failed to fetch topology", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	json.NewEncoder(w).Encode(topology)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED",
			"Method not allowed", fmt.Sprintf("Expected GET, got %s", r.Method))
		return
	}

	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now(),
		"uptime":    time.Since(h.startTime).String(),
		"service":   "kubesight",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED",
			"Method not allowed", fmt.Sprintf("Expected GET, got %s", r.Method))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Check if we can connect to Kubernetes
	healthStatus, err := h.client.GetHealth(ctx)
	if err != nil {
		log.Printf("Health check failed: %v", err)
		WriteError(w, http.StatusServiceUnavailable, "NOT_READY",
			"Service not ready", err.Error())
		return
	}

	response := map[string]interface{}{
		"status":      "ready",
		"timestamp":   time.Now(),
		"kubernetes":  healthStatus.Kubernetes,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) Metrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		WriteError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED",
			"Method not allowed", fmt.Sprintf("Expected GET, got %s", r.Method))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	metrics, err := h.client.GetMetrics(ctx)
	if err != nil {
		log.Printf("Failed to get metrics: %v", err)
		WriteError(w, http.StatusInternalServerError, "METRICS_ERROR",
			"Failed to fetch metrics", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func (h *Handler) TriggerChaos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		WriteError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED",
			"Method not allowed", fmt.Sprintf("Expected POST, got %s", r.Method))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Scale payment service to 0 for chaos demo
	err := h.client.ScaleDeployment(ctx, "default", "paymentservice", 0)
	if err != nil {
		log.Printf("Failed to trigger chaos: %v", err)
		WriteError(w, http.StatusInternalServerError, "CHAOS_ERROR",
			"Failed to trigger chaos", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "chaos triggered",
		"target":    "paymentservice",
		"timestamp": time.Now(),
	})
}

func (h *Handler) WebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade websocket: %v", err)
		return
	}
	defer conn.Close()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			topology, err := h.client.GetTopology(ctx)
			cancel()
			
			if err != nil {
				log.Printf("Failed to get topology: %v", err)
				continue
			}

			if err := conn.WriteJSON(topology); err != nil {
				log.Printf("Failed to write to websocket: %v", err)
				return
			}
		}
	}
}
