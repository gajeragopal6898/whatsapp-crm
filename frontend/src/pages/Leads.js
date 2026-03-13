import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      if (stageFilter) params.append('stage', stageFilter);
      const res = await api.get(`/leads?${params}`);
      setLeads(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/settings/stages/all').then(r => setStages(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadLeads(); }, [page, search, stageFilter]);

  useSocket((event, data) => {
    if (event === 'lead:new') setLeads(prev => [data, ...prev]);
    if (event === 'lead:updated') setLeads(prev => prev.map(l => l.id === data.id ? { ...l, ...data } : l));
  });

  const exportCSV = () => { window.open(`${process.env.REACT_APP_API_URL}/leads/export/csv`, '_blank'); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 700 }}>Leads ({total})</h2>
        <button className="btn btn-secondary" onClick={exportCSV}>📥 Export CSV</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          placeholder="🔍 Search by name or phone..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 300 }}
        />
        <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 180 }}>
          <option value="">All Stages</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Leads table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg3)' }}>
              {['Contact', 'Stage', 'Last Message', 'Follow-up', 'Date'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 12,
                  fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase',
                  letterSpacing: '0.5px', borderBottom: '1px solid var(--border)'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
                Loading...
              </td></tr>
            )}
            {!loading && leads.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
                No leads found
              </td></tr>
            )}
            {leads.map(lead => (
              <tr key={lead.id} style={{
                borderBottom: '1px solid var(--border)',
                background: !lead.is_read ? 'rgba(37,211,102,0.03)' : 'transparent',
                transition: 'background 0.15s'
              }}>
                <td style={{ padding: '14px 16px' }}>
                  <Link to={`/leads/${lead.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0
                      }}>{(lead.name || lead.phone).charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{lead.name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.phone}</div>
                      </div>
                      {!lead.is_read && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      )}
                    </div>
                  </Link>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {lead.lead_stages && (
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: `${lead.lead_stages.color}20`, color: lead.lead_stages.color,
                      border: `1px solid ${lead.lead_stages.color}40`
                    }}>{lead.lead_stages.name}</span>
                  )}
                </td>
                <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                    {lead.last_message || '—'}
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {lead.follow_up_at && !lead.follow_up_done ? (
                    <span style={{
                      fontSize: 12, color: new Date(lead.follow_up_at) <= new Date() ? 'var(--danger)' : 'var(--warning)'
                    }}>
                      {new Date(lead.follow_up_at) <= new Date() ? '🔴 ' : '🟡 '}
                      {new Date(lead.follow_up_at).toLocaleDateString()}
                    </span>
                  ) : lead.follow_up_done ? (
                    <span style={{ fontSize: 12, color: 'var(--accent)' }}>✅ Done</span>
                  ) : '—'}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text2)' }}>
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text2)' }}>
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
