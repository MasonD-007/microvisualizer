package main

import (
	"log"
	"net/http"

	"kubesight/backend/handlers"
	"kubesight/backend/k8s"
)

func main() {
	// Initialize Kubernetes client
	client, err := k8s.NewClient()
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}

	// Create handlers
	h := handlers.New(client)

	// API routes
	http.HandleFunc("/api/topology", h.GetTopology)
	http.HandleFunc("/api/chaos", h.TriggerChaos)
	http.HandleFunc("/api/health", h.Health)
	http.HandleFunc("/api/ready", h.Ready)
	http.HandleFunc("/api/metrics", h.Metrics)
	http.HandleFunc("/ws", h.WebSocket)

	// Serve frontend static files
	fs := http.FileServer(http.Dir("frontend/dist"))
	http.Handle("/", fs)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
