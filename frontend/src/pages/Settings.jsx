import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'ai',        label: '✨ AI Auto-Reply' },
  { key: 'media',     label: '📦 Product Media' },
  { key: 'knowledge', label: '📚 Knowledge Base' },
  { key: 'memory',    label: '🧠 Customer Memory' },
  { key: 'rules',     label: '🤖 Reply Rules' },
  { key: 'stages',    label: '📊 Lead Stages' },
  { key: 'users',     label: '👥 Team Members' },
  { key: 'hours',     label: '🕒 Office Hours' },
]

// ─── AI AUTO-REPLY TAB ────────────────────────────────────────────────────────
function AITab() {
  const [settings, setSettings] = useState({ enabled: false, mode: 'auto', businessContext: '' })
  const [apiKeys, setApiKeys]   = useState({ groq: '', gemini: '' })
  const [apiStatus, setApiStatus] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testMsg, setTestMsg]   = useState('')
  const [testResult, setTestResult] = useState(null)
  const [showGroq, setShowGroq] = useState(false)
  const [showGemini, setShowGemini] = useState(false)

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data?.ai_settings) setSettings(r.data.ai_settings)
    }).catch(() => {})
    api.get('/ai/status').then(r => setApiStatus(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings/ai_settings', settings)
      toast.success('AI settings saved!')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  const saveKeys = async () => {
    setSavingKeys(true)
    try {
      if (apiKeys.groq.trim())   await api.patch('/settings/groq_api_key',   { key: apiKeys.groq.trim() })
      if (apiKeys.gemini.trim()) await api.patch('/settings/gemini_api_key', { key: apiKeys.gemini.trim() })
      toast.success('API keys saved! Railway will use these on next deploy.')
      setApiKeys({ groq: '', gemini: '' })
      api.get('/ai/status').then(r => setApiStatus(r.data)).catch(() => {})
    } catch { toast.error('Failed to save keys') }
    finally { setSavingKeys(false) }
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
    <div style={{ maxWidth: 640 }}>

      {/* ── API Keys ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🔑 AI API Keys</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
          Groq is primary (14,400 req/day free). Gemini is fallback (1,500 req/day free). Auto-switches when one fails.
        </div>

        {/* API Status indicators */}
        {apiStatus && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { key: 'groq',   label: 'Groq API',   limit: '14,400 req/day', link: 'https://console.groq.com' },
              { key: 'gemini', label: 'Gemini API',  limit: '1,500 req/day',  link: 'https://aistudio.google.com' },
            ].map(a => (
              <div key={a.key} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px',
                border: `1px solid ${apiStatus[a.key]?.configured ? 'var(--green)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%',
                    background: apiStatus[a.key]?.configured ? 'var(--green)' : 'var(--red)' }}/>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                  <span className={`badge ${apiStatus[a.key]?.configured ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto', fontSize: 10 }}>
                    {apiStatus[a.key]?.configured ? '✅ Active' : '❌ Not Set'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                  Free: {a.limit} · <a href={a.link} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--primary)' }}>Get free key →</a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Groq key input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Groq API Key
            <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6, fontSize: 11 }}>
              — get free at console.groq.com
            </span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type={showGroq ? 'text' : 'password'}
              placeholder={apiStatus?.groq?.configured ? '••••••••••••••••  (already set)' : 'gsk_...'}
              value={apiKeys.groq}
              onChange={e => setApiKeys(k => ({ ...k, groq: e.target.value }))}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGroq(v => !v)}>
              {showGroq ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Gemini key input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Gemini API Key
            <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6, fontSize: 11 }}>
              — get free at aistudio.google.com
            </span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type={showGemini ? 'text' : 'password'}
              placeholder={apiStatus?.gemini?.configured ? '••••••••••••••••  (already set)' : 'AIza...'}
              value={apiKeys.gemini}
              onChange={e => setApiKeys(k => ({ ...k, gemini: e.target.value }))}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGemini(v => !v)}>
              {showGemini ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button className="btn btn-primary" onClick={saveKeys} disabled={savingKeys || (!apiKeys.groq && !apiKeys.gemini)}>
          {savingKeys ? 'Saving...' : 'Save API Keys'}
        </button>
      </div>

      {/* ── AI Settings ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>✨ AI Auto-Reply Settings</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!settings.enabled}
            onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))} />
          <div>
            <div style={{ fontWeight: 600 }}>Enable AI Auto-Reply</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>AI will automatically reply to every incoming WhatsApp message</div>
          </div>
        </label>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Reply Mode</label>
          <select className="input" value={settings.mode || 'auto'}
            onChange={e => setSettings(s => ({ ...s, mode: e.target.value }))}>
            <option value="auto">🤖 Auto — AI replies immediately without agent</option>
            <option value="semi">👤 Semi — Agent reviews AI reply before sending</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Business Context</label>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
            Tell AI about your business — extra instructions, special products, offers etc.
          </div>
          <textarea className="input" rows={5}
            placeholder="e.g. We offer free delivery on prepaid orders. COD available. Order on WhatsApp: 9023935773..."
            value={settings.businessContext || ''}
            onChange={e => setSettings(s => ({ ...s, businessContext: e.target.value }))}
            style={{ width: '100%', resize: 'vertical' }} />
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save AI Settings'}
        </button>
      </div>

      {/* ── Test ── */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🧪 Test AI Reply</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
          Send a test message to see how AI will reply (Gujarati / Hindi / English all work)
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="input" placeholder="e.g.  mane stress che  /  hair fall problem  /  मुझे नींद नहीं आती"
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
              : <>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>
                    via {testResult.provider} · language: {testResult.language}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{testResult.reply}</div>
                </>
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PRODUCT MEDIA TAB ────────────────────────────────────────────────────────
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

function MediaTab() {
  const [mediaMap, setMediaMap]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState({})
  const [search, setSearch]       = useState('')
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
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const { data } = await api.post('/media/upload', {
        productName, mediaType, fileBase64: base64, fileName: file.name, mimeType: file.type,
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
          updated[productName] = { ...updated[productName], [`${mediaType}_url`]: null, [`${mediaType}_path`]: null }
        }
        return updated
      })
      toast.success('Deleted!')
    } catch { toast.error('Delete failed') }
  }

  const filtered = ALL_PRODUCTS.filter(p => p.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📦 Product Media</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
          Upload image & video per product. After AI recommends a product, media is sent <strong>automatically</strong> to the customer.
        </div>
        <input className="input" placeholder="🔍 Search product..."
          value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(product => {
            const media      = mediaMap[product] || {}
            const imgKey     = `${product}_image`
            const vidKey     = `${product}_video`
            const imgLoading = uploading[imgKey]
            const vidLoading = uploading[vidKey]
            return (
              <div key={product} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 160, fontWeight: 600, fontSize: 13 }}>{product}</div>

                  {/* IMAGE */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
                    {media.image_url ? (
                      <>
                        <img src={media.image_url} alt={product}
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✅ Image</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 7px' }}
                              onClick={() => fileRefs.current[imgKey]?.click()}>Replace</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 7px', color: 'var(--red)' }}
                              onClick={() => handleDelete(product, 'image')}>Del</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, border: '1px dashed var(--border)', padding: '6px 12px' }}
                        onClick={() => fileRefs.current[imgKey]?.click()} disabled={imgLoading}>
                        {imgLoading ? '⏳...' : '📸 Image'}
                      </button>
                    )}
                    <input ref={el => fileRefs.current[imgKey] = el} type="file" accept="image/*"
                      style={{ display: 'none' }} onChange={e => handleUpload(product, 'image', e.target.files[0])} />
                  </div>

                  {/* VIDEO */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
                    {media.video_url ? (
                      <>
                        <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg3)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 20 }}>🎥</div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✅ Video</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 7px' }}
                              onClick={() => fileRefs.current[vidKey]?.click()}>Replace</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 7px', color: 'var(--red)' }}
                              onClick={() => handleDelete(product, 'video')}>Del</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, border: '1px dashed var(--border)', padding: '6px 12px' }}
                        onClick={() => fileRefs.current[vidKey]?.click()} disabled={vidLoading}>
                        {vidLoading ? '⏳...' : '🎥 Video'}
                      </button>
                    )}
                    <input ref={el => fileRefs.current[vidKey] = el} type="file" accept="video/*"
                      style={{ display: 'none' }} onChange={e => handleUpload(product, 'video', e.target.files[0])} />
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

// ─── KNOWLEDGE BASE TAB ───────────────────────────────────────────────────────
function KnowledgeTab() {
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState({ name: '', content: '', file_type: 'text' })
  const [apiStatus, setApiStatus] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [docsRes, statusRes] = await Promise.all([
        api.get('/ai/knowledge'),
        api.get('/ai/status')
      ])
      setDocs(docsRes.data)
      setApiStatus(statusRes.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) return toast.error('Name and content required')
    try {
      await api.post('/ai/knowledge', form)
      toast.success('Knowledge added!')
      setShowModal(false)
      setForm({ name: '', content: '', file_type: 'text' })
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const toggle = async (doc) => {
    try {
      await api.patch(`/ai/knowledge/${doc.id}`, { is_active: !doc.is_active })
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_active: !d.is_active } : d))
      toast.success(doc.is_active ? 'Disabled' : 'Enabled')
    } catch { toast.error('Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete this knowledge document?')) return
    try { await api.delete(`/ai/knowledge/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>AI Knowledge Base</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Upload product info, FAQs, pricing — AI learns from these documents
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Knowledge</button>
      </div>

      {apiStatus && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { key: 'groq',   label: 'Groq API',   limit: '14,400 req/day' },
            { key: 'gemini', label: 'Gemini API',  limit: '1,500 req/day'  },
          ].map(a => (
            <div key={a.key} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%',
                  background: apiStatus[a.key]?.configured ? 'var(--green)' : 'var(--red)' }}/>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                <span className={`badge ${apiStatus[a.key]?.configured ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>
                  {apiStatus[a.key]?.configured ? 'Active' : 'Not Set'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                Free limit: {a.limit} · Auto-switches when limit reached
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#1a2a1a', border: '1px solid #2a4a2a', borderRadius: 8,
        padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 3 }}>✅ Dhwakat Herbal Knowledge — Built-in</div>
        <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>
          40 products, 18+ categories, conversation scripts — all pre-loaded. Add extra documents below for additional knowledge.
        </div>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : docs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <div style={{ fontWeight: 600 }}>No extra documents yet</div>
          <p>Built-in Dhwakat Herbal knowledge is already active. Add more for extra info.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>Add Document</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {docs.map(doc => (
            <div key={doc.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className={`toggle ${doc.is_active ? 'on' : ''}`} onClick={() => toggle(doc)}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                    Type: {doc.file_type} · Added: {new Date(doc.created_at).toLocaleDateString('en-IN')}
                    {!doc.is_active && <span style={{ color: 'var(--red)', marginLeft: 8 }}>· Disabled</span>}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => del(doc.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">Add Knowledge Document</div>
            <div className="form-row">
              <label className="label">Document Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New Product List, FAQ, Pricing 2026" />
            </div>
            <div className="form-row">
              <label className="label">Type</label>
              <select className="input" value={form.file_type} onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}>
                <option value="text">Text / Notes</option>
                <option value="faq">FAQ</option>
                <option value="products">Product List</option>
                <option value="pricing">Pricing</option>
                <option value="policy">Policy / Terms</option>
              </select>
            </div>
            <div className="form-row">
              <label className="label">Content * (paste text, product info, FAQs etc.)</label>
              <textarea className="input" rows={8} value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Paste your content here. The AI will learn from this."
                style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Add to AI Knowledge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CUSTOMER MEMORY TAB ──────────────────────────────────────────────────────
function MemoryTab() {
  const [leads, setLeads]       = useState([])
  const [selected, setSelected] = useState(null)
  const [memory, setMemory]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [memLoading, setMemLoading] = useState(false)

  useEffect(() => {
    api.get('/leads?limit=50').then(r => {
      setLeads(r.data.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadMemory = async (lead) => {
    setSelected(lead)
    setMemLoading(true)
    try {
      const { data } = await api.get(`/ai/memory/${lead.phone}`)
      setMemory(data)
    } catch { setMemory({}) }
    finally { setMemLoading(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
          👥 Select Customer
        </div>
        {loading ? <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner"/></div>
         : leads.map(lead => (
          <div key={lead.id} onClick={() => loadMemory(lead)}
            style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: selected?.id === lead.id ? 'var(--bg3)' : 'transparent', transition: 'background .15s' }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.name || 'Unknown'}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{lead.phone}</div>
          </div>
        ))}
      </div>

      <div>
        {!selected ? (
          <div className="empty-state card">
            <div className="icon">🧠</div>
            <div style={{ fontWeight: 600 }}>Select a customer</div>
            <p>View AI memory — health concerns, products, preferences stored per customer</p>
          </div>
        ) : memLoading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}><div className="spinner"/></div>
        ) : (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>🧠 AI Memory — {selected.name || selected.phone}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              Phone: {selected.phone} · Lead since: {new Date(selected.created_at).toLocaleDateString('en-IN')}
            </div>
            {!memory || Object.keys(memory).length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: 13 }}>No memory yet. AI builds memory automatically from conversations.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {memory.health_concerns?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>HEALTH CONCERNS</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {memory.health_concerns.map(c => <span key={c} className="badge badge-red">{c}</span>)}
                    </div>
                  </div>
                )}
                {memory.products_recommended?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>PRODUCTS RECOMMENDED</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {memory.products_recommended.map(p => <span key={p} className="badge badge-green">{p}</span>)}
                    </div>
                  </div>
                )}
                {memory.order_history?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>ORDER HISTORY</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {memory.order_history.map((o, i) => <span key={i} className="badge badge-orange">{o}</span>)}
                    </div>
                  </div>
                )}
                {memory.preferences && Object.keys(memory.preferences).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>PREFERENCES</div>
                    <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                      {Object.entries(memory.preferences).map(([k, v]) => (
                        <div key={k}><span style={{ color: 'var(--text2)' }}>{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  </div>
                )}
                {memory.conversation_summary && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>LAST SUMMARY</div>
                    <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.6 }}>
                      {memory.conversation_summary}
                    </div>
                  </div>
                )}
                {memory.last_updated && (
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    Last updated: {new Date(memory.last_updated).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── REPLY RULES TAB ──────────────────────────────────────────────────────────
function RulesTab() {
  const [rules, setRules]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState({ type: 'keyword', keywords: '', reply_text: '', is_active: true })

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/rules'); setRules(data) }
    catch { toast.error('Failed to load rules') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ type: 'keyword', keywords: '', reply_text: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (rule) => {
    setEditing(rule)
    setForm({
      type: rule.type,
      keywords: (rule.keywords || []).join(', '),
      reply_text: rule.reply_text,
      is_active: rule.is_active,
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.reply_text.trim()) return toast.error('Reply text is required')
    const payload = {
      type: form.type,
      keywords: form.type === 'keyword' ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      reply_text: form.reply_text,
      is_active: form.is_active,
    }
    try {
      if (editing) {
        await api.patch(`/rules/${editing.id}`, payload)
        toast.success('Rule updated!')
      } else {
        await api.post('/rules', payload)
        toast.success('Rule created!')
      }
      setShowModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete this rule?')) return
    try { await api.delete(`/rules/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed') }
  }

  const toggle = async (rule) => {
    try {
      await api.patch(`/rules/${rule.id}`, { is_active: !rule.is_active })
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    } catch { toast.error('Failed') }
  }

  const typeLabel = { keyword: '🔑 Keyword', welcome: '👋 Welcome', away: '🌙 Away' }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Auto Reply Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Automatically reply when keywords match, new lead arrives, or outside office hours
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Rule</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : rules.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🤖</div>
          <div style={{ fontWeight: 600 }}>No rules yet</div>
          <p>Create welcome messages, keyword replies, and away messages</p>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>Add Rule</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map(rule => (
            <div key={rule.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button className={`toggle ${rule.is_active ? 'on' : ''}`} onClick={() => toggle(rule)} style={{ marginTop: 2 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>{typeLabel[rule.type] || rule.type}</span>
                    {rule.trigger_count > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>Triggered {rule.trigger_count} times</span>
                    )}
                    {!rule.is_active && <span className="badge badge-gray" style={{ fontSize: 11 }}>Disabled</span>}
                  </div>
                  {rule.keywords?.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                      Keywords: {rule.keywords.join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: 13, background: 'var(--bg3)', padding: '6px 10px', borderRadius: 6, lineHeight: 1.5 }}>
                    {rule.reply_text}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rule)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(rule.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-title">{editing ? 'Edit Rule' : 'Add Auto Reply Rule'}</div>
            <div className="form-row">
              <label className="label">Rule Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="keyword">Keyword Match — reply when message contains keyword</option>
                <option value="welcome">Welcome — reply to every new lead's first message</option>
                <option value="away">Away — reply when outside office hours</option>
              </select>
            </div>
            {form.type === 'keyword' && (
              <div className="form-row">
                <label className="label">Keywords (comma separated)</label>
                <input className="input" value={form.keywords}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  placeholder="e.g. price, cost, how much, order" />
              </div>
            )}
            <div className="form-row">
              <label className="label">Reply Text *</label>
              <textarea className="input" rows={4} value={form.reply_text}
                onChange={e => setForm(f => ({ ...f, reply_text: e.target.value }))}
                placeholder="Message to send automatically..." style={{ resize: 'vertical' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <span style={{ fontSize: 13 }}>Active</span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Create Rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LEAD STAGES TAB ──────────────────────────────────────────────────────────
function StagesTab() {
  const [stages, setStages]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState({ name: '', color: '#6366f1', is_default: false })

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/settings/stages'); setStages(data) }
    catch { toast.error('Failed to load stages') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm({ name: '', color: '#6366f1', is_default: false }); setShowModal(true) }
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, color: s.color || '#6366f1', is_default: s.is_default }); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim()) return toast.error('Stage name is required')
    try {
      if (editing) {
        await api.patch(`/settings/stages/${editing.id}`, form)
        toast.success('Stage updated!')
      } else {
        await api.post('/settings/stages', form)
        toast.success('Stage created!')
      }
      setShowModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const del = async (id) => {
    if (!confirm('Delete this stage?')) return
    try { await api.delete(`/settings/stages/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Failed — stage may be in use') }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Lead Stages</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            Manage pipeline stages for your leads
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Stage</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map((stage, i) => (
            <div key={stage.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color || '#6366f1', flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {stage.name}
                    {stage.is_default && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}>Default</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>Order: {stage.order_index ?? i + 1}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(stage)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(stage.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {stages.length === 0 && (
            <div className="empty-state">
              <div className="icon">📊</div>
              <div style={{ fontWeight: 600 }}>No stages yet</div>
              <p>Create pipeline stages like New, Contacted, Qualified, Closed</p>
              <button className="btn btn-primary btn-sm" onClick={openAdd}>Add Stage</button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">{editing ? 'Edit Stage' : 'Add Lead Stage'}</div>
            <div className="form-row">
              <label className="label">Stage Name *</label>
              <input className="input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New, Contacted, Qualified, Closed" />
            </div>
            <div className="form-row">
              <label className="label">Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{form.color}</span>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
              <span style={{ fontSize: 13 }}>Set as default stage for new leads</span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Create Stage'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TEAM MEMBERS TAB ─────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState({ name: '', email: '', password: '', role: 'agent' })

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/users'); setUsers(data) }
    catch { toast.error('Failed to load team') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'agent' }); setShowModal(true) }
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email required')
    if (!editing && !form.password.trim()) return toast.error('Password required for new user')
    try {
      const payload = { name: form.name, email: form.email, role: form.role }
      if (form.password) payload.password = form.password
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload)
        toast.success('User updated!')
      } else {
        await api.post('/users', { ...payload, password: form.password })
        toast.success('User created!')
      }
      setShowModal(false)
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const deactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return
    try { await api.delete(`/users/${id}`); toast.success('User deactivated'); load() }
    catch { toast.error('Failed') }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Team Members</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Manage agents and admin users</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Member</button>
      </div>

      {loading ? <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner"/></div>
       : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, color: 'var(--primary)', flexShrink: 0 }}>
                  {u.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {u.name}
                    {!u.is_active && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 10 }}>Inactive</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{u.email}</div>
                </div>
                <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: 11 }}>
                  {u.role}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                  {u.is_active && <button className="btn btn-danger btn-sm" onClick={() => deactivate(u.id)}>Remove</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-title">{editing ? 'Edit Member' : 'Add Team Member'}</div>
            <div className="form-row">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="form-row">
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="form-row">
              <label className="label">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editing ? 'Leave blank to keep current' : 'Set password'} />
            </div>
            <div className="form-row">
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Add Member'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OFFICE HOURS TAB ─────────────────────────────────────────────────────────
function OfficeHoursTab() {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const [settings, setSettings] = useState({ enabled: false, days: [1,2,3,4,5], start: '09:00', end: '18:00' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data?.office_hours) setSettings(r.data.office_hours)
    }).catch(() => {})
  }, [])

  const toggleDay = (d) => {
    setSettings(s => ({
      ...s,
      days: s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d].sort()
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings/office_hours', settings)
      toast.success('Office hours saved!')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>🕒 Office Hours</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!settings.enabled}
            onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))} />
          <div>
            <div style={{ fontWeight: 600 }}>Enable Office Hours</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Away message sent automatically outside working hours</div>
          </div>
        </label>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Working Days</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAY_NAMES.map((name, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: settings.days?.includes(i) ? 'var(--primary)' : 'var(--bg3)',
                  color: settings.days?.includes(i) ? '#fff' : 'var(--text2)',
                  transition: 'all .15s',
                }}>{name}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Start Time</label>
            <input type="time" className="input" value={settings.start || '09:00'}
              onChange={e => setSettings(s => ({ ...s, start: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>End Time</label>
            <input type="time" className="input" value={settings.end || '18:00'}
              onChange={e => setSettings(s => ({ ...s, end: e.target.value }))} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Office Hours'}
        </button>
      </div>
    </div>
  )
}

// ─── MAIN SETTINGS PAGE ───────────────────────────────────────────────────────
function Settings() {
  const [tab, setTab] = useState('ai')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'ai'        && <AITab />}
      {tab === 'media'     && <MediaTab />}
      {tab === 'knowledge' && <KnowledgeTab />}
      {tab === 'memory'    && <MemoryTab />}
      {tab === 'rules'     && <RulesTab />}
      {tab === 'stages'    && <StagesTab />}
      {tab === 'users'     && <UsersTab />}
      {tab === 'hours'     && <OfficeHoursTab />}
    </div>
  )
}

export default Settings
