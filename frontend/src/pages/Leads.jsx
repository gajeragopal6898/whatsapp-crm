import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const limit = 20

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/leads', { params: { page, limit, search: search || undefined } })
      setLeads(data.data || [])
      setTotal(data.total || 0)
    } catch { toast.error('Failed to load leads') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, search])

  useSocket({
    'lead:new': () => load(),
    'lead:updated': () => load(),
  })

  const exportCSV = async () => {
    try {
      const res = await api.get('/leads/export/csv', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
      toast.success('Exported!')
    } catch { toast.error('Export failed') }
  }

  const stageColor = (name) => {
    const map = { 'New': 'badge-blue', 'Contacted': 'badge-orange', 'Qualified': 'badge-purple', 'Closed': 'badge-green' }
    return map[name] || 'badge-gray'
  }

  const timeAgo = (date) => {
    if (!date) return '—'
    const diff = Date.now() - new Date(date)
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Leads <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 400 }}>({total})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input className="input" placeholder="🔍  Search by name or phone..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ maxWidth: 320 }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"/></div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <div style={{ fontWeight: 600 }}>No leads yet</div>
            <p>Leads will appear here when customers send WhatsApp messages</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Stage</th>
                  <th>Last Message</th>
                  <th>Last Active</th>
                  <th>Messages</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/leads/${lead.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'var(--bg3)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 700, fontSize: 13,
                          color: 'var(--primary)', flexShrink: 0
                        }}>{(lead.name || lead.phone)?.[0]?.toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.name || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.phone}</div>
                        </div>
                        {!lead.is_read && (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', marginLeft: 4 }}/>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${stageColor(lead.stage?.name)}`}>
                        {lead.stage?.name || 'New'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontSize: 12, color: 'var(--text2)' }}>
                        {lead.last_message || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{timeAgo(lead.last_message_at)}</td>
                    <td style={{ fontSize: 12 }}>{lead.message_count || 0}</td>
                    <td>
                      {lead.follow_up_at && !lead.follow_up_done && new Date(lead.follow_up_at) <= new Date() ? (
                        <span className="badge badge-orange">⏰ Follow-up due</span>
                      ) : lead.notes ? (
                        <span className="badge badge-gray">📝 Has notes</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Page {page} of {Math.ceil(total / limit)}</span>
            <button className="btn btn-ghost btn-sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
