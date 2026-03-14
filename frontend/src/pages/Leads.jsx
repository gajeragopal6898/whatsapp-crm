import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useSocket } from '../hooks/useSocket'
import toast from 'react-hot-toast'

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
    } catch { toast.error('Failed to update stage') }
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

  const formatTime = (d) => {
    const date = new Date(d)
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  if (!lead) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"/></div>

  let lastDate = ''

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>← Back</button>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--bg3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, color: 'var(--primary)'
        }}>{(lead.name || lead.phone)?.[0]?.toUpperCase()}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{lead.name || 'Unknown'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.phone}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* AI Pause Button */}
          <button
            onClick={async () => {
              try {
                const newVal = !lead.ai_paused
                await api.patch(`/leads/${id}`, { ai_paused: newVal })
                setLead(prev => ({ ...prev, ai_paused: newVal }))
                toast.success(newVal ? '⏸️ AI paused — you can chat manually' : '▶️ AI resumed')
              } catch { toast.error('Failed') }
            }}
            className={`btn btn-sm ${lead.ai_paused ? 'btn-success' : 'btn-ghost'}`}
            title={lead.ai_paused ? 'AI is paused — click to resume' : 'Click to pause AI for this customer'}
          >
            {lead.ai_paused ? '▶️ Resume AI' : '⏸️ Pause AI'}
          </button>
          <select className="input" style={{ width: 160 }} value={lead.stage_id || ''}
            onChange={e => updateStage(e.target.value)}>
            <option value="">No stage</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Chat */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 600 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>💬 Conversation ({messages.length} messages)</span>
            {lead.ai_paused && (
              <span className="badge badge-orange">⏸️ AI Paused — Agent Mode</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                      <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)',
                        padding: '2px 10px', borderRadius: 99 }}>{dateStr}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: msg.direction === 'outgoing' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '72%', padding: '8px 12px', borderRadius: 12,
                      background: msg.direction === 'outgoing' ? 'var(--primary)' : 'var(--bg3)',
                      color: 'var(--text)', fontSize: 13, lineHeight: 1.5,
                      borderBottomRightRadius: msg.direction === 'outgoing' ? 3 : 12,
                      borderBottomLeftRadius: msg.direction === 'incoming' ? 3 : 12,
                    }}>
                      {msg.content}
                      <div style={{ fontSize: 10, color: msg.direction === 'outgoing' ? 'rgba(255,255,255,.6)' : 'var(--text2)',
                        marginTop: 4, textAlign: 'right' }}>{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </div>
          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Type a message..." value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} />
            <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
              {sending ? <span className="spinner" style={{width:14,height:14}}/> : '➤'}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Info */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>📋 Lead Info</div>
            {[
              ['Phone', lead.phone],
              ['Source', 'WhatsApp'],
              ['Messages', lead.message_count],
              ['Created', new Date(lead.created_at).toLocaleDateString('en-IN')],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text2)' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v || '—'}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>📝 Notes</span>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }}
                onClick={() => setEditNote(!editNote)}>
                {editNote ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editNote ? (
              <>
                <textarea className="input" rows={4} value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Add notes about this lead..." style={{ resize: 'vertical', marginBottom: 8 }}/>
                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={saveNote}>Save Note</button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: note ? 'var(--text)' : 'var(--text2)', lineHeight: 1.6 }}>
                {note || 'No notes yet. Click Edit to add.'}
              </p>
            )}
          </div>

          {/* Follow-up */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>⏰ Follow-up</div>
            <input className="input" type="datetime-local" value={followUp}
              onChange={e => setFollowUp(e.target.value)} style={{ marginBottom: 8 }}/>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={saveFollowUp}>
              Set Follow-up
            </button>
            {lead.follow_up_at && (
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6, textAlign: 'center' }}>
                Scheduled: {new Date(lead.follow_up_at).toLocaleString('en-IN')}
              </div>
            )}
          </div>

          {/* AI Memory Panel */}
          <AIMemoryPanel phone={lead.phone} />
        </div>
      </div>
    </div>
  )
}

function AIMemoryPanel({ phone }) {
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!phone) return
    api.get(`/ai/memory/${phone}`).then(r => setMemory(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [phone])

  if (loading) return null
  if (!memory || Object.keys(memory).length === 0) return null

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>🧠 AI Memory</div>
      {memory.health_concerns?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>HEALTH CONCERNS</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {memory.health_concerns.map(c => <span key={c} className="badge badge-red" style={{ fontSize: 10 }}>{c}</span>)}
          </div>
        </div>
      )}
      {memory.products_recommended?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>PRODUCTS RECOMMENDED</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {memory.products_recommended.map(p => <span key={p} className="badge badge-green" style={{ fontSize: 10 }}>{p}</span>)}
          </div>
        </div>
      )}
      {memory.conversation_summary && (
        <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, background: 'var(--bg3)', padding: '6px 8px', borderRadius: 6 }}>
          {memory.conversation_summary}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 6 }}>
        Memory valid for 30 days · Last updated: {memory.last_updated ? new Date(memory.last_updated).toLocaleDateString('en-IN') : 'Never'}
      </div>
    </div>
  )
    </div>
  )
}
