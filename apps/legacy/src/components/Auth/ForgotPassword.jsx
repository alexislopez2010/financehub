import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import AuthShell from './AuthShell.jsx'

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="Password reset link sent">
        <p className="text-sm text-gray-700">
          If an account exists for <span className="font-medium">{email}</span>, we've sent a password reset link. Click the link in the email to set a new password.
        </p>
        <p className="text-xs text-gray-500 mt-3">
          The link expires after a short time. Don't see it? Check your spam folder, or try again in a few minutes (Supabase's default mailer has rate limits).
        </p>
        <button onClick={onBack} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          Back to sign in
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a reset link">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" required autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>
        {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}
        <button type="submit" disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="text-xs text-gray-500 text-center mt-4">
        <button onClick={onBack} className="text-blue-600 font-medium hover:underline">Back to sign in</button>
      </p>
    </AuthShell>
  )
}
