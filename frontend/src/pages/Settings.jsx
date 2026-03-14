import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'

// All product names matching backend list
const ALL_PRODUCTS = [
  'Manoveda','ShayanVeda','Shiroveda','Manomukta',
  'Smritiveda','Immuno Plus','Shwasveda','Allergy-GO',
  'Hridayaveda','RaktaSneha','GlucoVeda',
  'MedoharMukta','Poshakveda',
  'Agnimukta','Rechaka Veda','Yakritshuddhi','Raktaveda','GudaShanti',
  'Sandhiveda',
  'RomaVardhak','AcnoVeda','NikharVeda',
  'Feminoveda','Ritushanti','Lohaveda','Vajraveda',
  'Satvik Multivita','GO_Lith',
  'Ashwagandha','Shilajit Cap','Amla','Brahmi','Neem','Musli',
  'Isabgool','Harad','Moringa','Triphala',
]

// ─── Media Tab ────────────────────────────────────────────────────────────────
function MediaTab() {
  const [mediaMap, setMediaMap]       = useState({})   // { productName: { image_url, video_url } }
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState({})   // { 'ProductName_image': true }
  const [search, setSearch]           = useState('')
  const fileRefs = useRef({})

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/media')
      const map = {}
      ;(data || []).forEach(m => { map[m.product_name] = m })
      setMediaMap(map)
    } catch { toast.error('Failed to load media') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (productName, mediaType, file) => {
    if (!file) return
    const key = `${productName}_${mediaType}`
    setUploading(u => ({ ...u, [key]: true }))
    try {
      // Read file as base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })

      const { data } = await api.post('/media/upload', {
        productName,
        mediaType,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
      })

      setMediaMap(m => ({ ...m, [productName]: data.media }))
      toast.success(`${mediaType === 'image' ? '📸 Image' : '🎥 Video'} uploaded for ${productName}!`)
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setUploading(u => ({ ...u, [key]: false }))
    }
  }

  const handleDelete = async (productName, mediaType) => {
    if (!confirm(`Delete ${mediaType} for ${productName}?`)) return
    try {
      await api.delete(`/media/${productName}/${mediaType}`)
      setMediaMap(m => {
        const updated = { ...m }
        if (updated[productName]) {
          updated[productName] = {
            ...updated[productName],
            [`${mediaType}_url`]: null,
            [`${mediaType}_path`]: null,
          }
        }
        return updated
      })
      toast.success('Deleted!')
    } catch { toast.error('Delete failed') }
  }

  const filtered = ALL_PRODUCTS.filter(p =>
    p.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📦 Product Media</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Upload an image and/or video for each product. After AI recommends a product,
          the image and video will be sent <strong>automatically</strong> to the customer on WhatsApp.
        </p>
        <input
          className="input"
          placeholder="🔍 Search product..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(product => {
            const media     = mediaMap[product] || {}
            const imgKey    = `${product}_image`
            const vidKey    = `${product}_video`
            const imgLoading = uploading[imgKey]
            const vidLoading = uploading[vidKey]

            return (
              <div key={product} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

                  {/* Product name */}
                  <div style={{ minWidth: 160, fontWeight: 600, fontSize: 14 }}>{product}</div>

                  {/* IMAGE slot */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                    {media.image_url ? (
                      <>
                        <img
                          src={media.image_url}
                          alt={product}
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                        />
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✅ Image uploaded</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                              onClick={() => fileRefs.current[imgKey]?.click()}
                            >Replace</button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px', color: 'var(--red)' }}
                              onClick={() => handleDelete(product, 'image')}
                            >Delete</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12, border: '1px dashed var(--border)', padding: '8px 14px' }}
                        onClick={() => fileRefs.current[imgKey]?.click()}
                        disabled={imgLoading}
                      >
                        {imgLoading ? '⏳ Uploading...' : '📸 Upload Image'}
                      </button>
                    )}
                    <input
                      ref={el => fileRefs.current[imgKey] = el}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleUpload(product, 'image', e.target.files[0])}
                    />
                  </div>

                  {/* VIDEO slot */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                    {media.video_url ? (
                      <>
                        <div style={{
                          width: 48, height: 48, borderRadius: 8,
                          background: 'var(--bg3)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22
                        }}>🎥</div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✅ Video uploaded</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                              onClick={() => fileRefs.current[vidKey]?.click()}
                            >Replace</button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px', color: 'var(--red)' }}
                              onClick={() => handleDelete(product, 'video')}
                            >Delete</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12, border: '1px dashed var(--border)', padding: '8px 14px' }}
                        onClick={() => fileRefs.current[vidKey]?.click()}
                        disabled={vidLoading}
                      >
                        {vidLoading ? '⏳ Uploading...' : '🎥 Upload Video'}
                      </button>
                    )}
                    <input
                      ref={el => fileRefs.current[vidKey] = el}
                      type="file"
                      accept="video/*"
                      style={{ display: 'none' }}
                      onChange={e => handleUpload(product, 'video', e.target.files[0])}
                    />
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
function Settings() {
  const [tab, setTab] = useState('media')

  const tabs = [
    { id: 'media',    label: '📦 Product Media' },
    { id: 'ai',       label: '🤖 AI Auto-Reply' },
    { id: 'rules',    label: '⚡ Auto Rules' },
    { id: 'stages',   label: '🏷️ Lead Stages' },
    { id: 'hours',    label: '🕒 Office Hours' },
    { id: 'account',  label: '👤 Account' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--text2)',
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'media'   && <MediaTab />}
      {tab === 'ai'      && <AITab />}
      {tab === 'rules'   && <RulesTab />}
      {tab === 'stages'  && <StagesTab />}
      {tab === 'hours'   && <HoursTab />}
      {tab === 'account' && <AccountTab />}
    </div>
  )
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────
function AITab() {
  const [settings, setSettings] = useState({ enabled: false, mode: 'auto', businessContext: '' })
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testMsg, setTestMsg]   = useState('')
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data?.ai_settings) setSettings(r.data.ai_settings)
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings/ai_settings', settings)
      toast.success('AI settings saved!')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  const test = async () => {
    if (!testMsg.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/ai/test', { message: testMsg, businessContext: settings.businessContext })
      setTestResult(data)
    } catch (err) {
      setTestResult({ error: err.response?.data?.error || err.message })
    } finally { setTesting(false) }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🤖 AI Auto-Reply</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.enabled}
            onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))} />
          <span style={{ fontWeight: 600 }}>Enable AI Auto-Reply</span>
        </label>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Business Context</label>
          <textarea className="input" rows={6}
            placeholder="Enter your business info, special instructions for AI..."
            value={settings.businessContext || ''}
            onChange={e => setSettings(s => ({ ...s, businessContext: e.target.value }))}
            style={{ width: '100%', resize: 'vertical' }} />
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save AI Settings'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🧪 Test AI Reply</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="input" placeholder="Type a test message..."
            value={testMsg} onChange={e => setTestMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && test()}
            style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={test} disabled={testing}>
            {testing ? '...' : 'Test'}
          </button>
        </div>
        {testResult && (
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, fontSize: 13 }}>
            {testResult.error
              ? <span style={{ color: 'var(--red)' }}>❌ {testResult.error}</span>
              : <><div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>via {testResult.provider} [{testResult.language}]</div>
                 <div style={{ whiteSpace: 'pre-wrap' }}>{testResult.reply}</div></>
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Placeholder tabs (keep existing logic if you have separate components) ───
function RulesTab()   { return <div className="card"><p style={{color:'var(--text2)'}}>Auto reply rules — use existing Rules component here.</p></div> }
function StagesTab()  { return <div className="card"><p style={{color:'var(--text2)'}}>Lead stages — use existing Stages component here.</p></div> }
function HoursTab()   { return <div className="card"><p style={{color:'var(--text2)'}}>Office hours — use existing Hours component here.</p></div> }
function AccountTab() { return <div className="card"><p style={{color:'var(--text2)'}}>Account settings — use existing Account component here.</p></div> }

export default Settings
