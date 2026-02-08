import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import type { Database, Json } from '../types/database.types'

export interface DashboardWidgets {
    revenue: boolean
    occupancy: boolean
    pickup: boolean
    adr: boolean
    competitors: boolean
    market: boolean
    yieldRecommendations: boolean
    alerts: boolean
    events: boolean
    bookingPace: boolean
}

export interface RMSSettings {
    hotelCapacity: number
    strategy: 'conservative' | 'balanced' | 'aggressive'
    targetOccupancy: number
    minAdr: number
    maxAdr: number
    minPrice: number
    maxPrice: number
    weekendPremiumPct: number
    lastMinuteDiscountPct: number
    demandWeight: number
    competitorWeight: number
    eventWeight: number
    pickupWeight: number
    priceStep: number
    autoApproveThresholdPct: number
}

export interface UISettings {
    compactMode: boolean
    showAdvancedCards: boolean
}

export interface DashboardConfigPayload {
    version: number
    widgets: DashboardWidgets
    rms: RMSSettings
    ui: UISettings
}

const defaultWidgets: DashboardWidgets = {
    revenue: true,
    occupancy: true,
    pickup: true,
    adr: true,
    competitors: true,
    market: true,
    yieldRecommendations: true,
    alerts: true,
    events: true,
    bookingPace: true
}

const defaultRmsSettings: RMSSettings = {
    hotelCapacity: 45,
    strategy: 'balanced',
    targetOccupancy: 82,
    minAdr: 95,
    maxAdr: 290,
    minPrice: 79,
    maxPrice: 340,
    weekendPremiumPct: 12,
    lastMinuteDiscountPct: 8,
    demandWeight: 0.35,
    competitorWeight: 0.3,
    eventWeight: 0.2,
    pickupWeight: 0.15,
    priceStep: 2,
    autoApproveThresholdPct: 4
}

const defaultUI: UISettings = {
    compactMode: false,
    showAdvancedCards: true
}

const defaultConfig: DashboardConfigPayload = {
    version: 2,
    widgets: defaultWidgets,
    rms: defaultRmsSettings,
    ui: defaultUI
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>
    }
    return null
}

const parseBoolean = (value: unknown, fallback: boolean) => {
    if (typeof value === 'boolean') return value
    return fallback
}

const parseNumber = (value: unknown, fallback: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value)
    }
    return fallback
}

const parseStrategy = (value: unknown, fallback: RMSSettings['strategy']) => {
    if (value === 'conservative' || value === 'balanced' || value === 'aggressive') {
        return value
    }
    return fallback
}

const parseConfig = (input: Json | null | undefined): DashboardConfigPayload => {
    const root = asRecord(input)
    if (!root) return defaultConfig

    const hasModernShape = asRecord(root.widgets) && asRecord(root.rms)

    if (!hasModernShape) {
        const legacyWidgets: DashboardWidgets = {
            ...defaultWidgets,
            revenue: parseBoolean(root.revenue, defaultWidgets.revenue),
            occupancy: parseBoolean(root.occupancy, defaultWidgets.occupancy),
            pickup: parseBoolean(root.pickup, defaultWidgets.pickup),
            adr: parseBoolean(root.adr, defaultWidgets.adr),
            competitors: parseBoolean(root.competitors, defaultWidgets.competitors),
            market: parseBoolean(root.market, defaultWidgets.market),
            yieldRecommendations: parseBoolean(root.yieldRecommendations, defaultWidgets.yieldRecommendations)
        }

        return {
            ...defaultConfig,
            widgets: legacyWidgets
        }
    }

    const widgetsNode = asRecord(root.widgets) || {}
    const rmsNode = asRecord(root.rms) || {}
    const uiNode = asRecord(root.ui) || {}

    return {
        version: parseNumber(root.version, 2),
        widgets: {
            revenue: parseBoolean(widgetsNode.revenue, defaultWidgets.revenue),
            occupancy: parseBoolean(widgetsNode.occupancy, defaultWidgets.occupancy),
            pickup: parseBoolean(widgetsNode.pickup, defaultWidgets.pickup),
            adr: parseBoolean(widgetsNode.adr, defaultWidgets.adr),
            competitors: parseBoolean(widgetsNode.competitors, defaultWidgets.competitors),
            market: parseBoolean(widgetsNode.market, defaultWidgets.market),
            yieldRecommendations: parseBoolean(widgetsNode.yieldRecommendations, defaultWidgets.yieldRecommendations),
            alerts: parseBoolean(widgetsNode.alerts, defaultWidgets.alerts),
            events: parseBoolean(widgetsNode.events, defaultWidgets.events),
            bookingPace: parseBoolean(widgetsNode.bookingPace, defaultWidgets.bookingPace)
        },
        rms: {
            hotelCapacity: parseNumber(rmsNode.hotelCapacity, defaultRmsSettings.hotelCapacity),
            strategy: parseStrategy(rmsNode.strategy, defaultRmsSettings.strategy),
            targetOccupancy: parseNumber(rmsNode.targetOccupancy, defaultRmsSettings.targetOccupancy),
            minAdr: parseNumber(rmsNode.minAdr, defaultRmsSettings.minAdr),
            maxAdr: parseNumber(rmsNode.maxAdr, defaultRmsSettings.maxAdr),
            minPrice: parseNumber(rmsNode.minPrice, defaultRmsSettings.minPrice),
            maxPrice: parseNumber(rmsNode.maxPrice, defaultRmsSettings.maxPrice),
            weekendPremiumPct: parseNumber(rmsNode.weekendPremiumPct, defaultRmsSettings.weekendPremiumPct),
            lastMinuteDiscountPct: parseNumber(rmsNode.lastMinuteDiscountPct, defaultRmsSettings.lastMinuteDiscountPct),
            demandWeight: parseNumber(rmsNode.demandWeight, defaultRmsSettings.demandWeight),
            competitorWeight: parseNumber(rmsNode.competitorWeight, defaultRmsSettings.competitorWeight),
            eventWeight: parseNumber(rmsNode.eventWeight, defaultRmsSettings.eventWeight),
            pickupWeight: parseNumber(rmsNode.pickupWeight, defaultRmsSettings.pickupWeight),
            priceStep: parseNumber(rmsNode.priceStep, defaultRmsSettings.priceStep),
            autoApproveThresholdPct: parseNumber(rmsNode.autoApproveThresholdPct, defaultRmsSettings.autoApproveThresholdPct)
        },
        ui: {
            compactMode: parseBoolean(uiNode.compactMode, defaultUI.compactMode),
            showAdvancedCards: parseBoolean(uiNode.showAdvancedCards, defaultUI.showAdvancedCards)
        }
    }
}

const toJsonPayload = (config: DashboardConfigPayload): Json => {
    return {
        version: config.version,
        widgets: config.widgets,
        rms: config.rms,
        ui: config.ui
    } as unknown as Json
}

export const useDashboardConfig = () => {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()

    const { data: config = defaultConfig, isLoading } = useQuery({
        queryKey: ['dashboard-config', user?.id],
        queryFn: async (): Promise<DashboardConfigPayload> => {
            if (!user) return defaultConfig

            const { data, error } = await supabase
                .from('dashboard_config')
                .select('widgets')
                .eq('user_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') throw error
            const row = data as Pick<Database['public']['Tables']['dashboard_config']['Row'], 'widgets'> | null
            return parseConfig(row?.widgets)
        },
        enabled: !!user,
    })

    const updateConfig = useMutation({
        mutationFn: async (nextConfig: DashboardConfigPayload) => {
            if (!user) return

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error('Supabase configuration is missing')
            }

            const { data: { session } } = await supabase.auth.getSession()
            const authToken = session?.access_token || supabaseAnonKey

            const response = await fetch(
                `${supabaseUrl}/rest/v1/dashboard_config?user_id=eq.${user.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        apikey: supabaseAnonKey,
                        Authorization: `Bearer ${authToken}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=minimal'
                    },
                    body: JSON.stringify({
                        widgets: toJsonPayload(nextConfig),
                        updated_at: new Date().toISOString()
                    })
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Failed to save dashboard config: ${errorText}`)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-config', user?.id] })
        }
    })

    const savePartialConfig = async (partial: Partial<DashboardConfigPayload>) => {
        const merged: DashboardConfigPayload = {
            ...config,
            ...partial,
            widgets: {
                ...config.widgets,
                ...(partial.widgets || {})
            },
            rms: {
                ...config.rms,
                ...(partial.rms || {})
            },
            ui: {
                ...config.ui,
                ...(partial.ui || {})
            }
        }
        queryClient.setQueryData(['dashboard-config', user?.id], merged)
        await updateConfig.mutateAsync(merged)
    }

    return {
        config,
        isLoading,
        defaultConfig,
        updateConfig,
        savePartialConfig
    }
}
