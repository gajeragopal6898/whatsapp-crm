import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { useState, useEffect } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [waStatus, setWaStatus] = useState(false)
  const [unread, setUnread] = useState(0)

  useSocket({
    'whatsapp:connected': () => { setWaStatus(true); toast.success('WhatsApp Connected!') },
    'whatsapp:disconnected': () => { setWaStatus(false); toast.error('WhatsApp Disconnected') },
    'lead:new': (lead) => {
      setUnread(n => n + 1)
      toast(`New lead: ${lead.name || lead.phone}`, { icon: '👤' })
    },
    'message:new': (msg) => {
      if (msg.direction === 'incoming') setUnread(n => n + 1)
    }
  })

  useEffect(() => {
    api.get('/whatsapp/status').then(r => setWaStatus(r.data.isConnected)).catch(() => {})
    api.get('/leads?limit=1').then(r => {}).catch(() => {})
  }, [])

  const navItems = [
    { to: '/', icon: '⬛', label: 'Dashboard', exact: true },
    { to: '/leads', icon: '👥', label: 'Leads', badge: unread > 0 ? unread : null },
    { to: '/settings', icon: '⚙️', label: 'Settings' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: '#1a3a1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}>💬</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>WA CRM</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Lead Manager</div>
            </div>
          </div>
        </div>

        {/* WA Status */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: waStatus ? 'var(--green)' : 'var(--red)',
              boxShadow: waStatus ? '0 0 6px var(--green)' : 'none'
            }}/>
            <span style={{ color: waStatus ? 'var(--green)' : 'var(--text2)' }}>
              {waStatus ? 'WhatsApp Connected' : 'Not Connected'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                color: isActive ? 'var(--text)' : 'var(--text2)',
                background: isActive ? 'var(--bg3)' : 'transparent',
                transition: 'all .15s', position: 'relative'
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--red)', color: '#fff',
                  borderRadius: 99, padding: '1px 6px', fontSize: 11, fontWeight: 700
                }}>{item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--primary)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff'
            }}>{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}
            onClick={() => { logout(); navigate('/login') }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <div style={{ padding: 28, maxWidth: 1200 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
