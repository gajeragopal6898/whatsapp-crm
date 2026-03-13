import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useSocket } from '../hooks/useSocket'

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, today: 0, unread: 0, followups: 0 })
  const [qr, setQr] = useState(null)
  const [waConnected, setWaConnected] = useState(false)
  const [waPhone, setWaPhone] = useState(null)
  const [stageData, setStageData] = useState([])
  const navigate = useNavigate()

  useSocket({
    'whatsapp:qr': ({ qr }) => { setQr(qr); setWaConnected(false) },
    'whatsapp:connected': ({ phone }) => { setWaConnected(true); setQr(null); setWaPhone(phone) },
    'whatsapp:disconnected': () => { setWaConnected(false); setWaPhone(null) },
    'lead:new': () => loadStats(),
    'message:new': () => loadStats(),
  })

  const loadStats = async () => {
    try {
      const [leadsRes, waRes] = await Promise.all([
        api.get('/leads?limit=100'),
        api.get('/whatsapp/status'),
      ])
      const leads = leadsRes.data.data || []
      const today = new Date().toDateString()
      setStats({
        total: leadsRes.data.total || 0,
        today: leads.filter(l => new Date(l.created_at).toDateString() === today).length,
        unread: leads.filter(l => !l.is_read).length,
        followups: leads.filter(l => l.follow_up_at && !l.follow_up_done && new Date(l.follow_up_at) <= new Date()).length,
      })
      setWaConnected(waRes.data.isConnected)
      if (waRes.data.qr) setQr(waRes.data.qr)

      // Stage counts
      const stageCounts = {}
      leads.forEach(l => {
        const name = l.stage?.name || 'Unknown'
        stageCounts[name] = (stageCounts[name] || 0) + 1
      })
      setStageData(Object.entries(stageCounts).map(([name, count]) => ({ name, count })))
    } catch {}
  }

  useEffect(() => { loadStats() }, [])

  const statCards = [
    { label: 'Total Leads', val: stats.total, icon: '👥', color: '#162038', iconBg: '#1e3a5f' },
    { label: 'New Today', val: stats.today, icon: '✨', color: '#162a1e', iconBg: '#1a3a2a' },
    { label: 'Unread Messages', val: stats.unread, icon: '💬', color: '#1a1a2a', iconBg: '#2a2a4a' },
    { label: 'Follow-ups Due', val: stats.followups, icon: '⏰', color: '#2a1a1a', iconBg: '#3a2a1a' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button className="btn btn-primary btn-sm" onClick={loadStats}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card" style={{ background: s.color }}>
            <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
            <div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* WhatsApp Connection */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📱</span> WhatsApp Connection
            <span className={`badge ${waConnected ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>
              {waConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {waConnected ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 600, color: 'var(--green)' }}>WhatsApp is Active</div>
              {waPhone && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>+{waPhone}</div>}
              <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                Receiving messages and creating leads automatically
              </p>
            </div>
          ) : qr ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                Open WhatsApp → Linked Devices → Link a Device → Scan
              </p>
              <img src={qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 10 }} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
              <div style={{ color: 'var(--text2)', fontSize: 13 }}>Waiting for WhatsApp to initialize...</div>
              <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>QR code will appear shortly</div>
            </div>
          )}
        </div>

        {/* Leads by Stage */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>📊 Leads by Stage</div>
          {stageData.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="icon">📭</div>
              <p>No leads yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stageData.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 90, fontSize: 12, color: 'var(--text2)' }}>{s.name}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: 'var(--primary)', borderRadius: 99,
                      width: `${Math.min(100, (s.count / stats.total) * 100)}%`
                    }}/>
                  </div>
                  <div style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{s.count}</div>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, width: '100%' }}
            onClick={() => navigate('/leads')}>
            View All Leads →
          </button>
        </div>
      </div>
    </div>
  )
}
