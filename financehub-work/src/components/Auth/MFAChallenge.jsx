import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import AuthShell from './AuthShell.jsx'

export default function MFAChallenge({ onVerified }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = factors?.totp?.find(f => f.status === 'verified')
    if (!factor) { setErr('No active authenticator'); setBusy(false); return }
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (cErr) { setErr(cErr.message); setBusy(false); return }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: factor.id, challengeId: challenge.id, code
    })
    setBusy(false)
    if (vErr) { setErr(vErr.message); return }
    onVerified?.()
  }

  return (
    <AuthShell title="Enter your code" subtitle="Open your authenticator app">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">6-digit code</label>
          <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-center text-xl tracking-widest font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="000000" autoFocus />
        </div>
        {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}
        <button type="submit" disabled={busy || code.length !== 6}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg text-sm">
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <button onClick={() => supabase.auth.signOut()} className="w-full text-xs text-gray-400 hover:text-gray-600 mt-3">Sign out</button>
    </AuthShell>
  )
}
