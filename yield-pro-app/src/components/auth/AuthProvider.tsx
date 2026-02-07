import React, { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import type { Session, AuthChangeEvent } from '@supabase/supabase-js'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { setUser, setProfile } = useAuthStore()

    useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                useAuthStore.setState({ loading: false, initialized: true })
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                await fetchProfile(session.user.id)
            } else {
                setProfile(null)
            }
            useAuthStore.setState({ loading: false, initialized: true })
        })

        return () => subscription.unsubscribe()
    }, [setUser, setProfile])

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                // Ignore PGRST116 (no rows) as it's expected for new users before trigger runs
                if (error.code !== 'PGRST116') {
                    console.error('Error fetching profile:', error.message, error.details, error.hint)
                }
            }

            if (data) {
                setProfile(data as any)
            }
        } catch (err: any) {
            // Ignore AbortError which happens on rapid navigation/unmounts
            if (err.name !== 'AbortError') {
                console.error('Unexpected error fetching profile:', err)
            }
        } finally {
            useAuthStore.setState({ loading: false, initialized: true })
        }
    }

    return <>{children}</>
}
