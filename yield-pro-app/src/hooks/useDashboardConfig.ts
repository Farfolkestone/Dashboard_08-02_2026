import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

export interface DashboardWidgets {
    revenue: boolean
    occupancy: boolean
    pickup: boolean
    adr: boolean
    competitors: boolean
    market: boolean
    yieldRecommendations: boolean
}

export const useDashboardConfig = () => {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()

    const { data: config, isLoading } = useQuery({
        queryKey: ['dashboard-config', user?.id],
        queryFn: async () => {
            if (!user) return null
            const { data, error } = await supabase
                .from('dashboard_config')
                .select('widgets')
                .eq('user_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') throw error
            return (data?.widgets as unknown as DashboardWidgets) || {
                revenue: true,
                occupancy: true,
                pickup: true,
                adr: true,
                competitors: true,
                market: true,
                yieldRecommendations: true
            }
        },
        enabled: !!user,
    })

    const updateConfig = useMutation({
        mutationFn: async (newWidgets: DashboardWidgets) => {
            if (!user) return
            const { error } = await supabase
                .from('dashboard_config')
                .upsert({
                    user_id: user.id,
                    widgets: newWidgets as any,
                    updated_at: new Date().toISOString()
                })
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-config', user?.id] })
        }
    })

    return { config, isLoading, updateConfig }
}
