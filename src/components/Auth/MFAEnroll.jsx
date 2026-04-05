import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import AuthShell from './AuthShell.jsx'

export default function MFAEnroll({ onDone }) {
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { enroll() }, [])

  const enroll = async () => {
    setErr('')
    // Clean up any stale unverified factors first
    const { data: list, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr) { setErr(`Could not load existing factors: ${listErr.message}`); return }
    const stale = list?.totp?.filter(f => f.status !== 'verified') || []
    for (const f of stale) {
      const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (unErr) { setErr(`Could not remove a stuck MFA factor: ${unErr.message}. Contact support.`); return }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`
    })
    if (error) { setErr(error.message); return }
    setFactorId(data.id)
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
  }

  const verify = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
    if (cErr) { setErr(cErr.message); setBusy(false); return }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code
    })
    setBusy(false)
    if (vErr) { setErr(vErr.message); return }
    onDone?.()
  }

  return (
    <AuthShell title="Set up two-factor auth" subtitle="Required — one-time setup">
      <p className="text-xs text-gray-600 mb-3">Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>1Password</strong>, then enter the 6-digit code to confirm.</p>
      {qr ? (
        <>
          <div className="flex justify-center mb-3 bg-white p-3 rounded-lg border border-gray-200">
            <img src={qr} alt="TOTP QR code" className="w-44 h-44" />
          </div>
          <details className="mb-3">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Can't scan? Enter manually</summary>
            <code className="block mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 break-all">{secret}</code>
          </details>
          <form onSubmit={verify} className="space-y-3">
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
              {busy ? 'Verifying…' : 'Verify & enable'}
            </button>
          </form>
        </>
      ) : err ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 my-3">
          <p className="font-semibold mb-1">Setup error</p>
          <p>{err}</p>
          <button onClick={enroll} className="mt-2 text-blue-600 hover:text-blue-800 font-medium underline">Try again</button>
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-6">Loading QR code…</div>
      )}
      <button onClick={() => supabase.auth.signOut()} className="w-full text-xs text-gray-400 hover:text-gray-600 mt-3">Sign out</button>
    </AuthShell>
  )
}
