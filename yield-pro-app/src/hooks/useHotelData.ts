import { addDays, format, startOfDay } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type EventsCalendar = Database['public']['Tables']['events_calendar']['Row']
type Disponibilites = Database['public']['Tables']['disponibilites']['Row']
type BookingExport = Database['public']['Tables']['booking_export']['Row']

type BookingExportLike = BookingExport & {
  arrival_date?: string | null
}

type EventLike = EventsCalendar & Record<string, unknown>

const PRIORITY_WINDOW_DAYS = 90
const BOOKING_EXPORT_CHUNK_SIZE = 20000
const BOOKING_EXPORT_MAX_SCAN = 120000

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const localIso = new Date(Number(year), Number(month) - 1, Number(day))
    if (!Number.isNaN(localIso.getTime())) return localIso
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed

  if (value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number)
    if (day && month && year) {
      const fallback = new Date(year, month - 1, day)
      if (!Number.isNaN(fallback.getTime())) return fallback
    }
  }

  return null
}

const getEffectiveWindow = (startDate: Date, endDate: Date) => {
  const today = startOfDay(new Date())
  const priorityEndCap = addDays(today, PRIORITY_WINDOW_DAYS)

  const normalizedStart = new Date(startDate)
  normalizedStart.setHours(0, 0, 0, 0)

  const normalizedEnd = new Date(endDate)
  normalizedEnd.setHours(0, 0, 0, 0)

  const requestedStart = normalizedStart > today ? normalizedStart : today
  const requestedEnd = normalizedEnd
  const priorityStart = requestedStart
  const priorityEnd = requestedEnd < priorityEndCap ? requestedEnd : priorityEndCap

  return {
    requestedStart,
    requestedEnd,
    priorityStart,
    priorityEnd,
    shouldFallbackToRequested: requestedEnd > priorityEndCap,
    isValid: requestedStart <= requestedEnd,
  }
}

const inRange = (date: Date, startDate: Date, endDate: Date) => {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  return date >= start && date <= end
}

const getArrivalDate = (row: BookingExportLike): Date | null => {
  const record = row as Record<string, unknown>
  const rawArrival = row.arrival_date
    || (typeof record["Date d'arrivée"] === 'string' ? record["Date d'arrivée"] : null)
    || (typeof record["Date d'arrivÃ©e"] === 'string' ? record["Date d'arrivÃ©e"] : null)
    || (typeof record["Date d'arrivÃƒÂ©e"] === 'string' ? record["Date d'arrivÃƒÂ©e"] : null)

  return toDate(rawArrival)
}

const scanBookingExport = async (hotelId: string | null, rangeStart: Date, rangeEnd: Date): Promise<BookingExportLike[]> => {
  const matches: BookingExportLike[] = []
  let offset = 0

  while (offset < BOOKING_EXPORT_MAX_SCAN) {
    let query = supabase
      .from('booking_export')
      .select('*')
      .range(offset, offset + BOOKING_EXPORT_CHUNK_SIZE - 1)

    if (hotelId) {
      query = query.eq('hotel_id', hotelId)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []) as BookingExportLike[]
    if (rows.length === 0) break

    rows.forEach((row) => {
      const arrival = getArrivalDate(row)
      if (arrival && inRange(arrival, rangeStart, rangeEnd)) {
        matches.push(row)
      }
    })

    if (rows.length < BOOKING_EXPORT_CHUNK_SIZE) break
    offset += BOOKING_EXPORT_CHUNK_SIZE
  }

  return matches
}

const fetchEvents = async (hotelId: string, startDate: Date, endDate: Date): Promise<EventsCalendar[]> => {
  const { priorityStart, priorityEnd, requestedStart, requestedEnd, shouldFallbackToRequested, isValid } = getEffectiveWindow(startDate, endDate)
  if (!isValid) return []

  const parseEventDate = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return null
    return toDate(value)
  }

  const eventOverlaps = (row: EventLike, rangeStart: Date, rangeEnd: Date) => {
    const start = parseEventDate(row['DÃ©but'] ?? row['Début'] ?? row.start_date)
    const end = parseEventDate(row['Fin'] ?? row.end_date) || start
    if (!start || !end) return false
    return start <= rangeEnd && end >= rangeStart
  }

  const queryRange = async (rangeStart: Date, rangeEnd: Date) => {
    const { data, error } = await supabase
      .from('events_calendar')
      .select('*')
      .eq('hotel_id', hotelId)
      .limit(5000)

    if (error) throw error
    return ((data || []) as EventLike[]).filter((row) => eventOverlaps(row, rangeStart, rangeEnd))
  }

  let rows = await queryRange(priorityStart, priorityEnd)
  if (rows.length === 0 && shouldFallbackToRequested) {
    rows = await queryRange(requestedStart, requestedEnd)
  }

  return rows as EventsCalendar[]
}

export const useEvents = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['events', hotelId, startDate, endDate, PRIORITY_WINDOW_DAYS],
    queryFn: () => fetchEvents(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}

const fetchDisponibilites = async (hotelId: string, startDate: Date, endDate: Date): Promise<Disponibilites[]> => {
  const { priorityStart, priorityEnd, requestedStart, requestedEnd, shouldFallbackToRequested, isValid } = getEffectiveWindow(startDate, endDate)
  if (!isValid) return []

  const queryRange = async (rangeStart: Date, rangeEnd: Date) => {
    const { data, error } = await supabase
      .from('disponibilites')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('date', format(rangeStart, 'yyyy-MM-dd'))
      .lte('date', format(rangeEnd, 'yyyy-MM-dd'))
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  }

  let rows = await queryRange(priorityStart, priorityEnd)
  if (rows.length === 0 && shouldFallbackToRequested) {
    rows = await queryRange(requestedStart, requestedEnd)
  }

  return rows
}

export const useDisponibilites = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['disponibilites', hotelId, startDate, endDate, PRIORITY_WINDOW_DAYS],
    queryFn: () => fetchDisponibilites(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}

const fetchReservations = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingExport[]> => {
  const { priorityStart, priorityEnd, requestedStart, requestedEnd, shouldFallbackToRequested, isValid } = getEffectiveWindow(startDate, endDate)
  if (!isValid) return []

  let rows = await scanBookingExport(hotelId, priorityStart, priorityEnd)
  if (rows.length === 0 && shouldFallbackToRequested) {
    rows = await scanBookingExport(hotelId, requestedStart, requestedEnd)
  }

  if (rows.length === 0) {
    rows = await scanBookingExport(null, requestedStart, requestedEnd)
  }

  return rows.sort((a, b) => {
    const da = getArrivalDate(a)?.getTime() ?? 0
    const db = getArrivalDate(b)?.getTime() ?? 0
    return da - db
  })
}

export const useReservations = (hotelId: string, startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['reservations', hotelId, startDate, endDate, PRIORITY_WINDOW_DAYS],
    queryFn: () => fetchReservations(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}
