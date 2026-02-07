import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
    id: string
    user_id: string
    email: string | null
    full_name: string | null
    role: 'user' | 'admin'
    hotel_id: string | null
}

interface AuthState {
    user: User | null
    profile: UserProfile | null
    loading: boolean
    initialized: boolean
    setUser: (user: User | null) => void
    setProfile: (profile: UserProfile | null) => void
    signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    profile: null,
    loading: true,
    initialized: false,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null })
    }
}))
