import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type BookingApercu = Database['public']['Tables']['booking_apercu']['Row']
type BookingExport = Database['public']['Tables']['booking_export']['Row']

const fetchBookingApercu = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingApercu[]> => {
  const { data, error } = await supabase
    .from('booking_apercu')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) throw error
  return data || []
}

const fetchBookingExport = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingExport[]> => {
  const { data, error } = await supabase
    .from('booking_export')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte('arrival_date', startDate.toISOString().split('T')[0])
    .lte('arrival_date', endDate.toISOString().split('T')[0])

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

export const useBookingExport = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['booking-export', hotelId, startDate, endDate],
    queryFn: () => fetchBookingExport(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}
