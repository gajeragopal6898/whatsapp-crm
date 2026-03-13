import { useState, useEffect } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'

// ─── Auto Reply Rules Tab ────────────────────────────────────────────────────
function RulesTab() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'keyword', keywords: '', reply_text: '', is_active: true })

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/rules'); setRules(data) }
    catch { toast.error('Failed to load rules') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', type: 'keyword', keywords: '', reply_text: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (rule) => {
    setEditing(rule)
    setForm({
      name: rule.name, type: rule.type,
      keywords: (rule.keywords || []).join(', '),
      reply_text: rule.reply_text, is_active: rule.is_active
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.reply_text.trim()) return toast.error('Name and reply text are required')
    const payload = {
      name: form.name, type: form.type, reply_text: form.reply_text, is_active: form.is_active,
      keywords: form.type === 'keyword' ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : []
    }
    try {
      if (editing) await api.patch(`/rules/${editing.id}`, payload)
      else await api.post('/rules', payload)
      toast.success(editing ? 'Rule updated' : 'Rule created')
      setShowModal(false); load()
    } catch { toast.error('Failed to save rule') }
  }

  const toggle = async (rule) => {
    try {
      await api.patch(`/rules/${rule.id}`, { is_active: !rule.is_active })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    } catch { toast.error('Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete this rule?')) return
    try { await api.delete(`/rules/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const typeLabel = { keyword: '🔑 Keyword', welcome: '👋 Welcome', away: '🌙 Away', menu: '📋 Menu' }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Auto-Reply Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Automatically reply to customers based on trigger type
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Rule</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : rules.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🤖</div>
          <div style={{ fontWeight: 600 }}>No rules yet</div>
          <p>Create auto-reply rules to respond to customers automatically</p>
          <button className="btn btn-primary btn-sm" onClick={openNew}>Create First Rule</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map(rule => (
            <div key={rule.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <button className={`toggle ${rule.is_active ? 'on' : ''}`} onClick={() => toggle(rule)}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{rule.name}</span>
                    <span className="badge badge-blue">{typeLabel[rule.type] || rule.type}</span>
                    {!rule.is_active && <span className="badge badge-gray">Inactive</span>}
                    {rule.trigger_count > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>
                        Triggered {rule.trigger_count} times
                      </span>
                    )}
                  </div>
                  {rule.type === 'keyword' && rule.keywords?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                      {rule.keywords.map(k => (
                        <span key={k} style={{ background: 'var(--bg3)', padding: '2px 8px',
                          borderRadius: 99, fontSize: 11, color: 'var(--text2)' }}>{k}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)',
                    padding: '6px 10px', borderRadius: 6, lineHeight: 1.5 }}>
                    {rule.reply_text}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rule)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(rule.id)}>Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? 'Edit Rule' : 'New Auto-Reply Rule'}</div>
            <div className="form-row">
              <label className="label">Rule Name *</label>
              <input className="input" placeholder="e.g. Price Enquiry Reply"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-row">
              <label className="label">Trigger Type *</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="keyword">🔑 Keyword Match — triggers when message contains keyword</option>
                <option value="welcome">👋 Welcome — triggers for first message from new contact</option>
                <option value="away">🌙 Away — triggers outside office hours</option>
                <option value="menu">📋 Menu — sends options menu</option>
              </select>
            </div>
            {form.type === 'keyword' && (
              <div className="form-row">
                <label className="label">Keywords (comma separated) *</label>
                <input className="input" placeholder="price, cost, rate, how much"
                  value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
                <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                  Rule triggers when any of these words appear in the message
                </span>
              </div>
            )}
            <div className="form-row">
              <label className="label">Reply Message *</label>
              <textarea className="input" rows={4}
                placeholder="Hello! Our prices start from ₹500. For details, please share your requirements."
                value={form.reply_text}
                onChange={e => setForm(f => ({ ...f, reply_text: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button className={`toggle ${form.is_active ? 'on' : ''}`}
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}/>
              <span style={{ fontSize: 13 }}>{form.is_active ? 'Active — will send replies' : 'Inactive — disabled'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>
                {editing ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stages Tab ───────────────────────────────────────────────────────────────
function StagesTab() {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', color: '#4f8ef7' })

  const COLORS = ['#4f8ef7','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#ec4899','#84cc16']

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/settings/stages'); setStages(data) }
    catch { toast.error('Failed to load stages') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name required')
    try {
      if (editing) await api.patch(`/settings/stages/${editing.id}`, form)
      else await api.post('/settings/stages', { ...form, order_index: stages.length + 1 })
      toast.success('Saved'); setShowModal(false); load()
    } catch { toast.error('Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete stage? Leads in this stage will have no stage.')) return
    try { await api.delete(`/settings/stages/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Lead Stages</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Manage your lead pipeline stages</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setForm({ name: '', color: '#4f8ef7' }); setShowModal(true) }}>+ Add Stage</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map((stage, i) => (
            <div key={stage.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color, flexShrink: 0 }}/>
                <span style={{ fontWeight: 500, flex: 1 }}>{stage.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>Order: {i + 1}</span>
                {stage.is_default && <span className="badge badge-green">Default</span>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(stage); setForm({ name: stage.name, color: stage.color }); setShowModal(true) }}>Edit</button>
                  {!stage.is_default && <button className="btn btn-danger btn-sm" onClick={() => del(stage.id)}>Del</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? 'Edit Stage' : 'New Stage'}</div>
            <div className="form-row">
              <label className="label">Stage Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. In Negotiation" />
            </div>
            <div className="form-row">
              <label className="label">Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer' }}/>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' })

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/users'); setUsers(data) }
    catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name || !form.email || !form.password) return toast.error('All fields required')
    try {
      await api.post('/users', form)
      toast.success('User created'); setShowModal(false); load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const toggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      toast.success(user.is_active ? 'User deactivated' : 'User activated')
    } catch { toast.error('Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Team Members</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Manage users and their roles</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ name: '', email: '', password: '', role: 'agent' }); setShowModal(true) }}>+ Add User</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{u.email}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`} style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Team Member</div>
            <div className="form-row"><label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" /></div>
            <div className="form-row"><label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" /></div>
            <div className="form-row"><label className="label">Password *</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" /></div>
            <div className="form-row"><label className="label">Role *</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="agent">Agent — can manage leads & messages</option>
                <option value="admin">Admin — full access</option>
              </select></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Office Hours Tab ─────────────────────────────────────────────────────────
function OfficeHoursTab() {
  const [settings, setSettings] = useState({ enabled: false, start: '09:00', end: '18:00', days: [1,2,3,4,5] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.office_hours) setSettings(r.data.office_hours)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleDay = (d) => {
    setSettings(s => ({ ...s, days: s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d] }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings/office_hours', settings)
      toast.success('Office hours saved')
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Office Hours</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 20 }}>
        Away message sends automatically outside these hours
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Enable office hours</span>
          <button className={`toggle ${settings.enabled ? 'on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}/>
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label className="label">Opens at</label>
            <input className="input" type="time" value={settings.start}
              onChange={e => setSettings(s => ({ ...s, start: e.target.value }))} />
          </div>
          <div className="form-row">
            <label className="label">Closes at</label>
            <input className="input" type="time" value={settings.end}
              onChange={e => setSettings(s => ({ ...s, end: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Working Days</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500, transition: 'all .15s',
                  background: settings.days.includes(i) ? 'var(--primary)' : 'var(--bg3)',
                  color: settings.days.includes(i) ? '#fff' : 'var(--text2)'
                }}>{d}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Office Hours'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
const TABS = [
  { key: 'rules', label: '🤖 Auto-Reply Rules' },
  { key: 'stages', label: '📊 Lead Stages' },
  { key: 'users', label: '👥 Team Members' },
  { key: 'hours', label: '🕐 Office Hours' },
]

export default function Settings() {
  const [tab, setTab] = useState('rules')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'rules' && <RulesTab />}
      {tab === 'stages' && <StagesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'hours' && <OfficeHoursTab />}
    </div>
  )
}
