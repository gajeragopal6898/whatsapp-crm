import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stages, setStages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    api.get(`/leads/${id}`).then(r => {
      setLead(r.data.lead);
      setMessages(r.data.messages || []);
      setForm({
        name: r.data.lead?.name || '',
        stage_id: r.data.lead?.stage_id || '',
        notes: r.data.lead?.notes || '',
        follow_up_at: r.data.lead?.follow_up_at ? r.data.lead.follow_up_at.slice(0, 16) : '',
        follow_up_done: r.data.lead?.follow_up_done || false
      });
    }).catch(() => navigate('/leads'));
    api.get('/settings/stages/all').then(r => setStages(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useSocket((event, data) => {
    if (event === 'message:new' && data.lead_id === id) {
      setMessages(prev => [...prev, { ...data, created_at: new Date().toISOString() }]);
    }
  });

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await api.post('/whatsapp/send', { phone: lead.phone, message: replyText });
      setReplyText('');
      toast.success('Message sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.put(`/leads/${id}`, {
        ...form,
        follow_up_at: form.follow_up_at || null,
      });
      setLead(updated.data);
      toast.success('Lead updated!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/leads')}>← Back</button>
        <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700 }}>{lead.name || lead.phone}</h2>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{lead.phone}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, height: 'calc(100vh - 160px)' }}>
        {/* Chat */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 600 }}>💬 Conversation</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{messages.length} messages</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 14, margin: 'auto' }}>No messages yet</div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.direction === 'outgoing' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
                  background: msg.direction === 'outgoing' ? 'var(--accent)' : 'var(--bg3)',
                  color: msg.direction === 'outgoing' ? '#000' : 'var(--text)',
                  borderBottomRightRadius: msg.direction === 'outgoing' ? 4 : 12,
                  borderBottomLeftRadius: msg.direction === 'incoming' ? 4 : 12,
                }}>
                  <div>{msg.content}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {/* Reply box */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !replyText.trim()}>
              {sending ? '...' : 'Send ➤'}
            </button>
          </div>
        </div>

        {/* CRM panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16, fontSize: 15 }}>📋 Lead Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contact name" />
              </div>
              <div>
                <label>Stage</label>
                <select value={form.stage_id} onChange={e => setForm({ ...form, stage_id: e.target.value })}>
                  <option value="">Select stage</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label>Follow-up Date</label>
                <input type="datetime-local" value={form.follow_up_at}
                  onChange={e => setForm({ ...form, follow_up_at: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="fu_done" checked={form.follow_up_done}
                  onChange={e => setForm({ ...form, follow_up_done: e.target.checked })}
                  style={{ width: 16, height: 16 }} />
                <label htmlFor="fu_done" style={{ margin: 0 }}>Follow-up done</label>
              </div>
              <div>
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Add notes..." rows={4} style={{ resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 12, fontSize: 15 }}>ℹ️ Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Phone', value: lead.phone },
                { label: 'Messages', value: lead.message_count },
                { label: 'First Contact', value: new Date(lead.created_at).toLocaleDateString() },
                { label: 'Last Message', value: lead.last_message_at ? new Date(lead.last_message_at).toLocaleString() : '—' }
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>{item.label}</span>
                  <span style={{ fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
