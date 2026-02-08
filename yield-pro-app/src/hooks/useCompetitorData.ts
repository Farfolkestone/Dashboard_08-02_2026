import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type BookingTarifs = Database['public']['Tables']['booking_tarifs']['Row']
type HotelConcurrent = Database['public']['Tables']['hotels_concurrents']['Row']
type GenericTrendRow = Record<string, unknown>
type LooseSelectQuery = {
    select: (columns: string) => LooseFilterQuery
}
type LooseFilterQuery = {
    eq: (column: string, value: unknown) => LooseFilterQuery
    gte: (column: string, value: string) => LooseFilterQuery
    lte: (column: string, value: string) => LooseFilterQuery
    order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
}

const fetchCompetitorRates = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingTarifs[]> => {
    const { data, error } = await supabase
        .from('booking_tarifs')
        .select('*')
        .eq('hotel_id', hotelId)
        .gte('Date', startDate.toISOString().split('T')[0])
        .lte('Date', endDate.toISOString().split('T')[0])
        .order('Date', { ascending: true })

    if (error) throw error
    return data || []
}

const fetchCompetitorTrendTable = async (
    tableName: 'booking_vs_3j' | 'booking_vs_7j',
    hotelId: string,
    startDate: Date,
    endDate: Date
): Promise<GenericTrendRow[]> => {
    const client = supabase as unknown as { from: (table: string) => LooseSelectQuery }

    const { data, error } = await client
        .from(tableName)
        .select('*')
        .eq('hotel_id', hotelId)
        .gte('Date', startDate.toISOString().split('T')[0])
        .lte('Date', endDate.toISOString().split('T')[0])
        .order('Date', { ascending: true })

    if (error) throw error
    return (data || []) as GenericTrendRow[]
}

const fetchCompetitorsList = async (hotelId: string): Promise<HotelConcurrent[]> => {
    const { data, error } = await supabase
        .from('hotels_concurrents')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) throw error
    return data || []
}

export const useCompetitorRates = (hotelId: string, startDate: Date, endDate: Date) => {
    return useQuery({
        queryKey: ['competitor-rates', hotelId, startDate, endDate],
        queryFn: () => fetchCompetitorRates(hotelId, startDate, endDate),
        enabled: !!hotelId,
    })
}

export const useCompetitorsList = (hotelId: string) => {
    return useQuery({
        queryKey: ['competitors-list', hotelId],
        queryFn: () => fetchCompetitorsList(hotelId),
        enabled: !!hotelId,
    })
}

export const useCompetitorRatesVs3j = (hotelId: string, startDate: Date, endDate: Date) => {
    return useQuery({
        queryKey: ['competitor-rates-vs-3j', hotelId, startDate, endDate],
        queryFn: () => fetchCompetitorTrendTable('booking_vs_3j', hotelId, startDate, endDate),
        enabled: !!hotelId,
    })
}

export const useCompetitorRatesVs7j = (hotelId: string, startDate: Date, endDate: Date) => {
    return useQuery({
        queryKey: ['competitor-rates-vs-7j', hotelId, startDate, endDate],
        queryFn: () => fetchCompetitorTrendTable('booking_vs_7j', hotelId, startDate, endDate),
        enabled: !!hotelId,
    })
}
