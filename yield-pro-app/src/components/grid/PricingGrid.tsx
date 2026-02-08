import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, isWeekend, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, RefreshCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { useBookingApercu, useBookingExport } from '../../hooks/useBookingData'
import { useDisponibilites } from '../../hooks/useHotelData'
import { useDashboardConfig } from '../../hooks/useDashboardConfig'
import { useHotelByHotelId } from '../../hooks/useHotels'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useAuthStore } from '../../store/useAuthStore'
import type { Database } from '../../types/database.types'
import { formatCurrency, formatNumber } from '../../utils/formatters'

type DisponibilitesRow = Database['public']['Tables']['disponibilites']['Row']
type BookingApercuRow = Database['public']['Tables']['booking_apercu']['Row']
type BookingApercuLike = BookingApercuRow & {
    date?: string | null
    own_price?: number | null
    compset_median?: number | null
    market_demand?: number | null
    events?: string | null
}

const pickNumber = (record: Record<string, unknown>, aliases: string[]) => {
    for (const alias of aliases) {
        const value = record[alias]
        if (typeof value === 'number') return value
        if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
    }
    return 0
}

const pickText = (record: Record<string, unknown>, aliases: string[]) => {
    for (const alias of aliases) {
        const value = record[alias]
        if (typeof value === 'string' && value.trim() !== '') return value
    }
    return ''
}

const normalizeDate = (value: string | null | undefined): Date | null => {
    if (!value) return null

    const parsedIso = parseISO(value)
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso

    const parsedNative = new Date(value)
    if (!Number.isNaN(parsedNative.getTime())) return parsedNative

    if (value.includes('/')) {
        const [day, month, year] = value.split('/').map(Number)
        if (day && month && year) {
            const fallback = new Date(year, month - 1, day)
            if (!Number.isNaN(fallback.getTime())) return fallback
        }
    }

    return null
}

export const PricingGrid: React.FC = () => {
    const queryClient = useQueryClient()
    const { profile } = useAuthStore()
    const { startDate, endDate } = useDateRangeStore()
    const hotelId = profile?.hotel_id || 'H2258'
    const { data: hotel } = useHotelByHotelId(hotelId)

    const { data: apercu, isLoading: loadingApercu } = useBookingApercu(hotelId, startDate, endDate)
    const { data: disponibilites, isLoading: loadingDisponibilites } = useDisponibilites(hotelId, startDate, endDate)
    const { data: reservations } = useBookingExport(hotelId, startDate, endDate)
    const { config } = useDashboardConfig()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const { pricingSuggestions } = useRMSCalculations(reservations || [], disponibilites || [], apercu || [], config.rms)
    const isLoading = loadingApercu || loadingDisponibilites

    const gridData = useMemo(() => {
        const suggestionsMap = new Map<string, (typeof pricingSuggestions)[number]>()
        pricingSuggestions.forEach((s) => suggestionsMap.set(s.date, s))

        const discoMap = new Map<string, number | null>()
        disponibilites?.forEach((d: DisponibilitesRow) => {
            const current = discoMap.get(d.date) ?? 0
            const next = (typeof d.disponibilites === 'number' ? d.disponibilites : 0)
            discoMap.set(d.date, current + next)
        })

        const normalizedFromApercu = (apercu || [])
            .map((day) => {
                const dayData = day as BookingApercuLike
                const row = dayData as Record<string, unknown>
                const dateStr = dayData.date || dayData.Date || ''
                const dateObj = normalizeDate(dateStr)
                if (!dateObj) return null

                const ownPrice = dayData.own_price ?? pickNumber(row, ['Votre hôtel le plus bas', 'Votre hÃ´tel le plus bas'])
                const compsetMedian = dayData.compset_median ?? pickNumber(row, ['médiane du compset', 'mÃ©diane du compset'])
                const demand = dayData.market_demand ?? pickNumber(row, ['Demande du marché', 'Demande du marchÃ©'])
                const normalizedDate = format(dateObj, 'yyyy-MM-dd')
                const suggestion = suggestionsMap.get(normalizedDate) || suggestionsMap.get(dateStr)

                return {
                    date: normalizedDate,
                    dayName: format(dateObj, 'eee', { locale: fr }),
                    dayNum: format(dateObj, 'dd/MM'),
                    isWeekend: isWeekend(dateObj),
                    ownPrice,
                    compsetMedian,
                    demand,
                    availability: discoMap.get(normalizedDate) ?? '-',
                    events: dayData.events || pickText(row, ['Événements', 'Ã‰vÃ©nements']),
                    suggestion,
                }
            })
            .filter((row): row is NonNullable<typeof row> => Boolean(row))

        if (normalizedFromApercu.length > 0) {
            return normalizedFromApercu.sort((a, b) => a.date.localeCompare(b.date))
        }

        return Array.from(discoMap.entries())
            .map(([date, availability]) => {
                const dateObj = normalizeDate(date)
                if (!dateObj) return null
                const suggestion = suggestionsMap.get(date)
                return {
                    date,
                    dayName: format(dateObj, 'eee', { locale: fr }),
                    dayNum: format(dateObj, 'dd/MM'),
                    isWeekend: isWeekend(dateObj),
                    ownPrice: suggestion?.currentPrice ?? 0,
                    compsetMedian: 0,
                    demand: 0,
                    availability: availability ?? '-',
                    events: '',
                    suggestion,
                }
            })
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .sort((a, b) => a.date.localeCompare(b.date))
    }, [apercu, disponibilites, pricingSuggestions])

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
                pickText(row, ["Date d'arrivée", 'Date d’arrivee', 'Date d\u0027arrivee', 'Date d\'arrivee'])
            const arrivalDate = normalizeDate(arrivalRaw)
            if (!arrivalDate || arrivalDate < today) return

            arrivals += 1
            const status = typeof row.Etat === 'string' ? row.Etat.toLowerCase() : ''
            if (status.includes('annul') || status.includes('cancel')) cancellations += 1
            revenue += pickNumber(row, ['Montant total'])
            nights += pickNumber(row, ['Nuits'])
            const origin = pickText(row, ['Origine', "Type d'origine"]) || 'Non defini'
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

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                <p className="animate-pulse text-muted-foreground">Chargement de la grille tarifaire...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between rounded-xl border border-transparent bg-card/50 p-4 transition-all hover:border-border">
                <div>
                    <h2 className="text-3xl font-black tracking-tight">Grille tarifaire Yield</h2>
                    <p className="text-muted-foreground">
                        {hotel?.name || hotelId} · Analyse quotidienne et recommandations de prix dynamiques (priorité 90 jours).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            setIsRefreshing(true)
                            try {
                                await Promise.all([
                                    queryClient.refetchQueries({ queryKey: ['booking-apercu', hotelId], type: 'active' }),
                                    queryClient.refetchQueries({ queryKey: ['booking-export', hotelId], type: 'active' }),
                                    queryClient.refetchQueries({ queryKey: ['disponibilites', hotelId], type: 'active' }),
                                ])
                            } finally {
                                setIsRefreshing(false)
                            }
                        }}
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
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Arrivees futures</p><p className="text-2xl font-black">{bookingExportInsights.arrivals}</p></div>
                <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-700">Annulations</p><p className="text-2xl font-black text-rose-800">{bookingExportInsights.cancellations}</p></div>
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">CA futur</p><p className="text-2xl font-black text-emerald-800">{formatCurrency(bookingExportInsights.revenue)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Sejour moyen</p><p className="text-2xl font-black">{bookingExportInsights.avgStay.toFixed(1)} nuits</p></div>
            </section>

            <div className="glassmorphism overflow-hidden rounded-2xl border border-white/20 bg-card shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-border/50 bg-muted/30">
                                <th className="sticky left-0 z-20 w-32 bg-muted/30 p-4 text-[10px] font-black uppercase tracking-widest">Date / Jour</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Dispo.</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Demande</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Comp. médiane</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Prix actuel</th>
                                <th className="bg-primary/5 p-4 text-center text-[10px] font-black uppercase tracking-widest text-primary">Suggéré (Yield)</th>
                                <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Action</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Événements</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {gridData.map((row) => {
                                const suggestion = row.suggestion

                                return (
                                    <tr key={row.date} className={`group transition-all duration-200 hover:bg-primary/5 ${row.isWeekend ? 'bg-blue-50/20' : ''}`}>
                                        <td className={`sticky left-0 z-10 p-4 transition-colors ${row.isWeekend ? 'bg-blue-50/50' : 'bg-card group-hover:bg-primary/5'}`}>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black capitalize">{row.dayName}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">{row.dayNum}</span>
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            <span className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-black ${Number(row.availability) < 5 && row.availability !== '-' ? 'animate-pulse bg-rose-500 text-white' : 'bg-muted text-foreground'}`}>
                                                {row.availability}
                                            </span>
                                        </td>

                                        <td className="p-4">
                                            <div className="flex min-w-[80px] flex-col items-center gap-1">
                                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${row.demand * 100 > 80 ? 'bg-rose-500' : row.demand * 100 > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(100, row.demand * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black">{formatNumber(row.demand * 100, 2)}%</span>
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            <span className="text-sm font-bold italic text-muted-foreground">
                                                {row.compsetMedian > 0 ? formatCurrency(row.compsetMedian) : 'Indisponible'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center"><span className="text-base font-black text-slate-700">{formatCurrency(row.ownPrice)}</span></td>

                                        <td className="border-x border-primary/10 bg-primary/5 p-4 text-center transition-colors group-hover:bg-primary/10">
                                            {suggestion ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-base font-black ${suggestion.change > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(suggestion.suggestedPrice)}</span>
                                                    <span className={`text-[10px] font-bold ${suggestion.change > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                        {suggestion.change > 0 ? '+' : ''}{suggestion.change}€ ({suggestion.changePercent}%)
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm font-bold text-emerald-500">Optimal</span>
                                            )}
                                        </td>

                                        <td className="p-4 text-center">
                                            {suggestion ? (
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${suggestion.change > 0 ? 'border border-rose-200 bg-rose-100 text-rose-700' : 'border border-emerald-200 bg-emerald-100 text-emerald-700'}`}>
                                                    {suggestion.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {suggestion.reason || 'Ajuster'}
                                                </span>
                                            ) : (
                                                <div className="flex justify-center"><Check className="h-5 w-5 text-emerald-500" /></div>
                                            )}
                                        </td>

                                        <td className="p-4">
                                            {row.events && (
                                                <div className="group/event flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-amber-500 transition-transform group-hover/event:scale-125" />
                                                    <span className="max-w-[150px] truncate text-xs font-bold text-amber-700">{row.events}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {gridData.length === 0 && (
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
                                    <th className="py-2 pr-0 text-right">Reservations</th>
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
        </div>
    )
}

