// KubeSight - Real-Time Kubernetes Microservice Visualizer
// API Configuration
const API_BASE_URL = 'http://localhost:8080/api';
const POLL_INTERVAL = 3000; // 3 seconds
const USE_MOCK_DATA = false; // Set to false when backend is ready

// Mock data for standalone testing
let mockTopology = {
    nodes: [
        { id: 'frontend-1', label: 'frontend', type: 'pod', status: 'healthy' },
        { id: 'cartservice-1', label: 'cartservice', type: 'pod', status: 'healthy' },
        { id: 'productcatalog-1', label: 'productcatalog', type: 'pod', status: 'healthy' },
        { id: 'paymentservice-1', label: 'paymentservice', type: 'pod', status: 'healthy' },
        { id: 'shippingservice-1', label: 'shippingservice', type: 'pod', status: 'healthy' },
        { id: 'emailservice-1', label: 'emailservice', type: 'pod', status: 'healthy' },
        { id: 'checkoutservice-1', label: 'checkoutservice', type: 'pod', status: 'healthy' },
        { id: 'recommendationservice-1', label: 'recommendation', type: 'pod', status: 'healthy' },
        { id: 'adservice-1', label: 'adservice', type: 'pod', status: 'healthy' },
        { id: 'currencyservice-1', label: 'currencyservice', type: 'pod', status: 'healthy' }
    ],
    edges: [
        { from: 'frontend-1', to: 'cartservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'frontend-1', to: 'productcatalog-1', status: 'healthy', traffic: 'normal' },
        { from: 'frontend-1', to: 'checkoutservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'frontend-1', to: 'recommendationservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'frontend-1', to: 'adservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'frontend-1', to: 'currencyservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'checkoutservice-1', to: 'paymentservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'checkoutservice-1', to: 'shippingservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'checkoutservice-1', to: 'emailservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'checkoutservice-1', to: 'cartservice-1', status: 'healthy', traffic: 'normal' },
        { from: 'checkoutservice-1', to: 'currencyservice-1', status: 'healthy', traffic: 'normal' }
    ]
};

// Vis.js network instance
let network;
let pollInterval;

// Initialize the network graph
function initializeGraph() {
    const container = document.getElementById('network-graph');

    const options = {
        nodes: {
            shape: 'dot',
            size: 25,
            font: {
                size: 14,
                color: '#333'
            },
            borderWidth: 3,
            shadow: true
        },
        edges: {
            width: 2,
            shadow: true,
            smooth: {
                type: 'continuous'
            },
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 0.5
                }
            }
        },
        physics: {
            stabilization: {
                enabled: true,
                iterations: 200
            },
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.3,
                springLength: 150,
                springConstant: 0.04
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200
        }
    };

    network = new vis.Network(container, { nodes: [], edges: [] }, options);
}

// Map status to color
function getNodeColor(status) {
    switch (status) {
        case 'healthy':
        case 'active':    // Services use 'active'
        case 'running':   // Pods use 'running'
            return { background: '#4ade80', border: '#22c55e' };
        case 'degraded':
        case 'pending':
            return { background: '#fbbf24', border: '#f59e0b' };
        case 'down':
        case 'failed':
        case 'unknown':
            return { background: '#ef4444', border: '#dc2626' };
        default:
            return { background: '#9ca3af', border: '#6b7280' };
    }
}

// Map edge status to color
function getEdgeColor(status, traffic) {
    if (status === 'broken') {
        return { color: '#ef4444', width: 2 };
    } else if (status === 'degraded') {
        return { color: '#fbbf24', width: 2 };
    } else if (traffic === 'heavy') {
        return { color: '#f97316', width: 6 };
    } else {
        return { color: '#4ade80', width: 2 };
    }
}

// Update the graph with new topology data
function updateGraph(topology) {
    const nodes = topology.nodes.map(node => ({
        id: node.id,
        label: node.label,
        color: getNodeColor(node.status),
        title: `${node.label}\nType: ${node.type}\nStatus: ${node.status}`
    }));

    const edges = topology.edges.map((edge, index) => {
        const edgeStyle = getEdgeColor(edge.status, edge.traffic);
        return {
            id: `edge-${index}`,
            from: edge.from,
            to: edge.to,
            color: edgeStyle.color,
            width: edgeStyle.width,
            title: `Status: ${edge.status}\nTraffic: ${edge.traffic || 'normal'}`
        };
    });

    network.setData({ nodes, edges });
}

// Fetch topology from backend API
async function fetchTopology() {
    if (USE_MOCK_DATA) {
        // Use mock data for standalone testing
        updateGraph(mockTopology);
        updateStatus('connected', 'Mock Data Active');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/topology`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const topology = await response.json();
        updateGraph(topology);
        updateStatus('connected', 'Live');
    } catch (error) {
        console.error('Failed to fetch topology:', error);
        updateStatus('error', `Error: ${error.message}`);
    }
}

// Send chaos action to backend
async function sendChaosAction(action, target = null) {
    if (USE_MOCK_DATA) {
        // Simulate chaos in mock data
        simulateChaos(action, target);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/chaos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, target })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Immediately poll for updated state
        await fetchTopology();
    } catch (error) {
        console.error('Failed to send chaos action:', error);
        updateStatus('error', `Chaos Error: ${error.message}`);
    }
}

// Simulate chaos effects in mock data
function simulateChaos(action, target) {
    switch (action) {
        case 'kill':
            // Kill paymentservice
            const killNode = mockTopology.nodes.find(n => n.id === 'paymentservice-1');
            if (killNode) killNode.status = 'down';

            // Break edges connected to paymentservice
            mockTopology.edges.forEach(edge => {
                if (edge.to === 'paymentservice-1' || edge.from === 'paymentservice-1') {
                    edge.status = 'broken';
                }
            });
            break;

        case 'traffic':
            // Increase traffic load on frontend edges
            mockTopology.edges.forEach(edge => {
                if (edge.from === 'frontend-1') {
                    edge.traffic = 'heavy';
                }
            });
            break;

        case 'latency':
            // Add latency to checkoutservice
            const latencyNode = mockTopology.nodes.find(n => n.id === 'checkoutservice-1');
            if (latencyNode) latencyNode.status = 'degraded';

            // Degrade edges connected to checkoutservice
            mockTopology.edges.forEach(edge => {
                if (edge.from === 'checkoutservice-1') {
                    edge.status = 'degraded';
                }
            });
            break;

        case 'crash':
            // Pod crash loop on cartservice
            const crashNode = mockTopology.nodes.find(n => n.id === 'cartservice-1');
            if (crashNode) crashNode.status = 'degraded';
            break;

        case 'reset':
            // Reset all to healthy
            mockTopology.nodes.forEach(node => node.status = 'healthy');
            mockTopology.edges.forEach(edge => {
                edge.status = 'healthy';
                edge.traffic = 'normal';
            });
            break;
    }

    updateGraph(mockTopology);
}

// Update status indicator
function updateStatus(status, text) {
    const indicator = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');

    switch (status) {
        case 'connected':
            indicator.style.background = '#4ade80';
            break;
        case 'error':
            indicator.style.background = '#ef4444';
            break;
        default:
            indicator.style.background = '#fbbf24';
    }

    statusText.textContent = text;
}

// Start polling
function startPolling() {
    fetchTopology(); // Initial fetch
    pollInterval = setInterval(fetchTopology, POLL_INTERVAL);
}

// Stop polling
function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
}

// Event listeners for chaos buttons
document.getElementById('kill-service-btn').addEventListener('click', () => {
    sendChaosAction('kill', 'paymentservice');
});

document.getElementById('traffic-load-btn').addEventListener('click', () => {
    sendChaosAction('traffic');
});

document.getElementById('network-latency-btn').addEventListener('click', () => {
    sendChaosAction('latency');
});

document.getElementById('pod-crash-btn').addEventListener('click', () => {
    sendChaosAction('crash');
});

document.getElementById('reset-btn').addEventListener('click', () => {
    sendChaosAction('reset');
});

// Initialize on page load
window.addEventListener('load', () => {
    initializeGraph();
    startPolling();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPolling();
});
