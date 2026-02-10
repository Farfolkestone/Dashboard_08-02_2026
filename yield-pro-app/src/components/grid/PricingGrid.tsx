import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, isWeekend, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, ChevronLeft, ChevronRight, RefreshCcw, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useBookingApercu, useBookingExport } from '../../hooks/useBookingData'
import { useDisponibilites, useEvents } from '../../hooks/useHotelData'
import { useDashboardConfig } from '../../hooks/useDashboardConfig'
import { useHotelByHotelId } from '../../hooks/useHotels'
import { usePlanningTarifs } from '../../hooks/usePlanningTarifs'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useAuthStore } from '../../store/useAuthStore'
import type { Database } from '../../types/database.types'
import { formatCurrency, formatNumber } from '../../utils/formatters'

type DisponibilitesRow = Database['public']['Tables']['disponibilites']['Row']
type BookingApercuRow = Database['public']['Tables']['booking_apercu']['Row']
type EventRow = Database['public']['Tables']['events_calendar']['Row']
type PlanningTarifRow = Database['public']['Tables']['planning_tarifs']['Row']

type BookingApercuLike = BookingApercuRow & {
  date?: string | null
  own_price?: number | null
  compset_median?: number | null
  market_demand?: number | null
  events?: string | null
}

type GridRow = {
  date: string
  dayName: string
  dayNum: string
  isWeekend: boolean
  ownPrice: number
  rack: number
  compsetMedian: number
  demandPct: number
  availability: number | string
  events: string
  eventImpact: number
  suggestion?: ReturnType<typeof useRMSCalculations>['pricingSuggestions'][number]
}

const pickText = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

const parseLocalizedNumber = (value: string): number => {
  const cleaned = value
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(/[€$£%]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!cleaned) return Number.NaN

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.'))
    }
    return Number(cleaned.replace(/,/g, ''))
  }

  if (cleaned.includes(',')) return Number(cleaned.replace(',', '.'))
  return Number(cleaned)
}

const pickNumber = (record: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record[alias]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = parseLocalizedNumber(value)
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

const normalizeDate = (value: string | null | undefined): Date | null => {
  if (!value) return null

  const iso = parseISO(value)
  if (!Number.isNaN(iso.getTime())) return iso

  const nativeDate = new Date(value)
  if (!Number.isNaN(nativeDate.getTime())) return nativeDate

  if (value.includes('/')) {
    const [day, month, year] = value.split('/').map(Number)
    if (day && month && year) {
      const fallback = new Date(year, month - 1, day)
      if (!Number.isNaN(fallback.getTime())) return fallback
    }
  }

  return null
}

const normalizeToken = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()

const normalizeDemandPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0
  if (value <= 1) return Math.max(0, Math.min(100, value * 100))
  return Math.max(0, Math.min(100, value))
}

const getSuggestionTone = (change: number) => {
  if (change > 0) return 'text-rose-700'
  if (change < 0) return 'text-emerald-700'
  return 'text-cyan-700'
}

const getActionBadgeClass = (change: number) => {
  if (change > 0) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (change < 0) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-cyan-200 bg-cyan-50 text-cyan-700'
}

const getEventImpactClass = (impact: number) => {
  if (impact >= 7) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (impact >= 4) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export const PricingGrid: React.FC = () => {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()
  const { startDate, endDate } = useDateRangeStore()
  const hotelId = profile?.hotel_id || 'H2258'

  const { data: hotel } = useHotelByHotelId(hotelId)
  const { data: apercu, isLoading: loadingApercu } = useBookingApercu(hotelId, startDate, endDate)
  const { data: disponibilites, isLoading: loadingDisponibilites } = useDisponibilites(hotelId, startDate, endDate)
  const { data: events = [], isLoading: loadingEvents } = useEvents(hotelId, startDate, endDate)
  const { data: planningTarifs = [], isLoading: loadingPlanning } = usePlanningTarifs(hotelId, startDate, endDate)
  const { data: reservations = [] } = useBookingExport(hotelId, startDate, endDate)
  const { config } = useDashboardConfig()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [suggestionView, setSuggestionView] = useState<'all' | 'up' | 'down' | 'hold'>('all')
  const [page, setPage] = useState(1)
  const [formulaDialog, setFormulaDialog] = useState<{ date: string; reason: string; formula: string } | null>(null)

  const { pricingSuggestions } = useRMSCalculations(
    reservations,
    disponibilites || [],
    apercu || [],
    config.rms,
  )

  const isLoading = loadingApercu || loadingDisponibilites || loadingEvents || loadingPlanning

  const rackByDate = useMemo(() => {
    const map = new Map<string, number>()

    ;(planningTarifs as PlanningTarifRow[]).forEach((row) => {
      const roomType = normalizeToken(row.type_de_chambre || '')
      const plan = normalizeToken(row.plan_tarifaire || '')
      const matchesRoomType = roomType === normalizeToken('Double Classique')
      const matchesPlan = plan.includes('otaroflex')
      const date = row.date
      const rackValue = typeof row.tarif === 'number' ? row.tarif : 0

      if (!matchesRoomType || !matchesPlan || !date || rackValue <= 0) return
      map.set(date, rackValue)
    })

    return map
  }, [planningTarifs])

  const gridData = useMemo<GridRow[]>(() => {
    const suggestionsMap = new Map<string, (typeof pricingSuggestions)[number]>()
    pricingSuggestions.forEach((item) => {
      suggestionsMap.set(item.date, item)
    })

    const availabilityByDate = new Map<string, number>()
    ;(disponibilites || []).forEach((row: DisponibilitesRow) => {
      const current = availabilityByDate.get(row.date) ?? 0
      const next = typeof row.disponibilites === 'number' ? row.disponibilites : 0
      availabilityByDate.set(row.date, current + next)
    })

    const eventsByDate = new Map<string, { titles: string[]; impact: number }>()
    ;(events as EventRow[]).forEach((event) => {
      const record = event as unknown as Record<string, unknown>
      const title = pickText(record, ['Événement', 'Evenement', 'event', 'name']) || 'Événement'
      const start = normalizeDate(pickText(record, ['Début', 'start_date']))
      const end = normalizeDate(pickText(record, ['Fin', 'end_date'])) || start
      const impactRaw = pickNumber(record, ['Indice impact attendu sur la demande /10', 'impact_index', 'impact'])
      const impact = Math.max(0, Math.min(10, impactRaw))

      if (!start || !end) return

      const cursor = new Date(start)
      cursor.setHours(0, 0, 0, 0)
      const last = new Date(end)
      last.setHours(0, 0, 0, 0)

      while (cursor <= last) {
        const key = format(cursor, 'yyyy-MM-dd')
        const current = eventsByDate.get(key) || { titles: [], impact: 0 }
        current.titles.push(title)
        current.impact = Math.max(current.impact, impact)
        eventsByDate.set(key, current)
        cursor.setDate(cursor.getDate() + 1)
      }
    })

    const fromApercu = (apercu || [])
      .map((entry) => {
        const day = entry as BookingApercuLike
        const row = day as Record<string, unknown>

        const rawDate = day.date || pickText(row, ['date', 'Date'])
        const parsedDate = normalizeDate(rawDate)
        if (!parsedDate) return null

        const key = format(parsedDate, 'yyyy-MM-dd')
        const ownPrice = day.own_price ?? pickNumber(row, ['Votre hôtel le plus bas', 'Votre hotel le plus bas'])
        const compsetMedian = day.compset_median ?? pickNumber(row, ['médiane du compset', 'mediane du compset'])
        const demandRaw = day.market_demand ?? pickNumber(row, ['Demande du marché', 'Demande du marche'])

        return {
          date: key,
          dayName: format(parsedDate, 'eee', { locale: fr }),
          dayNum: format(parsedDate, 'dd/MM'),
          isWeekend: isWeekend(parsedDate),
          ownPrice,
          rack: rackByDate.get(key) ?? 0,
          compsetMedian,
          demandPct: normalizeDemandPercent(demandRaw),
          availability: availabilityByDate.get(key) ?? '-',
          events: eventsByDate.get(key)?.titles.join(' | ') || day.events || pickText(row, ['Événements', 'Evenements']),
          eventImpact: eventsByDate.get(key)?.impact ?? 0,
          suggestion: suggestionsMap.get(key),
        } as GridRow
      })
      .filter((row): row is GridRow => Boolean(row))

    if (fromApercu.length > 0) {
      return fromApercu.sort((a, b) => a.date.localeCompare(b.date))
    }

    return Array.from(availabilityByDate.entries())
      .map(([date, availability]) => {
        const parsedDate = normalizeDate(date)
        if (!parsedDate) return null

        return {
          date,
          dayName: format(parsedDate, 'eee', { locale: fr }),
          dayNum: format(parsedDate, 'dd/MM'),
          isWeekend: isWeekend(parsedDate),
          ownPrice: suggestionsMap.get(date)?.currentPrice ?? 0,
          rack: rackByDate.get(date) ?? 0,
          compsetMedian: 0,
          demandPct: 0,
          availability,
          events: eventsByDate.get(date)?.titles.join(' | ') || '',
          eventImpact: eventsByDate.get(date)?.impact ?? 0,
          suggestion: suggestionsMap.get(date),
        } as GridRow
      })
      .filter((row): row is GridRow => Boolean(row))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [apercu, disponibilites, events, pricingSuggestions, rackByDate])

  const filteredGridData = useMemo(() => {
    if (suggestionView === 'up') return gridData.filter((row) => (row.suggestion?.change ?? 0) > 0)
    if (suggestionView === 'down') return gridData.filter((row) => (row.suggestion?.change ?? 0) < 0)
    if (suggestionView === 'hold') return gridData.filter((row) => !row.suggestion || (row.suggestion?.change ?? 0) === 0)
    return gridData
  }, [gridData, suggestionView])

  const bookingExportInsights = useMemo(() => {
    if (!reservations || reservations.length === 0) {
      return {
        arrivals: 0,
        cancellations: 0,
        revenue: 0,
        avgStay: 0,
        topOrigins: [] as Array<{ origin: string; count: number }>,
      }
    }

    let arrivals = 0
    let cancellations = 0
    let revenue = 0
    let nights = 0
    const origins = new Map<string, number>()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    reservations.forEach((reservation) => {
      const row = reservation as Record<string, unknown>
      const arrivalRaw =
        (typeof row.arrival_date === 'string' ? row.arrival_date : '') ||
        pickText(row, ["Date d'arrivée", "Date d'arrivee"]) 
      const arrivalDate = normalizeDate(arrivalRaw)

      if (!arrivalDate || arrivalDate < today) return

      arrivals += 1
      const status = typeof row.Etat === 'string' ? row.Etat.toLowerCase() : ''
      if (status.includes('annul') || status.includes('cancel')) cancellations += 1

      revenue += pickNumber(row, ['Montant total'])
      nights += pickNumber(row, ['Nuits', 'Nuitées', 'Nuitees'])

      const origin = pickText(row, ['Origine', "Type d'origine"]) || 'Non défini'
      origins.set(origin, (origins.get(origin) || 0) + 1)
    })

    return {
      arrivals,
      cancellations,
      revenue,
      avgStay: arrivals > 0 ? nights / arrivals : 0,
      topOrigins: Array.from(origins.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([origin, count]) => ({ origin, count })),
    }
  }, [reservations])

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filteredGridData.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pagedGridData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredGridData.slice(start, start + pageSize)
  }, [currentPage, filteredGridData])

  const onRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['booking-apercu', hotelId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['booking-export', hotelId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['disponibilites', hotelId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['events-calendar', hotelId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['planning-tarifs', hotelId], type: 'active' }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        <p className="animate-pulse text-muted-foreground">Chargement de la grille tarifaire...</p>
      </div>
    )
  }

  return (
    <div className="animate-in space-y-6 fade-in duration-500">
      <div className="flex items-center justify-between rounded-xl border border-transparent bg-card/50 p-4 transition-all hover:border-border">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Grille tarifaire Yield</h2>
          <p className="text-muted-foreground">
            {hotel?.name || hotelId} · Analyse quotidienne et recommandations de prix dynamiques (priorité 90 jours).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 font-bold text-foreground shadow-sm transition-all hover:bg-muted"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90">
            <TrendingUp className="h-4 w-4" />
            Appliquer recommandations
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Arrivées futures</p>
          <p className="text-2xl font-black">{bookingExportInsights.arrivals}</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-xs text-rose-700">Annulations</p>
          <p className="text-2xl font-black text-rose-800">{bookingExportInsights.cancellations}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">CA futur</p>
          <p className="text-2xl font-black text-emerald-800">{formatCurrency(bookingExportInsights.revenue)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Séjour moyen</p>
          <p className="text-2xl font-black">{bookingExportInsights.avgStay.toFixed(1)} nuits</p>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSuggestionView('all'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide ${suggestionView === 'all' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}
          >
            Tout ({gridData.length})
          </button>
          <button
            onClick={() => { setSuggestionView('up'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide ${suggestionView === 'up' ? 'bg-rose-600 text-white' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}
          >
            Hausse
          </button>
          <button
            onClick={() => { setSuggestionView('down'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide ${suggestionView === 'down' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}
          >
            Baisse
          </button>
          <button
            onClick={() => { setSuggestionView('hold'); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide ${suggestionView === 'hold' ? 'bg-cyan-700 text-white' : 'border border-cyan-200 bg-cyan-50 text-cyan-700'}`}
          >
            Maintien
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-3 w-3" /> Préc.
          </button>
          <span className="text-xs font-semibold text-slate-600">
            {filteredGridData.length} lignes · Page {currentPage}/{totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suiv. <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-white/20 bg-card shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="sticky left-0 z-20 w-28 bg-muted/30 p-2 font-black uppercase tracking-wide">Date/Jour</th>
                <th className="p-2 text-center font-black uppercase tracking-wide">Dispo.</th>
                <th className="p-2 text-center font-black uppercase tracking-wide">Demande</th>
                <th className="p-2 text-center font-black uppercase tracking-wide">Comp. médiane</th>
                <th className="p-2 text-center font-black uppercase tracking-wide">Prix actuel</th>
                <th className="p-2 text-center font-black uppercase tracking-wide">Mon RACK</th>
                <th className="bg-primary/5 p-2 text-center font-black uppercase tracking-wide text-primary">Suggéré</th>
                <th className="w-[110px] p-2 text-center font-black uppercase tracking-wide">Action</th>
                <th className="w-[150px] p-2 font-black uppercase tracking-wide">Salon & événement</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/40">
              {pagedGridData.map((row) => {
                const suggestion = row.suggestion
                const demandBar = Math.min(100, Math.max(0, row.demandPct))
                const rowBg = row.isWeekend ? 'bg-slate-50/50' : 'bg-white'

                return (
                  <tr key={row.date} className={`group transition-all duration-200 hover:bg-primary/5 ${rowBg}`}>
                    <td className="sticky left-0 z-10 p-2 group-hover:bg-primary/5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black capitalize">{row.dayName}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{row.dayNum}</span>
                      </div>
                    </td>

                    <td className="p-2 text-center">
                      <span className="inline-flex h-7 min-w-[34px] items-center justify-center rounded-md bg-slate-100 px-2 text-[11px] font-black text-slate-700">
                        {row.availability}
                      </span>
                    </td>

                    <td className="p-2">
                      <div className="mx-auto flex w-[90px] flex-col items-center gap-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-cyan-500 transition-all duration-500" style={{ width: `${demandBar}%` }} />
                        </div>
                        <span className="text-[10px] font-black">{formatNumber(row.demandPct, 1)}%</span>
                      </div>
                    </td>

                    <td className="p-2 text-center font-semibold text-muted-foreground">
                      {row.compsetMedian > 0 ? formatCurrency(row.compsetMedian) : 'Indisponible'}
                    </td>

                    <td className="p-2 text-center text-sm font-black text-slate-700">{formatCurrency(row.ownPrice)}</td>
                    <td className="p-2 text-center text-sm font-black text-slate-700">{row.rack > 0 ? formatCurrency(row.rack) : '-'}</td>

                    <td className="border-x border-primary/10 bg-primary/5 p-2 text-center transition-colors group-hover:bg-primary/10">
                      {suggestion ? (
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-black ${getSuggestionTone(suggestion.change)}`}>
                            {formatCurrency(suggestion.suggestedPrice)}
                          </span>
                          <span className={`text-[10px] font-bold ${getSuggestionTone(suggestion.change)}`}>
                            {suggestion.change > 0 ? '+' : ''}{suggestion.change}€ ({suggestion.changePercent}%)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormulaDialog({
                                date: row.date,
                                reason: suggestion.reason || 'Ajustement',
                                formula: suggestion.formulaText,
                              })
                            }
                            className="mt-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Voir méthode
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-emerald-600">Optimal</span>
                      )}
                    </td>

                    <td className="p-2 text-center">
                      {suggestion ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${getActionBadgeClass(suggestion.change)}`}>
                          {suggestion.change > 0 ? <TrendingUp className="h-3 w-3" /> : suggestion.change < 0 ? <TrendingDown className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          {suggestion.change > 0 ? 'Hausse' : suggestion.change < 0 ? 'Baisse' : 'Maintien'}
                        </span>
                      ) : (
                        <div className="flex justify-center"><Check className="h-5 w-5 text-emerald-500" /></div>
                      )}
                    </td>

                    <td className="p-2">
                      {row.events ? (
                        <div className={`rounded-lg border px-2 py-1 ${getEventImpactClass(row.eventImpact)}`}>
                          <span className="block truncate text-[11px] font-bold">{row.events}</span>
                          <span className="text-[10px] font-semibold">Impact {row.eventImpact.toFixed(1)}/10</span>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {pagedGridData.length === 0 && (
            <div className="bg-muted/10 py-20 text-center text-muted-foreground italic">
              Aucune donnée disponible pour cette période. Cliquez sur "Rafraîchir" pour relancer les requêtes.
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-700">Origines booking_export</h3>
        {bookingExportInsights.topOrigins.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune origine disponible sur la plage active.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3 text-left">Origine</th>
                  <th className="py-2 pr-0 text-right">Réservations</th>
                </tr>
              </thead>
              <tbody>
                {bookingExportInsights.topOrigins.map((origin) => (
                  <tr key={origin.origin} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold">{origin.origin}</td>
                    <td className="py-2 pr-0 text-right">{origin.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formulaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Méthode de calcul du tarif suggéré</h3>
                <p className="text-xs text-slate-500">
                  Date {formulaDialog.date} · {formulaDialog.reason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormulaDialog(null)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {formulaDialog.formula}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
