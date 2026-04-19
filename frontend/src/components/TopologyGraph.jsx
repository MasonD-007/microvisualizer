import { useEffect, useRef } from 'react'
import { Network, DataSet } from 'vis-network/standalone'

function TopologyGraph({ topology }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const nodesRef = useRef(null)
  const edgesRef = useRef(null)

  // Initialize network once on mount
  useEffect(() => {
    if (!containerRef.current) return

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

    // Create DataSets for efficient updates
    nodesRef.current = new DataSet([])
    edgesRef.current = new DataSet([])

    networkRef.current = new Network(
      containerRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
      options
    )

    // Cleanup only on unmount
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy()
        networkRef.current = null
      }
      nodesRef.current = null
      edgesRef.current = null
    }
  }, []) // Empty deps = run once on mount

  // Update data when topology changes
  useEffect(() => {
    if (!nodesRef.current || !edgesRef.current) return

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

    const edges = topology.edges?.map((edge, index) => {
      // Determine edge styling based on type
      let color = '#666'
      let width = 1
      let dashes = false
      
      if (edge.type === 'service-pod') {
        color = '#4a90e2'  // Blue for service -> pod
        width = 2
      } else if (edge.type === 'service-dependency') {
        color = '#f39c12'  // Orange for service -> service dependency
        width = 2
        dashes = true      // Dashed line for service dependencies
      }
      
      return {
        id: `edge-${index}`,
        from: edge.from,
        to: edge.to,
        color: {
          color: color,
          highlight: '#ff6b6b',
        },
        width: width,
        dashes: dashes,
        smooth: { type: 'continuous' },
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 }
        },
      }
    }) || []

    // Efficiently update data using DataSet methods
    nodesRef.current.clear()
    nodesRef.current.add(nodes)
    edgesRef.current.clear()
    edgesRef.current.add(edges)
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
