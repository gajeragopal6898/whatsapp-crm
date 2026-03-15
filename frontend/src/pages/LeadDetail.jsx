import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'

// ─── AI Memory Panel ──────────────────────────────────────────────────────────
function AIMemoryPanel({ phone }) {
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!phone) return
    api.get(`/ai/memory/${phone}`)
      .then(r => setMemory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [phone])

  if (loading) return null
  if (!memory || Object.keys(memory).length === 0) return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>🧠 AI Memory</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
        No memory yet. AI builds memory automatically as conversations happen.
      </div>
    </div>
  )

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>🧠 AI Memory</div>

      {memory.health_concerns?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Health Concerns</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {memory.health_concerns.map(c => (
              <span key={c} className="badge badge-red" style={{ fontSize: 10 }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {memory.products_recommended?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Products Recommended</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {memory.products_recommended.map(p => (
              <span key={p} className="badge badge-green" style={{ fontSize: 10 }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {memory.order_history?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Order Intent</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {memory.order_history.map((o, i) => (
              <span key={i} className="badge badge-orange" style={{ fontSize: 10 }}>{o}</span>
            ))}
          </div>
        </div>
      )}

      {memory.conversation_summary && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Summary</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, background: 'var(--bg3)', padding: '6px 10px', borderRadius: 6 }}>
            {memory.conversation_summary}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4 }}>
        Memory valid 30 days · Updated: {memory.last_updated ? new Date(memory.last_updated).toLocaleDateString('en-IN') : '—'}
      </div>
    </div>
  )
}

// ─── AI Summary Panel ─────────────────────────────────────────────────────────
function AISummaryPanel({ leadId }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await api.post(`/ai/summarize/${leadId}`)
      setSummary(data.summary)
    } catch { toast.error('Failed to generate summary') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>📋 AI Summary</div>
        <button className="btn btn-ghost btn-sm" onClick={generate} disabled={loading}>
          {loading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '✨ Generate'}
        </button>
      </div>
      {summary ? (
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {summary}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          Click Generate to get an AI summary of this conversation.
        </div>
      )}
    </div>
  )
}

// ─── Main LeadDetail ──────────────────────────────────────────────────────────
export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [stages, setStages] = useState([])
  const [editNote, setEditNote] = useState(false)
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const bottomRef = useRef()

  const load = async () => {
    try {
      const [leadRes, msgsRes, stagesRes] = await Promise.all([
        api.get(`/leads/${id}`),
        api.get(`/messages/${id}`),
        api.get('/settings/stages'),
      ])
      setLead(leadRes.data)
      setNote(leadRes.data.notes || '')
      setFollowUp(leadRes.data.follow_up_at ? leadRes.data.follow_up_at.slice(0, 16) : '')
      setMessages(msgsRes.data)
      setStages(stagesRes.data)
    } catch { toast.error('Failed to load') }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useSocket({
    'message:new': (msg) => {
      if (msg.lead_id === id) setMessages(prev => [...prev, { ...msg, created_at: new Date().toISOString() }])
    }
  })

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      await api.post('/messages/send', { phone: lead.phone, text, lead_id: id })
      setText('')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send')
    } finally { setSending(false) }
  }

  const updateStage = async (stage_id) => {
    try {
      await api.patch(`/leads/${id}`, { stage_id })
      setLead(prev => ({ ...prev, stage_id, stage: stages.find(s => s.id === stage_id) }))
      toast.success('Stage updated')
    } catch { toast.error('Failed') }
  }

  const toggleAIPause = async () => {
    try {
      const newVal = !lead.ai_paused
      await api.patch(`/leads/${id}`, { ai_paused: newVal })
      setLead(prev => ({ ...prev, ai_paused: newVal }))
      toast.success(newVal ? '⏸️ AI paused — you can chat manually' : '▶️ AI resumed for this customer')
    } catch { toast.error('Failed to update AI status') }
  }

  const saveNote = async () => {
    try {
      await api.patch(`/leads/${id}`, { notes: note })
      setEditNote(false)
      toast.success('Note saved')
    } catch { toast.error('Failed') }
  }

  const saveFollowUp = async () => {
    try {
      await api.patch(`/leads/${id}`, { follow_up_at: followUp || null, follow_up_done: false })
      toast.success('Follow-up set')
    } catch { toast.error('Failed') }
  }

  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  if (!lead) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>

  let lastDate = ''

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>← Back</button>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', background: 'var(--bg3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: 'var(--primary)', flexShrink: 0
        }}>{(lead.name || lead.phone)?.[0]?.toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{lead.name || 'Unknown'}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{lead.phone}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* AI Pause / Resume Button */}
          <button
            onClick={toggleAIPause}
            className={`btn btn-sm ${lead.ai_paused ? 'btn-success' : 'btn-ghost'}`}
            style={{ border: lead.ai_paused ? 'none' : '1px solid var(--orange)', color: lead.ai_paused ? '#fff' : 'var(--orange)' }}
            title={lead.ai_paused ? 'AI is paused — click to resume' : 'Pause AI so you can reply manually'}
          >
            {lead.ai_paused ? '▶️ Resume AI' : '⏸️ Pause AI'}
          </button>
          <select className="input" style={{ width: 155 }} value={lead.stage_id || ''}
            onChange={e => updateStage(e.target.value)}>
            <option value="">No stage</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* AI Paused Banner */}
      {lead.ai_paused && (
        <div style={{
          background: '#2a1a00', border: '1px solid var(--orange)', borderRadius: 8,
          padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13
        }}>
          <span>⏸️</span>
          <span style={{ color: 'var(--orange)' }}>
            <strong>AI is paused</strong> for this customer — you are in manual mode. Click "Resume AI" to re-enable automatic replies.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 14 }}>
        {/* Chat */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 580 }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>💬 {messages.length} messages</span>
            {lead.ai_paused
              ? <span className="badge badge-orange">⏸️ Agent Mode</span>
              : <span className="badge badge-green">🤖 AI Active</span>
            }
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {messages.length === 0 ? (
              <div className="empty-state"><div className="icon">💭</div><p>No messages yet</p></div>
            ) : messages.map((msg, i) => {
              const dateStr = formatDate(msg.created_at)
              const showDate = dateStr !== lastDate
              lastDate = dateStr
              return (
                <div key={msg.id || i}>
                  {showDate && (
                    <div style={{ textAlign: 'center', margin: '8px 0' }}>
                      <span style={{
                        fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)',
                        padding: '2px 10px', borderRadius: 99
                      }}>{dateStr}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: msg.direction === 'outgoing' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '74%', padding: '7px 11px', borderRadius: 12,
                      background: msg.direction === 'outgoing' ? 'var(--primary)' : 'var(--bg3)',
                      color: 'var(--text)', fontSize: 13, lineHeight: 1.5,
                      borderBottomRightRadius: msg.direction === 'outgoing' ? 3 : 12,
                      borderBottomLeftRadius: msg.direction === 'incoming' ? 3 : 12,
                    }}>
                      {msg.content}
                      <div style={{
                        fontSize: 10, marginTop: 3, textAlign: 'right',
                        color: msg.direction === 'outgoing' ? 'rgba(255,255,255,.6)' : 'var(--text2)'
                      }}>{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder={lead.ai_paused ? "Type a message (AI paused — you're in control)" : "Type a message..."}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            />
            <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
              {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '➤'}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 620 }}>

          {/* Lead Info */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>📋 Lead Info</div>
            {[
              ['Phone', lead.phone],
              ['First Message', lead.first_message ? lead.first_message.slice(0, 40) : '—'],
              ['Lead Since', formatDate(lead.created_at)],
              ['Total Messages', lead.message_count || 0],
              ['Last Active', lead.last_message_at ? formatDate(lead.last_message_at) : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12
              }}>
                <span style={{ color: 'var(--text2)', flexShrink: 0 }}>{k}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', marginLeft: 8, wordBreak: 'break-all' }}>{String(v)}</span>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          <AISummaryPanel leadId={id} />

          {/* AI Memory */}
          <AIMemoryPanel phone={lead.phone} />

          {/* Purchase History */}
          <PurchasePanel leadId={id} phone={lead.phone} />

          {/* Flow State */}
          <FlowStatePanel phone={lead.phone} />

          {/* Notes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>📝 Notes</span>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }}
                onClick={() => setEditNote(!editNote)}>
                {editNote ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editNote ? (
              <>
                <textarea className="input" rows={3} value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add notes..." style={{ resize: 'vertical', marginBottom: 8 }} />
                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={saveNote}>Save</button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: note ? 'var(--text)' : 'var(--text2)', lineHeight: 1.6 }}>
                {note || 'No notes yet.'}
              </p>
            )}
          </div>

          {/* Follow-up */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>⏰ Follow-up</div>
            <input className="input" type="datetime-local" value={followUp}
              onChange={e => setFollowUp(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={saveFollowUp}>
              Set Follow-up
            </button>
            {lead.follow_up_at && (
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5, textAlign: 'center' }}>
                📅 {new Date(lead.follow_up_at).toLocaleString('en-IN')}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Purchase Panel ───────────────────────────────────────────────────────────
function PurchasePanel({ leadId, phone }) {
  const [purchases, setPurchases] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_name: '', quantity: '', purchase_date: new Date().toISOString().slice(0,10), course_days: 60, notes: '' })

  const PRODUCTS = ['Manoveda','ShayanVeda','Shiroveda','Smritiveda','Allergy-GO','Immuno Plus','Shwasveda',
    'Hridayaveda','RaktaSneha','GlucoVeda','MedoharMukta','Poshakveda','Agnimukta','Rechaka Veda',
    'GudaShanti','Yakritshuddhi','Raktaveda','AcnoVeda','NikharVeda','RomaVardhak','Feminoveda',
    'Ritushanti','Lohaveda','Vajraveda','Manomukta','Sandhiveda','GO_Lith','Satvik Multivita']

  useEffect(() => {
    api.get(`/purchases/lead/${leadId}`).then(r => setPurchases(r.data)).catch(() => {})
  }, [leadId])

  const save = async () => {
    if (!form.product_name) return toast.error('Select a product')
    try {
      await api.post('/purchases', { ...form, lead_id: leadId, phone })
      toast.success('Purchase recorded! Follow-up messages scheduled automatically.')
      setShowForm(false)
      const { data } = await api.get(`/purchases/lead/${leadId}`)
      setPurchases(data)
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete this purchase?')) return
    await api.delete(`/purchases/${id}`)
    setPurchases(prev => prev.filter(p => p.id !== id))
    toast.success('Deleted')
  }

  const daysSince = (date) => Math.floor((Date.now() - new Date(date)) / (1000*60*60*24))

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>🛒 Purchases</span>
        <button className="btn btn-primary btn-sm" style={{ padding: '3px 10px' }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div className="form-row">
            <label className="label">Product *</label>
            <select className="input" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}>
              <option value="">Select product...</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="label">Quantity (e.g. 200ml, 1 bottle)</label>
            <input className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="200ml" />
          </div>
          <div className="form-row">
            <label className="label">Purchase Date *</label>
            <input className="input" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          </div>
          <div className="form-row">
            <label className="label">Full Course Duration (days)</label>
            <select className="input" value={form.course_days} onChange={e => setForm(f => ({ ...f, course_days: +e.target.value }))}>
              {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={save}>
            Save Purchase & Schedule Follow-ups
          </button>
        </div>
      )}

      {purchases.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>No purchases recorded yet.</div>
      ) : purchases.map(p => {
        const days = daysSince(p.purchase_date)
        const progress = Math.min(100, (days / p.course_days) * 100)
        return (
          <div key={p.id} style={{ marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{p.product_name}</span>
              <button onClick={() => del(p.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
              {p.quantity && `${p.quantity} · `}Day {days} of {p.course_days}
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 99, height: 4, marginBottom: 4 }}>
              <div style={{ height: '100%', borderRadius: 99, background: progress >= 100 ? 'var(--green)' : 'var(--primary)', width: `${progress}%` }}/>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {p.followup_day_10_sent && <span className="badge badge-green" style={{fontSize:10}}>✓ Day 10</span>}
              {p.followup_day_45_sent && <span className="badge badge-green" style={{fontSize:10}}>✓ Day 45</span>}
              {p.followup_complete_sent && <span className="badge badge-green" style={{fontSize:10}}>✓ Complete</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Flow State Panel ─────────────────────────────────────────────────────────
function FlowStatePanel({ phone }) {
  const [state, setState] = useState(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    api.get(`/purchases/flow-state/${phone}`).then(r => setState(r.data)).catch(() => {})
  }, [phone])

  const resetFlow = async () => {
    setResetting(true)
    try {
      await api.post(`/purchases/reset-flow/${phone}`)
      setState(null)
      toast.success('Flow reset! Customer will get welcome message on next message.')
    } catch { toast.error('Failed') }
    finally { setResetting(false) }
  }

  if (!state || !state.flow_step) return null

  const stepLabels = {
    language: 'Selecting Language', health_concern: 'Choosing Health Concern',
    duration: 'Answering Duration', tried_medicine: 'Answering Medicine History',
    age_group: 'Answering Age', form_preference: 'Choosing Product Form',
    recommended: 'Product Recommended', done: 'Flow Complete',
    call_time: 'Choosing Call Time'
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>🔄 Conversation Flow</div>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--text2)' }}>Step: </span>
        <span style={{ fontWeight: 500 }}>{stepLabels[state.flow_step] || state.flow_step}</span>
      </div>
      {state.language && (
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--text2)' }}>Language: </span>
          <span>{{ gu: '🇮🇳 Gujarati', hi: '🇮🇳 Hindi', en: '🇬🇧 English' }[state.language]}</span>
        </div>
      )}
      {state.ai_mode && <span className="badge badge-purple" style={{fontSize:10, marginBottom:6, display:'block'}}>🤖 AI Mode Active</span>}
      {state.escalated && <span className="badge badge-red" style={{fontSize:10, marginBottom:6, display:'block'}}>🚨 Escalated to Agent</span>}
      {state.collected_data && Object.keys(state.collected_data).length > 0 && (
        <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '6px 8px', fontSize: 11, marginBottom: 8 }}>
          {Object.entries(state.collected_data).map(([k, v]) => (
            <div key={k} style={{ color: 'var(--text2)' }}><strong>{k}:</strong> {String(v)}</div>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: 11 }}
        onClick={resetFlow} disabled={resetting}>
        {resetting ? 'Resetting...' : '🔄 Restart Flow (send welcome again)'}
      </button>
    </div>
  )
}
