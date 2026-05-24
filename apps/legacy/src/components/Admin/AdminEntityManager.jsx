import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'

/**
 * Generic CRUD manager for a Supabase table.
 *
 * Props:
 * - title: string
 * - table: string (Supabase table name)
 * - householdId: uuid (auto-injected into inserts)
 * - columns: [{ key, label, type, options?, required?, hidden?, readOnly?, default?, width?, render?, min?, step? }]
 *     type: 'text' | 'number' | 'boolean' | 'select' | 'date'
 *     render?(row) => string | JSX (overrides display in list)
 * - orderBy: { column, ascending }
 * - filter?: (row) => boolean (optional client-side filter after fetch)
 * - onAfterSave?: (oldRow, newPayload) => Promise<void> — called after a successful update (not insert)
 */
export default function AdminEntityManager({ title, table, householdId, columns, orderBy, filter, extraQuery, onAfterSave }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null) // row being edited (or {} for new)
  const [originalRow, setOriginalRow] = useState(null) // snapshot before editing
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const editableColumns = columns.filter(c => !c.hidden && !c.readOnly)

  const load = async () => {
    setLoading(true); setErr('')
    try {
      let q = supabase.from(table).select('*').eq('household_id', householdId)
      if (extraQuery) q = extraQuery(q)
      if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending !== false })
      const { data, error } = await q
      if (error) throw error
      const filtered = filter ? (data || []).filter(filter) : (data || [])
      setRows(filtered)
    } catch (e) {
      setErr(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [table, householdId])

  const startNew = () => {
    const blank = { household_id: householdId }
    for (const c of columns) {
      if (c.default !== undefined) blank[c.key] = c.default
      else if (c.type === 'boolean') blank[c.key] = false
      else blank[c.key] = ''
    }
    setEditing(blank)
  }

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      // coerce values
      const payload = { household_id: householdId }
      for (const c of columns) {
        if (c.readOnly || c.hidden) continue
        let v = editing[c.key]
        if (c.type === 'number') {
          v = v === '' || v === null || v === undefined ? null : Number(v)
          if (v !== null && Number.isNaN(v)) throw new Error(`${c.label} must be a number`)
          if (v !== null && c.min !== undefined && v < c.min) throw new Error(`${c.label} must be at least ${c.min}`)
          if (v !== null && c.max !== undefined && v > c.max) throw new Error(`${c.label} must be at most ${c.max}`)
        }
        if (c.type === 'date') {
          v = v === '' ? null : v
        }
        if (c.type === 'text' || c.type === 'select') {
          v = v === '' ? null : v
        }
        if (c.required && (v === null || v === '' || v === undefined)) throw new Error(`${c.label} is required`)
        payload[c.key] = v
      }
      if (editing.id) {
        const { error } = await supabase.from(table).update(payload).eq('id', editing.id)
        if (error) throw error
        if (onAfterSave && originalRow) {
          await onAfterSave(originalRow, payload)
        }
      } else {
        const { error } = await supabase.from(table).insert(payload)
        if (error) throw error
      }
      setEditing(null)
      setOriginalRow(null)
      await load()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    setErr(''); setBusy(true)
    try {
      const { error } = await supabase.from(table).delete().eq('id', row.id)
      if (error) throw error
      setConfirmDelete(null)
      await load()
    } catch (e) {
      setErr(e.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const displayCols = columns.filter(c => !c.hidden)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 md:px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">
          <Plus size={14} />Add new
        </button>
      </div>

      {err && <div className="mx-4 md:mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}

      {loading ? (
        <div className="p-6 text-sm text-gray-400 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-400 text-center">No records yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {displayCols.map(c => (
                  <th key={c.key} className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider" style={{ width: c.width }}>{c.label}</th>
                ))}
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {displayCols.map(c => (
                    <td key={c.key} className="px-3 py-2 text-gray-700">
                      {c.render
                        ? c.render(row)
                        : c.type === 'boolean'
                          ? (row[c.key] ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>)
                          : c.type === 'select' && c.options
                            ? (c.options.find(o => o.value === row[c.key])?.label ?? row[c.key] ?? '—')
                            : (row[c.key] ?? '—')
                      }
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setOriginalRow({ ...row }); setEditing({ ...row }) }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmDelete(row)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full my-8">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">{editing.id ? `Edit ${title}` : `New ${title}`}</h3>
              <button onClick={() => { setEditing(null); setOriginalRow(null) }} className="p-1 text-gray-400 hover:text-gray-700 rounded"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {editableColumns.map(c => (
                <div key={c.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {c.label}{c.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {c.type === 'boolean' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!editing[c.key]} onChange={e => setEditing({ ...editing, [c.key]: e.target.checked })} className="w-4 h-4" />
                      <span className="text-sm text-gray-700">{editing[c.key] ? 'Yes' : 'No'}</span>
                    </label>
                  ) : c.type === 'select' ? (
                    <select value={editing[c.key] ?? ''} onChange={e => setEditing({ ...editing, [c.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                      <option value="">— Select —</option>
                      {(c.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : c.type === 'number' ? (
                    <input type="number" step={c.step || 'any'} min={c.min} max={c.max} value={editing[c.key] ?? ''} onChange={e => setEditing({ ...editing, [c.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                  ) : c.type === 'date' ? (
                    <input type="date" value={editing[c.key] ?? ''} onChange={e => setEditing({ ...editing, [c.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                  ) : (
                    <input type="text" value={editing[c.key] ?? ''} onChange={e => setEditing({ ...editing, [c.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={() => { setEditing(null); setOriginalRow(null) }} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg">
                <Check size={14} />{busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Delete this record?</h3>
              <p className="text-xs text-gray-500 mb-4">This action cannot be undone.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={() => remove(confirmDelete)} disabled={busy} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium rounded-lg">
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
