import { useEffect, useRef, useState } from 'react'
import { Network, DataSet } from 'vis-network/standalone'

// Color palette matching App design
const C = {
  bg: '#080f1c',
  surface: '#0d1628',
  blue: '#3b82f6',
  cyan: '#22d3ee',
  green: '#22c55e',
  red: '#ef4444',
  text: '#cdd9f0',
  textDim: '#5a7299',
}

function TopologyGraph({ topology, onNodeClick }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const nodesRef = useRef(null)
  const edgesRef = useRef(null)
  const [edgePositions, setEdgePositions] = useState([])

  // Initialize network once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const options = {
      nodes: {
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: 'rgba(59, 130, 246, 0.3)',
          size: 10,
          x: 0,
          y: 0
        },
        font: {
          color: C.text,
          size: 12,
          face: 'monospace'
        }
      },
      edges: {
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        shadow: false,
        color: {
          color: '#1e304f',
          highlight: C.blue,
          hover: C.blue
        },
        width: 2,
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.6
          }
        }
      },
      physics: {
        enabled: true,
        stabilization: {
          enabled: true,
          iterations: 100
        },
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.4,
          springLength: 120,
          springConstant: 0.05,
          damping: 0.15,
          avoidOverlap: 0.2
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
        zoomView: true,
        dragView: true
      },
      layout: {
        improvedLayout: true,
        hierarchical: false
      }
    }

    // Create DataSets for efficient updates
    nodesRef.current = new DataSet([])
    edgesRef.current = new DataSet([])

    networkRef.current = new Network(
      containerRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
      options
    )

    // Handle node clicks
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0 && onNodeClick) {
        const nodeId = params.nodes[0]
        const node = topology.nodes?.find(n => n.id === nodeId)
        if (node) {
          onNodeClick(node)
        }
      }
    })

    // Update edge positions after stabilization
    const updateEdgePositions = () => {
      if (!networkRef.current) return

      const positions = []
      const allEdges = edgesRef.current?.get() || []

      allEdges.forEach(edge => {
        try {
          const fromPos = networkRef.current.getPositions([edge.from])[edge.from]
          const toPos = networkRef.current.getPositions([edge.to])[edge.to]

          if (fromPos && toPos) {
            positions.push({
              id: edge.id,
              from: fromPos,
              to: toPos
            })
          }
        } catch (e) {
          // Ignore errors for missing nodes
        }
      })

      setEdgePositions(positions)
    }

    networkRef.current.on('stabilizationIterationsDone', updateEdgePositions)
    networkRef.current.on('dragEnd', updateEdgePositions)
    networkRef.current.on('zoom', updateEdgePositions)

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

  // Update topology and onNodeClick handler
  useEffect(() => {
    if (!networkRef.current) return

    // Update click handler
    networkRef.current.off('click')
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0 && onNodeClick) {
        const nodeId = params.nodes[0]
        const node = topology.nodes?.find(n => n.id === nodeId)
        if (node) {
          onNodeClick(node)
        }
      }
    })
  }, [topology, onNodeClick])

  // Update data when topology changes
  useEffect(() => {
    if (!nodesRef.current || !edgesRef.current) return

    // Transform topology data to vis-network format with Kubernetes icons
    const nodes = topology.nodes?.map(node => {
      const isService = node.type === 'service'
      const isFailed = node.status === 'down' || node.status === 'failed'

      return {
        id: node.id,
        label: node.label,
        shape: 'image',
        image: isService ? '/icons/service.svg' : '/icons/pod.svg',
        size: isService ? 35 : 25,
        color: {
          border: isFailed ? C.red : (isService ? C.blue : C.green),
          background: C.surface,
          highlight: {
            border: isFailed ? C.red : (isService ? C.blue : C.green),
            background: C.surface
          }
        },
        font: {
          color: isFailed ? C.red : C.text,
          size: 11,
          face: 'monospace'
        },
        borderWidth: 3,
        borderWidthSelected: 4,
        title: generateTooltip(node),
      }
    }) || []

    const edges = topology.edges?.map((edge, index) => {
      // Determine edge styling based on type
      let color = '#2a4370'
      let width = 2
      let dashes = false

      if (edge.type === 'service-pod') {
        color = C.blue
        width = 2
      } else if (edge.type === 'service-dependency') {
        color = '#f97316'
        width = 2
        dashes = [5, 5]
      }

      return {
        id: `edge-${index}`,
        from: edge.from,
        to: edge.to,
        color: {
          color: color,
          highlight: C.blue,
          hover: C.blue,
        },
        width: width,
        dashes: dashes,
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.6
          }
        },
      }
    }) || []

    // Efficiently update data using DataSet methods
    nodesRef.current.clear()
    nodesRef.current.add(nodes)
    edgesRef.current.clear()
    edgesRef.current.add(edges)

    // Fit view and update edge positions after data update
    setTimeout(() => {
      if (networkRef.current && nodes.length > 0) {
        networkRef.current.fit({
          animation: {
            duration: 500,
            easingFunction: 'easeInOutQuad'
          }
        })

        // Update edge positions after fit
        setTimeout(() => {
          const positions = []
          edges.forEach(edge => {
            try {
              const fromPos = networkRef.current.getPositions([edge.from])[edge.from]
              const toPos = networkRef.current.getPositions([edge.to])[edge.to]

              if (fromPos && toPos) {
                positions.push({
                  id: edge.id,
                  from: fromPos,
                  to: toPos
                })
              }
            } catch (e) {
              // Ignore errors
            }
          })
          setEdgePositions(positions)
        }, 600)
      }
    }, 100)
  }, [topology])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          background: C.bg,
        }}
      />

      {/* Traffic Particles Overlay */}
      <ParticleOverlay edgePositions={edgePositions} />
    </div>
  )
}

function ParticleOverlay({ edgePositions }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const animationFrameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()

    // Set canvas size
    canvas.width = rect.width
    canvas.height = rect.height

    // Create particles for each edge
    particlesRef.current = edgePositions.flatMap(edge => {
      // Create 3 particles per edge with staggered start times
      return [0, 0.33, 0.66].map(offset => ({
        edgeId: edge.id,
        progress: offset,
        speed: 0.008, // Slower speed for smoother animation
        from: edge.from,
        to: edge.to
      }))
    })

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach(particle => {
        // Update progress
        particle.progress += particle.speed
        if (particle.progress >= 1) {
          particle.progress = 0
        }

        // Calculate position along edge (with bezier curve)
        const t = particle.progress
        const from = particle.from
        const to = particle.to

        // Control point for curve (midpoint raised up)
        const cx = (from.x + to.x) / 2
        const cy = (from.y + to.y) / 2 - 30

        // Quadratic bezier curve
        const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x
        const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y

        // Draw particle with glow
        const fadeIn = Math.min(t * 5, 1)
        const fadeOut = Math.min((1 - t) * 5, 1)
        const opacity = Math.min(fadeIn, fadeOut)

        // Outer glow
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${opacity * 0.3})`
        ctx.fill()

        // Inner particle
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${opacity * 0.85})`
        ctx.fill()
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [edgePositions])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  )
}

function generateTooltip(node) {
  const statusText = node.status === 'down' || node.status === 'failed'
    ? 'FAILED'
    : node.status === 'running'
    ? 'RUNNING'
    : 'ACTIVE'

  let tooltip = `<b>${node.label}</b><br/>Type: ${node.type}<br/>Status: ${statusText}`

  if (node.metadata) {
    Object.entries(node.metadata).forEach(([key, value]) => {
      tooltip += `<br/>${key}: ${value}`
    })
  }

  return tooltip
}

export default TopologyGraph
