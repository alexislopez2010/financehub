import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import Login from './components/Auth/Login.jsx'
import Signup from './components/Auth/Signup.jsx'
import MFAEnroll from './components/Auth/MFAEnroll.jsx'
import MFAChallenge from './components/Auth/MFAChallenge.jsx'
import Dashboard from './components/Dashboard/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login') // 'login' | 'signup'
  const [aal, setAal] = useState(null) // current MFA assurance level
  const [needsEnroll, setNeedsEnroll] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      checkMFA()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) checkMFA()
      else { setAal(null); setNeedsEnroll(false); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const checkMFA = async () => {
    setLoading(true)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const { data: factorData } = await supabase.auth.mfa.listFactors()
    const verifiedTotp = factorData?.totp?.find(f => f.status === 'verified')
    setAal(aalData)
    setNeedsEnroll(!verifiedTotp)
    setLoading(false)
  }

  if (loading) return <Loading />

  // Not logged in — show login or signup
  if (!session) {
    return view === 'signup'
      ? <Signup onBack={() => setView('login')} />
      : <Login onSignupClick={() => setView('signup')} />
  }

  // Logged in but hasn't enrolled in MFA yet — force enrollment
  if (needsEnroll) {
    return <MFAEnroll onDone={checkMFA} />
  }

  // User has MFA enrolled but hasn't stepped up to AAL2 this session
  if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
    return <MFAChallenge onVerified={checkMFA} />
  }

  // Fully authenticated — show dashboard
  return <Dashboard user={session.user} />
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )
}
