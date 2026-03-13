import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [waStatus, setWaStatus] = useState({ isConnected: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    api.get('/whatsapp/status').then(r => setWaStatus(r.data)).catch(() => {});
    api.get('/leads/stats/summary').then(r => setUnreadCount(r.data.unread)).catch(() => {});
    api.get('/settings/notifications/all').then(r => setNotifications(r.data)).catch(() => {});
  }, []);

  useSocket((event, data) => {
    if (event === 'whatsapp:ready') setWaStatus({ isConnected: true });
    if (event === 'whatsapp:disconnected') setWaStatus({ isConnected: false });
    if (event === 'lead:new') {
      setUnreadCount(c => c + 1);
      toast.success(`New lead: ${data.name || data.phone}`);
    }
    if (event === 'notification:new') {
      api.get('/settings/notifications/all').then(r => setNotifications(r.data)).catch(() => {});
    }
  });

  const handleLogout = () => { logout(); navigate('/login'); };

  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: 'var(--accent)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}>💬</div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>WA CRM</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Lead Manager</div>
            </div>
          </div>
        </div>

        {/* WA Status */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: waStatus.isConnected ? 'var(--accent)' : 'var(--danger)',
              boxShadow: waStatus.isConnected ? '0 0 8px var(--accent)' : 'none'
            }} />
            <span style={{ color: 'var(--text2)' }}>
              {waStatus.isConnected ? 'WhatsApp Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { to: '/', icon: '📊', label: 'Dashboard', exact: true },
            { to: '/leads', icon: '👥', label: 'Leads', badge: unreadCount > 0 ? unreadCount : null },
          ].map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
                fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
                background: isActive ? 'rgba(37,211,102,0.1)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                border: isActive ? '1px solid rgba(37,211,102,0.2)' : '1px solid transparent'
              })}>
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  background: 'var(--danger)', color: '#fff',
                  borderRadius: 10, fontSize: 11, padding: '1px 7px', fontWeight: 700
                }}>{item.badge}</span>
              )}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/settings"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
                fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
                background: isActive ? 'rgba(37,211,102,0.1)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                border: isActive ? '1px solid rgba(37,211,102,0.2)' : '1px solid transparent'
              })}>
              <span>⚙️</span>
              <span>Settings</span>
            </NavLink>
          )}
        </nav>

        {/* User */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: '#000'
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
            <button onClick={handleLogout} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text2)', fontSize: 16, padding: 4
            }} title="Logout">↩</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {/* Top bar */}
        <div style={{
          height: 56, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 24px', gap: 12, position: 'sticky', top: 0, zIndex: 10
        }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotif(!showNotif)} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
              color: 'var(--text)', fontSize: 16, position: 'relative'
            }}>
              🔔
              {unreadNotifs > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: 'var(--danger)', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
                }}>{unreadNotifs}</span>
              )}
            </button>
            {showNotif && (
              <div style={{
                position: 'absolute', right: 0, top: '110%',
                width: 320, background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden', zIndex: 100,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 600 }}>Notifications</span>
                  <button className="btn btn-sm btn-secondary" onClick={() => {
                    api.put('/settings/notifications/read').then(() => {
                      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
                    });
                  }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {notifications.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>No notifications</div>
                  )}
                  {notifications.slice(0, 10).map(n => (
                    <div key={n.id} style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      background: n.is_read ? 'transparent' : 'rgba(37,211,102,0.04)',
                      cursor: 'default'
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
