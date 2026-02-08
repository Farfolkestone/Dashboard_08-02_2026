import { addDays, format, startOfDay } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { pushMetric } from '../utils/metricsLogger'

type BookingApercu = Database['public']['Tables']['booking_apercu']['Row']
type BookingExport = Database['public']['Tables']['booking_export']['Row']

type BookingExportLike = BookingExport & {
  arrival_date?: string | null
}

type BookingApercuLike = BookingApercu & {
  date?: string | null
}

const PRIORITY_WINDOW_DAYS = 90
const BOOKING_EXPORT_CHUNK_SIZE = 20000
const BOOKING_EXPORT_MAX_SCAN = 200000
const ARRIVAL_COLUMNS = ['arrival_date']

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const [, y, m, d] = iso
    const local = new Date(Number(y), Number(m) - 1, Number(d))
    if (!Number.isNaN(local.getTime())) return local
  }

  const frDash = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (frDash) {
    const [, d, m, y] = frDash
    const local = new Date(Number(y), Number(m) - 1, Number(d))
    if (!Number.isNaN(local.getTime())) return local
  }

  const frSlash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (frSlash) {
    const [, d, m, y] = frSlash
    const local = new Date(Number(y), Number(m) - 1, Number(d))
    if (!Number.isNaN(local.getTime())) return local
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed
  return null
}

const getEffectiveWindow = (startDate: Date, endDate: Date) => {
  const today = startOfDay(new Date())
  const priorityEndCap = addDays(today, PRIORITY_WINDOW_DAYS)

  const normalizedStart = new Date(startDate)
  normalizedStart.setHours(0, 0, 0, 0)

  const normalizedEnd = new Date(endDate)
  normalizedEnd.setHours(0, 0, 0, 0)

  const requestedStart = normalizedStart
  const requestedEnd = normalizedEnd
  const priorityStart = requestedStart > today ? requestedStart : today
  const priorityEnd = requestedEnd < priorityEndCap ? requestedEnd : priorityEndCap

  return {
    requestedStart,
    requestedEnd,
    priorityStart,
    priorityEnd,
    shouldFallbackToRequested: requestedEnd > priorityEndCap || requestedStart < today,
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

const isArrivalLikeKey = (normalized: string) =>
  (normalized.includes('arriv') || normalized.includes('arrival') || normalized.includes('checkin')) &&
  !normalized.includes('depart') &&
  !normalized.includes('checkout')

const isDepartureLikeKey = (normalized: string) =>
  normalized.includes('depart') || normalized.includes('checkout')

const inferArrivalKey = (rows: BookingExportLike[], rangeStart: Date, rangeEnd: Date): string | null => {
  if (rows.length === 0) return null

  const sample = rows.slice(0, 400)
  const candidates = new Map<string, { parseable: number; inRange: number }>()

  sample.forEach((row) => {
    const record = row as Record<string, unknown>
    Object.entries(record).forEach(([key, raw]) => {
      if (typeof raw !== 'string' || raw.trim() === '') return
      const parsed = toDate(raw)
      if (!parsed) return

      const current = candidates.get(key) || { parseable: 0, inRange: 0 }
      current.parseable += 1
      if (inRange(parsed, rangeStart, rangeEnd)) current.inRange += 1
      candidates.set(key, current)
    })
  })

  const ranked = Array.from(candidates.entries())
    .filter(([, score]) => score.parseable >= 5)
    .sort((a, b) => {
      const an = normalizeKey(a[0])
      const bn = normalizeKey(b[0])
      const aBoost = (isArrivalLikeKey(an) ? 4 : 0) - (isDepartureLikeKey(an) ? 6 : 0)
      const bBoost = (isArrivalLikeKey(bn) ? 4 : 0) - (isDepartureLikeKey(bn) ? 6 : 0)
      if (bBoost !== aBoost) return bBoost - aBoost
      if (b[1].inRange !== a[1].inRange) return b[1].inRange - a[1].inRange
      return b[1].parseable - a[1].parseable
    })

  const arrivalPreferred = ranked.find(([key]) => isArrivalLikeKey(normalizeKey(key)))
  if (arrivalPreferred) return arrivalPreferred[0]

  const nonDepartureFallback = ranked.find(([key]) => !isDepartureLikeKey(normalizeKey(key)))
  if (nonDepartureFallback) return nonDepartureFallback[0]

  return ranked[0]?.[0] || null
}

const extractArrivalRaw = (row: BookingExportLike, preferredKey?: string | null): string | null => {
  const record = row as Record<string, unknown>

  if (preferredKey) {
    const value = record[preferredKey]
    if (typeof value === 'string' && value.trim() !== '') return value
  }

  if (typeof row.arrival_date === 'string' && row.arrival_date.trim() !== '') {
    return row.arrival_date
  }

  for (const key of ARRIVAL_COLUMNS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }

  const dynamicKey = Object.keys(record).find((key) => {
    const normalized = normalizeKey(key)
    return normalized.includes('arrival') || normalized.includes('arrivee') || normalized.includes('arrive') || normalized.includes('checkin')
  })

  if (!dynamicKey) return null
  const value = record[dynamicKey]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

const getArrivalDate = (row: BookingExportLike, preferredKey?: string | null): Date | null => {
  return toDate(extractArrivalRaw(row, preferredKey))
}

const getApercuDate = (row: BookingApercuLike): Date | null => {
  const record = row as Record<string, unknown>
  const rawDate = row.date || (typeof record.Date === 'string' ? record.Date : null)
  return toDate(rawDate)
}

const fetchBookingApercu = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingApercu[]> => {
  const { priorityStart, priorityEnd, requestedStart, requestedEnd, shouldFallbackToRequested, isValid } = getEffectiveWindow(startDate, endDate)
  if (!isValid) return []

  const queryApercuRange = async (rangeStart: Date, rangeEnd: Date) => {
    const { data, error } = await supabase
      .from('booking_apercu')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('Date', format(rangeStart, 'yyyy-MM-dd'))
      .lte('Date', format(rangeEnd, 'yyyy-MM-dd'))
      .order('Date', { ascending: true })
      .limit(12000)

    if (error) throw error
    return data || []
  }

  const t0 = performance.now()
  let rows = await queryApercuRange(priorityStart, priorityEnd)
  let strategy = 'priority'

  if (rows.length === 0 && shouldFallbackToRequested) {
    rows = await queryApercuRange(requestedStart, requestedEnd)
    strategy = 'requested-fallback'
  }

  const filtered = rows
    .filter((row) => {
      const parsed = getApercuDate(row as BookingApercuLike)
      return parsed ? inRange(parsed, requestedStart, requestedEnd) : false
    })
    .sort((a, b) => {
      const da = getApercuDate(a as BookingApercuLike)?.getTime() ?? 0
      const db = getApercuDate(b as BookingApercuLike)?.getTime() ?? 0
      return da - db
    })

  pushMetric('booking_apercu_fetch', {
    hotelId,
    strategy,
    requestedStart: format(requestedStart, 'yyyy-MM-dd'),
    requestedEnd: format(requestedEnd, 'yyyy-MM-dd'),
    rowsFetched: rows.length,
    rowsReturned: filtered.length,
    ms: Math.round(performance.now() - t0),
  })

  return filtered
}

const queryByArrivalColumn = async (hotelId: string, column: string, startDate: Date, endDate: Date): Promise<BookingExportLike[]> => {
  const startIso = format(startDate, 'yyyy-MM-dd')
  const endIso = format(endDate, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('booking_export')
    .select('*')
    .eq('hotel_id', hotelId)
    .gte(column, startIso)
    .lte(column, endIso)
    .limit(50000)

  if (error) {
    pushMetric('booking_export_column_error', { hotelId, column, error: error.message })
    return []
  }

  return (data || []) as BookingExportLike[]
}

const scanBookingExport = async (hotelId: string | null, rangeStart: Date, rangeEnd: Date): Promise<BookingExportLike[]> => {
  const matches: BookingExportLike[] = []
  let offset = 0
  let rowsScanned = 0
  let rowsWithArrival = 0
  let inferredKey: string | null = null

  while (offset < BOOKING_EXPORT_MAX_SCAN) {
    let query = supabase
      .from('booking_export')
      .select('*')
      .range(offset, offset + BOOKING_EXPORT_CHUNK_SIZE - 1)

    if (hotelId) query = query.eq('hotel_id', hotelId)

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []) as BookingExportLike[]
    if (rows.length === 0) break

    if (!inferredKey) {
      inferredKey = inferArrivalKey(rows, rangeStart, rangeEnd)
      pushMetric('booking_export_inferred_key', {
        hotelId: hotelId || 'all',
        inferredKey,
        sampleKeys: Object.keys((rows[0] || {}) as Record<string, unknown>).slice(0, 20),
      })
    }

    rowsScanned += rows.length
    rows.forEach((row) => {
      const arrival = getArrivalDate(row, inferredKey)
      if (arrival) rowsWithArrival += 1
      if (arrival && inRange(arrival, rangeStart, rangeEnd)) matches.push(row)
    })

    if (rows.length < BOOKING_EXPORT_CHUNK_SIZE) break
    offset += BOOKING_EXPORT_CHUNK_SIZE
  }

  pushMetric('booking_export_scan_summary', {
    hotelId: hotelId || 'all',
    scanned: rowsScanned,
    rowsWithArrival,
    matched: matches.length,
    rangeStart: format(rangeStart, 'yyyy-MM-dd'),
    rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
  })

  return matches
}

const fetchBookingExport = async (hotelId: string, startDate: Date, endDate: Date): Promise<BookingExport[]> => {
  const { priorityStart, priorityEnd, requestedStart, requestedEnd, shouldFallbackToRequested, isValid } = getEffectiveWindow(startDate, endDate)
  if (!isValid) return []

  const t0 = performance.now()
  pushMetric('booking_export_fetch_start', {
    hotelId,
    requestedStart: format(requestedStart, 'yyyy-MM-dd'),
    requestedEnd: format(requestedEnd, 'yyyy-MM-dd'),
  })

  try {
    let strategy = 'column-filter'
    let rows: BookingExportLike[] = []

    for (const col of ARRIVAL_COLUMNS) {
      rows = await queryByArrivalColumn(hotelId, col, priorityStart, priorityEnd)
      if (rows.length > 0) {
        strategy = `column-${col}-priority`
        break
      }
    }

    if (rows.length === 0 && shouldFallbackToRequested) {
      rows = await scanBookingExport(hotelId, requestedStart, requestedEnd)
      strategy = 'scan-hotel'
    }

    if (rows.length === 0) {
      rows = await scanBookingExport(null, requestedStart, requestedEnd)
      strategy = 'scan-global'
    }

    const sorted = rows.sort((a, b) => {
      const da = getArrivalDate(a)?.getTime() ?? 0
      const db = getArrivalDate(b)?.getTime() ?? 0
      return da - db
    })

    pushMetric('booking_export_fetch', {
      hotelId,
      strategy,
      requestedStart: format(requestedStart, 'yyyy-MM-dd'),
      requestedEnd: format(requestedEnd, 'yyyy-MM-dd'),
      rowsReturned: sorted.length,
      ms: Math.round(performance.now() - t0),
    })

    return sorted
  } catch (error) {
    pushMetric('booking_export_fetch_error', {
      hotelId,
      message: error instanceof Error ? error.message : String(error),
      requestedStart: format(requestedStart, 'yyyy-MM-dd'),
      requestedEnd: format(requestedEnd, 'yyyy-MM-dd'),
    })
    throw error
  }
}

export const useBookingApercu = (hotelId: string, startDate: Date, endDate: Date) => {
  const startIso = format(startDate, 'yyyy-MM-dd')
  const endIso = format(endDate, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['booking-apercu', hotelId, startIso, endIso, PRIORITY_WINDOW_DAYS],
    queryFn: () => fetchBookingApercu(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}

export const useBookingExport = (hotelId: string, startDate: Date, endDate: Date) => {
  const startIso = format(startDate, 'yyyy-MM-dd')
  const endIso = format(endDate, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['booking-export', hotelId, startIso, endIso, PRIORITY_WINDOW_DAYS],
    queryFn: () => fetchBookingExport(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}
