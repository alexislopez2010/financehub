import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import Login from './components/Auth/Login.jsx'
import Signup from './components/Auth/Signup.jsx'
import ForgotPassword from './components/Auth/ForgotPassword.jsx'
import ResetPassword from './components/Auth/ResetPassword.jsx'
import MFAEnroll from './components/Auth/MFAEnroll.jsx'
import MFAChallenge from './components/Auth/MFAChallenge.jsx'
import Dashboard from './components/Dashboard/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('login') // 'login' | 'signup' | 'forgot'
  const [aal, setAal] = useState(null) // current MFA assurance level
  const [needsEnroll, setNeedsEnroll] = useState(false)
  const [recovery, setRecovery] = useState(false) // true when user arrived via password-reset link
  const [recoveryAal2, setRecoveryAal2] = useState(false) // true once MFA stepped-up during recovery

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      checkMFA()
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true)
        setRecoveryAal2(false)
        setSession(s)
        // Detect whether MFA step-up is required to update password
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
          setRecoveryAal2(false)
        } else {
          setRecoveryAal2(true) // no MFA required — skip straight to reset form
        }
        setLoading(false)
        return
      }
      setSession(s)
      if (s) checkMFA()
      else { setAal(null); setNeedsEnroll(false); setRecovery(false); setRecoveryAal2(false); setLoading(false) }
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

  // Arrived via password-reset email link — step up MFA if needed, then show reset form.
  if (recovery) {
    if (!recoveryAal2) {
      return <MFAChallenge onVerified={() => setRecoveryAal2(true)} />
    }
    return <ResetPassword onDone={() => { setRecovery(false); setRecoveryAal2(false); setView('login') }} />
  }

  // Not logged in — show login, signup, or forgot password
  if (!session) {
    if (view === 'signup')  return <Signup onBack={() => setView('login')} />
    if (view === 'forgot')  return <ForgotPassword onBack={() => setView('login')} />
    return <Login onSignupClick={() => setView('signup')} onForgotClick={() => setView('forgot')} />
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
