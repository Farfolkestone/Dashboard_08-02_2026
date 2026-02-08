import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useBookingApercu, useBookingExport } from '../../hooks/useBookingData'
import { useReservations, useDisponibilites, useEvents } from '../../hooks/useHotelData'
import { useCompetitorRates, useCompetitorRatesVs3j, useCompetitorRatesVs7j, useCompetitorsList } from '../../hooks/useCompetitorData'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { useDashboardConfig } from '../../hooks/useDashboardConfig'
import { useHotelByHotelId } from '../../hooks/useHotels'
import { formatCurrency, formatShortDate } from '../../utils/formatters'
import { buildTrendSeries } from '../../utils/competitorTrends'
import { FinancialScorecard } from './FinancialScorecard'
import { YieldChart } from './YieldChart'
import { DashboardSidebar } from './DashboardSidebar'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Gauge,
  Hotel,
  LayoutDashboard,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  RefreshCcw,
} from 'lucide-react'
import type { Database } from '../../types/database.types'

type BookingApercuRow = Database['public']['Tables']['booking_apercu']['Row']
type BookingExportRow = Database['public']['Tables']['booking_export']['Row']
type BookingApercuLike = BookingApercuRow & {
  date?: string | null
  own_price?: number | null
  compset_median?: number | null
  market_demand?: number | null
}

type BookingExportLike = BookingExportRow & {
  total_amount?: number | null
  purchase_date?: string | null
  arrival_date?: string | null
}

type EventRow = Database['public']['Tables']['events_calendar']['Row'] & {
  start_date?: string | null
  end_date?: string | null
}

type BusinessSignal = {
  id: string
  tone: 'amber' | 'cyan' | 'blue' | 'rose' | 'emerald'
  message: string
  recommendation: string
}

const ARRIVAL_ALIASES = [
  "Date d'arrivée",
  "Date d’arrivee",
  "Date d'arrivee",
  "Date d'arrivÃ©e",
  "Date d'arrivÃƒÂ©e",
  "Date d'arrivÃƒÆ’Ã‚Â©e"
]

const PURCHASE_ALIASES = [
  "Date d'achat",
  "Date d’achat",
  "Date d\u0027achat"
]

const CANCELLATION_ALIASES = [
  "Date d'annulation",
  "Date d’annulation",
  "Date dâ€™annulation",
  "Date d'annul"
]

const pickNumber = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  }
  return 0
}

const pickString = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

const toDemandPercent = (rawValue: number) => {
  if (!Number.isFinite(rawValue)) return 0
  if (rawValue <= 1) return rawValue * 100
  return rawValue
}

const getApercuDemandPercent = (entry: BookingApercuLike) => {
  const row = entry as Record<string, unknown>
  const rawDemand = entry.market_demand ?? pickNumber(row, ['Demande du marché', 'Demande du marche', 'Demande du marchÃ©', 'Demande du marchÃƒÂ©'])
  return toDemandPercent(rawDemand)
}

const normalizeDate = (input: string) => {
  if (!input) return null
  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) return parsed

  if (input.includes('/')) {
    const [day, month, year] = input.split('/').map(Number)
    if (day && month && year) {
      const alt = new Date(year, month - 1, day)
      if (!Number.isNaN(alt.getTime())) return alt
    }
  }

  return null
}

const toDateKey = (input: string | Date) => {
  const date = input instanceof Date ? input : normalizeDate(input)
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

const isCancelledStatus = (status: string) => {
  const lower = status.toLowerCase()
  return lower.includes('annul') || lower.includes('cancel')
}

const eventToneClass = (tone: BusinessSignal['tone']) => {
  if (tone === 'rose') return 'border-rose-200 bg-rose-50 text-rose-800'
  if (tone === 'cyan') return 'border-cyan-200 bg-cyan-50 text-cyan-800'
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-800'
  if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

const getBusinessAlertExplanation = (message: string) => {
  const lower = message.toLowerCase()

  if (lower.includes('annulation')) {
    return "Cette alerte signale un risque de perte de revenu net. Verifiez les conditions tarifaires, les canaux OTA concernes et ajustez vos regles de vente."
  }
  if (lower.includes('demande')) {
    return "Cette alerte indique une tension de marche. Vous pouvez appliquer une hausse tarifaire progressive si l'occupation projetee depasse la cible."
  }
  if (lower.includes('compset') || lower.includes('mediane')) {
    return "Votre positionnement prix face au compset peut reduire soit le volume, soit la valeur. Recalibrez l'ecart prix cible pour la date concernee."
  }
  if (lower.includes('evenement') || lower.includes('événement')) {
    return "Un evenement local peut accelerer ou ralentir les reservations. Ajustez restrictions, disponibilites et vitesse d'augmentation tarifaire."
  }
  if (lower.includes('pickup')) {
    return "Le pickup mesure la vitesse de prise de reservation. Une variation anormale est un signal precurseur pour ajuster prix et disponibilite."
  }
  return "Ce signal met en evidence un ecart entre la situation observee et la trajectoire RMS cible. Priorisez les actions tarifaires sur les dates concernees."
}

const KpiTile: React.FC<{
  title: string
  value: string
  subtitle: string
  trend?: number
  icon: React.ReactNode
}> = ({ title, value, subtitle, trend, icon }) => {
  const isPositive = trend === undefined ? null : trend >= 0

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <div className="rounded-xl bg-slate-900 p-2 text-white">{icon}</div>
      </div>
      <p className="text-3xl font-black tracking-tight text-slate-900">{value}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">{subtitle}</p>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

export const DashboardContent: React.FC = () => {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()
  const { startDate, endDate } = useDateRangeStore()
  const hotelId = profile?.hotel_id || 'H2258'
  const { data: hotel } = useHotelByHotelId(hotelId)

  const { config, isLoading: loadingConfig, savePartialConfig, updateConfig } = useDashboardConfig()

  const { data: apercu, isLoading: loadingApercu } = useBookingApercu(hotelId, startDate, endDate)
  const { data: reservations, isLoading: loadingReservations } = useReservations(hotelId, startDate, endDate)
  const { data: disponibilites, isLoading: loadingDisponibilites } = useDisponibilites(hotelId, startDate, endDate)
  const { data: bookingExport } = useBookingExport(hotelId, startDate, endDate)
  const { data: events } = useEvents(hotelId, startDate, endDate)
  const { data: competitorRates } = useCompetitorRates(hotelId, startDate, endDate)
  const { data: competitorRatesVs3j } = useCompetitorRatesVs3j(hotelId, startDate, endDate)
  const { data: competitorRatesVs7j } = useCompetitorRatesVs7j(hotelId, startDate, endDate)
  const { data: competitorsList } = useCompetitorsList(hotelId)

  const { kpis, pricingSuggestions, dailyDecisions, alerts } = useRMSCalculations(
    reservations || [],
    disponibilites || [],
    apercu || [],
    config.rms,
    events || []
  )

  const isLoading = loadingConfig || loadingApercu || loadingReservations || loadingDisponibilites
  const [selectedDashboardDate, setSelectedDashboardDate] = useState<Date>(new Date())
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null)
  const selectedDateKey = toDateKey(selectedDashboardDate)

  const handleSaveRms = async (nextRmsPartial: Partial<typeof config.rms>) => {
    await savePartialConfig({
      rms: {
        ...config.rms,
        ...nextRmsPartial,
      },
    })
  }

  const chartData = useMemo(() => {
    if (!apercu || !Array.isArray(apercu)) return []

    return apercu.map((entry) => {
      const day = entry as BookingApercuLike
      const row = day as Record<string, unknown>

      return {
        date: formatShortDate(day.date || day.Date || ''),
        price: day.own_price ?? pickNumber(row, ['Votre hôtel le plus bas', 'Votre hÃ´tel le plus bas']),
        market: day.compset_median ?? pickNumber(row, ['médiane du compset', 'mÃ©diane du compset']),
        demand: getApercuDemandPercent(day)
      }
    })
  }, [apercu])

  const scorecardData = useMemo(() => ({
    roomNights: {
      value: kpis.occupiedRooms,
      target: kpis.totalRooms * (config.rms.targetOccupancy / 100),
      committed: kpis.occupiedRooms,
      forecast: Math.round((kpis.projectedOccupancy / 100) * kpis.totalRooms),
      change: ((kpis.projectedOccupancy - kpis.occupancyRate) / Math.max(kpis.occupancyRate, 1)) * 100
    },
    adr: {
      value: kpis.adr,
      target: (config.rms.minAdr + config.rms.maxAdr) / 2,
      committed: kpis.adr,
      forecast: kpis.adr * 1.04,
      change: 4
    },
    revpar: {
      value: kpis.revpar,
      target: ((config.rms.minAdr + config.rms.maxAdr) / 2) * (config.rms.targetOccupancy / 100),
      committed: kpis.revpar,
      forecast: kpis.revpar * 1.06,
      change: 6
    },
    revenue: {
      value: kpis.adr * kpis.occupiedRooms,
      target: ((config.rms.minAdr + config.rms.maxAdr) / 2) * (kpis.totalRooms * (config.rms.targetOccupancy / 100)),
      committed: kpis.adr * kpis.occupiedRooms,
      forecast: (kpis.adr * kpis.occupiedRooms) * 1.05,
      change: 5
    }
  }), [config.rms, kpis])

  const eventStats = useMemo(() => {
    if (!events || events.length === 0) return { count: 0, averageImpact: 0 }

    const totalImpact = events.reduce((sum, event) => {
      const row = event as EventRow & Record<string, unknown>
      return sum + pickNumber(row, ['Indice impact attendu sur la demande /10'])
    }, 0)

    return { count: events.length, averageImpact: totalImpact / events.length }
  }, [events])

  const eventInsights = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        eventIndex: 0,
        activeEvents: 0,
        selectedDateEvents: [] as Array<{ name: string; advice: string; impact: number }>,
      }
    }

    const parsed = (events as Array<Record<string, unknown>>).map((row, idx) => {
      const name = pickString(row, ['Événement', 'Ã‰vÃ©nement', 'event', 'name']) || `Événement ${idx + 1}`
      const advice = pickString(row, ['Conseils yield', 'Pourquoi cet indice', 'advice']) || 'Ajuster progressivement le prix et surveiller le pickup.'
      const impact10 = pickNumber(row, ['Indice impact attendu sur la demande /10'])
      const impact = Math.max(0, Math.min(100, impact10 * 10))
      const startRaw = pickString(row, ['Début', 'DÃ©but', 'start_date'])
      const endRaw = pickString(row, ['Fin', 'end_date']) || startRaw
      const startDate = normalizeDate(startRaw)
      const endDate = normalizeDate(endRaw)
      return { name, advice, impact, startDate, endDate }
    })

    const selectedDateEvents = parsed.filter((evt) => {
      if (!evt.startDate || !evt.endDate) return false
      return selectedDashboardDate >= evt.startDate && selectedDashboardDate <= evt.endDate
    })

    const eventIndex = parsed.length > 0
      ? parsed.reduce((sum, evt) => sum + evt.impact, 0) / parsed.length
      : 0

    return {
      eventIndex,
      activeEvents: selectedDateEvents.length,
      selectedDateEvents: selectedDateEvents.slice(0, 3).map((evt) => ({
        name: evt.name,
        advice: evt.advice,
        impact: evt.impact,
      })),
    }
  }, [events, selectedDashboardDate])

  const bookingInsights = useMemo(() => {
    if (!bookingExport || bookingExport.length === 0) {
      return {
        upcomingCount: 0,
        confirmedCount: 0,
        cancelledCount: 0,
        upcomingNights: 0,
        confirmedRevenue: 0,
        cancelledRevenue: 0,
        averageLeadTime: 0,
        byDate: [] as Array<{ date: string; reservations: number; rooms: number; nights: number; revenue: number; cancellations: number }>,
      }
    }

    const now = new Date()
    const dateMap = new Map<string, { reservations: number; rooms: number; nights: number; revenue: number; cancellations: number }>()

    let upcomingCount = 0
    let confirmedCount = 0
    let cancelledCount = 0
    let upcomingNights = 0
    let confirmedRevenue = 0
    let cancelledRevenue = 0
    let cumulativeLeadTime = 0
    let leadTimeCount = 0

    bookingExport.forEach((reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const status = typeof row.Etat === 'string' ? row.Etat : ''
      const arrivalRaw = row.arrival_date || pickString(row, ARRIVAL_ALIASES)
      const purchaseRaw = row.purchase_date || pickString(row, PURCHASE_ALIASES)
      const arrivalDate = normalizeDate(arrivalRaw)
      if (!arrivalDate || arrivalDate < now) return

      const amount = parseFloat(String(row.total_amount ?? pickNumber(row, ['Montant total']) ?? 0)) || 0
      const nights = parseFloat(String(row.Nuits ?? 0)) || 0
      const rooms = parseFloat(String(row.Chambres ?? 0)) || 0
      const cancelled = isCancelledStatus(status)

      upcomingCount += 1
      upcomingNights += nights

      if (cancelled) {
        cancelledCount += 1
        cancelledRevenue += amount
      } else {
        confirmedCount += 1
        confirmedRevenue += amount
      }

      if (purchaseRaw) {
        const purchaseDate = normalizeDate(purchaseRaw)
        if (purchaseDate) {
          const leadDays = Math.max(0, Math.round((arrivalDate.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24)))
          cumulativeLeadTime += leadDays
          leadTimeCount += 1
        }
      }

      const dateKey = format(arrivalDate, 'yyyy-MM-dd')
      const current = dateMap.get(dateKey) || { reservations: 0, rooms: 0, nights: 0, revenue: 0, cancellations: 0 }
      current.reservations += 1
      current.rooms += rooms
      current.nights += nights
      current.revenue += amount
      if (cancelled) current.cancellations += 1
      dateMap.set(dateKey, current)
    })

    const byDate = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([date, values]) => ({ date, ...values }))

    return {
      upcomingCount,
      confirmedCount,
      cancelledCount,
      upcomingNights,
      confirmedRevenue,
      cancelledRevenue,
      averageLeadTime: leadTimeCount > 0 ? cumulativeLeadTime / leadTimeCount : 0,
      byDate,
    }
  }, [bookingExport])

  const bookingPace = useMemo(() => {
    if (!bookingExport || bookingExport.length === 0) {
      return {
        recentBookings: 0,
        totalBookings: 0,
        previousBookings: 0,
        trendPct: 0,
        topPickupDates: [] as Array<{ date: string; count: number }>,
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const recentStart = new Date(today)
    recentStart.setDate(recentStart.getDate() - 7)
    const previousStart = new Date(today)
    previousStart.setDate(previousStart.getDate() - 14)

    let recentBookings = 0
    let previousBookings = 0
    let totalFutureBookings = 0
    const byArrival = new Map<string, number>()

    bookingExport.forEach((reservation) => {
      const row = reservation as Record<string, unknown>
      const purchaseRaw =
        (typeof row.purchase_date === 'string' ? row.purchase_date : '') ||
        pickString(row, PURCHASE_ALIASES)
      const arrivalRaw =
        (typeof row.arrival_date === 'string' ? row.arrival_date : '') ||
        pickString(row, ARRIVAL_ALIASES)

      const purchaseDate = normalizeDate(purchaseRaw)
      const arrivalDate = normalizeDate(arrivalRaw)
      if (!purchaseDate || !arrivalDate) return
      if (arrivalDate < today) return

      totalFutureBookings += 1

      if (purchaseDate >= recentStart && purchaseDate <= today) {
        recentBookings += 1
        const key = format(arrivalDate, 'yyyy-MM-dd')
        byArrival.set(key, (byArrival.get(key) || 0) + 1)
      } else if (purchaseDate >= previousStart && purchaseDate < recentStart) {
        previousBookings += 1
      }
    })

    const trendPct = previousBookings > 0
      ? ((recentBookings - previousBookings) / previousBookings) * 100
      : (recentBookings > 0 ? 100 : 0)

    const topPickupDates = Array.from(byArrival.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([date, count]) => ({ date, count }))

    return {
      recentBookings,
      totalBookings: totalFutureBookings,
      previousBookings,
      trendPct,
      topPickupDates,
    }
  }, [bookingExport])

  const cancellationInsights = useMemo(() => {
    if (!bookingExport || bookingExport.length === 0) {
      return {
        totalCancelled: 0,
        spikeByCancellationDate: [] as Array<{ date: string; count: number }>,
        highRateByArrivalDate: [] as Array<{ date: string; cancelled: number; total: number; rate: number }>,
      }
    }

    const arrivalsTotals = new Map<string, number>()
    const arrivalsCancelled = new Map<string, number>()
    const cancellationsByDate = new Map<string, number>()
    let totalCancelled = 0

    bookingExport.forEach((reservation) => {
      const row = reservation as Record<string, unknown>
      const status = typeof row.Etat === 'string' ? row.Etat : ''
      const cancelled = isCancelledStatus(status)
      const arrivalRaw =
        (typeof row.arrival_date === 'string' ? row.arrival_date : '') ||
        pickString(row, ARRIVAL_ALIASES)
      const cancellationRaw =
        (typeof row.cancellation_date === 'string' ? row.cancellation_date : '') ||
        pickString(row, CANCELLATION_ALIASES)

      const arrivalDate = normalizeDate(arrivalRaw)
      if (!arrivalDate) return
      const arrivalKey = format(arrivalDate, 'yyyy-MM-dd')
      arrivalsTotals.set(arrivalKey, (arrivalsTotals.get(arrivalKey) || 0) + 1)

      if (!cancelled) return
      totalCancelled += 1
      arrivalsCancelled.set(arrivalKey, (arrivalsCancelled.get(arrivalKey) || 0) + 1)

      const cancellationDate = normalizeDate(cancellationRaw)
      if (cancellationDate) {
        const cancellationKey = format(cancellationDate, 'yyyy-MM-dd')
        cancellationsByDate.set(cancellationKey, (cancellationsByDate.get(cancellationKey) || 0) + 1)
      }
    })

    const spikeByCancellationDate = Array.from(cancellationsByDate.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([date, count]) => ({ date, count }))

    const highRateByArrivalDate = Array.from(arrivalsTotals.entries())
      .map(([date, total]) => {
        const cancelled = arrivalsCancelled.get(date) || 0
        return { date, cancelled, total, rate: total > 0 ? cancelled / total : 0 }
      })
      .filter((row) => row.cancelled >= 2 || row.rate >= 0.25)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)

    return { totalCancelled, spikeByCancellationDate, highRateByArrivalDate }
  }, [bookingExport])

  const competitorInsight = useMemo(() => {
    if (!competitorRates || competitorRates.length === 0) return { avgGap: 0, ownAvg: 0, compsetAvg: 0 }

    let ownTotal = 0
    let compsetTotal = 0
    let rows = 0

    competitorRates.forEach((row) => {
      const record = row as Record<string, unknown>
      const ownPrice = pickNumber(record, ['Folkestone Opéra', 'Folkestone OpÃ©ra'])
      if (!ownPrice) return

      let competitorSum = 0
      let competitorCount = 0

      Object.entries(record).forEach(([key, value]) => {
        if (['id', 'hotel_id', 'date_mise_a_jour', 'Jour', 'Date', 'Demande du marché', 'Demande du marchÃ©', 'Folkestone Opéra', 'Folkestone OpÃ©ra'].includes(key)) return
        const parsed = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN)
        if (!Number.isNaN(parsed) && parsed > 0) {
          competitorSum += parsed
          competitorCount += 1
        }
      })

      if (competitorCount > 0) {
        ownTotal += ownPrice
        compsetTotal += competitorSum / competitorCount
        rows += 1
      }
    })

    if (rows === 0) return { avgGap: 0, ownAvg: 0, compsetAvg: 0 }

    const ownAvg = ownTotal / rows
    const compsetAvg = compsetTotal / rows

    return { ownAvg, compsetAvg, avgGap: ownAvg - compsetAvg }
  }, [competitorRates])

  const competitorTrend = useMemo(() => {
    return buildTrendSeries(
      (competitorRates || []) as Record<string, unknown>[],
      (competitorRatesVs3j || []) as Record<string, unknown>[],
      (competitorRatesVs7j || []) as Record<string, unknown>[]
    )
  }, [competitorRates, competitorRatesVs3j, competitorRatesVs7j])

  const marketTrendCoverage = useMemo(() => {
    const totalDays = competitorTrend.series.length
    const ratio3j = totalDays > 0 ? competitorTrend.summary.comparedDays3j / totalDays : 0
    const ratio7j = totalDays > 0 ? competitorTrend.summary.comparedDays7j / totalDays : 0
    return { totalDays, ratio3j, ratio7j }
  }, [competitorTrend.series.length, competitorTrend.summary.comparedDays3j, competitorTrend.summary.comparedDays7j])

  const arrivalsByDateForCalendar = useMemo(() => {
    const map: Record<string, number> = {}
    ;(bookingExport || []).forEach((reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const arrivalRaw = row.arrival_date || pickString(row, ARRIVAL_ALIASES)
      const key = toDateKey(arrivalRaw)
      if (!key) return
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [bookingExport])

  const selectedDayInsights = useMemo(() => {
    if (!bookingExport || bookingExport.length === 0) {
      return { reservations: 0, revenue: 0, cancellations: 0, nights: 0, rooms: 0 }
    }

    let reservationsCount = 0
    let revenue = 0
    let cancellations = 0
    let nights = 0
    let rooms = 0

    bookingExport.forEach((reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const arrivalRaw = row.arrival_date || pickString(row, ARRIVAL_ALIASES)
      const arrivalKey = toDateKey(arrivalRaw)
      if (!arrivalKey || arrivalKey !== selectedDateKey) return

      const amount = Number(row.total_amount ?? pickNumber(row, ['Montant total'])) || 0
      const n = Number(row.Nuits ?? pickNumber(row, ['Nuits'])) || 0
      const r = Number(row.Chambres ?? pickNumber(row, ['Chambres'])) || 0
      const status = typeof row.Etat === 'string' ? row.Etat : ''

      reservationsCount += 1
      revenue += amount
      nights += n
      rooms += r
      if (isCancelledStatus(status)) cancellations += 1
    })

    return { reservations: reservationsCount, revenue, cancellations, nights, rooms }
  }, [bookingExport, selectedDateKey])

  const selectedDayApercu = useMemo(() => {
    if (!apercu || apercu.length === 0) return null
    return apercu.find((entry) => {
      const day = entry as BookingApercuLike
      return toDateKey(day.date || day.Date || '') === selectedDateKey
    }) as BookingApercuLike | undefined
  }, [apercu, selectedDateKey])

  const selectedDateSuggestions = useMemo(() => {
    return pricingSuggestions.filter((s) => toDateKey(s.date || '') === selectedDateKey)
  }, [pricingSuggestions, selectedDateKey])

  const selectedDateAlerts = useMemo(() => {
    const out: string[] = []
    if (selectedDayInsights.cancellations > 0) out.push(`${selectedDayInsights.cancellations} annulation(s) detectee(s) sur la date active.`)
    if (selectedDayApercu) {
      const row = selectedDayApercu as Record<string, unknown>
      const demand = getApercuDemandPercent(selectedDayApercu)
      const own = selectedDayApercu.own_price ?? pickNumber(row, ['Votre hôtel le plus bas', 'Votre hÃ´tel le plus bas'])
      const compset = selectedDayApercu.compset_median ?? pickNumber(row, ['médiane du compset', 'mÃ©diane du compset'])
      if (demand >= 70) out.push(`Demande elevee (${demand.toFixed(0)}%) - opportunite d'optimisation tarifaire.`)
      if (own > 0 && compset > 0 && own < compset) out.push(`Tarif hotel sous mediane compset (${formatCurrency(own)} vs ${formatCurrency(compset)}).`)
    }

    const cancelSpikeOnSelectedDate = cancellationInsights.spikeByCancellationDate.find((row) => row.date === selectedDateKey)
    if (cancelSpikeOnSelectedDate) {
      out.push(`Pic d'annulations detecte le ${selectedDateKey}: ${cancelSpikeOnSelectedDate.count} annulation(s).`)
    }

    const highCancelOnArrivalSelected = cancellationInsights.highRateByArrivalDate.find((row) => row.date === selectedDateKey)
    if (highCancelOnArrivalSelected) {
      out.push(`Taux d'annulation eleve sur arrivee ${selectedDateKey}: ${(highCancelOnArrivalSelected.rate * 100).toFixed(0)}% (${highCancelOnArrivalSelected.cancelled}/${highCancelOnArrivalSelected.total}).`)
    }
    return out
  }, [cancellationInsights.highRateByArrivalDate, cancellationInsights.spikeByCancellationDate, selectedDateKey, selectedDayApercu, selectedDayInsights.cancellations])

  const businessSignals = useMemo<BusinessSignal[]>(() => {
    const signals: BusinessSignal[] = []

    if (marketTrendCoverage.totalDays > 0 && (marketTrendCoverage.ratio3j < 0.75 || marketTrendCoverage.ratio7j < 0.75)) {
      signals.push({
        id: 'market-coverage',
        tone: 'amber',
        message: `Évolution demande marché partielle: ${competitorTrend.summary.comparedDays3j}/${marketTrendCoverage.totalDays} jours (vs3j), ${competitorTrend.summary.comparedDays7j}/${marketTrendCoverage.totalDays} jours (vs7j).`,
        recommendation: 'Vérifier les dates manquantes dans booking_vs_3j / booking_vs_7j et relancer le rafraîchissement.',
      })
    }

    if (competitorTrend.summary.avgDemandVs7j >= 8) {
      signals.push({
        id: 'market-surge',
        tone: 'rose',
        message: `Hausse rapide de demande marché vs7j: +${competitorTrend.summary.avgDemandVs7j.toFixed(1)} pts.`,
        recommendation: 'Appliquer une hausse graduelle BAR et contrôler la conversion sur les 72h.',
      })
    } else if (competitorTrend.summary.avgDemandVs7j <= -8) {
      signals.push({
        id: 'market-drop',
        tone: 'cyan',
        message: `Baisse de demande marché vs7j: ${competitorTrend.summary.avgDemandVs7j.toFixed(1)} pts.`,
        recommendation: 'Activer une stimulation tactique: packs, offres ciblées, ajustement contrôlé des prix.',
      })
    }

    if (eventInsights.activeEvents > 0) {
      signals.push({
        id: 'active-events',
        tone: 'blue',
        message: `${eventInsights.activeEvents} salon/événement actif(s) sur la date sélectionnée. Indice événements: ${eventInsights.eventIndex.toFixed(0)}/100.`,
        recommendation: eventInsights.selectedDateEvents[0]?.advice || "Renforcer la stratégie prix et surveiller le pickup intra-journalier.",
      })
    }

    if (selectedDayInsights.cancellations >= 3) {
      signals.push({
        id: 'cancel-risk',
        tone: 'rose',
        message: `Risque annulation élevé sur la date active: ${selectedDayInsights.cancellations} annulation(s).`,
        recommendation: 'Contrôler les conditions flexibles, renforcer l’acompte sur les segments sensibles.',
      })
    }

    if (signals.length === 0) {
      signals.push({
        id: 'stable',
        tone: 'emerald',
        message: 'Signaux business stables sur la période active.',
        recommendation: 'Maintenir la stratégie actuelle et surveiller le pickup quotidien.',
      })
    }

    return signals
  }, [competitorTrend.summary.avgDemandVs7j, competitorTrend.summary.comparedDays3j, competitorTrend.summary.comparedDays7j, eventInsights.activeEvents, eventInsights.eventIndex, eventInsights.selectedDateEvents, marketTrendCoverage.ratio3j, marketTrendCoverage.ratio7j, marketTrendCoverage.totalDays, selectedDayInsights.cancellations])

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900" />
        <p className="text-sm font-semibold text-slate-500">Chargement du cockpit RMS...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-2xl">
        <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
              <Sparkles className="h-3 w-3" />
              RMS Yield Command Center
            </p>
            <h2 className="text-4xl font-black tracking-tight">{hotel?.name || hotelId} · 45 chambres</h2>
            <p className="mt-2 text-sm text-slate-200">
              Période: {format(startDate, 'dd MMM yyyy', { locale: fr })} au {format(endDate, 'dd MMM yyyy', { locale: fr })} · Stratégie {config.rms.strategy}
            </p>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['booking-apercu', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['booking-export', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['reservations', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['disponibilites', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['events', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['competitor-rates', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['competitor-rates-vs-3j', hotelId] })
                queryClient.invalidateQueries({ queryKey: ['competitor-rates-vs-7j', hotelId] })
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-white/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Rafraîchir
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-slate-300">Concurrents actifs</p>
              <p className="text-xl font-black">{competitorsList?.length || 0}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-slate-300">Événements</p>
              <p className="text-xl font-black">{eventStats.count}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-slate-300">Décisions RMS</p>
              <p className="text-xl font-black">{pricingSuggestions.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-slate-300">Auto-approve</p>
              <p className="text-xl font-black">{config.rms.autoApproveThresholdPct}%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {config.widgets.occupancy && (
          <KpiTile
            title="Occupation"
            value={`${kpis.occupancyRate.toFixed(1)}%`}
            subtitle={`Cible ${config.rms.targetOccupancy}%`}
            trend={kpis.projectedOccupancy - kpis.occupancyRate}
            icon={<Gauge className="h-4 w-4" />}
          />
        )}
        {config.widgets.adr && (
          <KpiTile
            title="ADR"
            value={formatCurrency(kpis.adr)}
            subtitle={`Plancher/Plafond ${config.rms.minAdr} - ${config.rms.maxAdr}`}
            trend={(kpis.adr - config.rms.minAdr) / Math.max(1, config.rms.minAdr) * 100}
            icon={<Target className="h-4 w-4" />}
          />
        )}
        {config.widgets.market && (
          <KpiTile
            title="Gap Compset"
            value={formatCurrency(competitorInsight.avgGap)}
            subtitle={`Moy. hôtel ${formatCurrency(competitorInsight.ownAvg)} vs compset ${formatCurrency(competitorInsight.compsetAvg)}`}
            trend={competitorInsight.compsetAvg > 0 ? (competitorInsight.avgGap / competitorInsight.compsetAvg) * 100 : 0}
            icon={<Users className="h-4 w-4" />}
          />
        )}
        {config.widgets.pickup && (
          <KpiTile
            title="Pickup 7j"
            value={`${bookingPace.recentBookings}`}
            subtitle={`sur ${bookingPace.totalBookings} réservations futures`}
            trend={bookingPace.trendPct}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        )}
        {config.widgets.events && (
          <KpiTile
            title="Salons & Événements"
            value={`${eventInsights.eventIndex.toFixed(0)}/100`}
            subtitle={`${eventInsights.activeEvents} actif(s) date sélectionnée`}
            trend={eventInsights.eventIndex - 50}
            icon={<CalendarDays className="h-4 w-4" />}
          />
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Votre tarif vs 3j</p>
          <p className={`text-xl font-black ${competitorTrend.summary.avgOwnVs3j >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {competitorTrend.summary.avgOwnVs3j >= 0 ? '+' : ''}{formatCurrency(competitorTrend.summary.avgOwnVs3j)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Votre tarif vs 7j</p>
          <p className={`text-xl font-black ${competitorTrend.summary.avgOwnVs7j >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {competitorTrend.summary.avgOwnVs7j >= 0 ? '+' : ''}{formatCurrency(competitorTrend.summary.avgOwnVs7j)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Médiane compset vs 3j</p>
          <p className={`text-xl font-black ${competitorTrend.summary.avgCompsetVs3j >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {competitorTrend.summary.avgCompsetVs3j >= 0 ? '+' : ''}{formatCurrency(competitorTrend.summary.avgCompsetVs3j)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Médiane compset vs 7j</p>
          <p className={`text-xl font-black ${competitorTrend.summary.avgCompsetVs7j >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {competitorTrend.summary.avgCompsetVs7j >= 0 ? '+' : ''}{formatCurrency(competitorTrend.summary.avgCompsetVs7j)}
          </p>
        </div>
        <div className="rounded-xl bg-cyan-50 p-3">
          <p className="text-xs text-cyan-700">Demande marché vs 3j</p>
          <p className={`text-xl font-black ${competitorTrend.summary.avgDemandVs3j >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {competitorTrend.summary.avgDemandVs3j >= 0 ? '+' : ''}{competitorTrend.summary.avgDemandVs3j.toFixed(1)} pts
          </p>
        </div>
        <div className="rounded-xl bg-cyan-50 p-3">
          <p className="text-xs text-cyan-700">Demande marché vs 7j</p>
          <p className={`text-xl font-black ${competitorTrend.summary.avgDemandVs7j >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {competitorTrend.summary.avgDemandVs7j >= 0 ? '+' : ''}{competitorTrend.summary.avgDemandVs7j.toFixed(1)} pts
          </p>
        </div>
      </section>
      <p className="text-xs text-slate-500">
        Couverture évolution marché: vs3j {competitorTrend.summary.comparedDays3j}/{marketTrendCoverage.totalDays} jours, vs7j {competitorTrend.summary.comparedDays7j}/{marketTrendCoverage.totalDays} jours.
      </p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
              Indices Date Selectionnee ({format(selectedDashboardDate, 'dd MMM yyyy', { locale: fr })})
            </h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Suggestions du jour: {selectedDateSuggestions.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Resas</p><p className="text-xl font-black">{selectedDayInsights.reservations}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Chambres</p><p className="text-xl font-black">{selectedDayInsights.rooms.toFixed(0)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Nuitees</p><p className="text-xl font-black">{selectedDayInsights.nights.toFixed(0)}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">CA</p><p className="text-xl font-black text-emerald-800">{formatCurrency(selectedDayInsights.revenue)}</p></div>
          <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-700">Annulations</p><p className="text-xl font-black text-rose-800">{selectedDayInsights.cancellations}</p></div>
            <div className="rounded-xl bg-cyan-50 p-3">
              <p className="text-xs text-cyan-700">Demande marche</p>
              <p className="text-xl font-black text-cyan-800">
                {selectedDayApercu ? `${Math.round(getApercuDemandPercent(selectedDayApercu))}%` : '-'}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Pickup 7j - dates d'arrivee les plus dynamiques</p>
              {bookingPace.topPickupDates.length === 0 ? (
                <p className="mt-1 text-sm text-slate-600">Aucun pickup detecte sur 7 jours.</p>
              ) : (
                <div className="mt-1 grid grid-cols-1 gap-1 text-sm text-slate-800 md:grid-cols-3">
                  {bookingPace.topPickupDates.map((row) => (
                    <p key={`pickup-top-${row.date}`}>{row.date}: <span className="font-black">{row.count}</span> resa(s)</p>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Dates a pic d'annulations (date d'annulation)</p>
              {cancellationInsights.spikeByCancellationDate.length === 0 ? (
                <p className="mt-1 text-sm text-amber-800">Aucun pic detecte.</p>
              ) : (
                <div className="mt-1 space-y-1 text-sm text-amber-900">
                  {cancellationInsights.spikeByCancellationDate.map((row) => (
                    <p key={`cancel-spike-${row.date}`}>{row.date}: <span className="font-black">{row.count}</span> annulation(s)</p>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Dates arrivee a fort taux d'annulation</p>
              {cancellationInsights.highRateByArrivalDate.length === 0 ? (
                <p className="mt-1 text-sm text-rose-800">Aucun risque eleve detecte.</p>
              ) : (
                <div className="mt-1 space-y-1 text-sm text-rose-900">
                  {cancellationInsights.highRateByArrivalDate.map((row) => (
                    <p key={`arrival-risk-${row.date}`}>{row.date}: <span className="font-black">{(row.rate * 100).toFixed(0)}%</span> ({row.cancelled}/{row.total})</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <DashboardSidebar
            selectedDate={selectedDashboardDate}
            onSelectDate={setSelectedDashboardDate}
            arrivalCountByDate={arrivalsByDateForCalendar}
          />
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          {config.widgets.revenue && (
            <FinancialScorecard
              data={scorecardData}
              rms={config.rms}
              onSaveRms={handleSaveRms}
              isSaving={updateConfig.isPending}
            />
          )}
          {config.widgets.yieldRecommendations && <YieldChart data={chartData} />}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">Réservations à venir (booking_export)</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Fenêtre active</span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Arrivées futures</p>
                <p className="text-lg font-black text-slate-900">{bookingInsights.upcomingCount}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Nuitées</p>
                <p className="text-lg font-black text-slate-900">{bookingInsights.upcomingNights.toFixed(0)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">CA confirmé</p>
                <p className="text-lg font-black text-emerald-800">{formatCurrency(bookingInsights.confirmedRevenue)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs text-rose-700">Annulations</p>
                <p className="text-lg font-black text-rose-800">{bookingInsights.cancelledCount} ({formatCurrency(bookingInsights.cancelledRevenue)})</p>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Délai moyen de réservation: {bookingInsights.averageLeadTime.toFixed(1)} jours
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Date arrivée</th>
                    <th className="py-2 pr-3 text-right">Résas</th>
                    <th className="py-2 pr-3 text-right">Chambres</th>
                    <th className="py-2 pr-3 text-right">Nuitées</th>
                    <th className="py-2 pr-3 text-right">CA</th>
                    <th className="py-2 pr-0 text-right">Annulations</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingInsights.byDate.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-semibold text-slate-800">{format(new Date(row.date), 'EEE dd MMM', { locale: fr })}</td>
                      <td className="py-2 pr-3 text-right text-slate-700">{row.reservations}</td>
                      <td className="py-2 pr-3 text-right text-slate-700">{row.rooms.toFixed(0)}</td>
                      <td className="py-2 pr-3 text-right text-slate-700">{row.nights.toFixed(0)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-800">{formatCurrency(row.revenue)}</td>
                      <td className="py-2 pr-0 text-right text-rose-700">{row.cancellations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {bookingInsights.byDate.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Aucune arrivée future détectée sur la période sélectionnée.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
                Décisions RMS prioritaires ({format(selectedDashboardDate, 'dd MMM', { locale: fr })})
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Capacité {config.rms.hotelCapacity} chambres</span>
            </div>

            <div className="space-y-3">
              {(selectedDateSuggestions.length > 0 ? selectedDateSuggestions : pricingSuggestions).slice(0, 8).map((suggestion) => (
                <div key={suggestion.date} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{suggestion.date || 'Date inconnue'}</p>
                    <p className="text-sm font-semibold text-slate-900">{suggestion.reason}</p>
                    <p className="text-xs text-slate-500">Confiance: {suggestion.confidence}%</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">BAR actuel</p>
                      <p className="font-bold text-slate-900">{formatCurrency(suggestion.currentPrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Recommandé</p>
                      <p className="font-bold text-slate-900">{formatCurrency(suggestion.suggestedPrice)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${suggestion.change >= 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {suggestion.change > 0 ? '+' : ''}{suggestion.change}€
                    </span>
                    {suggestion.shouldAutoApprove && <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">Auto</span>}
                  </div>
                </div>
              ))}

              {(selectedDateSuggestions.length > 0 ? selectedDateSuggestions : pricingSuggestions).length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Aucune action tarifaire nécessaire pour la date active.
                </div>
              )}
            </div>
          </section>

          {(config.widgets.alerts || config.widgets.events) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-slate-700">Alertes et signaux business</h3>
              <div className="space-y-3">
                {businessSignals.map((signal) => (
                  <div key={signal.id} className={`rounded-xl border p-3 ${eventToneClass(signal.tone)}`}>
                    <button
                      type="button"
                      onClick={() => setExpandedAlertId((prev) => (prev === `signal-${signal.id}` ? null : `signal-${signal.id}`))}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="flex-1 text-sm font-medium">{signal.message}</p>
                      {expandedAlertId === `signal-${signal.id}` ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {expandedAlertId === `signal-${signal.id}` && (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs">
                        {signal.recommendation}
                      </p>
                    )}
                  </div>
                ))}

                {eventInsights.selectedDateEvents.map((evt) => (
                  <div key={`evt-${evt.name}`} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-800">
                    <button
                      type="button"
                      onClick={() => setExpandedAlertId((prev) => (prev === `evt-${evt.name}` ? null : `evt-${evt.name}`))}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="flex-1 text-sm font-medium">{evt.name} - impact {evt.impact.toFixed(0)}/100</p>
                      {expandedAlertId === `evt-${evt.name}` ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {expandedAlertId === `evt-${evt.name}` && (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs">
                        Recommandation événement: {evt.advice}
                      </p>
                    )}
                  </div>
                ))}

                {alerts.map((message) => (
                  <div key={message} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                    <button
                      type="button"
                      onClick={() => setExpandedAlertId((prev) => (prev === `base-${message}` ? null : `base-${message}`))}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="flex-1 text-sm font-medium">{message}</p>
                      {expandedAlertId === `base-${message}` ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {expandedAlertId === `base-${message}` && (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-amber-900">
                        {getBusinessAlertExplanation(message)}
                      </p>
                    )}
                  </div>
                ))}
                {selectedDateAlerts.map((message) => (
                  <div key={`sel-${message}`} className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-cyan-800">
                    <button
                      type="button"
                      onClick={() => setExpandedAlertId((prev) => (prev === `sel-${message}` ? null : `sel-${message}`))}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="flex-1 text-sm font-medium">{message}</p>
                      {expandedAlertId === `sel-${message}` ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {expandedAlertId === `sel-${message}` && (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-cyan-900">
                        {getBusinessAlertExplanation(message)}
                      </p>
                    )}
                  </div>
                ))}
                {config.widgets.events && eventStats.count > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800">
                    <button
                      type="button"
                      onClick={() => setExpandedAlertId((prev) => (prev === 'events-signal' ? null : 'events-signal'))}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="flex-1 text-sm font-medium">{eventStats.count} événement(s) détecté(s) avec impact moyen {eventStats.averageImpact.toFixed(1)}/10.</p>
                      {expandedAlertId === 'events-signal' ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {expandedAlertId === 'events-signal' && (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-blue-900">
                        {getBusinessAlertExplanation('evenement')}
                      </p>
                    )}
                  </div>
                )}
                {alerts.length === 0 && eventStats.count === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aucun signal critique sur la période.</p>
                )}
              </div>
            </section>
          )}
        </div>

      </div>

      {config.ui.showAdvancedCards && dailyDecisions.length > 0 && (
        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Signal demande moyen</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{(dailyDecisions.reduce((sum, d) => sum + d.demandIndex, 0) / dailyDecisions.length).toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Confiance moyenne RMS</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{(dailyDecisions.reduce((sum, d) => sum + d.confidence, 0) / dailyDecisions.length).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Écart moyen BAR vs reco</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(dailyDecisions.reduce((sum, d) => sum + (d.recommendedPrice - d.currentPrice), 0) / dailyDecisions.length)}</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">Poids Demande: {Math.round(config.rms.demandWeight * 100)}%</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">Poids Concurrence: {Math.round(config.rms.competitorWeight * 100)}%</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">Poids Événement: {Math.round(config.rms.eventWeight * 100)}%</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">Poids Pickup: {Math.round(config.rms.pickupWeight * 100)}%</span>
          <span className="rounded-full bg-cyan-100 px-3 py-1 font-bold text-cyan-800">Hôtel calibré: {config.rms.hotelCapacity} chambres</span>
          <span className="rounded-full bg-slate-900 px-3 py-1 font-bold text-white"><Hotel className="mr-1 inline h-3 w-3" />Yield Model {config.rms.strategy}</span>
        </div>
      </section>
    </div>
  )
}

