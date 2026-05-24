import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import AuthShell from './AuthShell.jsx'

export default function Login({ onSignupClick, onForgotClick }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <AuthShell title="Sign in" subtitle="Sign in to view your household finances">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" required autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
          <input type="password" required autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>
        {err && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</div>}
        <div className="text-right">
          <button type="button" onClick={onForgotClick} className="text-xs text-blue-600 font-medium hover:underline">Forgot password?</button>
        </div>
        <button type="submit" disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-xs text-gray-500 text-center mt-4">
        No account yet?{' '}
        <button onClick={onSignupClick} className="text-blue-600 font-medium hover:underline">Create one</button>
      </p>
    </AuthShell>
  )
}
