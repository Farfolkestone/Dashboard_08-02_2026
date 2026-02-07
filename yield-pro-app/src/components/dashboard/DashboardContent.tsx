import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useBookingApercu } from '../../hooks/useBookingData'
import { useReservations, useDisponibilites } from '../../hooks/useHotelData'
import { useRMSCalculations } from '../../hooks/useRMSCalculations'
import { formatShortDate } from '../../utils/formatters'
import { FinancialScorecard } from './FinancialScorecard'
import { YieldChart } from './YieldChart'
import { DashboardSidebar } from './DashboardSidebar'
import {
  ChevronRight,
  Home,
  LayoutDashboard,
  Edit3
} from 'lucide-react'

export const DashboardContent: React.FC = () => {
  const { profile } = useAuthStore()
  const { startDate, endDate } = useDateRangeStore()
  const hotelId = profile?.hotel_id || 'H2258'

  const { data: apercu, isLoading: loadingApercu } = useBookingApercu(hotelId, startDate, endDate)
  const { data: reservations, isLoading: loadingReservations } = useReservations(hotelId, startDate, endDate)
  const { data: disponibilites, isLoading: loadingDisponibilites } = useDisponibilites(hotelId, startDate, endDate)

  const { kpis } = useRMSCalculations(
    reservations || [],
    disponibilites || [],
    apercu || []
  )

  const isLoading = loadingApercu || loadingReservations || loadingDisponibilites

  // Chart Data normalization
  const chartData = useMemo(() => {
    if (!apercu || !Array.isArray(apercu)) return []
    return apercu.map(d => ({
      date: formatShortDate((d as any).date || ''),
      price: Number((d as any).own_price || 0),
      market: Number((d as any).compset_median || 0),
      demand: Number((d as any).market_demand || 0)
    }))
  }, [apercu])

  // Mock budget/forecast data for the scorecard to match the aesthetics
  const scorecardData = useMemo(() => ({
    roomNights: {
      value: kpis.occupiedRooms,
      target: kpis.totalRooms * 0.8,
      committed: kpis.occupiedRooms,
      forecast: kpis.occupiedRooms * 1.15,
      change: 5.2
    },
    adr: {
      value: kpis.adr,
      target: 180,
      committed: kpis.adr,
      forecast: 165,
      change: -15
    },
    revpar: {
      value: kpis.revpar,
      target: 120,
      committed: kpis.revpar,
      forecast: 110,
      change: -6
    },
    revenue: {
      value: kpis.adr * kpis.occupiedRooms,
      target: 30000,
      committed: kpis.adr * kpis.occupiedRooms,
      forecast: 25000,
      change: -10
    }
  }), [kpis])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground animate-pulse font-bold tracking-tight">Chargement du dashboard stratégique...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-[1600px] mx-auto px-4">
      {/* Header & Breadcrumbs */}
      <div className="flex justify-between items-end pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
            <Home className="w-3 h-3" />
            <ChevronRight className="w-3 h-3" />
            <span>GameChanger</span>
            <ChevronRight className="w-3 h-3" />
            <span>All Properties Report</span>
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-slate-800">
            Folkestone Opéra <span className="text-muted-foreground font-light px-2">|</span>
            <span className="text-2xl font-bold text-muted-foreground">
              {startDate && endDate ? (
                `${format(startDate, 'MMMM d, yyyy')} - ${format(endDate, 'MMMM d, yyyy')}`
              ) : (
                "Période non sélectionnée"
              )}
            </span>
          </h2>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg font-black text-[11px] uppercase tracking-wider hover:bg-muted transition-all shadow-sm">
            <Edit3 className="w-4 h-4" />
            Edit Charts
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-black text-[11px] uppercase tracking-wider hover:translate-y-[-1px] transition-all shadow-md">
            <LayoutDashboard className="w-4 h-4" />
            Apply Strategy
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Visualizations */}
        <div className="flex-grow space-y-8 min-w-0">
          <FinancialScorecard data={scorecardData} />
          <YieldChart data={chartData} />
        </div>

        {/* Right Column: Sidebar */}
        <aside className="lg:shrink-0">
          <DashboardSidebar />
        </aside>
      </div>
    </div>
  )
}
