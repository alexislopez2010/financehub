import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import AuthShell from './AuthShell.jsx'

export default function Signup({ onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return }
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } }
    })
    setBusy(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="We sent you a confirmation link">
        <p className="text-sm text-gray-600 mb-4">Confirm your email at <strong>{email}</strong> to activate the account. Then you'll set up multi-factor auth on first sign-in.</p>
        <button onClick={onBack} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm">Back to sign in</button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create account" subtitle="Set up your household access">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Your name</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
          <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
          <p className="text-[11px] text-gray-400 mt-1">At least 8 characters</p>
        </div>
        {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}
        <button type="submit" disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg text-sm">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="text-xs text-gray-500 text-center mt-4">
        Have an account?{' '}
        <button onClick={onBack} className="text-blue-600 font-medium hover:underline">Sign in</button>
      </p>
    </AuthShell>
  )
}
