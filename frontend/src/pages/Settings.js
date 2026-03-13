import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [tab, setTab] = useState('whatsapp');
  const [rules, setRules] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [officeHours, setOfficeHours] = useState({ enabled: false, start: '09:00', end: '18:00', days: [1,2,3,4,5] });
  const [newRule, setNewRule] = useState({ name: '', type: 'keyword', keywords: '', reply_text: '', is_active: true });
  const [newStage, setNewStage] = useState({ name: '', color: '#6366f1' });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [waStatus, setWaStatus] = useState({});

  useEffect(() => {
    api.get('/settings/rules/all').then(r => setRules(r.data)).catch(() => {});
    api.get('/settings/stages/all').then(r => setStages(r.data)).catch(() => {});
    api.get('/auth/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/whatsapp/status').then(r => setWaStatus(r.data)).catch(() => {});
    api.get('/settings').then(r => {
      if (r.data.office_hours) setOfficeHours(r.data.office_hours);
    }).catch(() => {});
  }, []);

  const saveOfficeHours = async () => {
    await api.put('/settings/office_hours', { value: officeHours });
    toast.success('Office hours saved!');
  };

  const addRule = async () => {
    const keywords = newRule.type === 'keyword' ? newRule.keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined;
    const res = await api.post('/settings/rules', { ...newRule, keywords });
    setRules(r => [...r, res.data]);
    setNewRule({ name: '', type: 'keyword', keywords: '', reply_text: '', is_active: true });
    toast.success('Rule added!');
  };

  const toggleRule = async (rule) => {
    const res = await api.put(`/settings/rules/${rule.id}`, { ...rule, is_active: !rule.is_active });
    setRules(r => r.map(x => x.id === rule.id ? res.data : x));
  };

  const deleteRule = async (id) => {
    await api.delete(`/settings/rules/${id}`);
    setRules(r => r.filter(x => x.id !== id));
    toast.success('Rule deleted');
  };

  const addStage = async () => {
    const res = await api.post('/settings/stages', newStage);
    setStages(s => [...s, res.data]);
    setNewStage({ name: '', color: '#6366f1' });
    toast.success('Stage added!');
  };

  const deleteStage = async (id) => {
    await api.delete(`/settings/stages/${id}`);
    setStages(s => s.filter(x => x.id !== id));
  };

  const addUser = async () => {
    const res = await api.post('/auth/users', newUser);
    setUsers(u => [...u, res.data]);
    setNewUser({ name: '', email: '', password: '', role: 'agent' });
    toast.success('User created!');
  };

  const toggleUser = async (user) => {
    const res = await api.put(`/auth/users/${user.id}`, { ...user, is_active: !user.is_active });
    setUsers(u => u.map(x => x.id === user.id ? res.data : x));
  };

  const disconnectWA = async () => {
    await api.post('/whatsapp/disconnect');
    setWaStatus({ isConnected: false });
    toast.success('WhatsApp disconnected');
  };

  const tabs = [
    { id: 'whatsapp', label: '📱 WhatsApp' },
    { id: 'rules', label: '🤖 Auto-Reply' },
    { id: 'stages', label: '📊 Stages' },
    { id: 'hours', label: '🕐 Office Hours' },
    { id: 'users', label: '👥 Users' },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>⚙️ Settings</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.2s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* WhatsApp Tab */}
      {tab === 'whatsapp' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16 }}>WhatsApp Connection</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: waStatus.isConnected ? 'var(--accent)' : 'var(--danger)' }} />
            <span>{waStatus.isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {waStatus.isConnected && (
            <button className="btn btn-danger" onClick={disconnectWA}>Disconnect WhatsApp</button>
          )}
          {!waStatus.isConnected && (
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>Go to Dashboard to scan the QR code and connect WhatsApp.</p>
          )}
        </div>
      )}

      {/* Auto-Reply Rules Tab */}
      {tab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16 }}>Add New Rule</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label>Rule Name</label><input value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} placeholder="e.g. Price Inquiry" /></div>
              <div><label>Type</label>
                <select value={newRule.type} onChange={e => setNewRule({...newRule, type: e.target.value})}>
                  <option value="keyword">Keyword</option>
                  <option value="welcome">Welcome</option>
                  <option value="away">Away</option>
                  <option value="menu">Menu</option>
                </select>
              </div>
              {newRule.type === 'keyword' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Keywords (comma separated)</label>
                  <input value={newRule.keywords} onChange={e => setNewRule({...newRule, keywords: e.target.value})} placeholder="price, cost, rate" />
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Reply Text</label>
                <textarea value={newRule.reply_text} onChange={e => setNewRule({...newRule, reply_text: e.target.value})} rows={3} placeholder="Auto reply message..." />
              </div>
            </div>
            <button className="btn btn-primary" onClick={addRule} style={{ marginTop: 12 }}>+ Add Rule</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
              <span style={{ fontFamily: 'Syne', fontWeight: 600 }}>Rules ({rules.length})</span>
            </div>
            {rules.map(rule => (
              <div key={rule.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{rule.name}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)' }}>{rule.type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>{rule.reply_text?.substring(0, 80)}...</div>
                  {rule.keywords?.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {rule.keywords.map(k => <span key={k} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--accent)20', color: 'var(--accent)' }}>{k}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleRule(rule)}
                    style={{ color: rule.is_active ? 'var(--accent)' : 'var(--text2)' }}>
                    {rule.is_active ? '✅ On' : '⭕ Off'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteRule(rule.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stages Tab */}
      {tab === 'stages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 500 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16 }}>Add Stage</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <input value={newStage.name} onChange={e => setNewStage({...newStage, name: e.target.value})} placeholder="Stage name" style={{ flex: 1 }} />
              <input type="color" value={newStage.color} onChange={e => setNewStage({...newStage, color: e.target.value})} style={{ width: 48, padding: 4 }} />
              <button className="btn btn-primary" onClick={addStage}>Add</button>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {stages.map(stage => (
              <div key={stage.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color }} />
                  <span>{stage.name}</span>
                  {stage.is_default && <span style={{ fontSize: 11, color: 'var(--text2)' }}>(default)</span>}
                </div>
                {!stage.is_default && (
                  <button className="btn btn-sm btn-danger" onClick={() => deleteStage(stage.id)}>🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Office Hours Tab */}
      {tab === 'hours' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16 }}>Office Hours</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="oh_enabled" checked={officeHours.enabled}
                onChange={e => setOfficeHours({...officeHours, enabled: e.target.checked})}
                style={{ width: 16, height: 16 }} />
              <label htmlFor="oh_enabled" style={{ margin: 0 }}>Enable office hours (sends away message outside hours)</label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label>Start Time</label><input type="time" value={officeHours.start} onChange={e => setOfficeHours({...officeHours, start: e.target.value})} /></div>
              <div><label>End Time</label><input type="time" value={officeHours.end} onChange={e => setOfficeHours({...officeHours, end: e.target.value})} /></div>
            </div>
            <div>
              <label>Working Days</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                  <button key={i} onClick={() => {
                    const days = officeHours.days.includes(i)
                      ? officeHours.days.filter(x => x !== i)
                      : [...officeHours.days, i];
                    setOfficeHours({...officeHours, days});
                  }} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: officeHours.days.includes(i) ? 'var(--accent)' : 'var(--bg3)',
                    color: officeHours.days.includes(i) ? '#000' : 'var(--text2)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500
                  }}>{d}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveOfficeHours}>💾 Save Office Hours</button>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16 }}>Add Team Member</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label>Name</label><input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Full name" /></div>
              <div><label>Email</label><input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="email@example.com" /></div>
              <div><label>Password</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="••••••••" /></div>
              <div><label>Role</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={addUser} style={{ marginTop: 12 }}>+ Add User</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {users.map(user => (
              <div key={user.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#000'
                  }}>{user.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{user.email} · {user.role}</div>
                  </div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => toggleUser(user)}
                  style={{ color: user.is_active ? 'var(--accent)' : 'var(--danger)' }}>
                  {user.is_active ? '✅ Active' : '❌ Inactive'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
