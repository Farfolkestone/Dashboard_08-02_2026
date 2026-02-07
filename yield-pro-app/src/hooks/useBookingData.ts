import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type BookingApercu = Database['public']['Tables']['booking_apercu']['Row']

const fetchBookingApercu = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingApercu[]> => {
  const { data, error } = await supabase
    .from('booking_apercu')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte('Date', startDate.toISOString().split('T')[0])
    .lte('Date', endDate.toISOString().split('T')[0])
    .order('Date', { ascending: true })

  if (error) throw error
  return data || []
}

export const useBookingApercu = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['booking-apercu', hotelId, startDate, endDate],
    queryFn: () => fetchBookingApercu(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}
