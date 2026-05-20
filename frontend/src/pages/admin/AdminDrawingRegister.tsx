import { useEffect, useState, useRef } from 'react'
import { Upload, FileImage, CheckCircle, RefreshCw, Eye, X } from 'lucide-react'
import { listDrawingRegister, uploadFloorPlan, BASE } from '../../services/api'

interface Plan {
  url: string
  uploaded_at: string
  uploaded_by_name?: string
}

interface VillaEntry {
  id?: string
  villa_id: string
  villa_number?: string
  villa_name?: string
  villa_type?: string
  standard_plan: Plan | null
  updated_plan:  Plan | null
}

const fullUrl = (path: string) =>
  path.startsWith('/static/') ? `${BASE}${path}` : path

function PlanCell({
  villaId, planType, plan, onUploaded,
}: {
  villaId: string
  planType: 'standard' | 'updated'
  plan: Plan | null
  onUploaded: (entry: VillaEntry) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [preview, setPreview]     = useState(false)

  const label  = planType === 'standard' ? 'Standard Floor Plan' : 'Updated Floor Plan'
  const isPDF  = plan?.url?.endsWith('.pdf')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const updated = await uploadFloorPlan(villaId, file, planType)
      onUploaded(updated)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const fmtDate = (d?: string) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="dr-plan-cell">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {plan ? (
        <div className="dr-plan-uploaded">
          {!isPDF && (
            <div className="dr-plan-thumb" onClick={() => setPreview(true)}>
              <img src={fullUrl(plan.url)} alt={label} />
              <div className="dr-plan-thumb-overlay"><Eye size={16} /></div>
            </div>
          )}
          {isPDF && (
            <a href={fullUrl(plan.url)} target="_blank" rel="noopener noreferrer" className="dr-plan-pdf-link">
              <FileImage size={18} /> View PDF
            </a>
          )}
          <div className="dr-plan-meta">
            <span className="dr-plan-status dr-plan-status--uploaded">
              <CheckCircle size={11} /> Uploaded
            </span>
            <span className="dr-plan-date">{fmtDate(plan.uploaded_at)}</span>
            {plan.uploaded_by_name && (
              <span className="dr-plan-by">by {plan.uploaded_by_name}</span>
            )}
          </div>
          <button
            className="admin-btn admin-btn--ghost admin-btn--sm dr-reupload-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <RefreshCw size={12} /> {uploading ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      ) : (
        <div className="dr-plan-empty">
          <span className="dr-plan-status dr-plan-status--missing">Not uploaded</span>
          <button
            className="admin-btn admin-btn--primary admin-btn--sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}

      {error && <div className="dr-plan-error">{error}</div>}

      {/* Lightbox */}
      {preview && plan && !isPDF && (
        <div className="dr-lightbox" onClick={() => setPreview(false)}>
          <button className="dr-lightbox-close" onClick={() => setPreview(false)}>
            <X size={20} />
          </button>
          <img
            src={fullUrl(plan.url)}
            alt={label}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default function AdminDrawingRegister() {
  const [entries, setEntries] = useState<VillaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await listDrawingRegister()
      setEntries(data)
    } catch { setError('Failed to load drawing register.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleUploaded = (updated: VillaEntry) => {
    setEntries(prev => prev.map(e =>
      e.villa_id === updated.villa_id ? { ...e, ...updated } : e
    ))
  }

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    return (
      (e.villa_number ?? '').toLowerCase().includes(q) ||
      (e.villa_name  ?? '').toLowerCase().includes(q) ||
      (e.villa_type  ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-table-title">Drawing Register</span>
          <input
            type="text"
            className="dr-search"
            placeholder="Search villa…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-loading">Loading drawing register…</div>
        ) : error ? (
          <div className="admin-error" style={{ margin: 16 }}>{error}</div>
        ) : entries.length === 0 ? (
          <div className="admin-table-empty">No villas found.</div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">No villas match your search.</div>
        ) : (
          <table className="admin-table dr-table">
            <thead>
              <tr>
                <th>Villa</th>
                <th>Type</th>
                <th style={{ width: 280 }}>Standard Floor Plan</th>
                <th style={{ width: 280 }}>Updated Floor Plan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.villa_id}>
                  <td style={{ fontWeight: 600 }}>
                    {entry.villa_number ?? '—'}
                    {entry.villa_name && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
                        {entry.villa_name}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {entry.villa_type ?? '—'}
                  </td>
                  <td>
                    <PlanCell
                      villaId={entry.villa_id}
                      planType="standard"
                      plan={entry.standard_plan}
                      onUploaded={handleUploaded}
                    />
                  </td>
                  <td>
                    <PlanCell
                      villaId={entry.villa_id}
                      planType="updated"
                      plan={entry.updated_plan}
                      onUploaded={handleUploaded}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
