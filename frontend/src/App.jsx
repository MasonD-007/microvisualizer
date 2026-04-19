import { useState, useEffect, useCallback } from 'react'
import TopologyGraph from './components/TopologyGraph'
import './App.css'

function App() {
  const [topology, setTopology] = useState({ nodes: [], edges: [] })
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setTopology(data)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setError('WebSocket connection failed')
      setConnected(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [])

  const triggerChaos = useCallback(async () => {
    try {
      const response = await fetch('/api/chaos', {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to trigger chaos')
      }
      const result = await response.json()
      console.log('Chaos triggered:', result)
    } catch (err) {
      console.error('Chaos error:', err)
      setError('Failed to trigger chaos simulation')
    }
  }, [])

  const nodeCount = topology.nodes?.length || 0
  const edgeCount = topology.edges?.length || 0

  return (
    <div className="app">
      <header className="header">
        <h1>KubeSight</h1>
        <div className="status">
          <span className={`indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
          <span className="stats">{nodeCount} nodes | {edgeCount} edges</span>
        </div>
      </header>

      <main className="main">
        <div className="sidebar">
          <div className="panel">
            <h2>Controls</h2>
            <button 
              className="chaos-button"
              onClick={triggerChaos}
              disabled={!connected}
            >
              Simulate Failure
            </button>
            <p className="hint">
              Scales the payment service to 0 pods to test failure detection
            </p>
          </div>

          <div className="panel">
            <h2>Legend</h2>
            <div className="legend-item">
              <span className="node-type service"></span>
              <span>Service</span>
            </div>
            <div className="legend-item">
              <span className="node-type pod"></span>
              <span>Pod</span>
            </div>
            <div className="legend-item">
              <span className="node-type down"></span>
              <span>Down</span>
            </div>
          </div>

          {error && (
            <div className="error-panel">
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="visualization">
          <TopologyGraph topology={topology} />
        </div>
      </main>
    </div>
  )
}

export default App
