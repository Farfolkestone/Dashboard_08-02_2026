import React, { useMemo } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useBookingApercu, useBookingExport } from '../../hooks/useBookingData'
import { useDisponibilites } from '../../hooks/useHotelData'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { format, parseISO, isWeekend } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
    TrendingUp,
    TrendingDown,
    Check
} from 'lucide-react'

export const PricingGrid: React.FC = () => {
    const { profile } = useAuthStore()
    const { startDate, endDate } = useDateRangeStore()
    const hotelId = profile?.hotel_id || 'H2258'

    const { data: apercu, isLoading: loadingApercu } = useBookingApercu(hotelId, startDate, endDate)
    const { data: disponibilites, isLoading: loadingDisponibilites } = useDisponibilites(hotelId, startDate, endDate)
    const { data: reservations } = useBookingExport(hotelId, startDate, endDate)

    const { pricingSuggestions } = useRMSCalculations(
        reservations || [],
        disponibilites || [],
        apercu || []
    )

    const isLoading = loadingApercu || loadingDisponibilites

    const gridData = useMemo(() => {
        if (!apercu) return []

        // Map suggestions by date for easy lookup
        const suggestionsMap = new Map()
        pricingSuggestions.forEach(s => {
            suggestionsMap.set(s.date, s)
        })

        // Map disponibilites by date
        const discoMap = new Map()
        disponibilites?.forEach((d: any) => {
            discoMap.set(d.date, d.disponibilites)
        })

        return apercu.map((day: any) => {
            const dateStr = day.date || ''
            const dateObj = dateStr ? parseISO(dateStr) : new Date()
            const suggestion = suggestionsMap.get(dateStr)

            return {
                date: dateStr,
                dayName: format(dateObj, 'eee', { locale: fr }),
                dayNum: format(dateObj, 'dd/MM'),
                isWeekend: isWeekend(dateObj),
                ownPrice: Number(day.own_price || 0),
                compsetMedian: Number(day.compset_median || 0),
                demand: Number(day.market_demand || 0),
                availability: discoMap.get(dateStr) ?? '-',
                events: day.events || day['Événements'] || '',
                suggestion: suggestion,
                occupancy: 0
            }
        })
    }, [apercu, disponibilites, pricingSuggestions])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground animate-pulse">Chargement de la grille tarifaire...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-card/50 p-4 rounded-xl border border-transparent hover:border-border transition-all">
                <div>
                    <h2 className="text-3xl font-black tracking-tight">Grille Tarifaire Yield</h2>
                    <p className="text-muted-foreground">Analyse quotidienne et recommandations de prix dynamiques.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-bold shadow-sm">
                        <TrendingUp className="w-4 h-4" />
                        Appliquer Recommandations
                    </button>
                </div>
            </div>

            <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden glassmorphism border-white/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border/50">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest sticky left-0 bg-muted/30 z-20 w-32">Date / Jour</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Dispo.</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Demande</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Comp. Médiane</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Prix Actuel</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center bg-primary/5 text-primary">Suggéré (Yield)</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Action</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Événements</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {gridData.map((row) => {
                                const suggestion = row.suggestion

                                return (
                                    <tr key={row.date} className={`group hover:bg-primary/5 transition-all duration-200 ${row.isWeekend ? 'bg-blue-50/20' : ''}`}>
                                        <td className={`p-4 sticky left-0 z-10 transition-colors ${row.isWeekend ? 'bg-blue-50/50' : 'bg-card group-hover:bg-primary/5'}`}>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm capitalize">{row.dayName}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">{row.dayNum}</span>
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg text-xs font-black ${Number(row.availability) < 5 && row.availability !== '-' ? 'bg-rose-500 text-white animate-pulse' : 'bg-muted text-foreground'
                                                }`}>
                                                {row.availability}
                                            </span>
                                        </td>

                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1 min-w-[80px]">
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${row.demand * 100 > 80 ? 'bg-rose-500' : row.demand * 100 > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(100, row.demand * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black">{formatNumber(row.demand * 100, 2)}%</span>
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            <span className="text-sm font-bold text-muted-foreground italic">
                                                {formatCurrency(row.compsetMedian)}
                                            </span>
                                        </td>

                                        <td className="p-4 text-center">
                                            <span className="text-base font-black text-slate-700">
                                                {formatCurrency(row.ownPrice)}
                                            </span>
                                        </td>

                                        <td className="p-4 text-center bg-primary/5 group-hover:bg-primary/10 transition-colors border-x border-primary/10">
                                            {suggestion ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-base font-black ${suggestion.change > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {formatCurrency(suggestion.suggestedPrice)}
                                                    </span>
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
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${suggestion.change > 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                    {suggestion.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {suggestion.reason || 'Ajuster'}
                                                </span>
                                            ) : (
                                                <div className="flex justify-center">
                                                    <Check className="w-5 h-5 text-emerald-500" />
                                                </div>
                                            )}
                                        </td>

                                        <td className="p-4">
                                            {row.events && (
                                                <div className="flex items-center gap-2 group/event">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 group-hover/event:scale-125 transition-transform"></div>
                                                    <span className="text-xs font-bold text-amber-700 truncate max-w-[150px]">{row.events}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {gridData.length === 0 && (
                        <div className="py-20 text-center text-muted-foreground italic bg-muted/10">
                            Aucune donnée disponible pour cette période.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
