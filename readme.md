Here is a professional, high-impact `README.md` template tailored specifically for your hackathon submission. It is designed to be easily skimmable for judges while highlighting the technical depth of what you built.

-----

# KubeSight: Real-Time K8s Microservice Visualizer 🕸️

> **Built for the Synthesis Hackathon by the Computer Networking Student Association**

## 📌 The Problem

Modern networks have evolved beyond physical cables and switches; they are now highly complex, ephemeral microservices living inside orchestration clusters. When a single pod fails or a network link degrades in a 10-tier microservice architecture, troubleshooting becomes a nightmare because **you cannot troubleshoot what you cannot see.**

## 💡 The Solution

**KubeSight** is a Golang-based network analysis and visualization engine. It hooks directly into the Kubernetes API to automatically discover, map, and render service dependencies and network traffic flows in real-time.

Instead of digging through thousands of lines of `kubectl` logs, infrastructure engineers can look at a live, self-updating topology graph to instantly identify bottlenecks and outages.

## ✨ Key Features

  * **Auto-Discovery:** Uses the Go `client-go` library to query the Kubernetes API and automatically map Pods, Services, and their label selectors.
  * **Real-Time Topology Graph:** Renders a dynamic, floating network map using `Vis.js`, illustrating exactly how microservices communicate.
  * **Live State Monitoring:** Continuously watches cluster state to reflect the health of the network.
  * **"Chaos" Simulation:** Includes a built-in demo feature to intentionally sever a network link (scaling a critical service to 0 pods) to demonstrate how KubeSight instantly identifies the broken dependency path in glowing red.

## 🛠️ Tech Stack

  * **Backend:** Golang, Kubernetes API (`client-go`)
  * **Frontend:** HTML5, JavaScript, Vis.js (Graphing Library)
  * **Infrastructure:** Minikube (Local K8s cluster)
  * **Target Environment:** Google Cloud "Boutique" Microservices Demo

-----

## 🚀 Quick Start Guide

### Prerequisites

  * Go 1.21+
  * Minikube & kubectl
  * Docker

### 1\. Spin up the Target Environment

Start Minikube and deploy the 10-tier microservice demo application:

```bash
minikube start
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/microservices-demo/main/release/kubernetes-manifests.yaml
```

*Wait a few minutes for all pods to reach the `Running` state.*

### 2\. Run the KubeSight Engine

Clone this repository and start the Go backend to begin harvesting network data:

```bash
git clone https://github.com/yourusername/kubesight.git
cd kubesight
go run main.go
```

### 3\. View the Network

Open your browser and navigate to:
`http://localhost:8080`

### 4\. Trigger the Chaos Demo

To see KubeSight's real-time detection in action, click the **"Simulate Failure"** button in the UI, or manually kill the payment service:

```bash
kubectl scale deployment/paymentservice --replicas=0
```

Watch the graph instantly sever the connection and alert you to the broken network path\!

-----

## 🏆 Hackathon Tracks

KubeSight was built to compete in the following Synthesis prize tracks:

1.  **Network Analysis:** Inspecting and interpreting complex, ephemeral network behaviors in a distributed system.
2.  **Infrastructure Troubleshooting:** Providing a visual tool to instantly find and fix networking issues in a provided scenario.
3.  **Socket Programming:** Utilizing API streams to maintain a live websocket/polling connection between the K8s control plane and the visualization UI.

-----
