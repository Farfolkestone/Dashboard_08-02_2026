import React, { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import type { Session } from '@supabase/supabase-js'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { setUser, setProfile } = useAuthStore()

    useEffect(() => {
        let isMounted = true;

        // Fonction pour charger le profil et débloquer l'état
        const handleAuthChange = async (session: Session | null) => {
            try {
                if (session?.user) {
                    setUser(session.user);
                    // On récupère le profil
                    const { data } = await supabase
                        .from('user_profiles')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .maybeSingle();

                    if (isMounted && data) {
                        setProfile(data as any);
                    }
                } else {
                    setUser(null);
                    setProfile(null);
                }
            } catch (err) {
                console.error('Auth change handling error:', err);
            } finally {
                // IMPORTANT: On marque comme initialisé quoi qu'il arrive pour débloquer l'UI
                if (isMounted) {
                    useAuthStore.setState({ loading: false, initialized: true });
                }
            }
        };

        // 1. Détecter la session initiale
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) {
                handleAuthChange(session);
            }
        });

        // 2. Écouter les changements futurs
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (isMounted) {
                handleAuthChange(session);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [setUser, setProfile])

    return <>{children}</>
}
