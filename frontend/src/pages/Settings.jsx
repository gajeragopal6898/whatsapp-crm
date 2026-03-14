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
// ─── AI Settings Tab ──────────────────────────────────────────────────────────
function AITab() {
  const [settings, setSettings] = useState({
    enabled: false, mode: 'semi', business_context: '',
    reply_delay: 3, max_auto_replies: 5,
    escalate_keywords: 'human, agent, person, manager'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [testReply, setTestReply] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api.get('/ai/settings').then(r => {
      setSettings({ ...r.data, escalate_keywords: (r.data.escalate_keywords || []).join(', ') })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/ai/settings', {
        ...settings,
        escalate_keywords: settings.escalate_keywords.split(',').map(k => k.trim()).filter(Boolean)
      })
      toast.success('AI settings saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const testAI = async () => {
    if (!testMsg.trim()) return toast.error('Enter a test message')
    setTesting(true); setTestReply('')
    try {
      const { data } = await api.post('/ai/preview', { lead_id: 'test', message: testMsg })
      setTestReply(data.reply)
    } catch (e) { toast.error(e.response?.data?.error || 'AI test failed — check your Gemini API key') }
    finally { setTesting(false) }
  }

  if (loading) return <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>AI Auto-Reply (Google Gemini)</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 20 }}>
        Free AI that replies to customers automatically in their language
      </div>

      {/* API Key notice */}
      <div style={{ background: '#1a2a1a', border: '1px solid #2a4a2a', borderRadius: 8,
        padding: '10px 14px', marginBottom: 20, fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>🔑 Setup Required — Free Gemini API Key</div>
        <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>
          1. Go to <strong style={{color:'var(--text)'}}>aistudio.google.com</strong> → Sign in with Google<br/>
          2. Click <strong style={{color:'var(--text)'}}>Get API Key</strong> → Create API Key → Copy it<br/>
          3. Go to <strong style={{color:'var(--text)'}}>Railway</strong> → Variables → Add: <code style={{background:'var(--bg3)',padding:'1px 5px',borderRadius:3}}>GEMINI_API_KEY</code> = your key<br/>
          4. Railway will redeploy automatically — then enable AI below
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>Enable AI Auto-Reply</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>AI will reply to all incoming messages</div>
          </div>
          <button className={`toggle ${settings.enabled ? 'on' : ''}`}
            onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}/>
        </div>

        <div className="form-row">
          <label className="label">AI Mode</label>
          <select className="input" value={settings.mode}
            onChange={e => setSettings(s => ({ ...s, mode: e.target.value }))}>
            <option value="full">🤖 Full Auto — AI sends replies automatically</option>
            <option value="semi">👁 Semi-Auto — AI suggests, agent approves before sending</option>
          </select>
        </div>

        <div className="form-row">
          <label className="label">Business Context (train your AI)</label>
          <textarea className="input" rows={5} value={settings.business_context}
            onChange={e => setSettings(s => ({ ...s, business_context: e.target.value }))}
            placeholder={`Tell AI about your business. Example:\nWe are ABC Traders, selling electrical goods in Surat.\nOur products: Cables, Switches, Panels.\nPrices start from ₹500.\nWorking hours: Mon-Sat 9am-6pm.\nContact: 9876543210`}
            style={{ resize: 'vertical' }} />
          <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
            The more detail you add, the better AI replies will be
          </span>
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label className="label">Reply Delay (seconds)</label>
            <select className="input" value={settings.reply_delay}
              onChange={e => setSettings(s => ({ ...s, reply_delay: +e.target.value }))}>
              <option value={0}>Instant</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
            </select>
          </div>
          <div className="form-row">
            <label className="label">Max AI Replies per Lead</label>
            <select className="input" value={settings.max_auto_replies}
              onChange={e => setSettings(s => ({ ...s, max_auto_replies: +e.target.value }))}>
              <option value={3}>3 replies then stop</option>
              <option value={5}>5 replies then stop</option>
              <option value={10}>10 replies then stop</option>
              <option value={0}>Unlimited</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <label className="label">Escalation Keywords (comma separated)</label>
          <input className="input" value={settings.escalate_keywords}
            onChange={e => setSettings(s => ({ ...s, escalate_keywords: e.target.value }))}
            placeholder="human, agent, person, manager, owner" />
          <span style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
            When customer types these words, AI stops and notifies agent
          </span>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save AI Settings'}
        </button>
      </div>

      {/* Test AI */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>🧪 Test AI Reply</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="input" placeholder="Type a test customer message..."
            value={testMsg} onChange={e => setTestMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && testAI()} />
          <button className="btn btn-primary" onClick={testAI} disabled={testing} style={{ flexShrink: 0 }}>
            {testing ? <span className="spinner" style={{width:14,height:14}}/> : 'Test'}
          </button>
        </div>
        {testReply && (
          <div style={{ background: 'var(--bg3)', padding: '10px 14px', borderRadius: 8,
            fontSize: 13, lineHeight: 1.6, color: 'var(--green)' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>AI Reply:</div>
            {testReply}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Knowledge Base Tab ───────────────────────────────────────────────────────
function KnowledgeTab() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', content: '', file_type: 'text' })
  const [apiStatus, setApiStatus] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [docsRes, statusRes] = await Promise.all([
        api.get('/ai/knowledge'),
        api.get('/ai/status')
      ])
      setDocs(docsRes.data)
      setApiStatus(statusRes.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) return toast.error('Name and content required')
    try {
      await api.post('/ai/knowledge', form)
      toast.success('Knowledge added! AI will now use this.')
      setShowModal(false)
      setForm({ name: '', content: '', file_type: 'text' })
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const toggle = async (doc) => {
    try {
      await api.patch(`/ai/knowledge/${doc.id}`, { is_active: !doc.is_active })
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_active: !d.is_active } : d))
      toast.success(doc.is_active ? 'Disabled' : 'Enabled')
    } catch { toast.error('Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete this knowledge document?')) return
    try { await api.delete(`/ai/knowledge/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>AI Knowledge Base</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Upload product info, FAQs, pricing — AI learns from these documents
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Knowledge</button>
      </div>

      {/* API Status */}
      {apiStatus && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { key: 'groq', label: 'Groq API', limit: '14,400 req/day', color: apiStatus.groq?.configured ? 'var(--green)' : 'var(--red)' },
            { key: 'gemini', label: 'Gemini API', limit: '1,500 req/day', color: apiStatus.gemini?.configured ? 'var(--green)' : 'var(--orange)' }
          ].map(a => (
            <div key={a.key} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }}/>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                <span className={`badge ${apiStatus[a.key]?.configured ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>
                  {apiStatus[a.key]?.configured ? 'Active' : 'Not Set'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                Free limit: {a.limit} | Auto-switches when limit reached
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Built-in KB notice */}
      <div style={{ background: '#1a2a1a', border: '1px solid #2a4a2a', borderRadius: 8,
        padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 3 }}>
          ✅ Dhwakat Herbal Knowledge — Built-in
        </div>
        <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>
          40 products, 18+ categories, conversation scripts, pricing, delivery info — all pre-loaded from your training document.
          Add extra documents below for additional knowledge.
        </div>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : docs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <div style={{ fontWeight: 600 }}>No extra documents yet</div>
          <p>The built-in Dhwakat Herbal knowledge is already active. Add more documents for extra info.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>Add Document</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {docs.map(doc => (
            <div key={doc.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className={`toggle ${doc.is_active ? 'on' : ''}`} onClick={() => toggle(doc)}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                    Type: {doc.file_type} · Added: {new Date(doc.created_at).toLocaleDateString('en-IN')}
                    {!doc.is_active && <span style={{ color: 'var(--red)', marginLeft: 8 }}>· Disabled</span>}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => del(doc.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">Add Knowledge Document</div>
            <div className="form-row">
              <label className="label">Document Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New Product List, FAQ, Pricing 2026" />
            </div>
            <div className="form-row">
              <label className="label">Type</label>
              <select className="input" value={form.file_type} onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}>
                <option value="text">Text / Notes</option>
                <option value="faq">FAQ</option>
                <option value="products">Product List</option>
                <option value="pricing">Pricing</option>
                <option value="policy">Policy / Terms</option>
              </select>
            </div>
            <div className="form-row">
              <label className="label">Content * (paste your text, product info, FAQs etc.)</label>
              <textarea className="input" rows={8} value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Paste your content here. The AI will learn from this and use it when replying to customers."
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Add to AI Knowledge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Customer Memory Tab ──────────────────────────────────────────────────────
function MemoryTab() {
  const [leads, setLeads] = useState([])
  const [selected, setSelected] = useState(null)
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [memLoading, setMemLoading] = useState(false)

  useEffect(() => {
    api.get('/leads?limit=50').then(r => {
      setLeads(r.data.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadMemory = async (lead) => {
    setSelected(lead)
    setMemLoading(true)
    try {
      const { data } = await api.get(`/ai/memory/${lead.phone}`)
      setMemory(data)
    } catch { setMemory({}) }
    finally { setMemLoading(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
      {/* Lead list */}
      <div className="card" style={{ padding: 0, height: 'fit-content', maxHeight: 600, overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
          👥 Select Customer
        </div>
        {loading ? <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner"/></div>
         : leads.map(lead => (
          <div key={lead.id}
            onClick={() => loadMemory(lead)}
            style={{
              padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: selected?.id === lead.id ? 'var(--bg3)' : 'transparent',
              transition: 'background .15s'
            }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.name || 'Unknown'}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{lead.phone}</div>
          </div>
        ))}
      </div>

      {/* Memory display */}
      <div>
        {!selected ? (
          <div className="empty-state card">
            <div className="icon">🧠</div>
            <div style={{ fontWeight: 600 }}>Select a customer</div>
            <p>View AI memory — health concerns, products, preferences stored per customer</p>
          </div>
        ) : memLoading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}><div className="spinner"/></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>🧠 AI Memory — {selected.name || selected.phone}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                Phone: {selected.phone} · Lead since: {new Date(selected.created_at).toLocaleDateString('en-IN')}
              </div>

              {!memory || Object.keys(memory).length === 0 ? (
                <div style={{ color: 'var(--text2)', fontSize: 13 }}>
                  No memory yet. AI builds memory automatically as customer conversations happen.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {memory.health_concerns?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>HEALTH CONCERNS</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {memory.health_concerns.map(c => (
                          <span key={c} className="badge badge-red">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {memory.products_recommended?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>PRODUCTS RECOMMENDED</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {memory.products_recommended.map(p => (
                          <span key={p} className="badge badge-green">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {memory.order_history?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>ORDER HISTORY</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {memory.order_history.map((o, i) => (
                          <span key={i} className="badge badge-orange">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {memory.preferences && Object.keys(memory.preferences).length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>PREFERENCES</div>
                      <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                        {Object.entries(memory.preferences).map(([k, v]) => (
                          <div key={k}><span style={{ color: 'var(--text2)' }}>{k}:</span> {v}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {memory.conversation_summary && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>LAST SUMMARY</div>
                      <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.6 }}>
                        {memory.conversation_summary}
                      </div>
                    </div>
                  )}
                  {memory.last_updated && (
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                      Last updated: {new Date(memory.last_updated).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const TABS = [
  { key: 'ai', label: '✨ AI Auto-Reply' },
  { key: 'knowledge', label: '📚 Knowledge Base' },
  { key: 'memory', label: '🧠 Customer Memory' },
  { key: 'rules', label: '🤖 Reply Rules' },
  { key: 'stages', label: '📊 Lead Stages' },
  { key: 'users', label: '👥 Team Members' },
  { key: 'hours', label: '🕐 Office Hours' },
]

export default function Settings() {
  const [tab, setTab] = useState('ai')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'ai' && <AITab />}
      {tab === 'knowledge' && <KnowledgeTab />}
      {tab === 'memory' && <MemoryTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'stages' && <StagesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'hours' && <OfficeHoursTab />}
    </div>
  )
}
