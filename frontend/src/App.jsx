import { useState, useEffect, useCallback } from 'react'
import TopologyGraph from './components/TopologyGraph'
import './App.css'

// Color palette
const C = {
  bg: '#080f1c',
  surface: '#0d1628',
  panel: '#111e35',
  border: '#1e304f',
  text: '#cdd9f0',
  textDim: '#5a7299',
  blue: '#3b82f6',
  cyan: '#22d3ee',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
}

function App() {
  const [topology, setTopology] = useState({ nodes: [], edges: [] })
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [chaosLoading, setChaosLoading] = useState(null)

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
    setChaosLoading('kill')
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
    } finally {
      setTimeout(() => setChaosLoading(null), 1500)
    }
  }, [])

  const nodeCount = topology.nodes?.length || 0
  const edgeCount = topology.edges?.length || 0

  const services = topology.nodes?.filter(n => n.type === 'service') || []
  const pods = topology.nodes?.filter(n => n.type === 'pod') || []

  const failedServices = services.filter(s => s.status === 'down').length
  const healthyServices = services.filter(s => s.status === 'active').length

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      color: C.text,
      userSelect: 'none'
    }}>

      {/* Header */}
      <header style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        gap: 16,
        background: C.surface
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 22 22">
            <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" fill="none" stroke={C.blue} strokeWidth="1.5"/>
            <circle cx="11" cy="11" r="3" fill={C.blue}/>
          </svg>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: '#fff' }}>
            KubeSight
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Status indicators */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {failedServices > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#450a0a',
              border: `1px solid ${C.red}44`,
              borderRadius: 5,
              padding: '3px 10px',
              fontSize: 12
            }}>
              <span style={{ color: C.red }}>● {failedServices} Failed</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textDim }}>
            <span className="live-dot" style={{ color: connected ? C.green : C.red, fontSize: 10 }}>●</span>
            <span>{connected ? 'Live' : 'Disconnected'}</span>
            <span style={{ color: C.border, margin: '0 4px' }}>|</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {nodeCount} nodes · {edgeCount} edges
            </span>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left Sidebar */}
        <aside style={{
          width: 220,
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          background: C.surface,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'auto'
        }}>

          {/* Chaos Controls */}
          <div style={{ padding: '16px 14px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: C.textDim,
              letterSpacing: '0.1em',
              marginBottom: 12
            }}>
              CHAOS ENGINEERING
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <ChaosButton
                label="Kill Service"
                icon="✕"
                color={C.red}
                loading={chaosLoading === 'kill'}
                disabled={!!chaosLoading || !connected}
                onClick={triggerChaos}
              />
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, lineHeight: 1.4 }}>
                Scales payment service to 0 pods
              </div>
            </div>
          </div>

          {/* Services List */}
          <div style={{ padding: '14px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: C.textDim,
              letterSpacing: '0.1em',
              marginBottom: 10
            }}>
              SERVICES ({services.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 5,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: selected?.id === s.id ? `${C.blue}22` : 'transparent',
                    outline: selected?.id === s.id ? `1px solid ${C.blue}44` : 'none',
                    transition: 'background 0.15s'
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: s.status === 'down' ? C.red : C.green,
                    boxShadow: `0 0 6px ${s.status === 'down' ? C.red : C.green}`
                  }} />
                  <span style={{
                    fontSize: 11.5,
                    color: C.text,
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: '14px' }}>
            <div style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: C.textDim,
              letterSpacing: '0.1em',
              marginBottom: 10
            }}>
              LEGEND
            </div>
            {[
              { color: C.blue, label: 'Service', type: 'service' },
              { color: C.green, label: 'Pod — Healthy', type: 'pod' },
              { color: C.red, label: 'Failed / Down', type: 'failed' },
            ].map(({ color, label, type }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {type === 'service' ? (
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <rect x="3" y="3" width="8" height="8" fill="none" stroke={color} strokeWidth="1.5"/>
                  </svg>
                ) : (
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    display: 'inline-block'
                  }} />
                )}
                <span style={{ fontSize: 11, color: C.text }}>{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{
              margin: '0 14px 14px',
              padding: 8,
              background: '#450a0a',
              border: `1px solid ${C.red}`,
              borderRadius: 5,
              fontSize: 11,
              color: C.red
            }}>
              {error}
            </div>
          )}
        </aside>

        {/* Main Visualization */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <TopologyGraph topology={topology} onNodeClick={setSelected} />
        </div>

        {/* Right Sidebar - Node Details */}
        {selected && (
          <aside
            className="slide-in-right"
            style={{
              width: 280,
              flexShrink: 0,
              borderLeft: `1px solid ${C.border}`,
              background: C.surface,
              padding: '16px',
              overflow: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Node Details</h3>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.textDim,
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: 4
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              background: C.panel,
              borderRadius: 6,
              padding: 12,
              marginBottom: 12,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>NAME</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#fff', marginBottom: 12 }}>
                {selected.label}
              </div>

              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>TYPE</div>
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                <span style={{
                  background: `${C.blue}22`,
                  color: C.blue,
                  border: `1px solid ${C.blue}44`,
                  borderRadius: 3,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace'
                }}>
                  {selected.type}
                </span>
              </div>

              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>STATUS</div>
              <div style={{ fontSize: 13 }}>
                <span style={{
                  background: selected.status === 'down' ? '#450a0a' : '#14532d',
                  color: selected.status === 'down' ? C.red : C.green,
                  border: `1px solid ${selected.status === 'down' ? C.red : C.green}44`,
                  borderRadius: 3,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace'
                }}>
                  {selected.status === 'down' ? 'FAILED' : selected.status === 'running' ? 'RUNNING' : 'ACTIVE'}
                </span>
              </div>
            </div>

            {selected.metadata && (
              <div style={{
                background: C.panel,
                borderRadius: 6,
                padding: 12,
                border: `1px solid ${C.border}`
              }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>METADATA</div>
                {Object.entries(selected.metadata).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>
                      {key}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: C.text }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function ChaosButton({ label, icon, color, loading, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        padding: '8px 12px',
        background: disabled ? C.panel : `${color}22`,
        border: `1px solid ${disabled ? C.border : color}44`,
        borderRadius: 5,
        color: disabled ? C.textDim : color,
        fontSize: 11,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.03em'
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.target.style.background = `${color}33`
          e.target.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.target.style.background = `${color}22`
          e.target.style.transform = 'translateY(0)'
        }
      }}
    >
      {loading ? (
        <span className="spin">⟳</span>
      ) : (
        <span>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  )
}

export default App
