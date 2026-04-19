package minikube

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	clientset *kubernetes.Clientset
	connected bool
	startTime time.Time
}

type Node struct {
	ID       string            `json:"id"`
	Label    string            `json:"label"`
	Type     string            `json:"type"`
	Status   string            `json:"status"`
	Metadata map[string]string `json:"metadata"`
}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
	Type string `json:"type"`
}

type Topology struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type HealthStatus struct {
	Status      string            `json:"status"`
	Timestamp   time.Time         `json:"timestamp"`
	Version     string            `json:"version"`
	Uptime      string            `json:"uptime"`
	Kubernetes  KubernetesHealth  `json:"kubernetes"`
}

type KubernetesHealth struct {
	Connected bool   `json:"connected"`
	Version   string `json:"version"`
}

type Metrics struct {
	Timestamp    time.Time       `json:"timestamp"`
	Nodes        NodeMetrics     `json:"nodes"`
	Topology     TopologyMetrics `json:"topology"`
	Performance  PerfMetrics     `json:"performance"`
}

type NodeMetrics struct {
	Total     int `json:"total"`
	Services  int `json:"services"`
	Pods      int `json:"pods"`
	Running   int `json:"running"`
	Down      int `json:"down"`
}

type TopologyMetrics struct {
	Nodes int `json:"nodes"`
	Edges int `json:"edges"`
}

type PerfMetrics struct {
	Uptime string `json:"uptime"`
}

var (
	// Matches env vars like: PRODUCT_CATALOG_SERVICE_ADDR=service:port
	serviceAddrRegex = regexp.MustCompile(`(?i)([a-z_]+)_SERVICE_ADDR`)
	version = "dev" // Set at build time with -ldflags
)

func NewClient() (*Client, error) {
	config, err := getConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	return &Client{
		clientset: clientset,
		connected: true,
		startTime: time.Now(),
	}, nil
}

func (c *Client) GetHealth(ctx context.Context) (*HealthStatus, error) {
	if !c.connected {
		return nil, fmt.Errorf("kubernetes client not connected")
	}

	// Test K8s connection by getting version
	serverVersion, err := c.clientset.Discovery().ServerVersion()
	k8sVersion := "unknown"
	k8sConnected := false
	
	if err == nil {
		k8sConnected = true
		k8sVersion = serverVersion.GitVersion
	}

	return &HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now(),
		Version:   serverVersion.GitVersion,
		Uptime:    time.Since(c.startTime).String(),
		Kubernetes: KubernetesHealth{
			Connected: k8sConnected,
			Version:   k8sVersion,
		},
	}, nil
}

func (c *Client) GetMetrics(ctx context.Context) (*Metrics, error) {
	topology, err := c.GetTopology(ctx, "")
	if err != nil {
		return nil, err
	}

	services := 0
	pods := 0
	running := 0
	down := 0

	for _, node := range topology.Nodes {
		switch node.Type {
		case "service":
			services++
		case "pod":
			pods++
			if node.Status == "running" {
				running++
			} else {
				down++
			}
		}
	}

	return &Metrics{
		Timestamp: time.Now(),
		Nodes: NodeMetrics{
			Total:    len(topology.Nodes),
			Services: services,
			Pods:     pods,
			Running:  running,
			Down:     down,
		},
		Topology: TopologyMetrics{
			Nodes: len(topology.Nodes),
			Edges: len(topology.Edges),
		},
		Performance: PerfMetrics{
			Uptime: time.Since(c.startTime).String(),
		},
	}, nil
}

func getConfig() (*rest.Config, error) {
	// Try in-cluster config first
	config, err := rest.InClusterConfig()
	if err == nil {
		return config, nil
	}

	// Fall back to kubeconfig
	home := os.Getenv("HOME")
	kubeconfig := filepath.Join(home, ".kube", "config")
	
	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}

func (c *Client) GetTopology(ctx context.Context, namespace string) (*Topology, error) {
	// Get all pods
	listOptions := metav1.ListOptions{
		FieldSelector: "",
	}
	if namespace != "" && namespace != "all" {
		listOptions.FieldSelector = "metadata.namespace=" + namespace
	}
	pods, err := c.clientset.CoreV1().Pods("").List(ctx, listOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	// Get all services
	var services *corev1.ServiceList
	if namespace != "" && namespace != "all" {
		services, err = c.clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	} else {
		services, err = c.clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	}
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	topology := &Topology{
		Nodes: []Node{},
		Edges: []Edge{},
	}

	// Build service name map for dependency detection
	serviceNames := make(map[string]string) // service name -> svc-<name>
	for _, svc := range services.Items {
		if svc.Spec.Type == corev1.ServiceTypeClusterIP {
			serviceNames[svc.Name] = fmt.Sprintf("svc-%s", svc.Name)
		}
	}

	// Add service nodes
	for _, svc := range services.Items {
		if svc.Spec.Type == corev1.ServiceTypeClusterIP {
			node := Node{
				ID:     fmt.Sprintf("svc-%s", svc.Name),
				Label:  svc.Name,
				Type:   "service",
				Status: "active",
				Metadata: map[string]string{
					"namespace": svc.Namespace,
					"clusterIP": svc.Spec.ClusterIP,
				},
			}
			topology.Nodes = append(topology.Nodes, node)
		}
	}

	// Add pod nodes and edges
	for _, pod := range pods.Items {
		// Skip system pods
		if pod.Namespace == "kube-system" || pod.Namespace == "kube-public" {
			continue
		}

		status := "running"
		if pod.Status.Phase != corev1.PodRunning {
			status = "down"
		}

		node := Node{
			ID:     fmt.Sprintf("pod-%s", pod.Name),
			Label:  pod.Name,
			Type:   "pod",
			Status: status,
			Metadata: map[string]string{
				"namespace": pod.Namespace,
				"podIP":     pod.Status.PodIP,
			},
		}
		topology.Nodes = append(topology.Nodes, node)

		// Find which service this pod belongs to based on labels
		for _, svc := range services.Items {
			if svc.Namespace != pod.Namespace {
				continue
			}
			if matchesSelector(pod.Labels, svc.Spec.Selector) {
				edge := Edge{
					From: fmt.Sprintf("svc-%s", svc.Name),
					To:   fmt.Sprintf("pod-%s", pod.Name),
					Type: "service-pod",
				}
				topology.Edges = append(topology.Edges, edge)
			}
		}
	}

	// Detect inter-service dependencies from pod env vars
	for _, pod := range pods.Items {
		if pod.Namespace == "kube-system" || pod.Namespace == "kube-public" {
			continue
		}

		// Find which service this pod belongs to
		var podService string
		for _, svc := range services.Items {
			if svc.Namespace == pod.Namespace && matchesSelector(pod.Labels, svc.Spec.Selector) {
				podService = fmt.Sprintf("svc-%s", svc.Name)
				break
			}
		}
		
		if podService == "" {
			continue
		}

		// Parse env vars for service dependencies
		for _, container := range pod.Spec.Containers {
			for _, env := range container.Env {
				if env.Value == "" {
					continue
				}

				// Check for *_ADDR patterns
				matches := serviceAddrRegex.FindStringSubmatch(env.Name)
				if len(matches) > 1 {
					targetService := extractServiceFromAddr(env.Value)
					if targetService != "" {
						targetSvcID := fmt.Sprintf("svc-%s", targetService)
						// Debug logging
						log.Printf("DEBUG: Found env var %s=%s, extracted service=%s, targetSvcID=%s", 
							env.Name, env.Value, targetService, targetSvcID)
						log.Printf("DEBUG: Looking for targetService=%s in serviceNames map with keys: %v",
							targetService, func() []string {
								keys := make([]string, 0, len(serviceNames))
								for k := range serviceNames {
									keys = append(keys, k)
								}
								return keys
							}())
						if _, exists := serviceNames[targetService]; exists {
							log.Printf("DEBUG: Service %s found in map, podService=%s, targetSvcID=%s", targetService, podService, targetSvcID)
							// Check if edge already exists to avoid duplicates
							edgeExists := false
							for _, e := range topology.Edges {
								if e.From == podService && e.To == targetSvcID && e.Type == "service-dependency" {
									edgeExists = true
									log.Printf("DEBUG: Edge already exists: %s -> %s", podService, targetSvcID)
									break
								}
							}
							if !edgeExists {
								edge := Edge{
									From: podService,
									To:   targetSvcID,
									Type: "service-dependency",
								}
								topology.Edges = append(topology.Edges, edge)
								log.Printf("DEBUG: Added edge: %s -> %s", podService, targetSvcID)
							} else {
								log.Printf("DEBUG: Edge already exists, not adding: %s -> %s", podService, targetSvcID)
							}
						} else {
							log.Printf("DEBUG: Service %s NOT found in map", targetService)
						}
					}
				}
			}
		}
	}

	return topology, nil
}

// extractServiceFromAddr extracts service name from address like "service:port" or "service.namespace:port"
func extractServiceFromAddr(addr string) string {
	if addr == "" {
		return ""
	}

	// Handle formats like:
	// - service:port
	// - service.namespace:port  
	// - service.namespace.svc.cluster.local:port
	
	// Split by colon to remove port
	parts := strings.Split(addr, ":")
	host := parts[0]

	// Split by dots and take first part (service name)
	hostParts := strings.Split(host, ".")
	if len(hostParts) > 0 && hostParts[0] != "" {
		return hostParts[0]
	}

	return ""
}

func matchesSelector(podLabels, selector map[string]string) bool {
	if len(selector) == 0 {
		return false
	}
	for key, value := range selector {
		if podLabels[key] != value {
			return false
		}
	}
	return true
}

func (c *Client) ScaleDeployment(ctx context.Context, namespace, name string, replicas int32) error {
	deployment, err := c.clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get deployment: %w", err)
	}

	deployment.Spec.Replicas = &replicas
	_, err = c.clientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update deployment: %w", err)
	}

	return nil
}

func (c *Client) ScaleService(ctx context.Context, namespace, name string, replicas int32) error {
	deployments, err := c.clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list deployments: %w", err)
	}

	var target *appsv1.Deployment
	for _, d := range deployments.Items {
		if d.Name == name || d.Name == name+"-service" {
			target = &d
			break
		}
	}

	if target == nil {
		for _, d := range deployments.Items {
			for _, svcName := range []string{name, name + "-service", name + "service"} {
				if d.Name == svcName || strings.Contains(d.Name, svcName) {
					target = &d
					break
				}
			}
			if target != nil {
				break
			}
		}
	}

	if target == nil {
		return fmt.Errorf("deployment not found: %s in namespace %s", name, namespace)
	}

	target.Spec.Replicas = &replicas
	_, err = c.clientset.AppsV1().Deployments(namespace).Update(ctx, target, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update deployment: %w", err)
	}

	return nil
}

func (c *Client) CreateNamespace(ctx context.Context, namespace string) error {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: namespace,
		},
	}
	_, err := c.clientset.CoreV1().Namespaces().Create(ctx, ns, metav1.CreateOptions{})
	if err != nil {
		// Check if already exists
		if strings.Contains(err.Error(), "already exists") {
			return nil
		}
		return fmt.Errorf("failed to create namespace %s: %w", namespace, err)
	}
	log.Printf("Created namespace: %s", namespace)
	return nil
}

func (c *Client) ApplyManifest(ctx context.Context, manifestURL, namespace string) error {
	// Download manifest
	resp, err := http.Get(manifestURL)
	if err != nil {
		return fmt.Errorf("failed to fetch manifest: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("manifest fetch returned status %d", resp.StatusCode)
	}

	// Write to temp file
	tmpFile, err := os.CreateTemp("", "manifest-*.yaml")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		tmpFile.Close()
		return fmt.Errorf("failed to write manifest: %w", err)
	}
	tmpFile.Close()

	// First create namespace if specified
	if namespace != "" && namespace != "default" {
		if err := c.CreateNamespace(ctx, namespace); err != nil {
			log.Printf("Warning: failed to create namespace %s: %v", namespace, err)
		}
	}

	// Apply manifest to specific namespace if provided
	if namespace != "" {
		// Use kubectl to apply with namespace
		cmd := exec.Command("kubectl", "apply", "-f", tmpFile.Name(), "-n", namespace)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("failed to apply manifest to namespace %s: %w\n%s", namespace, err, output)
		}
		log.Printf("Applied manifest to namespace %s: %s", namespace, output)
	} else {
		// Default namespace
		cmd := exec.Command("kubectl", "apply", "-f", tmpFile.Name())
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("failed to apply manifest: %w\n%s", err, output)
		}
		log.Printf("Applied manifest: %s", output)
	}

	return nil
}

func (c *Client) WaitForPodsReady(ctx context.Context, namespace string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	pollInterval := 2 * time.Second

	log.Printf("Waiting up to %v for pods to be ready in namespace: %s", timeout, namespace)

	for time.Now().Before(deadline) {
		pods, err := c.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			log.Printf("Error listing pods: %v", err)
			time.Sleep(pollInterval)
			continue
		}

		// Skip system pods
		var nonSystemPods []corev1.Pod
		for _, pod := range pods.Items {
			if pod.Namespace != "kube-system" && pod.Namespace != "kube-public" {
				nonSystemPods = append(nonSystemPods, pod)
			}
		}

		if len(nonSystemPods) == 0 {
			log.Printf("No pods found in namespace %s, waiting...", namespace)
			time.Sleep(pollInterval)
			continue
		}

		allReady := true
		readyCount := 0
		for _, pod := range nonSystemPods {
			if pod.Status.Phase == corev1.PodRunning {
				// Check if all containers are ready
				ready := true
				for _, cond := range pod.Status.Conditions {
					if cond.Type == corev1.PodReady && cond.Status != corev1.ConditionTrue {
						ready = false
						break
					}
				}
				if ready {
					readyCount++
				} else {
					allReady = false
					break
				}
			} else {
				allReady = false
				break
			}
		}

		if allReady && len(nonSystemPods) > 0 {
			log.Printf("All %d pods are ready in namespace %s", readyCount, namespace)
			return nil
		}

		log.Printf("Pods status: %d/%d ready in namespace %s", readyCount, len(nonSystemPods), namespace)
		time.Sleep(pollInterval)
	}

	return fmt.Errorf("timeout waiting for pods to be ready in namespace %s", namespace)
}
