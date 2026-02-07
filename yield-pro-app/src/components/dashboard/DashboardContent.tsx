import React, { useState } from 'react'
import { KPICard } from './KPICard'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useBookingApercu } from '../../hooks/useBookingData'
import { useReservations, useDisponibilites } from '../../hooks/useHotelData'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { useDashboardConfig } from '../../hooks/useDashboardConfig'
import type { DashboardWidgets } from '../../hooks/useDashboardConfig'
import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import {
  BedDouble,
  Euro,
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  BarChart3,
  Calendar,
  Settings2,
  Check
} from 'lucide-react'
import { formatShortDate } from '../../utils/formatters'

export const DashboardContent: React.FC = () => {
  const { profile } = useAuthStore()
  const { startDate, endDate } = useDateRangeStore()
  const { config, updateConfig } = useDashboardConfig()
  const [showConfig, setShowConfig] = useState(false)
  const hotelId = profile?.hotel_id || 'H2258'

  const { data: apercu, isLoading: loadingApercu } = useBookingApercu(hotelId, startDate, endDate)
  const { data: reservations, isLoading: loadingReservations } = useReservations(hotelId, startDate, endDate)
  const { data: disponibilites, isLoading: loadingDisponibilites } = useDisponibilites(hotelId, startDate, endDate)

  const { kpis, pricingSuggestions } = useRMSCalculations(
    reservations || [],
    disponibilites || [],
    apercu || []
  )

  const isLoading = loadingApercu || loadingReservations || loadingDisponibilites

  // Données pour graphiques
  const chartData = apercu?.map(d => ({
    date: formatShortDate(d.Date || ''),
    price: d['Votre hôtel le plus bas'],
    market: d['médiane du compset'],
    demand: d['Demande du marché']
  })) || []

  const toggleWidget = (key: keyof DashboardWidgets) => {
    if (!config) return
    updateConfig.mutate({ ...config, [key]: !config[key] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vue d'ensemble</h2>
          <p className="text-muted-foreground">Analyse des performances pour la période sélectionnée.</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
        >
          <Settings2 className="w-4 h-4" />
          Personnaliser
        </button>
      </div>

      {showConfig && config && (
        <div className="p-6 bg-card border rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold mb-4">Configuration du Dashboard</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(config) as Array<keyof DashboardWidgets>).map((key) => (
              <button
                key={key}
                onClick={() => toggleWidget(key)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${config[key] ? 'bg-primary/5 border-primary text-primary' : 'bg-background border-border text-muted-foreground'
                  }`}
              >
                <span className="text-xs font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                {config[key] && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {config?.occupancy && (
          <KPICard
            title="Taux d'occupation"
            value={kpis.occupancyRate}
            unit="%"
            change={5.2}
            icon={<BedDouble className="w-6 h-6" />}
            color="blue"
          />
        )}
        {config?.adr && (
          <KPICard
            title="ADR (Prix moyen)"
            value={kpis.adr}
            currency
            change={-2.1}
            icon={<Euro className="w-6 h-6" />}
            color="green"
          />
        )}
        {config?.revenue && (
          <KPICard
            title="RevPAR"
            value={kpis.revpar}
            currency
            change={3.4}
            icon={<TrendingUp className="w-6 h-6" />}
            color="purple"
          />
        )}
        {config?.pickup && (
          <KPICard
            title="Pickup (7 jours)"
            value={kpis.pickupRooms}
            unit="ch."
            change={12.5}
            icon={<ShoppingCart className="w-6 h-6" />}
            color="orange"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Graphique Evolution Prix */}
        {config?.competitors && (
          <div className="lg:col-span-2 bg-card border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">Evolution des prix vs Marché</h3>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} unit="€" />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Area type="monotone" dataKey="price" name="Votre Prix" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                  <Line type="monotone" dataKey="market" name="Médiane Marché" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Graphique Demande */}
        {config?.market && (
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-lg">Demande du Marché</h3>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="demand" name="Indice Demande" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Module Propositions Tarifaires */}
      {config?.yieldRecommendations && (
        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <h3 className="font-bold text-xl">Recommandations Yield Management</h3>
            </div>
            <button className="text-primary text-sm font-semibold hover:underline bg-primary/5 px-4 py-2 rounded-lg">
              Appliquer toutes les recommandations
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pricingSuggestions.map((suggestion) => (
              <div key={suggestion.date} className="border rounded-xl p-5 hover:border-primary transition-all bg-muted/30">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 font-bold">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {formatShortDate(suggestion.date)}
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${suggestion.change > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                    {suggestion.change > 0 ? '+' : ''}{suggestion.change}€
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nouveau Prix Suggéré</p>
                    <p className="text-2xl font-black">{suggestion.suggestedPrice}€</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Actuel: {suggestion.currentPrice}€</p>
                    <p className="text-sm font-medium text-amber-600">{suggestion.reason}</p>
                  </div>
                </div>
                <button className="w-full mt-4 py-2 bg-background border border-primary/20 hover:border-primary text-primary text-sm font-bold rounded-lg transition-all">
                  Mettre à jour
                </button>
              </div>
            ))}
            {pricingSuggestions.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground italic">
                Aucune recommandation pour cette période.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
