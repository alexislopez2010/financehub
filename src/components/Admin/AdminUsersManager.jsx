import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Edit2, Trash2, X, Check, KeyRound, ShieldOff } from 'lucide-react'

/**
 * Users manager — uses admin RPCs because household_members joins auth.users.email
 * and has safeguards (can't demote last owner, can't remove self).
 */
export default function AdminUsersManager({ householdId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmPwd, setConfirmPwd] = useState(null)
  const [confirmMfa, setConfirmMfa] = useState(null)
  const [flash, setFlash] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const { data, error } = await supabase.rpc('admin_list_household_users', { h_id: householdId })
      if (error) throw error
      setRows(data || [])
    } catch (e) {
      setErr(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [householdId])

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      const { error } = await supabase.rpc('admin_update_household_user', {
        h_id: householdId,
        target_user: editing.user_id,
        new_role: editing.role,
        new_display_name: editing.display_name || null
      })
      if (error) throw error
      setEditing(null)
      await load()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const sendPasswordReset = async (row) => {
    setErr(''); setFlash(''); setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(row.email, {
        redirectTo: `${window.location.origin}/`
      })
      if (error) throw error
      setConfirmPwd(null)
      setFlash(`Password reset email sent to ${row.email}`)
      setTimeout(() => setFlash(''), 5000)
    } catch (e) {
      setErr(e.message || 'Failed to send reset email')
    } finally {
      setBusy(false)
    }
  }

  const resetMfa = async (row) => {
    setErr(''); setFlash(''); setBusy(true)
    try {
      const { data, error } = await supabase.rpc('admin_reset_user_mfa', {
        h_id: householdId,
        target_user: row.user_id
      })
      if (error) throw error
      setConfirmMfa(null)
      setFlash(`Removed ${data || 0} MFA factor${data === 1 ? '' : 's'} for ${row.email}`)
      setTimeout(() => setFlash(''), 5000)
    } catch (e) {
      setErr(e.message || 'Failed to reset MFA')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    setErr(''); setBusy(true)
    try {
      const { error } = await supabase.rpc('admin_remove_household_user', {
        h_id: householdId,
        target_user: row.user_id
      })
      if (error) throw error
      setConfirmDelete(null)
      await load()
    } catch (e) {
      setErr(e.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 md:px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Household Users</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Users sign up themselves, then you grant access here.</p>
        </div>
      </div>

      {err && <div className="mx-4 md:mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}
      {flash && <div className="mx-4 md:mx-5 mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">{flash}</div>}

      {loading ? (
        <div className="p-6 text-sm text-gray-400 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-400 text-center">No users yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Display name</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-3 py-2 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.user_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 font-mono text-[11px]">{row.email}</td>
                  <td className="px-3 py-2 text-gray-700">{row.display_name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${row.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {row.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{row.joined_at ? new Date(row.joined_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setConfirmPwd(row)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Send password reset"><KeyRound size={13} /></button>
                      <button onClick={() => setConfirmMfa(row)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Reset MFA"><ShieldOff size={13} /></button>
                      <button onClick={() => setEditing({ ...row })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmDelete(row)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Edit user</h3>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-700 rounded"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <div className="text-sm font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{editing.email}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
                <input type="text" value={editing.display_name ?? ''} onChange={e => setEditing({ ...editing, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select value={editing.role ?? 'member'} onChange={e => setEditing({ ...editing, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="member">Member</option>
                  <option value="owner">Owner (admin)</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg">
                <Check size={14} />{busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPwd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Send password reset email?</h3>
              <p className="text-xs text-gray-500 mb-4">
                An email with a reset link will be sent to <span className="font-mono">{confirmPwd.email}</span>. The user can then choose a new password themselves.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmPwd(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={() => sendPasswordReset(confirmPwd)} disabled={busy} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-medium rounded-lg">
                  {busy ? 'Sending…' : 'Send reset email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmMfa && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Reset MFA for this user?</h3>
              <p className="text-xs text-gray-500 mb-4">
                All enrolled MFA factors for <span className="font-mono">{confirmMfa.email}</span> will be removed. They'll be prompted to enroll a new authenticator on next login.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmMfa(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={() => resetMfa(confirmMfa)} disabled={busy} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-medium rounded-lg">
                  {busy ? 'Resetting…' : 'Reset MFA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Remove this user?</h3>
              <p className="text-xs text-gray-500 mb-4">
                <span className="font-mono">{confirmDelete.email}</span> will lose access to the household. This does not delete their auth account.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={() => remove(confirmDelete)} disabled={busy} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium rounded-lg">
                  {busy ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
