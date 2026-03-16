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
  const [teamStats, setTeamStats] = useState([])
  const [recentLeads, setRecentLeads] = useState([])
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
      const [leadsRes, waRes, teamRes] = await Promise.all([
        api.get('/leads?limit=200'),
        api.get('/whatsapp/status'),
        api.get('/users/team-stats').catch(() => ({ data: [] })),
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
      const stageCounts = {}
      leads.forEach(l => { const n = l.stage?.name || 'New'; stageCounts[n] = (stageCounts[n] || 0) + 1 })
      setStageData(Object.entries(stageCounts).map(([name, count]) => ({ name, count })))
      setTeamStats(teamRes.data || [])
      setRecentLeads(leads.slice(0, 6))
    } catch {}
  }

  useEffect(() => { loadStats() }, [])

  const stageColors = { New: '#3b82f6', Contacted: '#f59e0b', Qualified: '#8b5cf6', Closed: '#10b981' }
  const timeAgo = (d) => {
    if (!d) return '—'
    const m = Math.floor((Date.now() - new Date(d)) / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button className="btn btn-primary btn-sm" onClick={loadStats}>↻ Refresh</button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Leads', val: stats.total, icon: '👥', color: '#162038', iconBg: '#1e3a5f', click: () => navigate('/leads') },
          { label: 'New Today', val: stats.today, icon: '✨', color: '#162a1e', iconBg: '#1a3a2a' },
          { label: 'Unread Messages', val: stats.unread, icon: '💬', color: '#1a1a2a', iconBg: '#2a2a4a', click: () => navigate('/leads') },
          { label: 'Follow-ups Due', val: stats.followups, icon: '⏰', color: '#2a1a1a', iconBg: '#3a2a1a' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ background: s.color, cursor: s.click ? 'pointer' : 'default' }} onClick={s.click}>
            <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
            <div><div className="stat-val">{s.val}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Row 1: WA + Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            📱 WhatsApp
            <span className={`badge ${waConnected ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>
              {waConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {waConnected ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 600, color: 'var(--green)' }}>WhatsApp is Active</div>
              {waPhone && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>+{waPhone}</div>}
            </div>
          ) : qr ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>WhatsApp → Linked Devices → Scan QR</p>
              <img src={qr} alt="QR" style={{ width: 180, height: 180, borderRadius: 10 }} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32 }}>⏳</div>
              <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 8 }}>Initializing...</div>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>📊 Leads by Stage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stageData.sort((a,b) => b.count - a.count).map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: stageColors[s.name] || 'var(--primary)', flexShrink: 0 }}/>
                <div style={{ width: 75, fontSize: 12, color: 'var(--text2)' }}>{s.name}</div>
                <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: stageColors[s.name] || 'var(--primary)', borderRadius: 99, width: `${Math.min(100,(s.count/(stats.total||1))*100)}%` }}/>
                </div>
                <div style={{ width: 26, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{s.count}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14, width: '100%' }} onClick={() => navigate('/leads')}>
            View All Leads →
          </button>
        </div>
      </div>

      {/* Team Performance */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>👥 Team Performance</span>
          <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)', padding: '3px 8px', borderRadius: 99 }}>
            Bird's Eye View
          </span>
        </div>
        {teamStats.length === 0 ? (
          <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Add team members in Settings → Team Members
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Agent', 'Role', 'Assigned Leads', 'Active', 'Won/Closed', 'New Today', 'Win Rate'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamStats.map(m => {
                  const wr = m.assigned_leads > 0 ? Math.round((m.closed_leads / m.assigned_leads) * 100) : 0
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                            {m.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${m.role === 'admin' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: 10 }}>{m.role}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 16 }}>{m.assigned_leads}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ color: 'var(--orange)', fontWeight: 600 }}>{m.active_leads}</span></td>
                      <td style={{ padding: '10px 12px' }}><span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 15 }}>{m.closed_leads}</span></td>
                      <td style={{ padding: '10px 12px' }}><span className="badge badge-blue" style={{ fontSize: 11 }}>+{m.today_leads}</span></td>
                      <td style={{ padding: '10px 12px', minWidth: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 99 }}>
                            <div style={{ height: '100%', background: wr > 50 ? 'var(--green)' : wr > 25 ? 'var(--orange)' : '#ef4444', borderRadius: 99, width: `${wr}%`, transition: 'width .5s' }}/>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 34 }}>{wr}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Leads */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>🕐 Recent Leads</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>View All</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recentLeads.map(lead => (
            <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => navigate(`/leads/${lead.id}`)}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                {(lead.name || lead.phone)?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.name || lead.phone}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.last_message || '—'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`badge ${stageColors[lead.stage?.name] ? '' : 'badge-gray'}`}
                  style={{ fontSize: 10, marginBottom: 2, display: 'block', background: stageColors[lead.stage?.name] ? stageColors[lead.stage?.name] + '33' : undefined, color: stageColors[lead.stage?.name] }}>
                  {lead.stage?.name || 'New'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text2)' }}>{timeAgo(lead.last_message_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
