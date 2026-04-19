import { useEffect, useRef } from 'react'
import { Network } from 'vis-network/standalone'

function TopologyGraph({ topology }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Transform topology data to vis-network format
    const nodes = topology.nodes?.map(node => ({
      id: node.id,
      label: node.label,
      color: getNodeColor(node),
      shape: getNodeShape(node),
      font: { color: '#e0e0e0', size: 12 },
      borderWidth: 2,
      borderWidthSelected: 4,
      size: node.type === 'service' ? 25 : 15,
      title: generateTooltip(node),
    })) || []

    const edges = topology.edges?.map((edge, index) => ({
      id: `edge-${index}`,
      from: edge.from,
      to: edge.to,
      color: {
        color: edge.type === 'service-pod' ? '#4a90e2' : '#666',
        highlight: '#ff6b6b',
      },
      width: edge.type === 'service-pod' ? 2 : 1,
      smooth: { type: 'continuous' },
      arrows: {
        to: { enabled: true, scaleFactor: 0.5 }
      },
    })) || []

    const data = { nodes, edges }

    const options = {
      nodes: {
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        smooth: true,
        shadow: false,
      },
      physics: {
        enabled: true,
        stabilization: false,
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1,
        },
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.005,
          springLength: 100,
          springConstant: 0.08,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
      },
      layout: {
        improvedLayout: true,
      },
    }

    if (!networkRef.current) {
      networkRef.current = new Network(containerRef.current, data, options)
    } else {
      networkRef.current.setData(data)
    }

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy()
        networkRef.current = null
      }
    }
  }, [topology])

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        background: '#1a1a2e',
      }} 
    />
  )
}

function getNodeColor(node) {
  if (node.status === 'down') {
    return {
      background: '#ff6b6b',
      border: '#ff4757',
      highlight: { background: '#ff8787', border: '#ff6b6b' },
    }
  }

  switch (node.type) {
    case 'service':
      return {
        background: '#4a90e2',
        border: '#357abd',
        highlight: { background: '#63a4ff', border: '#4a90e2' },
      }
    case 'pod':
      return {
        background: '#2ecc71',
        border: '#27ae60',
        highlight: { background: '#58d68d', border: '#2ecc71' },
      }
    default:
      return {
        background: '#95a5a6',
        border: '#7f8c8d',
        highlight: { background: '#bdc3c7', border: '#95a5a6' },
      }
  }
}

function getNodeShape(node) {
  switch (node.type) {
    case 'service':
      return 'box'
    case 'pod':
      return 'dot'
    default:
      return 'dot'
  }
}

function generateTooltip(node) {
  const metadata = Object.entries(node.metadata || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  
  return `Type: ${node.type}\nStatus: ${node.status}\n${metadata}`
}

export default TopologyGraph
