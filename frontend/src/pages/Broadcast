import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'

const FILTER_TYPES = [
  { value: 'manual', label: '✋ Manual Selection' },
  { value: 'date_range', label: '📅 Date Range' },
  { value: 'stage', label: '📊 By Stage' },
  { value: 'product', label: '💊 By Product Recommended' },
  { value: 'no_reply', label: '🔇 No Reply in X Days' },
  { value: 'ai_tag', label: '🤖 AI Tag Filter' },
]

const PRODUCTS = [
  'Manoveda','ShayanVeda','Shiroveda','Smritiveda','Allergy-GO',
  'Immuno Plus','Shwasveda','Hridayaveda','RaktaSneha','GlucoVeda',
  'MedoharMukta','Poshakveda','Agnimukta','Rechaka Veda','GudaShanti',
  'Yakritshuddhi','Raktaveda','AcnoVeda','NikharVeda','RomaVardhak',
  'Feminoveda','Ritushanti','Lohaveda','Vajraveda','Manomukta',
  'Sandhiveda','GO_Lith','Satvik Multivita','Ashwagandha','Shilajit Cap',
  'Brahmi','Moringa','Neem','Musli','Ishabgool','Tripha'
]

const STAGES = ['New', 'Contacted', 'Qualified', 'Closed']
const AI_TAGS = ['interested', 'not_interested', 'ordered']

// ─── TAB: New Broadcast ────────────────────────────────────────────────────────
function NewBroadcast({ onSaved }) {
  const [step, setStep] = useState(1) // 1=filter, 2=compose, 3=preview
  const [filterType, setFilterType] = useState('manual')
  const [filterData, setFilterData] = useState({})
  const [leads, setLeads] = useState([])
  const [selectedLeads, setSelectedLeads] = useState([])
  const [filtering, setFiltering] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setBroadcastName] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState('')
  const [gettingSuggestions, setGettingSuggestions] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(null)

  useSocket({
    'broadcast:progress': (data) => setProgress(data)
  })

  const runFilter = async () => {
    setFiltering(true)
    try {
      const { data } = await api.post('/broadcast/filter', { filter_type: filterType, filter_data: filterData })
      setLeads(data.leads || [])
      setSelectedLeads(data.leads?.map(l => l.id) || [])
      toast.success(`Found ${data.total} matching contacts`)
      setStep(2)
    } catch (e) { toast.error(e.response?.data?.error || 'Filter failed') }
    finally { setFiltering(false) }
  }

  const getAISuggestions = async () => {
    setGettingSuggestions(true)
    try {
      const { data } = await api.post('/broadcast/ai-message', {
        context: filterType === 'product' ? `Follow-up for ${filterData.product}` :
                 filterType === 'no_reply' ? 'Re-engage inactive customer' :
                 'General follow-up',
        tone: 'Friendly and helpful',
        product: filterData.product || ''
      })
      setAiSuggestions(data.suggestions)
    } catch (e) { toast.error('AI suggestions failed') }
    finally { setGettingSuggestions(false) }
  }

  const sendNow = async () => {
    if (!message.trim()) return toast.error('Please write a message')
    if (selectedLeads.length === 0) return toast.error('No contacts selected')
    setSending(true)
    setProgress({ sent: 0, failed: 0, total: selectedLeads.length })
    try {
      const recipients = leads.filter(l => selectedLeads.includes(l.id)).map(l => ({ phone: l.phone, name: l.name }))
      const { data: broadcast } = await api.post('/broadcast', {
        name: name || `Broadcast ${new Date().toLocaleDateString('en-IN')}`,
        message, filter_type: filterType, filter_data: filterData,
        recipients, scheduled_at: scheduledAt || null
      })
      if (!scheduledAt) {
        await api.post(`/broadcast/${broadcast.id}/send`)
        toast.success(`Sent to ${selectedLeads.length} contacts!`)
        onSaved()
      } else {
        toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}`)
        onSaved()
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Send failed') }
    finally { setSending(false) }
  }

  return (
    <div>
      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['1. Filter Contacts', '2. Compose Message', '3. Review & Send'].map((s, i) => (
          <div key={i} style={{
            padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
            background: step === i+1 ? 'var(--primary)' : step > i+1 ? 'var(--green)' : 'var(--bg3)',
            color: step >= i+1 ? '#fff' : 'var(--text2)', cursor: step > i+1 ? 'pointer' : 'default'
          }} onClick={() => step > i+1 && setStep(i+1)}>{s}</div>
        ))}
      </div>

      {/* STEP 1 — Filter */}
      {step === 1 && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>🎯 Select Target Audience</div>

          <div className="form-row">
            <label className="label">Filter Type</label>
            <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setFilterData({}) }}>
              {FILTER_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {filterType === 'date_range' && (
            <div className="form-grid">
              <div className="form-row">
                <label className="label">From Date</label>
                <input className="input" type="date" value={filterData.from || ''}
                  onChange={e => setFilterData(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="label">To Date</label>
                <input className="input" type="date" value={filterData.to || ''}
                  onChange={e => setFilterData(f => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
          )}

          {filterType === 'stage' && (
            <div className="form-row">
              <label className="label">Stage</label>
              <select className="input" value={filterData.stage || ''} onChange={e => setFilterData({ stage: e.target.value })}>
                <option value="">Select stage...</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {filterType === 'product' && (
            <div className="form-row">
              <label className="label">Product</label>
              <select className="input" value={filterData.product || ''} onChange={e => setFilterData({ product: e.target.value })}>
                <option value="">Select product...</option>
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {filterType === 'no_reply' && (
            <div className="form-row">
              <label className="label">No reply for how many days?</label>
              <select className="input" value={filterData.days || 3} onChange={e => setFilterData({ days: +e.target.value })}>
                {[1,2,3,5,7,14,30].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
          )}

          {filterType === 'ai_tag' && (
            <div className="form-row">
              <label className="label">AI Tag</label>
              <select className="input" value={filterData.tag || ''} onChange={e => setFilterData({ tag: e.target.value })}>
                <option value="">Select tag...</option>
                <option value="interested">Interested in buying</option>
                <option value="not_interested">Not interested</option>
                <option value="ordered">Placed order</option>
              </select>
            </div>
          )}

          <button className="btn btn-primary" onClick={runFilter} disabled={filtering} style={{ width: '100%' }}>
            {filtering ? <><span className="spinner" style={{width:14,height:14}}/> Filtering...</> : '🔍 Find Contacts →'}
          </button>
        </div>
      )}

      {/* STEP 2 — Compose */}
      {step === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>✍️ Write Message</div>

            <div className="form-row">
              <label className="label">Broadcast Name</label>
              <input className="input" value={name} onChange={e => setBroadcastName(e.target.value)}
                placeholder={`Follow-up ${new Date().toLocaleDateString('en-IN')}`} />
            </div>

            <div className="form-row">
              <label className="label">Message *</label>
              <textarea className="input" rows={6} value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Type your message here... Use {name} to personalize with customer name"
                style={{ resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                {message.length} characters · {selectedLeads.length} recipients
              </div>
            </div>

            <div className="form-row">
              <label className="label">Schedule (optional — leave empty to send now)</label>
              <input className="input" type="datetime-local" value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}
                disabled={!message.trim()}>
                Preview & Send →
              </button>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>✨ AI Message Suggestions</div>
              <button className="btn btn-ghost btn-sm" onClick={getAISuggestions} disabled={gettingSuggestions}>
                {gettingSuggestions ? <span className="spinner" style={{width:12,height:12}}/> : '✨ Generate'}
              </button>
            </div>
            {aiSuggestions ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 12 }}>
                  {aiSuggestions}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  Click on any suggestion to use it as your message
                </div>
                {aiSuggestions.split('\n').filter(l => l.match(/^[123]\./)).map((line, i) => (
                  <button key={i} className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 4, textAlign: 'left', whiteSpace: 'normal', height: 'auto', padding: '6px 10px' }}
                    onClick={() => setMessage(line.replace(/^[123]\.\s*/, '').trim())}>
                    {line}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text2)', fontSize: 13 }}>
                Click "✨ Generate" to get AI-written follow-up message suggestions based on your filter context.
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3 — Preview & Send */}
      {step === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          {/* Contact list */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>
                👥 {selectedLeads.length} of {leads.length} contacts selected
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLeads(leads.map(l => l.id))}>All</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLeads([])}>None</button>
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {leads.map(lead => (
                <div key={lead.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: selectedLeads.includes(lead.id) ? 'var(--bg3)' : 'transparent'
                }} onClick={() => setSelectedLeads(prev =>
                  prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id]
                )}>
                  <input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => {}}
                    style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--bg2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0
                  }}>{(lead.name || lead.phone)?.[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.name || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{lead.phone}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>{lead.match_reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary & Send */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>📋 Message Preview</div>
              <div style={{
                background: 'var(--bg3)', borderRadius: 10, padding: '10px 14px',
                fontSize: 13, lineHeight: 1.6, color: 'var(--text)', marginBottom: 12
              }}>{message}</div>
              {scheduledAt && (
                <div className="badge badge-orange" style={{ marginBottom: 12, display: 'block' }}>
                  ⏰ Scheduled: {new Date(scheduledAt).toLocaleString('en-IN')}
                </div>
              )}
            </div>

            {/* Progress */}
            {progress && (
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>📤 Sending...</div>
                <div style={{ background: 'var(--bg3)', borderRadius: 99, height: 6, marginBottom: 6 }}>
                  <div style={{
                    height: '100%', borderRadius: 99, background: 'var(--green)',
                    width: `${(progress.sent / progress.total) * 100}%`, transition: 'width .3s'
                  }}/>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Sent: {progress.sent} · Failed: {progress.failed} · Total: {progress.total}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Edit Message</button>
              <button className="btn btn-primary" onClick={sendNow}
                disabled={sending || selectedLeads.length === 0}
                style={{ justifyContent: 'center' }}>
                {sending ? <><span className="spinner" style={{width:14,height:14}}/> Sending...</>
                  : scheduledAt ? `⏰ Schedule for ${selectedLeads.length} contacts`
                  : `📤 Send Now to ${selectedLeads.length} contacts`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Broadcast History ───────────────────────────────────────────────────
function BroadcastHistory() {
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/broadcast').then(r => setBroadcasts(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const statusBadge = (s) => {
    const map = { sent: 'badge-green', sending: 'badge-orange', scheduled: 'badge-blue', failed: 'badge-red', draft: 'badge-gray' }
    return map[s] || 'badge-gray'
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : broadcasts.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📤</div>
          <div style={{ fontWeight: 600 }}>No broadcasts yet</div>
          <p>Create your first broadcast to send messages to multiple customers</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Message</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td style={{ maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text2)' }}>
                      {b.message}
                    </div>
                  </td>
                  <td>{b.total_count}</td>
                  <td>
                    {b.status === 'sent' ? (
                      <span style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--green)' }}>✓ {b.sent_count}</span>
                        {b.failed_count > 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>✗ {b.failed_count}</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td><span className={`badge ${statusBadge(b.status)}`}>{b.status}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {b.sent_at ? new Date(b.sent_at).toLocaleDateString('en-IN')
                     : b.scheduled_at ? `⏰ ${new Date(b.scheduled_at).toLocaleString('en-IN')}`
                     : new Date(b.created_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── TAB: Auto Follow-up Rules ────────────────────────────────────────────────
function FollowupRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', trigger_days: 3, message: '', filter_stage: '', is_active: true })

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/broadcast/followup-rules'); setRules(data) }
    catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name || !form.message) return toast.error('Name and message required')
    try {
      await api.post('/broadcast/followup-rules', form)
      toast.success('Rule created!')
      setShowModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const toggle = async (rule) => {
    await api.patch(`/broadcast/followup-rules/${rule.id}`, { is_active: !rule.is_active })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
  }

  const del = async (id) => {
    if (!confirm('Delete this rule?')) return
    await api.delete(`/broadcast/followup-rules/${id}`)
    load()
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>⚙️ Auto Follow-up Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Automatically send follow-up messages based on inactivity
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ name: '', trigger_days: 3, message: '', filter_stage: '', is_active: true }); setShowModal(true) }}>
          + New Rule
        </button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : rules.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🤖</div>
          <div style={{ fontWeight: 600 }}>No auto follow-up rules</div>
          <p>Create rules to automatically follow up with inactive customers</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map(rule => (
            <div key={rule.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button className={`toggle ${rule.is_active ? 'on' : ''}`} onClick={() => toggle(rule)} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{rule.name}</span>
                    <span className="badge badge-blue">After {rule.trigger_days} days inactive</span>
                    {rule.filter_stage && <span className="badge badge-gray">Stage: {rule.filter_stage}</span>}
                    {!rule.is_active && <span className="badge badge-red">Disabled</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', padding: '6px 10px', borderRadius: 6 }}>
                    {rule.message}
                  </div>
                  {rule.last_run && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                      Last run: {new Date(rule.last_run).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => del(rule.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">New Auto Follow-up Rule</div>
            <div className="form-row">
              <label className="label">Rule Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 3-Day No Reply Follow-up" />
            </div>
            <div className="form-row">
              <label className="label">Trigger After (days of inactivity)</label>
              <select className="input" value={form.trigger_days} onChange={e => setForm(f => ({ ...f, trigger_days: +e.target.value }))}>
                {[1,2,3,5,7,14,30].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="label">Only for Stage (optional)</label>
              <select className="input" value={form.filter_stage} onChange={e => setForm(f => ({ ...f, filter_stage: e.target.value }))}>
                <option value="">All stages</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="label">Follow-up Message *</label>
              <textarea className="input" rows={4} value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Namaste! Dhwakat Herbal taraf thi aapko yaad kari raha hu. Aapni koi health problem che to batavo..."
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Broadcast Page ──────────────────────────────────────────────────────
const TABS = [
  { key: 'new', label: '📤 New Broadcast' },
  { key: 'history', label: '📋 History' },
  { key: 'followup', label: '⚙️ Auto Follow-up Rules' },
]

export default function Broadcast() {
  const [tab, setTab] = useState('new')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Broadcast & Follow-up</h1>
      </div>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'new' && <NewBroadcast onSaved={() => setTab('history')} />}
      {tab === 'history' && <BroadcastHistory />}
      {tab === 'followup' && <FollowupRules />}
    </div>
  )
}
