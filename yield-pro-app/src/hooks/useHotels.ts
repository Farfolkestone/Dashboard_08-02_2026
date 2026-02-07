import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type Hotels = Database['public']['Tables']['hotels']['Row']
type HotelsConcurrents = Database['public']['Tables']['hotels_concurrents']['Row']

// Hotels
const fetchHotels = async (): Promise<Hotels[]> => {
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

// Concurrents d'un hôtel
const fetchCompetitors = async (hotelId: string): Promise<HotelsConcurrents[]> => {
  const { data, error } = await supabase
    .from('hotels_concurrents')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return data || []
}

export const useCompetitors = (hotelId: string) => {
  return useQuery({
    queryKey: ['competitors', hotelId],
    queryFn: () => fetchCompetitors(hotelId),
    enabled: !!hotelId,
  })
}
