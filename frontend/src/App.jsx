import { useState, useEffect, useRef, useMemo } from 'react'
import './App.css'

const C = {
  bg:        '#080f1c',
  surface:   '#0d1628',
  panel:     '#111e35',
  border:    '#1e304f',
  borderHi:  '#2a4370',
  text:      '#cdd9f0',
  textDim:   '#5a7299',
  textMid:   '#8ba3cc',
  blue:      '#3b82f6',
  blueGlow:  '#1d4ed8',
  blueSoft:  '#1e3a5f',
  cyan:      '#22d3ee',
  green:     '#22c55e',
  greenDim:  '#14532d',
  red:       '#ef4444',
  redDim:    '#450a0a',
  orange:    '#f97316',
  yellow:    '#eab308',
  yellowDim: '#422006',
}

const SERVICES = [
  { id:'svc-api',      label:'api-gateway',     cpu:68, mem:72, rps:1240, ns:'default' },
  { id:'svc-auth',     label:'auth-service',    cpu:34, mem:45, rps:580,  ns:'default' },
  { id:'svc-users',    label:'user-service',    cpu:22, mem:38, rps:390,  ns:'default' },
  { id:'svc-orders',   label:'order-service',   cpu:81, mem:60, rps:870,  ns:'commerce' },
  { id:'svc-payments', label:'payment-svc',     cpu:55, mem:51, rps:430,  ns:'commerce' },
  { id:'svc-notify',   label:'notify-worker',   cpu:12, mem:28, rps:110,  ns:'workers' },
  { id:'svc-cache',    label:'redis-cache',     cpu:9,  mem:82, rps:4400, ns:'infra' },
  { id:'svc-db',       label:'postgres-main',   cpu:44, mem:77, rps:960,  ns:'infra' },
]

const EDGES_INIT = [
  { from:'svc-api',    to:'svc-auth' },
  { from:'svc-api',    to:'svc-users' },
  { from:'svc-api',    to:'svc-orders' },
  { from:'svc-orders', to:'svc-payments' },
  { from:'svc-orders', to:'svc-cache' },
  { from:'svc-users',  to:'svc-db' },
  { from:'svc-payments',to:'svc-notify' },
  { from:'svc-auth',   to:'svc-cache' },
  { from:'svc-api',    to:'svc-db' },
  { from:'svc-orders', to:'svc-db' },
  { from:'svc-payments',to:'svc-db' },
]

const makePods = (svcId, count, status='healthy') =>
  Array.from({length: count}, (_, i) => ({
    id: `${svcId}-pod-${i}`,
    parentId: svcId,
    label: `pod-${i}`,
    status,
    cpu: Math.floor(Math.random()*60+10),
    mem: Math.floor(Math.random()*50+20),
    restarts: Math.floor(Math.random()*3),
  }))

const PODS_INIT = [
  ...makePods('svc-api', 3),
  ...makePods('svc-auth', 2),
  ...makePods('svc-users', 2),
  ...makePods('svc-orders', 3),
  ...makePods('svc-payments', 2),
  ...makePods('svc-notify', 1),
  ...makePods('svc-cache', 2),
  ...makePods('svc-db', 2),
]

const SVC_POS = {
  'svc-api':      { x: 600, y: 200 },
  'svc-auth':     { x: 280, y: 130 },
  'svc-users':    { x: 180, y: 320 },
  'svc-orders':   { x: 760, y: 130 },
  'svc-payments': { x: 880, y: 310 },
  'svc-notify':   { x: 1000, y: 460 },
  'svc-cache':    { x: 480, y: 480 },
  'svc-db':       { x: 700, y: 540 },
}

function getPodPos(svcId, podIndex, podCount) {
  const sp = SVC_POS[svcId]
  const angle = (podIndex / podCount) * Math.PI * 2 - Math.PI / 2
  const r = 70
  return { x: sp.x + Math.cos(angle) * r, y: sp.y + Math.sin(angle) * r }
}

const statusColor = s => s==='failed' ? C.red : s==='degraded' ? C.yellow : C.green
const statusLabel = s => s==='failed' ? 'Failed' : s==='degraded' ? 'Degraded' : 'Healthy'
const cpuColor = v => v>80 ? C.red : v>60 ? C.orange : C.cyan
const memColor = v => v>85 ? C.red : v>65 ? C.yellow : C.cyan

function MiniBar({ value, color, width=60 }) {
  return (
    <div style={{ width, height:4, background: C.border, borderRadius:2, overflow:'hidden' }}>
      <div style={{ width:`${value}%`, height:'100%', background: color, borderRadius:2,
        transition:'width 0.5s ease' }} />
    </div>
  )
}

function Badge({ children, color = C.blue }) {
  return (
    <span style={{ background: `${color}22`, color, border:`1px solid ${color}44`,
      borderRadius:3, padding:'1px 6px', fontSize:10, fontFamily:'IBM Plex Mono', letterSpacing:'0.02em' }}>
      {children}
    </span>
  )
}

function TrafficParticle({ x1, y1, x2, y2, active, color = C.cyan }) {
  const id = useRef(`p-${Math.random().toString(36).slice(2)}`).current
  const mid = { x: (x1+x2)/2, y: (y1+y2)/2 - 30 }
  const d = `M${x1},${y1} Q${mid.x},${mid.y} ${x2},${y2}`
  if (!active) return null
  return (
    <g>
      <defs>
        <path id={id} d={d} />
      </defs>
      {[0, 0.33, 0.66].map((offset, i) => (
        <circle key={i} r={3} fill={color} opacity={0.85}>
          <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${offset * 1.8}s`}>
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      ))}
    </g>
  )
}

export default function App() {
  const [services, setServices] = useState(() =>
    SERVICES.map(s => ({ ...s, status: 'healthy' }))
  )
  const [pods, setPods] = useState(PODS_INIT)
  const [edges] = useState(EDGES_INIT)
  const [selected, setSelected] = useState(null)
  const [chaos, setChaos] = useState(null)
  const [, setTick] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [showTweaks, setShowTweaks] = useState(false)
  const [tweaks, setTweaks] = useState({ showParticles: true, colorScheme: 'blue', density: 'comfortable' })
  const svgRef = useRef()

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1)
      setServices(prev => prev.map(s => ({
        ...s,
        cpu: s.status === 'failed' ? 0 : s.status === 'degraded'
          ? Math.min(99, s.cpu + (Math.random()-0.3)*8)
          : Math.max(5, Math.min(95, s.cpu + (Math.random()-0.5)*6)),
        rps: s.status === 'failed' ? 0 : s.status === 'degraded'
          ? Math.max(0, s.rps + (Math.random()-0.6)*80)
          : Math.max(20, s.rps + (Math.random()-0.5)*60),
      })))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const totalNodes = services.length + pods.length
  const totalEdges = edges.length + services.reduce((a,s) => a + pods.filter(p=>p.parentId===s.id).length, 0)
  const failedCount = services.filter(s=>s.status==='failed').length
  const degradedCount = services.filter(s=>s.status==='degraded').length

  const selectedObj = useMemo(() => {
    if (!selected) return null
    if (selected.type === 'service') return services.find(s=>s.id===selected.id)
    if (selected.type === 'pod') return pods.find(p=>p.id===selected.id)
    return null
  }, [selected, services, pods])

  const killService = () => {
    const targets = services.filter(s=>s.status==='healthy')
    if (!targets.length) return
    const t = targets[Math.floor(Math.random()*targets.length)]
    setChaos('kill')
    setTimeout(() => {
      setServices(prev => prev.map(s => s.id===t.id ? {...s, status:'failed'} : s))
      setPods(prev => prev.map(p => p.parentId===t.id ? {...p, status:'failed'} : p))
      setChaos(null)
    }, 1200)
  }

  const trafficLoad = () => {
    setChaos('load')
    setTimeout(() => {
      setServices(prev => prev.map(s => s.status==='healthy' && Math.random()>0.5
        ? {...s, status:'degraded', cpu: Math.min(99, s.cpu+30)}
        : s))
      setChaos(null)
    }, 1500)
  }

  const resetAll = () => {
    setChaos('resetting')
    setTimeout(() => {
      setServices(SERVICES.map(s => ({...s, status:'healthy'})))
      setPods(PODS_INIT)
      setSelected(null)
      setChaos(null)
    }, 1800)
  }

  const handleWheel = e => {
    e.preventDefault()
    setZoom(z => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)))
  }
  const handleMouseDown = e => {
    if (e.target.closest('[data-node]')) return
    setDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const handleMouseMove = e => {
    if (!dragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const handleMouseUp = () => setDragging(false)

  const accentColor = tweaks.colorScheme === 'cyan' ? C.cyan : tweaks.colorScheme === 'green' ? C.green : C.blue

  useEffect(() => {
    const handler = e => {
      if (e.data?.type === '__activate_edit_mode') setShowTweaks(true)
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false)
    }
    window.addEventListener('message', handler)
    window.parent.postMessage({ type: '__edit_mode_available' }, '*')
    return () => window.removeEventListener('message', handler)
  }, [])

  const setTweak = (k, v) => {
    setTweaks(t => {
      const next = {...t, [k]:v}
      window.parent.postMessage({ type:'__edit_mode_set_keys', edits: next }, '*')
      return next
    })
  }

  return (
    <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column',
      background: C.bg, color: C.text, userSelect:'none' }}>

      <header style={{ height:52, display:'flex', alignItems:'center', padding:'0 20px',
        borderBottom:`1px solid ${C.border}`, flexShrink:0, gap:16,
        background: C.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <svg width="22" height="22" viewBox="0 0 22 22">
            <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" fill="none" stroke={accentColor} strokeWidth="1.5"/>
            <circle cx="11" cy="11" r="3" fill={accentColor}/>
          </svg>
          <span style={{ fontSize:17, fontWeight:600, letterSpacing:'-0.01em', color:'#fff' }}>KubeSight</span>
        </div>

        <div style={{ flex:1 }} />

        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {failedCount > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:5, background:C.redDim,
              border:`1px solid ${C.red}44`, borderRadius:5, padding:'3px 10px', fontSize:12 }}>
              <span style={{ color:C.red }}>● {failedCount} Failed</span>
            </div>
          )}
          {degradedCount > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:5, background:C.yellowDim,
              border:`1px solid ${C.yellow}44`, borderRadius:5, padding:'3px 10px', fontSize:12 }}>
              <span style={{ color:C.yellow }}>◐ {degradedCount} Degraded</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:C.textMid }}>
            <span className="live-dot" style={{ color:C.green, fontSize:10 }}>●</span>
            <span>Live</span>
            <span style={{ color:C.border, margin:'0 4px' }}>|</span>
            <span style={{ fontFamily:'IBM Plex Mono', fontSize:12 }}>{totalNodes} nodes · {totalEdges} edges</span>
          </div>
        </div>
      </header>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <aside style={{ width:220, flexShrink:0, borderRight:`1px solid ${C.border}`,
          background: C.surface, display:'flex', flexDirection:'column', gap:0, overflow:'auto' }}>

          <div style={{ padding:'16px 14px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontFamily:'IBM Plex Mono', color:C.textDim,
              letterSpacing:'0.1em', marginBottom:12 }}>CHAOS ENGINEERING</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <ChaosBtn
                label="Kill Service"
                icon="✕"
                color={C.red}
                loading={chaos==='kill'}
                disabled={!!chaos || services.every(s=>s.status==='failed')}
                onClick={killService}
              />
              <ChaosBtn
                label="Traffic Load"
                icon="↑"
                color={C.orange}
                loading={chaos==='load'}
                disabled={!!chaos}
                onClick={trafficLoad}
              />
              <ChaosBtn
                label="Reset All"
                icon="↺"
                color={accentColor}
                loading={chaos==='resetting'}
                disabled={chaos==='resetting'}
                onClick={resetAll}
              />
            </div>
          </div>

          <div style={{ padding:'14px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontFamily:'IBM Plex Mono', color:C.textDim,
              letterSpacing:'0.1em', marginBottom:10 }}>SERVICES</div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {services.map(s => (
                <button key={s.id}
                  onClick={() => setSelected(sel => sel?.id===s.id ? null : {type:'service', id:s.id})}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                    borderRadius:5, border:'none', cursor:'pointer', textAlign:'left',
                    background: selected?.id===s.id ? `${accentColor}22` : 'transparent',
                    outline: selected?.id===s.id ? `1px solid ${accentColor}44` : 'none',
                    transition:'background 0.15s' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: statusColor(s.status),
                    boxShadow: `0 0 6px ${statusColor(s.status)}` }} />
                  <span style={{ fontSize:11.5, color:C.text, fontFamily:'IBM Plex Mono',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding:'14px' }}>
            <div style={{ fontSize:10, fontFamily:'IBM Plex Mono', color:C.textDim,
              letterSpacing:'0.1em', marginBottom:10 }}>LEGEND</div>
            {[
              { color: accentColor, label:'Service', shape:'hex' },
              { color: C.green,  label:'Pod — Healthy' },
              { color: C.red,    label:'Pod / Svc — Failed' },
              { color: C.yellow, label:'Pod / Svc — Degraded' },
            ].map(({ color, label, shape }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                {shape==='hex'
                  ? <svg width="14" height="14" viewBox="0 0 14 14">
                      <polygon points="7,1 12,4 12,10 7,13 2,10 2,4" fill={`${color}33`} stroke={color} strokeWidth="1.2"/>
                    </svg>
                  : <span style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }} />
                }
                <span style={{ fontSize:11.5, color:C.textMid }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ flex:1 }} />

          <div style={{ padding:'12px 14px', borderTop:`1px solid ${C.border}` }}>
            <div style={{ fontSize:10, fontFamily:'IBM Plex Mono', color:C.textDim,
              letterSpacing:'0.1em', marginBottom:8 }}>NAMESPACE</div>
            {['default','commerce','workers','infra'].map(ns => (
              <div key={ns} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ width:6, height:6, borderRadius:1, background:`${accentColor}88` }} />
                <span style={{ fontSize:11, color:C.textMid, fontFamily:'IBM Plex Mono' }}>{ns}</span>
              </div>
            ))}
          </div>
        </aside>

        <main style={{ flex:1, position:'relative', overflow:'hidden',
          cursor: dragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}>

          <svg ref={svgRef} width="100%" height="100%"
            style={{ position:'absolute', inset:0 }}>
            <defs>
              <radialGradient id="bg-grad" cx="50%" cy="50%">
                <stop offset="0%" stopColor="#0d1e3a" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#080f1c" stopOpacity="0"/>
              </radialGradient>
              <filter id="glow-sm">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-md">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border} strokeWidth="0.4" opacity="0.4"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)"/>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
              style={{ transformOrigin:'center', transition: dragging ? 'none' : 'transform 0.1s' }}>

              {edges.map((e, i) => {
                const sp = SVC_POS[e.from], ep = SVC_POS[e.to]
                if (!sp || !ep) return null
                const fromSvc = services.find(s=>s.id===e.from)
                const toSvc = services.find(s=>s.id===e.to)
                const failed = fromSvc?.status==='failed' || toSvc?.status==='failed'
                const degraded = fromSvc?.status==='degraded' || toSvc?.status==='degraded'
                const mid = { x:(sp.x+ep.x)/2, y:(sp.y+ep.y)/2-40 }
                const d = `M${sp.x},${sp.y} Q${mid.x},${mid.y} ${ep.x},${ep.y}`
                const color = failed ? `${C.red}66` : degraded ? `${C.yellow}66` : `${accentColor}44`
                const dashColor = failed ? C.red : degraded ? C.yellow : accentColor
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke={color} strokeWidth={failed?1.5:1}/>
                    {!failed && tweaks.showParticles && (
                      <path d={d} fill="none" stroke={dashColor} strokeWidth="1.5"
                        strokeDasharray="4 36" opacity="0.7"
                        className="flow-dash"
                        style={{ animation:`flow-dash 1.4s linear infinite`,
                          animationDelay:`${i*0.18}s` }}/>
                    )}
                    {tweaks.showParticles && !failed && (
                      <TrafficParticle x1={sp.x} y1={sp.y} x2={ep.x} y2={ep.y}
                        active color={dashColor}/>
                    )}
                  </g>
                )
              })}

              {services.map(svc => {
                const svcPods = pods.filter(p=>p.parentId===svc.id)
                return svcPods.map((pod, i) => {
                  const sp = SVC_POS[svc.id]
                  const pp = getPodPos(svc.id, i, svcPods.length)
                  const color = statusColor(pod.status)
                  return (
                    <line key={pod.id}
                      x1={sp.x} y1={sp.y} x2={pp.x} y2={pp.y}
                      stroke={`${color}44`} strokeWidth="1"/>
                  )
                })
              })}

              {services.map(svc => {
                const svcPods = pods.filter(p=>p.parentId===svc.id)
                return svcPods.map((pod, i) => {
                  const pp = getPodPos(svc.id, i, svcPods.length)
                  const color = statusColor(pod.status)
                  const isSel = selected?.id === pod.id
                  return (
                    <g key={pod.id} data-node="true"
                      style={{ cursor:'pointer' }}
                      onClick={e => { e.stopPropagation(); setSelected(s => s?.id===pod.id ? null : {type:'pod', id:pod.id}); }}>
                      {isSel && <circle cx={pp.x} cy={pp.y} r="14" fill={`${color}22`} stroke={`${color}66`} strokeWidth="1"/>}
                      <circle cx={pp.x} cy={pp.y} r="7" fill={C.panel}
                        stroke={color} strokeWidth={isSel ? 2 : 1.5}
                        filter={pod.status!=='healthy' ? 'url(#glow-sm)' : undefined}/>
                      <circle cx={pp.x} cy={pp.y} r="3" fill={color}/>
                    </g>
                  )
                })
              })}

              {services.map(svc => {
                const sp = SVC_POS[svc.id]
                const color = svc.status==='failed' ? C.red : svc.status==='degraded' ? C.yellow : accentColor
                const isSel = selected?.id === svc.id
                const pts = Array.from({length:6}, (_,i) => {
                  const a = i * 60 * Math.PI/180 - Math.PI/2
                  const r = 22
                  return `${sp.x + Math.cos(a)*r},${sp.y + Math.sin(a)*r}`
                }).join(' ')
                return (
                  <g key={svc.id} data-node="true"
                    style={{ cursor:'pointer' }}
                    onClick={e => { e.stopPropagation(); setSelected(s => s?.id===svc.id ? null : {type:'service', id:svc.id}); }}>
                    {isSel && (
                      <polygon points={pts.split(' ').map(p => {
                        const [x,y] = p.split(',').map(Number)
                        const cx = sp.x, cy = sp.y
                        const dx = x-cx, dy = y-cy
                        const scale = 1.5
                        return `${cx+dx*scale},${cy+dy*scale}`
                      }).join(' ')}
                        fill={`${color}15`} stroke={`${color}55`} strokeWidth="1"/>
                    )}
                    <polygon points={pts}
                      fill={C.panel}
                      stroke={color} strokeWidth={isSel ? 2 : 1.5}
                      filter={svc.status!=='healthy' ? 'url(#glow-md)' : undefined}/>
                    <circle cx={sp.x} cy={sp.y} r="18" fill="none"
                      stroke={`${cpuColor(svc.cpu)}55`} strokeWidth="3"
                      strokeDasharray={`${svc.cpu * 1.13} 113`}
                      strokeDashoffset="28" strokeLinecap="round"/>
                    <text x={sp.x} y={sp.y+1} textAnchor="middle" dominantBaseline="middle"
                      fontSize="10" fill={color} style={{ fontFamily:'IBM Plex Mono', fontWeight:'500' }}>
                      {svc.status==='failed' ? '✕' : svc.status==='degraded' ? '!' : '◈'}
                    </text>
                    <text x={sp.x} y={sp.y+34} textAnchor="middle"
                      fontSize="10.5" fill={C.textMid}
                      style={{ fontFamily:'IBM Plex Mono' }}>
                      {svc.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          <div style={{ position:'absolute', bottom:20, right:20, display:'flex',
            flexDirection:'column', gap:6 }}>
            {[
              { label:'+', onClick:()=>setZoom(z=>Math.min(2.5,z+0.15)) },
              { label:'⊡', onClick:()=>{ setZoom(1); setPan({x:0,y:0}); } },
              { label:'−', onClick:()=>setZoom(z=>Math.max(0.4,z-0.15)) },
            ].map(btn => (
              <button key={btn.label} onClick={btn.onClick}
                style={{ width:34, height:34, borderRadius:6, border:`1px solid ${C.border}`,
                  background:C.panel, color:C.textMid, fontSize:16, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=accentColor}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                {btn.label}
              </button>
            ))}
          </div>

          <div style={{ position:'absolute', inset:0, zIndex:-1 }}
            onClick={() => setSelected(null)}/>
        </main>

        {selected && selectedObj && (
          <DetailPanel
            selected={selected}
            obj={selectedObj}
            services={services}
            pods={pods}
            accentColor={accentColor}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {showTweaks && (
        <div style={{ position:'fixed', bottom:20, right:20, zIndex:1000,
          background:C.panel, border:`1px solid ${C.borderHi}`, borderRadius:10,
          padding:18, width:220, boxShadow:'0 8px 32px #000a',
          animation:'fade-up 0.2s ease both' }}>
          <div style={{ fontSize:11, fontFamily:'IBM Plex Mono', color:C.textDim,
            letterSpacing:'0.1em', marginBottom:14 }}>TWEAKS</div>

          <TweakRow label="Traffic particles">
            <Toggle value={tweaks.showParticles} onChange={v=>setTweak('showParticles',v)} color={accentColor}/>
          </TweakRow>
          <TweakRow label="Accent color">
            <div style={{ display:'flex', gap:5 }}>
              {['blue','cyan','green'].map(c => (
                <button key={c} onClick={()=>setTweak('colorScheme',c)}
                  style={{ width:18, height:18, borderRadius:'50%', border:'none', cursor:'pointer',
                    background: c==='blue' ? C.blue : c==='cyan' ? C.cyan : C.green,
                    outline: tweaks.colorScheme===c ? `2px solid #fff` : 'none',
                    outlineOffset:2 }}/>
              ))}
            </div>
          </TweakRow>
        </div>
      )}
    </div>
  )
}

function TweakRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      marginBottom:12, fontSize:12, color:C.textMid }}>
      <span>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, color }) {
  return (
    <div onClick={()=>onChange(!value)}
      style={{ width:34, height:18, borderRadius:9, cursor:'pointer',
        background: value ? color : C.border, position:'relative', transition:'background 0.2s' }}>
      <div style={{ position:'absolute', top:3, left: value ? 19 : 3, width:12, height:12,
        borderRadius:'50%', background:'#fff', transition:'left 0.2s' }}/>
    </div>
  )
}

function ChaosBtn({ label, icon, color, loading, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7,
        padding:'8px 12px', borderRadius:6, border:`1px solid ${color}55`,
        background: disabled ? `${C.border}33` : `${color}22`,
        color: disabled ? C.textDim : color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize:12.5, fontWeight:500, fontFamily:'IBM Plex Sans',
        transition:'all 0.15s', width:'100%' }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=`${color}44` }}
      onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.background=`${color}22` }}>
      <span className={loading ? 'spin' : ''} style={{ fontSize:14 }}>{icon}</span>
      {loading ? 'Working…' : label}
    </button>
  )
}

function DetailPanel({ selected, obj, services, pods, accentColor, onClose }) {
  const isSvc = selected.type === 'service'

  const svcPods = isSvc ? pods.filter(p => p.parentId === obj.id) : null
  const parentSvc = !isSvc ? services.find(s => s.id === obj.parentId) : null

  return (
    <div className="slide-in-right"
      style={{ width:280, flexShrink:0, borderLeft:`1px solid ${C.border}`,
        background: C.surface, overflowY:'auto', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, fontFamily:'IBM Plex Mono', color:C.textDim,
            letterSpacing:'0.08em', marginBottom:3 }}>
            {isSvc ? 'SERVICE' : 'POD'}
          </div>
          <div style={{ fontSize:14, fontWeight:500, color:'#fff', fontFamily:'IBM Plex Mono',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {isSvc ? obj.label : `${parentSvc?.label}/${obj.label}`}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Badge color={statusColor(obj.status)}>{statusLabel(obj.status)}</Badge>
          <button onClick={onClose}
            style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer',
              fontSize:16, lineHeight:1, padding:2 }}>✕</button>
        </div>
      </div>

      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
        <Section label="METRICS">
          <MetricRow label="CPU" value={obj.cpu} color={cpuColor(obj.cpu)} unit="%"/>
          <MetricRow label="Memory" value={obj.mem} color={memColor(obj.mem)} unit="%"/>
          {isSvc && <MetricRow label="RPS" value={Math.round(obj.rps)} color={accentColor} unit="" raw/>}
          {!isSvc && <MetricRow label="Restarts" value={obj.restarts} color={C.textMid} unit="" raw/>}
        </Section>

        {isSvc && (
          <Section label="METADATA">
            <KV k="Namespace" v={obj.ns}/>
            <KV k="Pods" v={svcPods.length}/>
            <KV k="Healthy" v={svcPods.filter(p=>p.status==='healthy').length}/>
            <KV k="Failed" v={svcPods.filter(p=>p.status==='failed').length}/>
          </Section>
        )}

        {isSvc && svcPods.length > 0 && (
          <Section label="PODS">
            {svcPods.map(pod => (
              <div key={pod.id} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'5px 8px', borderRadius:5, background:C.panel,
                marginBottom:4 }}>
                <span style={{ width:7, height:7, borderRadius:'50%',
                  background: statusColor(pod.status),
                  boxShadow:`0 0 5px ${statusColor(pod.status)}` }}/>
                <span style={{ fontSize:11, fontFamily:'IBM Plex Mono', color:C.textMid, flex:1 }}>
                  {pod.label}
                </span>
                <span style={{ fontSize:10, color:C.textDim }}>
                  CPU {pod.cpu}%
                </span>
              </div>
            ))}
          </Section>
        )}

        {!isSvc && parentSvc && (
          <Section label="PARENT SERVICE">
            <KV k="Service" v={parentSvc.label}/>
            <KV k="Namespace" v={parentSvc.ns}/>
            <KV k="Svc Status" v={statusLabel(parentSvc.status)}/>
          </Section>
        )}

        <Section label="RECENT LOGS">
          <div style={{ background:C.bg, borderRadius:6, padding:'8px 10px',
            fontFamily:'IBM Plex Mono', fontSize:10.5, color:C.textDim,
            lineHeight:1.7, maxHeight:110, overflow:'hidden' }}>
            {obj.status==='failed' ? (
              <>
                <div style={{color:C.red}}>ERR connection refused :5432</div>
                <div style={{color:C.red}}>ERR health check failed (3x)</div>
                <div style={{color:C.yellow}}>WARN circuit breaker OPEN</div>
              </>
            ) : obj.status==='degraded' ? (
              <>
                <div style={{color:C.yellow}}>WARN latency p99 &gt; 2000ms</div>
                <div>INFO retry attempt 2/3</div>
                <div>INFO request processed 200ms</div>
              </>
            ) : (
              <>
                <div>INFO request processed 12ms</div>
                <div>INFO healthcheck OK</div>
                <div>INFO metrics scraped</div>
                <div style={{color:C.textDim}}>DEBUG cache hit ratio 0.94</div>
              </>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:9.5, fontFamily:'IBM Plex Mono', color:C.textDim,
        letterSpacing:'0.1em', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}

function MetricRow({ label, value, color, unit, raw }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:C.textMid }}>{label}</span>
        <span style={{ fontSize:11, fontFamily:'IBM Plex Mono', color }}>
          {raw ? value : value}{unit}
        </span>
      </div>
      {!raw && <MiniBar value={value} color={color} width="100%"/>}
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6,
      fontSize:11.5 }}>
      <span style={{ color:C.textDim }}>{k}</span>
      <span style={{ color:C.text, fontFamily:'IBM Plex Mono', fontSize:11 }}>{v}</span>
    </div>
  )
}