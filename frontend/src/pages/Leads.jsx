import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'

const PRODUCTS = ['Manoveda','ShayanVeda','Shiroveda','Smritiveda','Allergy-GO','Immuno Plus',
  'Shwasveda','Hridayaveda','RaktaSneha','GlucoVeda','MedoharMukta','Poshakveda',
  'Agnimukta','Rechaka Veda','GudaShanti','Yakritshuddhi','Raktaveda','AcnoVeda',
  'NikharVeda','RomaVardhak','Feminoveda','Ritushanti','Lohaveda','Vajraveda',
  'Manomukta','Sandhiveda','GO_Lith','Satvik Multivita']

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ date_from: '', date_to: '', stage: '', product: '' })
  const [stages, setStages] = useState([])
  const [editingName, setEditingName] = useState(null)
  const [nameVal, setNameVal] = useState('')
  const navigate = useNavigate()
  const limit = 20

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, limit, search: search || undefined, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) }
      const { data } = await api.get('/leads', { params })
      setLeads(data.data || [])
      setTotal(data.total || 0)
    } catch { toast.error('Failed to load leads') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, search, filters])
  useEffect(() => {
    api.get('/settings/stages').then(r => setStages(r.data)).catch(() => {})
  }, [])

  useSocket({ 'lead:new': () => load(), 'lead:updated': () => load() })

  const exportCSV = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([,v]) => v))
      const res = await api.get('/leads/export/csv', { responseType: 'blob', params })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
      toast.success('Exported!')
    } catch { toast.error('Export failed') }
  }

  const saveName = async (lead) => {
    if (!nameVal.trim()) return setEditingName(null)
    try {
      await api.patch(`/leads/${lead.id}/name`, { name: nameVal })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, name: nameVal } : l))
      toast.success('Name updated!')
    } catch { toast.error('Failed') }
    setEditingName(null)
  }

  const clearFilters = () => { setFilters({ date_from: '', date_to: '', stage: '', product: '' }); setPage(1) }
  const hasFilters = Object.values(filters).some(v => v)

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

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Leads <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 400 }}>({total})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowFilters(!showFilters)}>
            🔽 Filters {hasFilters && <span className="badge badge-orange" style={{ marginLeft: 4, fontSize: 10 }}>ON</span>}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input className="input" placeholder="🔍  Search by name or phone..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ maxWidth: 320 }} />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card" style={{ marginBottom: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-row" style={{ margin: 0, minWidth: 140 }}>
              <label className="label">From Date</label>
              <input className="input" type="date" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div className="form-row" style={{ margin: 0, minWidth: 140 }}>
              <label className="label">To Date</label>
              <input className="input" type="date" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
            </div>
            <div className="form-row" style={{ margin: 0, minWidth: 140 }}>
              <label className="label">Stage</label>
              <select className="input" value={filters.stage}
                onChange={e => setFilters(f => ({ ...f, stage: e.target.value }))}>
                <option value="">All Stages</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ margin: 0, minWidth: 160 }}>
              <label className="label">Product Recommended</label>
              <select className="input" value={filters.product}
                onChange={e => setFilters(f => ({ ...f, product: e.target.value }))}>
                <option value="">All Products</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginBottom: 2 }}>
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"/></div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <div style={{ fontWeight: 600 }}>No leads found</div>
            <p>{hasFilters ? 'Try clearing filters' : 'Leads appear when customers send WhatsApp messages'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Stage</th>
                  <th>Pincode/City</th>
                  <th>First Contact</th>
                  <th>Last Message</th>
                  <th>Last Active</th>
                  <th>Messages</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} style={{ cursor: 'pointer' }}
                    onClick={(e) => { if (editingName === lead.id) e.stopPropagation(); else navigate(`/leads/${lead.id}`) }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'var(--bg3)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 700, fontSize: 13,
                          color: 'var(--primary)', flexShrink: 0
                        }}>{(lead.name || lead.phone)?.[0]?.toUpperCase()}</div>
                        <div>
                          {editingName === lead.id ? (
                            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                              <input className="input" value={nameVal} onChange={e => setNameVal(e.target.value)}
                                style={{ padding: '2px 6px', height: 26, fontSize: 12, width: 120 }}
                                onKeyDown={e => { if (e.key === 'Enter') saveName(lead); if (e.key === 'Escape') setEditingName(null) }}
                                autoFocus />
                              <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => saveName(lead)}>✓</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {lead.name || <span style={{ color: 'var(--text2)', fontStyle: 'italic' }}>Unknown</span>}
                              </span>
                              <button onClick={e => { e.stopPropagation(); setEditingName(lead.id); setNameVal(lead.name || '') }}
                                style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, padding: '0 2px', opacity: 0.6 }}
                                title="Edit name">✏️</button>
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.phone}</div>
                        </div>
                        {!lead.is_read && (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', marginLeft: 4, flexShrink: 0 }}/>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${stageColor(lead.stage?.name)}`}>
                        {lead.stage?.name || 'New'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {lead.pincode ? (
                        <span className="badge badge-blue" style={{ fontSize: 10 }}>📮 {lead.pincode}</span>
                      ) : lead.city ? (
                        <span style={{ color: 'var(--text2)' }}>📍 {lead.city}</span>
                      ) : <span style={{ color: 'var(--text2)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(lead.created_at)}</td>
                    <td style={{ maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text2)' }}>
                        {lead.last_message || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{timeAgo(lead.last_message_at)}</td>
                    <td style={{ fontSize: 12 }}>{lead.message_count || 0}</td>
                    <td>
                      {lead.follow_up_at && !lead.follow_up_done && new Date(lead.follow_up_at) <= new Date() ? (
                        <span className="badge badge-orange">⏰ Follow-up</span>
                      ) : lead.notes ? (
                        <span className="badge badge-gray">📝 Notes</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
