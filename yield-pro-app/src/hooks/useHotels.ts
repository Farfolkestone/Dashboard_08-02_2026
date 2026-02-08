import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type HotelRow = Database['public']['Tables']['hotels']['Row']
type CompetitorRow = Database['public']['Tables']['hotels_concurrents']['Row']
type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const fetchHotels = async (): Promise<HotelRow[]> => {
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export const useHotels = () => {
  return useQuery({
    queryKey: ['hotels'],
    queryFn: fetchHotels,
  })
}

export const useHotelByHotelId = (hotelId: string | null | undefined) => {
  return useQuery({
    queryKey: ['hotel-by-id', hotelId],
    queryFn: async (): Promise<HotelRow | null> => {
      if (!hotelId) return null
      const trimmed = hotelId.trim()

      const { data: byHotelOrCode, error: byHotelOrCodeError } = await supabase
        .from('hotels')
        .select('*')
        .or(`hotel_id.eq.${trimmed},code.eq.${trimmed}`)
        .limit(1)
        .maybeSingle()

      if (byHotelOrCodeError) throw byHotelOrCodeError
      if (byHotelOrCode) return byHotelOrCode

      if (UUID_REGEX.test(trimmed)) {
        const { data: byUuid, error: byUuidError } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', trimmed)
          .limit(1)
          .maybeSingle()

        if (byUuidError) throw byUuidError
        return byUuid || null
      }

      return null
    },
    enabled: !!hotelId,
  })
}

export const useUpdateCurrentUserHotel = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Pick<UserProfileRow, 'user_id' | 'hotel_id'>) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing')
      }

      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token || supabaseAnonKey

      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_profiles?user_id=eq.${payload.user_id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            hotel_id: payload.hotel_id,
            updated_at: new Date().toISOString()
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update selected hotel: ${errorText}`)
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-by-id'] })
      queryClient.invalidateQueries({ queryKey: ['competitors', variables.hotel_id] })
      queryClient.invalidateQueries({ queryKey: ['competitors-settings', variables.hotel_id] })
    },
  })
}

const fetchCompetitors = async (hotelId: string, onlyActive = true): Promise<CompetitorRow[]> => {
  let query = supabase
    .from('hotels_concurrents')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('display_order', { ascending: true })

  if (onlyActive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export const useCompetitors = (hotelId: string) => {
  return useQuery({
    queryKey: ['competitors', hotelId],
    queryFn: () => fetchCompetitors(hotelId, true),
    enabled: !!hotelId,
  })
}

export const useCompetitorsSettings = (hotelId: string) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['competitors-settings', hotelId],
    queryFn: () => fetchCompetitors(hotelId, false),
    enabled: !!hotelId,
  })

  const saveMutation = useMutation({
    mutationFn: async (rows: Array<Pick<CompetitorRow, 'id' | 'is_active' | 'display_order'>>) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing')
      }

      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token || supabaseAnonKey

      for (const row of rows) {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/hotels_concurrents?id=eq.${row.id}`,
          {
            method: 'PATCH',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal'
            },
            body: JSON.stringify({
              is_active: row.is_active,
              display_order: row.display_order,
            })
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to save competitor settings: ${errorText}`)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors-settings', hotelId] })
      queryClient.invalidateQueries({ queryKey: ['competitors', hotelId] })
      queryClient.invalidateQueries({ queryKey: ['competitors-list', hotelId] })
    },
  })

  return {
    ...query,
    saveMutation,
  }
}
