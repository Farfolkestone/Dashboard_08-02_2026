import React, { useMemo, useState } from 'react'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSaturday, isSunday, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Eye, EyeOff, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useBookingApercu, useBookingExport } from '../../hooks/useBookingData'
import { useCompetitorRates } from '../../hooks/useCompetitorData'
import { useEvents } from '../../hooks/useHotelData'
import { useAuthStore } from '../../store/useAuthStore'
import type { Database } from '../../types/database.types'
import { formatCurrency } from '../../utils/formatters'
import { clearMetrics, getMetrics } from '../../utils/metricsLogger'

type BookingExportRow = Database['public']['Tables']['booking_export']['Row']
type BookingApercuRow = Database['public']['Tables']['booking_apercu']['Row']
type BookingTarifsRow = Database['public']['Tables']['booking_tarifs']['Row']
type EventRow = Database['public']['Tables']['events_calendar']['Row']
type BookingExportLike = BookingExportRow & {
  arrival_date?: string | null
  departure_date?: string | null
  total_amount?: number | null
}

type BookingApercuLike = BookingApercuRow & {
  date?: string | null
  own_price?: number | null
  compset_median?: number | null
  market_demand?: number | null
}

type BookingTarifsLike = BookingTarifsRow & Record<string, unknown>

type DisplayRow = {
  id: string
  arrival: Date | null
  departure: Date | null
  reference: string
  status: string
  origin: string
  roomType: string
  rooms: number
  nights: number
  adults: number
  children: number
  country: string
  amount: number
  isCancelled: boolean
}

type RangePreset = 'week' | 'month' | 'quarter' | 'custom'

type ColumnKey =
  | 'arrival'
  | 'departure'
  | 'reference'
  | 'status'
  | 'origin'
  | 'roomType'
  | 'rooms'
  | 'nights'
  | 'guests'
  | 'country'
  | 'amount'
type SortDirection = 'asc' | 'desc'

const toIsoLocal = (date: Date) => format(date, 'yyyy-MM-dd')

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || 2000, (month || 1) - 1, day || 1)
}

const parseDate = (value: string | null | undefined): Date | null => {
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

const dayDiff = (start: Date, end: Date) => {
  const s = new Date(start)
  const e = new Date(end)
  s.setHours(0, 0, 0, 0)
  e.setHours(0, 0, 0, 0)
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
}

const inferRoomsFromRoomType = (roomType: string) => {
  const normalized = normalizeKey(roomType || '')
  if (normalized.includes('deuxchambresadjacentes') || normalized.includes('2chambresadjacentes')) return 2
  return 1
}

const getEffectiveNights = (row: DisplayRow) => {
  if (row.nights > 0) return row.nights
  if (row.arrival && row.departure) return Math.max(1, dayDiff(row.arrival, row.departure))
  return 0
}

const getEffectiveRooms = (row: DisplayRow) => {
  const sourceRooms = row.rooms > 0 ? row.rooms : 1
  const inferredRooms = inferRoomsFromRoomType(row.roomType || '')
  return Math.max(sourceRooms, inferredRooms)
}

const getEffectiveRoomNights = (row: DisplayRow) => {
  const nights = getEffectiveNights(row)
  if (nights <= 0) return 0
  return getEffectiveRooms(row) * nights
}

const pickNumber = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  }
  return 0
}

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()

const readString = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

const readNumber = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  }
  return 0
}

const getDynamicDate = (record: Record<string, unknown>, mode: 'arrival' | 'departure') => {
  const key = Object.keys(record).find((candidate) => {
    const k = normalizeKey(candidate)
    if (mode === 'arrival') return (k.includes('arriv') || k.includes('checkin')) && !k.includes('depart') && !k.includes('checkout')
    return k.includes('depart') || k.includes('checkout')
  })

  if (!key) return null
  const value = record[key]
  return typeof value === 'string' ? parseDate(value) : null
}

const getArrivalDate = (record: Record<string, unknown>) => {
  const direct = parseDate(readString(record, [
    'arrival_date',
    "Date d'arrivée",
    'Date arrivee',
    'Arrivee',
    'Arrival',
    'Check-in',
    "Date d'arrivee",
    "Date d'arrivÃ©e",
    "Date d'arrivÃƒÂ©e",
    "Date d'arrivÃƒÆ’Ã‚Â©e",
  ]))
  return direct || getDynamicDate(record, 'arrival')
}

const getDepartureDate = (record: Record<string, unknown>) => {
  const direct = parseDate(readString(record, [
    'departure_date',
    'Date de depart',
    'Departure',
    'Check-out',
    'Date de dÃ©part',
    'Date de dÃƒÂ©part',
    'Date de dÃƒÆ’Ã‚Â©part',
  ]))
  return direct || getDynamicDate(record, 'departure')
}

const isCancelled = (status: string) => {
  const lower = status.toLowerCase()
  return lower.includes('annul') || lower.includes('cancel')
}

const defaultVisibleColumns: Record<ColumnKey, boolean> = {
  arrival: true,
  departure: true,
  reference: true,
  status: true,
  origin: true,
  roomType: true,
  rooms: true,
  nights: true,
  guests: true,
  country: false,
  amount: true,
}

export const CalendarInsightsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()
  const hotelId = profile?.hotel_id || 'H2258'

  const today = new Date()
  const [rangePreset, setRangePreset] = useState<RangePreset>('month')
  const [rangeStartInput, setRangeStartInput] = useState(toIsoLocal(today))
  const [rangeEndInput, setRangeEndInput] = useState(toIsoLocal(addDays(today, 30)))

  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [visibleMonth, setVisibleMonth] = useState<Date>(today)

  const [showCancellations, setShowCancellations] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(defaultVisibleColumns)
  const [metricsVersion, setMetricsVersion] = useState(0)
  const [sortBy, setSortBy] = useState<ColumnKey>('arrival')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [isCalendarDayFilterActive, setIsCalendarDayFilterActive] = useState(false)
  const [showRevenueSeries, setShowRevenueSeries] = useState(false)
  const [showOriginChart, setShowOriginChart] = useState(false)
  const [showAvgPriceSeries, setShowAvgPriceSeries] = useState(false)
  const [showCompetitionIndicators, setShowCompetitionIndicators] = useState(true)
  const [detailDateIso, setDetailDateIso] = useState<string | null>(toIsoLocal(today))

  const rangeStart = parseLocalDate(rangeStartInput)
  const rangeEnd = parseLocalDate(rangeEndInput)
  const monthStart = startOfMonth(visibleMonth)
  const monthEnd = endOfMonth(addMonths(visibleMonth, 1))
  const fetchStart = rangeStart < monthStart ? rangeStart : monthStart
  const fetchEnd = rangeEnd > monthEnd ? rangeEnd : monthEnd

  const { data: reservations = [], isLoading, refetch, isFetching } = useBookingExport(hotelId, fetchStart, fetchEnd)
  const { data: bookingApercu = [] } = useBookingApercu(hotelId, fetchStart, fetchEnd)
  const { data: competitorRates = [] } = useCompetitorRates(hotelId, fetchStart, fetchEnd)
  const { data: events = [] } = useEvents(hotelId, fetchStart, fetchEnd)

  const allFetchedRows = useMemo(() => {
    return (reservations as BookingExportLike[])
      .map((raw) => {
        const record = raw as unknown as Record<string, unknown>
        const arrival = getArrivalDate(record)
        const departure = getDepartureDate(record)
        const status = readString(record, ['Etat'])

        return {
          id: raw.id,
          arrival,
          departure,
          reference: readString(record, ['Référence', 'RÃ©fÃ©rence']) || raw.id,
          status,
          origin: readString(record, ['Origine', "Type d'origine"]),
          roomType: readString(record, ['Type de chambre']),
          rooms: readNumber(record, ['Chambres']),
          nights: readNumber(record, ['Nuits']),
          adults: readNumber(record, ['Adultes']),
          children: readNumber(record, ['Enfants']),
          country: readString(record, ['Pays']),
          amount: readNumber(record, ['Montant total']),
          isCancelled: isCancelled(status),
        } satisfies DisplayRow
      })
      .filter((row) => row.arrival !== null)
      .sort((a, b) => {
        const da = a.arrival?.getTime() ?? 0
        const db = b.arrival?.getTime() ?? 0
        return da - db
      })
  }, [reservations])

  const baseRows = useMemo(() => {
    return allFetchedRows.filter((row) => {
      if (!row.arrival) return false
      const start = new Date(rangeStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(rangeEnd)
      end.setHours(23, 59, 59, 999)
      return row.arrival >= start && row.arrival <= end
    })
  }, [allFetchedRows, rangeStart, rangeEnd])

  const arrivalsByDate = useMemo(() => {
    const map = new Map<string, DisplayRow[]>()
    allFetchedRows.forEach((row) => {
      if (!row.arrival) return
      const key = toIsoLocal(row.arrival)
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    })
    return map
  }, [allFetchedRows])

  const apercuByDate = useMemo(() => {
    const map = new Map<string, { ownLow: number; compsetMedian: number; demandIndex: number }>()
    ;(bookingApercu as BookingApercuLike[]).forEach((row) => {
      const record = row as unknown as Record<string, unknown>
      const dateRaw = row.date || row.Date
      const date = parseDate(dateRaw)
      if (!date) return
      const key = toIsoLocal(date)
      const ownLow = row.own_price ?? pickNumber(record, ['Votre hôtel le plus bas', 'Votre hÃ´tel le plus bas'])
      const compsetMedian = row.compset_median ?? pickNumber(record, ['médiane du compset', 'mÃ©diane du compset'])
      const demandIndex = row.market_demand ?? pickNumber(record, ['Demande du marché', 'Demande du marchÃ©'])
      map.set(key, { ownLow, compsetMedian, demandIndex })
    })
    return map
  }, [bookingApercu])

  const lowestCompetitorByDate = useMemo(() => {
    const ignoreKeys = new Set(['id', 'hotel_id', 'date_mise_a_jour', 'Jour', 'Date', 'Demande du marché', 'Demande du marchÃ©', 'Folkestone Opéra', 'Folkestone OpÃ©ra'])
    const map = new Map<string, { hotelName: string; price: number }>()

    ;(competitorRates as BookingTarifsLike[]).forEach((row) => {
      const dateRaw = typeof row.Date === 'string' ? row.Date : ''
      const date = parseDate(dateRaw)
      if (!date) return
      const key = toIsoLocal(date)

      let lowestName = ''
      let lowestPrice = Number.POSITIVE_INFINITY
      Object.entries(row).forEach(([col, value]) => {
        if (ignoreKeys.has(col)) return
        if (typeof value !== 'number') return
        if (value <= 0) return
        if (value < lowestPrice) {
          lowestPrice = value
          lowestName = col
        }
      })

      if (lowestName && Number.isFinite(lowestPrice)) {
        map.set(key, { hotelName: lowestName, price: lowestPrice })
      }
    })

    return map
  }, [competitorRates])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    ;(events as EventRow[]).forEach((event) => {
      const row = event as Record<string, unknown>
      const name = readString(row, ['Ã‰vÃ©nement', 'Événement', 'event', 'name']) || 'Evenement'
      const start = parseDate(readString(row, ['DÃ©but', 'Début', 'start_date']))
      const end = parseDate(readString(row, ['Fin', 'end_date'])) || start
      if (!start || !end) return
      const cur = new Date(start)
      cur.setHours(0, 0, 0, 0)
      const last = new Date(end)
      last.setHours(0, 0, 0, 0)
      while (cur <= last) {
        const key = toIsoLocal(cur)
        const list = map.get(key) || []
        list.push(name)
        map.set(key, list)
        cur.setDate(cur.getDate() + 1)
      }
    })
    return map
  }, [events])

  const selectedKey = toIsoLocal(selectedDate)
  const effectiveSelectedKey = selectedKey

  const rangeRows = useMemo(() => {
    return showCancellations ? baseRows : baseRows.filter((row) => !row.isCancelled)
  }, [baseRows, showCancellations])

  const calendarRows = useMemo(() => {
    const selectedDateRows = arrivalsByDate.get(effectiveSelectedKey) || []
    return showCancellations ? selectedDateRows : selectedDateRows.filter((row) => !row.isCancelled)
  }, [arrivalsByDate, effectiveSelectedKey, showCancellations])

  const averageExpectedRateByArrivalDate = useMemo(() => {
    const map = new Map<string, number>()
    const aggregate = new Map<string, { amount: number; roomNights: number }>()
    allFetchedRows.forEach((row) => {
      if (!row.arrival) return
      const key = toIsoLocal(row.arrival)
      const current = aggregate.get(key) || { amount: 0, roomNights: 0 }
      current.amount += row.amount
      current.roomNights += getEffectiveRoomNights(row)
      aggregate.set(key, current)
    })
    aggregate.forEach((v, k) => {
      map.set(k, v.roomNights > 0 ? v.amount / v.roomNights : 0)
    })
    return map
  }, [allFetchedRows])

  const computeStats = (rows: DisplayRow[]) => {
    const total = rows.length
    const cancelled = rows.filter((row) => row.isCancelled).length
    const confirmed = total - cancelled
    const rooms = rows.reduce((sum, row) => sum + getEffectiveRooms(row), 0)
    const nights = rows.reduce((sum, row) => sum + getEffectiveNights(row), 0)
    const revenue = rows.reduce((sum, row) => sum + row.amount, 0)
    const roomNights = rows.reduce((sum, row) => sum + getEffectiveRoomNights(row), 0)
    const avgNightPrice = roomNights > 0 ? revenue / roomNights : 0
    const byOrigin = rows.reduce<Record<string, number>>((acc, row) => {
      const origin = row.origin?.trim() || 'Non defini'
      acc[origin] = (acc[origin] || 0) + 1
      return acc
    }, {})
    const topOrigins = Object.entries(byOrigin)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    return { total, cancelled, confirmed, rooms, nights, revenue, avgNightPrice, topOrigins }
  }

  const rangeStats = useMemo(() => computeStats(rangeRows), [rangeRows])
  const calendarStats = useMemo(() => computeStats(calendarRows), [calendarRows])

  const getSortValue = (row: DisplayRow, key: ColumnKey): number | string => {
    if (key === 'arrival') return row.arrival?.getTime() ?? 0
    if (key === 'departure') return row.departure?.getTime() ?? 0
    if (key === 'reference') return row.reference || ''
    if (key === 'status') return row.status || ''
    if (key === 'origin') return row.origin || ''
    if (key === 'roomType') return row.roomType || ''
    if (key === 'rooms') return getEffectiveRooms(row)
    if (key === 'nights') return row.nights
    if (key === 'guests') return row.adults + row.children
    if (key === 'country') return row.country || ''
    return row.amount
  }

  const rangeSortedRows = useMemo(() => {
    const sorted = [...rangeRows].sort((a, b) => {
      const va = getSortValue(a, sortBy)
      const vb = getSortValue(b, sortBy)
      if (typeof va === 'number' && typeof vb === 'number') return va - vb
      return String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' })
    })
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [rangeRows, sortBy, sortDirection])

  const calendarSortedRows = useMemo(() => {
    const sorted = [...calendarRows].sort((a, b) => {
      const va = getSortValue(a, sortBy)
      const vb = getSortValue(b, sortBy)
      if (typeof va === 'number' && typeof vb === 'number') return va - vb
      return String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' })
    })
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [calendarRows, sortBy, sortDirection])

  const monthDays = eachDayOfInterval({ start: startOfMonth(visibleMonth), end: endOfMonth(visibleMonth) })
  const metricRows = getMetrics(undefined, 40).filter((m) => m.scope.startsWith('booking_export'))
  const displayedRows = isCalendarDayFilterActive ? calendarSortedRows : rangeSortedRows
  const displayedStats = isCalendarDayFilterActive ? calendarStats : rangeStats

  const dailyChartData = useMemo(() => {
    const intervalDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    const index = new Map<string, { arrivals: number; revenue: number; roomNights: number }>()

    rangeRows.forEach((row) => {
      if (!row.arrival) return
      const key = toIsoLocal(row.arrival)
      const bucket = index.get(key) || { arrivals: 0, revenue: 0, roomNights: 0 }
      bucket.arrivals += 1
      bucket.revenue += row.amount
      bucket.roomNights += getEffectiveRoomNights(row)
      index.set(key, bucket)
    })

    return intervalDays.map((day) => {
      const key = toIsoLocal(day)
      const bucket = index.get(key) || { arrivals: 0, revenue: 0, roomNights: 0 }
      return {
        date: key,
        label: format(day, 'dd/MM'),
        arrivals: bucket.arrivals,
        revenue: bucket.revenue,
        avgNightPrice: bucket.roomNights > 0 ? bucket.revenue / bucket.roomNights : 0,
      }
    })
  }, [rangeRows, rangeStart, rangeEnd])

  const originChartData = useMemo(() => {
    const byOrigin = rangeRows.reduce<Record<string, { arrivals: number; revenue: number; roomNights: number }>>((acc, row) => {
      const key = row.origin?.trim() || 'Non defini'
      const bucket = acc[key] || { arrivals: 0, revenue: 0, roomNights: 0 }
      bucket.arrivals += 1
      bucket.revenue += row.amount
      bucket.roomNights += getEffectiveRoomNights(row)
      acc[key] = bucket
      return acc
    }, {})

    return Object.entries(byOrigin)
      .map(([origin, values]) => ({
        origin,
        arrivals: values.arrivals,
        revenue: values.revenue,
        avgNightPrice: values.roomNights > 0 ? values.revenue / values.roomNights : 0,
      }))
      .sort((a, b) => b.arrivals - a.arrivals)
      .slice(0, 10)
  }, [rangeRows])

  const yieldAnalysis = useMemo(() => {
    const activeKeys = dailyChartData.map((d) => d.date)
    let highDemandDays = 0
    let aboveCompsetDays = 0
    let undercutByCompsetDays = 0

    activeKeys.forEach((key) => {
      const apercu = apercuByDate.get(key)
      const ownLow = apercu?.ownLow || 0
      const compsetMedian = apercu?.compsetMedian || 0
      const demandPct = Math.round((apercu?.demandIndex || 0) * 100)
      const compLowest = lowestCompetitorByDate.get(key)?.price || 0

      if (demandPct >= 70) highDemandDays += 1
      if (ownLow > 0 && compsetMedian > 0 && ownLow >= compsetMedian) aboveCompsetDays += 1
      if (ownLow > 0 && compLowest > 0 && ownLow > compLowest) undercutByCompsetDays += 1
    })

    return { highDemandDays, aboveCompsetDays, undercutByCompsetDays }
  }, [apercuByDate, dailyChartData, lowestCompetitorByDate])

  const applyPreset = (preset: RangePreset) => {
    const now = new Date()
    setRangePreset(preset)
    if (preset === 'week') {
      setRangeStartInput(toIsoLocal(now))
      setRangeEndInput(toIsoLocal(addDays(now, 6)))
    } else if (preset === 'month') {
      setRangeStartInput(toIsoLocal(now))
      setRangeEndInput(toIsoLocal(addDays(now, 30)))
    } else if (preset === 'quarter') {
      setRangeStartInput(toIsoLocal(now))
      setRangeEndInput(toIsoLocal(addDays(now, 89)))
    }
  }

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'booking-export' && query.queryKey[1] === hotelId,
    })
    await queryClient.invalidateQueries({
      predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'booking-apercu' && query.queryKey[1] === hotelId,
    })
    await refetch()
    setMetricsVersion((v) => v + 1)
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Calendrier des arrivees</h2>
            <p className="text-sm text-slate-500">Vue previsionnelle des arrivees, chiffre d'affaires et origine sur la plage selectionnee.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => applyPreset('week')} className={`rounded-lg px-3 py-2 text-xs font-bold ${rangePreset === 'week' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'}`}>Semaine</button>
            <button onClick={() => applyPreset('month')} className={`rounded-lg px-3 py-2 text-xs font-bold ${rangePreset === 'month' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'}`}>Mois</button>
            <button onClick={() => applyPreset('quarter')} className={`rounded-lg px-3 py-2 text-xs font-bold ${rangePreset === 'quarter' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'}`}>3 mois</button>
            <button onClick={() => setRangePreset('custom')} className={`rounded-lg px-3 py-2 text-xs font-bold ${rangePreset === 'custom' ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700'}`}>Personnalisee</button>
            <button onClick={handleRefresh} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><RotateCcw className="mr-1 inline h-3 w-3" /> {isFetching ? 'Rafraichissement...' : 'Rafraichir'}</button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">Graphiques plage selectionnee</p>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={showRevenueSeries} onChange={(e) => setShowRevenueSeries(e.target.checked)} />
              CA par jour d'arrivee
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={showAvgPriceSeries} onChange={(e) => setShowAvgPriceSeries(e.target.checked)} />
              Prix moyen/nuitee
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={showOriginChart} onChange={(e) => setShowOriginChart(e.target.checked)} />
              Graphe origine
            </label>
          </div>
          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={280}>
              <ComposedChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(value)}€`} />
                <Tooltip
                  formatter={(value: number | string | undefined, name: string | undefined) => {
                    const numeric = Number(value ?? 0)
                    if (name === "CA par jour d'arrivee" || name === 'Prix moyen/nuitee') return [formatCurrency(numeric), name || 'Valeur']
                    return [numeric, name || 'Valeur']
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="arrivals" name="Arrivees prevues" fill="#0f172a" radius={[4, 4, 0, 0]} />
                {showRevenueSeries && <Line yAxisId="right" type="monotone" dataKey="revenue" name="CA par jour d'arrivee" stroke="#0ea5e9" strokeWidth={2} dot={false} />}
                {showAvgPriceSeries && <Line yAxisId="right" type="monotone" dataKey="avgNightPrice" name="Prix moyen/nuitee" stroke="#16a34a" strokeWidth={2} dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {showOriginChart && (
            <div className="mt-4 h-[260px] w-full min-w-0 rounded-xl border border-slate-200 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={220}>
                <BarChart data={originChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="origin" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="arrivals" name="Arrivees" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-slate-700">Analyse Yield</p>
            <a href="/help-calibrage" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
              Aide calibrage & tarifs suggeres
            </a>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Jours forte demande</p>
              <p className="text-2xl font-black text-red-800">{yieldAnalysis.highDemandDays}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-700">Jours au-dessus mediane compset</p>
              <p className="text-2xl font-black text-emerald-800">{yieldAnalysis.aboveCompsetDays}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">Jours sous-cotes vs plus bas compset</p>
              <p className="text-2xl font-black text-amber-800">{yieldAnalysis.undercutByCompsetDays}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">Date d'arrivee<input type="date" value={rangeStartInput} onChange={(e) => { setRangePreset('custom'); setRangeStartInput(e.target.value) }} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label>
          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">Date de depart<input type="date" value={rangeEndInput} onChange={(e) => { setRangePreset('custom'); setRangeEndInput(e.target.value) }} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">Afficher annulations<input type="checkbox" checked={showCancellations} onChange={(e) => setShowCancellations(e.target.checked)} /></label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">Date active: <span className="font-black">{effectiveSelectedKey || '-'}</span></div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">Stats plage selectionnee</p>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-7">
              <div><p className="text-xs text-slate-500">Arrivees</p><p className="text-lg font-black">{rangeStats.total}</p></div>
              <div><p className="text-xs text-slate-500">Confirmees</p><p className="text-lg font-black">{rangeStats.confirmed}</p></div>
              <div><p className="text-xs text-slate-500">Annulations</p><p className="text-lg font-black">{rangeStats.cancelled}</p></div>
              <div><p className="text-xs text-slate-500">Chambres</p><p className="text-lg font-black">{rangeStats.rooms}</p></div>
              <div><p className="text-xs text-slate-500">Nuitees</p><p className="text-lg font-black">{rangeStats.nights}</p></div>
              <div><p className="text-xs text-emerald-700">Montants</p><p className="text-lg font-black text-emerald-800">{formatCurrency(rangeStats.revenue)}</p></div>
              <div><p className="text-xs text-slate-500">Prix moyen/nuitee</p><p className="text-lg font-black">{formatCurrency(rangeStats.avgNightPrice)}</p></div>
            </div>
            <p className="mt-2 text-xs text-slate-600">Origines: {rangeStats.topOrigins.length === 0 ? '-' : rangeStats.topOrigins.map(([origin, count]) => `${origin} (${count})`).join(' | ')}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">
              Stats vue active {isCalendarDayFilterActive ? `(jour ${effectiveSelectedKey || '-'})` : '(plage)'}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-7">
              <div><p className="text-xs text-slate-500">Arrivees</p><p className="text-lg font-black">{displayedStats.total}</p></div>
              <div><p className="text-xs text-slate-500">Confirmees</p><p className="text-lg font-black">{displayedStats.confirmed}</p></div>
              <div><p className="text-xs text-slate-500">Annulations</p><p className="text-lg font-black">{displayedStats.cancelled}</p></div>
              <div><p className="text-xs text-slate-500">Chambres</p><p className="text-lg font-black">{displayedStats.rooms}</p></div>
              <div><p className="text-xs text-slate-500">Nuitees</p><p className="text-lg font-black">{displayedStats.nights}</p></div>
              <div><p className="text-xs text-emerald-700">Montants</p><p className="text-lg font-black text-emerald-800">{formatCurrency(displayedStats.revenue)}</p></div>
              <div><p className="text-xs text-slate-500">Prix moyen/nuitee</p><p className="text-lg font-black">{formatCurrency(displayedStats.avgNightPrice)}</p></div>
            </div>
            <p className="mt-2 text-xs text-slate-600">Origines: {displayedStats.topOrigins.length === 0 ? '-' : displayedStats.topOrigins.map(([origin, count]) => `${origin} (${count})`).join(' | ')}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setShowColumnSettings((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><SlidersHorizontal className="mr-1 inline h-3 w-3" /> Colonnes</button>
          <button onClick={() => setShowMetrics((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">{showMetrics ? <EyeOff className="mr-1 inline h-3 w-3" /> : <Eye className="mr-1 inline h-3 w-3" />} Metriques</button>
          <button onClick={() => { clearMetrics(); setMetricsVersion((v) => v + 1) }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><Trash2 className="mr-1 inline h-3 w-3" /> Vider logs</button>
          <label className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700">Tri
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as ColumnKey)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">
              <option value="arrival">Arrivee</option>
              <option value="departure">Depart</option>
              <option value="reference">Reference</option>
              <option value="status">Etat</option>
              <option value="origin">Origine</option>
              <option value="roomType">Type chambre</option>
              <option value="rooms">Chambres</option>
              <option value="nights">Nuitees</option>
              <option value="guests">Guests</option>
              <option value="country">Pays</option>
              <option value="amount">Montant</option>
            </select>
          </label>
          <label className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700">Ordre
            <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as SortDirection)} className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs">
              <option value="asc">Croissant</option>
              <option value="desc">Decroissant</option>
            </select>
          </label>
          <label className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
            Vue
            <select
              value={isCalendarDayFilterActive ? 'day' : 'range'}
              onChange={(e) => setIsCalendarDayFilterActive(e.target.value === 'day')}
              className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs"
            >
              <option value="range">Plage selectionnee</option>
              <option value="day">Jour selectionne</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={showCompetitionIndicators} onChange={(e) => setShowCompetitionIndicators(e.target.checked)} />
            Afficher tarifs concurrence
          </label>
          {isCalendarDayFilterActive && (
            <button onClick={() => setIsCalendarDayFilterActive(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
              Afficher toute la plage
            </button>
          )}
          <span className="text-[10px] text-slate-400">Refresh logs: {metricsVersion}</span>
        </div>

        {showColumnSettings && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-4">
            {(Object.keys(visibleColumns) as ColumnKey[]).map((key) => (
              <label key={key} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1"><span>{key}</span><input type="checkbox" checked={visibleColumns[key]} onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [key]: e.target.checked }))} /></label>
            ))}
          </div>
        )}

        {showMetrics && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-bold text-slate-700">Metriques live</p>
            <p>Reservations chargees: {reservations.length} | Dates avec arrivees: {arrivalsByDate.size} | Date active: {effectiveSelectedKey || '-'}</p>
            <div className="mt-2 max-h-28 overflow-auto font-mono text-[11px]">
              {metricRows.length === 0 ? <p>Aucun log booking_export pour l'instant.</p> : metricRows.map((m, idx) => <div key={`${m.ts}-${idx}`}>{m.ts} | {m.scope} | {JSON.stringify(m.payload)}</div>)}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button className="rounded-lg border border-slate-200 px-2 py-1 text-sm" onClick={() => setVisibleMonth(addDays(startOfMonth(visibleMonth), -1))}>{'<'}</button>
            <p className="font-bold uppercase tracking-widest text-slate-600">{format(visibleMonth, 'MMMM yyyy', { locale: fr })}</p>
            <button className="rounded-lg border border-slate-200 px-2 py-1 text-sm" onClick={() => setVisibleMonth(addDays(endOfMonth(visibleMonth), 1))}>{'>'}</button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase text-slate-400">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
              <div key={`a-${d}-${idx}`} className={d === 'S' || d === 'D' ? 'font-black text-blue-600' : ''}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthDays.map((day) => {
              const key = toIsoLocal(day)
              const count = arrivalsByDate.get(key)?.length || 0
              const apercu = apercuByDate.get(key)
              const dayEvents = eventsByDate.get(key) || []
              const demandPct = Math.round((apercu?.demandIndex || 0) * 100)
              const selected = key === effectiveSelectedKey || isSameDay(day, selectedDate)
              const demandClass = demandPct >= 70 ? 'bg-red-100 border-red-300' : demandPct >= 45 ? 'bg-orange-100 border-orange-300' : 'bg-emerald-100 border-emerald-300'
              const weekClass = (isSaturday(day) || isSunday(day)) ? 'ring-1 ring-blue-300' : ''
              return (
                <button
                  key={`a-${key}`}
                  onClick={() => {
                    setSelectedDate(day)
                    setDetailDateIso(key)
                    setIsCalendarDayFilterActive(true)
                  }}
                  className={`min-h-[104px] rounded-lg border p-3 text-left transition ${demandClass} ${weekClass} ${selected ? 'ring-2 ring-slate-900' : ''}`}
                >
                  <div className="text-2xl font-black leading-none text-slate-900">{format(day, 'd')}</div>
                  <div className="mt-2 text-[11px] font-semibold tracking-wide text-slate-700">Demande {demandPct}%</div>
                  <div className="mt-1 text-[10px] text-slate-600">{count} arrivees</div>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 text-[10px] font-bold text-amber-700">{dayEvents.length} evt</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        {detailDateIso && (
          <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black text-slate-800">Detail du {detailDateIso}</p>
              <button className="rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600" onClick={() => setDetailDateIso(null)}>Fermer</button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <p>Mon tarif moyen prevu: <span className="font-black">{formatCurrency(averageExpectedRateByArrivalDate.get(detailDateIso) || 0)}</span></p>
              <p>Demande du marche: <span className="font-black">{Math.round((apercuByDate.get(detailDateIso)?.demandIndex || 0) * 100)}%</span></p>
              {showCompetitionIndicators && (
                <>
                  <p>Mon tarif le plus bas (actuel): <span className="font-black text-indigo-700">{formatCurrency(apercuByDate.get(detailDateIso)?.ownLow || 0)}</span></p>
                  <p>Mediane du compset: <span className="font-black text-cyan-700">{formatCurrency(apercuByDate.get(detailDateIso)?.compsetMedian || 0)}</span></p>
                  <p>Tarif concurrence le plus bas: <span className="font-black text-orange-700">{formatCurrency(lowestCompetitorByDate.get(detailDateIso)?.price || 0)}</span></p>
                  <p>Hotel concurrence le moins cher: <span className="font-black">{lowestCompetitorByDate.get(detailDateIso)?.hotelName || '-'}</span></p>
                </>
              )}
              <p>Salons & evenements: <span className="font-black">{(eventsByDate.get(detailDateIso) || []).join(' | ') || '-'}</span></p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-700">
          Tableau des arrivees {isCalendarDayFilterActive ? `jour selectionne (${effectiveSelectedKey || '-'})` : 'plage de dates'}
        </h3>
        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement des reservations...</p>
        ) : displayedRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {isCalendarDayFilterActive ? 'Aucune reservation pour le jour selectionne.' : 'Aucune reservation sur la plage selectionnee.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {visibleColumns.arrival && <th className="py-2 pr-3 text-left">Arrivee</th>}
                  {visibleColumns.departure && <th className="py-2 pr-3 text-left">Depart</th>}
                  {visibleColumns.reference && <th className="py-2 pr-3 text-left">Reference</th>}
                  {visibleColumns.status && <th className="py-2 pr-3 text-left">Etat</th>}
                  {visibleColumns.origin && <th className="py-2 pr-3 text-left">Origine</th>}
                  {visibleColumns.roomType && <th className="py-2 pr-3 text-left">Type chambre</th>}
                  {visibleColumns.rooms && <th className="py-2 pr-3 text-right">Chambres</th>}
                  {visibleColumns.nights && <th className="py-2 pr-3 text-right">Nuitees</th>}
                  {visibleColumns.guests && <th className="py-2 pr-3 text-right">Guests</th>}
                  {visibleColumns.country && <th className="py-2 pr-3 text-left">Pays</th>}
                  {visibleColumns.amount && <th className="py-2 pr-0 text-right">Montant</th>}
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, idx) => (
                  <tr key={`${row.id}-range-${idx}`} className="border-b border-slate-100">
                    {visibleColumns.arrival && <td className="py-2 pr-3 font-semibold">{row.arrival ? format(row.arrival, 'EEE dd MMM yyyy', { locale: fr }) : '-'}</td>}
                    {visibleColumns.departure && <td className="py-2 pr-3">{row.departure ? format(row.departure, 'EEE dd MMM yyyy', { locale: fr }) : '-'}</td>}
                    {visibleColumns.reference && <td className="py-2 pr-3">{row.reference}</td>}
                    {visibleColumns.status && <td className="py-2 pr-3">{row.status || '-'}</td>}
                    {visibleColumns.origin && <td className="py-2 pr-3">{row.origin || '-'}</td>}
                    {visibleColumns.roomType && <td className="py-2 pr-3">{row.roomType || '-'}</td>}
                    {visibleColumns.rooms && <td className="py-2 pr-3 text-right">{getEffectiveRooms(row)}</td>}
                    {visibleColumns.nights && <td className="py-2 pr-3 text-right">{row.nights}</td>}
                    {visibleColumns.guests && <td className="py-2 pr-3 text-right">{row.adults + row.children}</td>}
                    {visibleColumns.country && <td className="py-2 pr-3">{row.country || '-'}</td>}
                    {visibleColumns.amount && <td className="py-2 pr-0 text-right font-semibold">{formatCurrency(row.amount)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
