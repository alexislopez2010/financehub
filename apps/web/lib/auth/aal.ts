import type { SupabaseClient } from '@supabase/supabase-js'

export type AalLevel = 'aal1' | 'aal2' | null

export interface AalState {
  currentLevel: AalLevel
  nextLevel: AalLevel
}

/**
 * Fail-closed check: returns true when the caller MUST step up via MFA challenge.
 * Returns false only when explicitly safe — currentLevel === 'aal2' OR
 * nextLevel !== 'aal2' (no MFA factor enrolled at all).
 * Any error, null data, or unexpected shape → must challenge.
 */
export async function mustChallenge(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return true
    if (data.currentLevel === 'aal2') return false
    if (data.nextLevel !== 'aal2') return false
    return true
  } catch {
    return true
  }
}

/**
 * Returns true if the user has at least one verified TOTP factor.
 * Used to decide whether to redirect to /mfa/enroll vs /mfa/challenge.
 */
export async function hasVerifiedTotp(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error || !data) return false
    return (data.totp ?? []).some(f => f.status === 'verified')
  } catch {
    return false
  }
}
