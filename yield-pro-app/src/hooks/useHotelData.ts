import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type EventsCalendar = Database['public']['Tables']['events_calendar']['Row']
type Disponibilites = Database['public']['Tables']['disponibilites']['Row']
type BookingExport = Database['public']['Tables']['booking_export']['Row']

// Events Calendar
const fetchEvents = async (hotelId: string, startDate: Date, endDate: Date): Promise<EventsCalendar[]> => {
  const { data, error } = await supabase
    .from('events_calendar')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte('Début', startDate.toISOString().split('T')[0])
    .lte('Fin', endDate.toISOString().split('T')[0])

  if (error) throw error
  return data || []
}

export const useEvents = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['events', hotelId, startDate, endDate],
    queryFn: () => fetchEvents(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}

// Disponibilités
const fetchDisponibilites = async (hotelId: string, startDate: Date, endDate: Date): Promise<Disponibilites[]> => {
  const { data, error } = await supabase
    .from('disponibilites')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) throw error
  return data || []
}

export const useDisponibilites = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['disponibilites', hotelId, startDate, endDate],
    queryFn: () => fetchDisponibilites(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}

// Réservations (Booking Export)
const fetchReservations = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingExport[]> => {
  const { data, error } = await supabase
    .from('booking_export')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte('Date d\'arrivée', startDate.toISOString().split('T')[0])
    .lte('Date d\'arrivée', endDate.toISOString().split('T')[0])
    .order('Date d\'arrivée', { ascending: true })

  if (error) throw error
  return data || []
}

export const useReservations = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['reservations', hotelId, startDate, endDate],
    queryFn: () => fetchReservations(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}
