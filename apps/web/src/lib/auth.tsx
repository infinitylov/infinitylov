import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AppRole = 'super_admin' | 'admin' | 'support' | 'reseller' | 'member'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: AppRole
}

type AuthCtx = {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: AppRole | null
  loading: boolean
  isStaff: boolean
  isReseller: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<Profile | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
}

const Ctx = createContext<AuthCtx | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) {
      setProfile(null)
      return null
    }
    const p = await fetchProfile(uid)
    setProfile(p)
    return p
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        const p = await fetchProfile(data.session.user.id)
        if (mounted) setProfile(p)
      }
      if (mounted) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s?.user) {
        const p = await fetchProfile(s.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const role = profile?.role ?? null
  const isStaff = role === 'super_admin' || role === 'admin' || role === 'support'
  const isReseller = role === 'reseller'
  const isAdmin = role === 'super_admin' || role === 'admin'

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    loading,
    isStaff,
    isReseller,
    isAdmin,
    refreshProfile,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return refreshProfile()
    },
    async signOut() {
      await supabase.auth.signOut()
      setProfile(null)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}

export function staffHomePath(role: AppRole | null): string {
  if (role === 'super_admin' || role === 'admin' || role === 'support') return '/admin'
  if (role === 'reseller') return '/revendedor'
  return '/login'
}
