import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [waStatus, setWaStatus] = useState({ isConnected: false, qrCodeData: null });
  const [followUps, setFollowUps] = useState([]);

  const loadData = () => {
    api.get('/leads/stats/summary').then(r => setStats(r.data)).catch(() => {});
    api.get('/whatsapp/status').then(r => setWaStatus(r.data)).catch(() => {});
    api.get('/leads?page=1&limit=5').then(r => {
      const due = r.data.data?.filter(l => l.follow_up_at && !l.follow_up_done && new Date(l.follow_up_at) <= new Date());
      setFollowUps(due || []);
    }).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  useSocket((event, data) => {
    if (event === 'whatsapp:qr') setWaStatus({ isConnected: false, qrCodeData: data.qr });
    if (event === 'whatsapp:ready') setWaStatus({ isConnected: true, qrCodeData: null });
    if (event === 'whatsapp:disconnected') setWaStatus({ isConnected: false, qrCodeData: null });
    if (event === 'lead:new') loadData();
  });

  const statCards = [
    { label: 'Total Leads', value: stats?.total || 0, icon: '👥', color: '#3b82f6' },
    { label: 'New Today', value: stats?.newToday || 0, icon: '✨', color: 'var(--accent)' },
    { label: 'Unread Messages', value: stats?.unread || 0, icon: '💬', color: '#f59e0b' },
    { label: 'Follow-ups Due', value: stats?.followUps || 0, icon: '⏰', color: '#ef4444' },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h2>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map(card => (
          <div key={card.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: `${card.color}20`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 22, flexShrink: 0
            }}>{card.icon}</div>
            <div>
              <div style={{ fontSize: 28, fontFamily: 'Syne', fontWeight: 800 }}>{card.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* WhatsApp Connection */}
        <div className="card">
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16, fontSize: 16 }}>
            📱 WhatsApp Connection
          </h3>
          {waStatus.isConnected ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(37,211,102,0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 12px'
              }}>✅</div>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 16 }}>Connected!</div>
              <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 6 }}>WhatsApp is active and listening for messages</div>
            </div>
          ) : waStatus.qrCodeData ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>
                Scan this QR code with WhatsApp on your phone
              </p>
              <img src={waStatus.qrCodeData} alt="QR Code"
                style={{ width: 200, height: 200, borderRadius: 12, border: '4px solid var(--border)' }} />
              <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 12 }}>
                WhatsApp → Settings → Linked Devices → Link a Device
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <div style={{ color: 'var(--text2)', fontSize: 14 }}>Waiting for WhatsApp to initialize...</div>
              <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 8 }}>QR code will appear shortly</div>
            </div>
          )}
        </div>

        {/* Lead stages */}
        <div className="card">
          <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16, fontSize: 16 }}>
            📈 Leads by Stage
          </h3>
          {stats?.byStage?.map(stage => (
            <div key={stage.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
                  {stage.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{stage.count}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: stage.color, borderRadius: 3,
                  width: stats.total > 0 ? `${(stage.count / stats.total) * 100}%` : '0%',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>
          ))}
          {(!stats?.byStage || stats.byStage.length === 0) && (
            <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data yet</div>
          )}
        </div>

        {/* Follow-ups */}
        {followUps.length > 0 && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: 16, fontSize: 16 }}>
              ⏰ Pending Follow-ups
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {followUps.map(lead => (
                <div key={lead.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.2)'
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{lead.name || lead.phone}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                      Due: {new Date(lead.follow_up_at).toLocaleString()}
                    </div>
                  </div>
                  <a href={`/leads/${lead.id}`} className="btn btn-sm btn-secondary">View Lead</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
