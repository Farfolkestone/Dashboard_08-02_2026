import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle, Gauge, Sparkles, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useBookingApercu, useBookingExport } from '../../hooks/useBookingData'
import { useDisponibilites, useEvents } from '../../hooks/useHotelData'
import { useCompetitorRates, useCompetitorRatesVs3j, useCompetitorRatesVs7j } from '../../hooks/useCompetitorData'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { formatCurrency } from '../../utils/formatters'
import { buildTrendSeries } from '../../utils/competitorTrends'

export const YieldAnalysisPage: React.FC = () => {
  const { profile } = useAuthStore()
  const { startDate, endDate } = useDateRangeStore()
  const hotelId = profile?.hotel_id || 'H2258'

  const { data: bookingExport = [] } = useBookingExport(hotelId, startDate, endDate)
  const { data: bookingApercu = [] } = useBookingApercu(hotelId, startDate, endDate)
  const { data: disponibilites = [] } = useDisponibilites(hotelId, startDate, endDate)
  const { data: events = [] } = useEvents(hotelId, startDate, endDate)
  const { data: competitorRates = [] } = useCompetitorRates(hotelId, startDate, endDate)
  const { data: competitorRatesVs3j = [] } = useCompetitorRatesVs3j(hotelId, startDate, endDate)
  const { data: competitorRatesVs7j = [] } = useCompetitorRatesVs7j(hotelId, startDate, endDate)

  const { kpis, pricingSuggestions, alerts } = useRMSCalculations(
    bookingExport as never[],
    disponibilites,
    bookingApercu as never[],
    undefined,
    events
  )

  const trend = useMemo(
    () =>
      buildTrendSeries(
        competitorRates as Record<string, unknown>[],
        competitorRatesVs3j as Record<string, unknown>[],
        competitorRatesVs7j as Record<string, unknown>[]
      ),
    [competitorRates, competitorRatesVs3j, competitorRatesVs7j]
  )

  const apercuDemand = useMemo(() => {
    if (bookingApercu.length === 0) return 0
    const total = bookingApercu.reduce((sum, row) => {
      const r = row as Record<string, unknown>
      const d = typeof r.market_demand === 'number' ? r.market_demand : (typeof r['Demande du marché'] === 'number' ? r['Demande du marché'] : 0)
      return sum + d
    }, 0)
    return (total / bookingApercu.length) * 100
  }, [bookingApercu])

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-slate-700" />
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Analyses Yield</h2>
        </div>
        <p className="text-sm text-slate-500">
          Periode active: {format(startDate, 'dd MMM yyyy', { locale: fr })} au {format(endDate, 'dd MMM yyyy', { locale: fr })}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Occupation</p><p className="text-2xl font-black">{kpis.occupancyRate.toFixed(1)}%</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">ADR</p><p className="text-2xl font-black">{formatCurrency(kpis.adr)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">RevPAR</p><p className="text-2xl font-black">{formatCurrency(kpis.revpar)}</p></div>
        <div className="rounded-xl bg-cyan-50 p-4"><p className="text-xs text-cyan-700">Demande moyenne</p><p className="text-2xl font-black text-cyan-800">{apercuDemand.toFixed(0)}%</p></div>
        <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs text-amber-700">Suggestions RMS</p><p className="text-2xl font-black text-amber-800">{pricingSuggestions.length}</p></div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Votre tarif vs 3j</p><p className="text-2xl font-black">{trend.summary.avgOwnVs3j >= 0 ? '+' : ''}{formatCurrency(trend.summary.avgOwnVs3j)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Votre tarif vs 7j</p><p className="text-2xl font-black">{trend.summary.avgOwnVs7j >= 0 ? '+' : ''}{formatCurrency(trend.summary.avgOwnVs7j)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Compset médiane vs 3j</p><p className="text-2xl font-black">{trend.summary.avgCompsetVs3j >= 0 ? '+' : ''}{formatCurrency(trend.summary.avgCompsetVs3j)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Compset médiane vs 7j</p><p className="text-2xl font-black">{trend.summary.avgCompsetVs7j >= 0 ? '+' : ''}{formatCurrency(trend.summary.avgCompsetVs7j)}</p></div>
        <div className="rounded-xl bg-cyan-50 p-4"><p className="text-xs text-cyan-700">Demande marché vs 3j</p><p className="text-2xl font-black text-cyan-800">{trend.summary.avgDemandVs3j >= 0 ? '+' : ''}{trend.summary.avgDemandVs3j.toFixed(1)} pts</p></div>
        <div className="rounded-xl bg-cyan-50 p-4"><p className="text-xs text-cyan-700">Demande marché vs 7j</p><p className="text-2xl font-black text-cyan-800">{trend.summary.avgDemandVs7j >= 0 ? '+' : ''}{trend.summary.avgDemandVs7j.toFixed(1)} pts</p></div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-700">Top suggestions tarifaires</h3>
          <div className="space-y-3">
            {pricingSuggestions.slice(0, 10).map((s) => (
              <div key={`${s.date}-${s.reason}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.date}</p>
                  <p className="text-sm font-semibold text-slate-900">{s.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Actuel / Reco</p>
                  <p className="font-black text-slate-900">{formatCurrency(s.currentPrice)} {'->'} {formatCurrency(s.suggestedPrice)}</p>
                </div>
              </div>
            ))}
            {pricingSuggestions.length === 0 && <p className="text-sm text-slate-500">Aucune suggestion sur cette plage.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-700">Alertes & signaux</h3>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p className="text-sm font-medium">{a}</p>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                <p className="text-sm font-semibold">Aucune alerte critique detectee.</p>
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Confiance RMS moyenne</p><p className="text-xl font-black"><Gauge className="mr-1 inline h-4 w-4" />{pricingSuggestions.length > 0 ? (pricingSuggestions.reduce((s, r) => s + r.confidence, 0) / pricingSuggestions.length).toFixed(1) : '0'}%</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Variation prix moyenne</p><p className="text-xl font-black"><TrendingUp className="mr-1 inline h-4 w-4" />{pricingSuggestions.length > 0 ? formatCurrency(pricingSuggestions.reduce((s, r) => s + r.change, 0) / pricingSuggestions.length) : formatCurrency(0)}</p></div>
          </div>
        </div>
      </section>
    </div>
  )
}
