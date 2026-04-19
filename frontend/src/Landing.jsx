import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#080f1c',
  surface: '#0d1628',
  panel: '#111e35',
  border: '#1e304f',
  borderHi: '#2a4370',
  text: '#cdd9f0',
  textDim: '#5a7299',
  textMid: '#8ba3cc',
  blue: '#3b82f6',
  blueGlow: '#1d4ed8',
  cyan: '#22d3ee',
  green: '#22c55e',
  red: '#ef4444',
}

const ARCHITECTURE_URLS = {
  'google-boutique': {
    id: 'google-boutique',
    url: 'https://raw.githubusercontent.com/GoogleCloudPlatform/microservices-demo/main/release/kubernetes-manifests.yaml',
    name: 'Google Boutique',
    namespace: 'default',
  },
  'sock-shop': {
    id: 'sock-shop',
    url: 'https://raw.githubusercontent.com/microservices-demo/microservices-demo/master/deploy/kubernetes/complete-demo.yaml',
    name: 'Sock Shop',
    namespace: 'sock-shop',
  },
  'bookinfo': {
    id: 'bookinfo',
    url: 'https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/platform/kube/bookinfo.yaml',
    name: 'Bookinfo',
    namespace: 'bookinfo',
  },
  'yelb': {
    id: 'yelb',
    url: 'https://raw.githubusercontent.com/mreferre/yelb/master/deployments/platformdeployment/Kubernetes/yaml/yelb-k8s-nodeport.yaml',
    name: 'Yelb',
    namespace: 'yelb',
  },
}

const ARCH_CARDS = [
  {
    id: 'google-boutique',
    name: 'Google Boutique',
    badge: 'Currently Deployed',
    badgeType: 'default',
    desc: 'E-commerce microservices demo with 11 services. Industry-standard reference architecture from Google Cloud.',
    meta: ['~12 pods', 'Go • Python • Java', 'gRPC'],
  },
  {
    id: 'sock-shop',
    name: 'Sock Shop',
    badge: 'Popular',
    badgeType: 'new',
    desc: 'E-commerce application by Weaveworks. Tests service meshes, monitoring, and network routing patterns.',
    meta: ['~13 pods', 'Node.js • Java • Go', 'RabbitMQ'],
  },
  {
    id: 'bookinfo',
    name: 'Bookinfo',
    badge: 'Istio Demo',
    badgeType: 'new',
    desc: 'Canonical Istio sample app. Features multi-version routing (reviews-v1, v2, v3) for A/B testing.',
    meta: ['~6 pods', 'Python • Ruby • Java', 'Multi-version'],
  },
  {
    id: 'yelb',
    name: 'Yelb',
    badge: 'Simple',
    badgeType: 'new',
    desc: 'Clean 4-tier restaurant rating app by VMware. Perfect for testing basic database dependency.',
    meta: ['~4 pods', 'Angular • Ruby', 'Redis • Postgres'],
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [showStatus, setShowStatus] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [logs, setLogs] = useState([])

  const addLog = (text, type = 'info') => {
    setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }])
  }

  const handleArchSelect = async (archId) => {
    const arch = ARCHITECTURE_URLS[archId]
    setShowStatus(true)
    setStatusText(`Deploying ${arch.name}...`)
    setLogs([])
    addLog(`[INFO] Starting deployment...`)
    addLog(`[INFO] Namespace: ${arch.namespace}`)
    addLog(`[INFO] Manifest: ${arch.url}`)

    try {
      addLog(`[INFO] Creating namespace and applying manifest...`)
      
      const deployResponse = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestUrl: arch.url,
          namespace: arch.namespace
        })
      })

      if (!deployResponse.ok) {
        const err = await deployResponse.json()
        throw new Error(err.error || 'Deploy failed')
      }

      const result = await deployResponse.json()
      addLog(`[SUCCESS] Deployed to namespace: ${result.namespace}`, 'success')
      addLog(`[INFO] Waiting for pods to start...`)

      setStatusText(`Navigating to ${arch.name}...`)

      setTimeout(() => {
        navigate('/graph', { state: { architecture: arch } })
      }, 2000)
    } catch (error) {
      addLog(`[ERROR] Failed to deploy: ${error.message}`, 'error')
      setStatusText('Deployment failed')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 50 }}>
          <h1 style={{
            fontSize: 48,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #3b82f6 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 12,
            fontFamily: 'IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif',
          }}>
            KubeSight
          </h1>
          <p style={{ fontSize: 18, color: C.textMid, fontWeight: 300 }}>
            Deploy and visualize any Kubernetes microservice architecture
          </p>
        </header>

        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 20, marginTop: 40 }}>
          Preset Architectures
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginBottom: 40,
        }}>
          {ARCH_CARDS.map(card => (
            <div
              key={card.id}
              onClick={() => handleArchSelect(card.id)}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 24,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.borderHi
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg, #3b82f6, #22d3ee)',
                opacity: 0,
                transition: 'opacity 0.3s ease',
              }} className="arch-card-bar" />
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                {card.name}
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  marginLeft: 8,
                  background: card.badgeType === 'new' ? '#14532d' : '#1e3a5f',
                  color: card.badgeType === 'new' ? C.green : C.cyan,
                }}>
                  {card.badge}
                </span>
              </div>
              <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 12 }}>
                {card.desc}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                {card.meta.map(tag => (
                  <span key={tag} style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    padding: '4px 10px',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.cyan,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        

        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
          display: showStatus ? 'block' : 'none',
          animation: 'fadeIn 0.3s ease',
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 20,
              height: 20,
              border: `2px solid ${C.border}`,
              borderTopColor: C.blue,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 16, fontWeight: 500 }}>{statusText}</div>
          </div>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 12,
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
            color: C.textMid,
            maxHeight: 150,
            overflowY: 'auto',
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                marginBottom: 4,
                color: log.type === 'success' ? C.green : log.type === 'error' ? C.red : log.type === 'info' ? C.cyan : C.textMid,
              }}>
                {log.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}