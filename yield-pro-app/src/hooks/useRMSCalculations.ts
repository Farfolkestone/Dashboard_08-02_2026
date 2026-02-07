import { useMemo } from 'react'
import type { Database } from '../types/database.types'

type BookingExport = Database['public']['Tables']['booking_export']['Row']
type Disponibilites = Database['public']['Tables']['disponibilites']['Row']
type BookingApercu = Database['public']['Tables']['booking_apercu']['Row']

interface KPIData {
  occupancyRate: number
  adr: number
  revpar: number
  pickupRooms: number
  pickupRevenue: number
  totalRooms: number
  occupiedRooms: number
}

interface PricingSuggestion {
  date: string
  currentPrice: number
  suggestedPrice: number
  change: number
  changePercent: number
  reason: string
}

export const useRMSCalculations = (
  reservations: BookingExport[],
  disponibilites: Disponibilites[],
  apercu: BookingApercu[]
) => {
  // Configuration des capacités par hôtel
  const HOTEL_CAPACITIES: Record<string, number> = {
    'H2258': 45, // Folkestone Opéra
    'DEMO': 50
  }

  const kpis: KPIData = useMemo(() => {
    // 1. Détermination de la capacité de l'hôtel
    // On essaie de trouver l'ID hôtel dans les résas ou aperçu sinon on prend le profil
    const currentHotelId = reservations[0]?.hotel_id || apercu[0]?.hotel_id || 'H2258'
    const capacityPerDay = HOTEL_CAPACITIES[currentHotelId] || 30 // Défaut à 30 si inconnu

    // 2. Calcul du nombre de jours couverts par les données ou la sélection
    // On se base sur la période sélectionnée pour le calcul du RevPAR et de l'Occupation
    const startDate = apercu.length > 0 ? new Date((apercu[0] as any).date) : new Date()
    const endDate = apercu.length > 0 ? new Date((apercu[apercu.length - 1] as any).date) : new Date()
    const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1)

    const totalRoomsCapacity = capacityPerDay * dayCount

    // 3. Filtrage des réservations confirmées (gestion casse et possible 'e' final)
    const confirmedReservations = reservations.filter(r => {
      const etat = (r as any).Etat || ''
      return etat.toLowerCase().startsWith('confirm') // Capture 'Confirmée', 'Confirmé', 'Confirmed'
    })

    // 4. Calcul des chambres occupées et du revenu
    // Utilisation des colonnes normalisées : total_amount, Chambres
    const occupiedRooms = confirmedReservations.reduce((sum, r: any) => sum + (Number(r.Chambres) || 0), 0)
    const totalRevenue = confirmedReservations.reduce((sum, r: any) => sum + (Number(r.total_amount) || 0), 0)

    // Taux d'occupation (Total chambres vendues / Capacité totale sur la période)
    const occupancyRate = totalRoomsCapacity > 0 ? (occupiedRooms / totalRoomsCapacity) * 100 : 0

    // ADR (Average Daily Rate) : CA / Chambres Vendues
    const adr = occupiedRooms > 0 ? totalRevenue / occupiedRooms : 0

    // RevPAR : CA / Capacité Totale
    const revpar = totalRoomsCapacity > 0 ? totalRevenue / totalRoomsCapacity : 0

    // 5. Calcul du Pickup (réservations prises lors des 7 derniers jours)
    const now = new Date()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)

    const recentReservations = confirmedReservations.filter((r: any) => {
      const pDateStr = r.purchase_date || r["Date d'achat"]
      if (!pDateStr) return false

      const pDate = new Date(pDateStr)
      // Si format français JJ/MM/AAAA, Date(JJ/MM/AAAA) échoue, on tente un split
      if (isNaN(pDate.getTime()) && typeof pDateStr === 'string' && pDateStr.includes('/')) {
        const [day, month, year] = pDateStr.split('/')
        const parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
        return parsedDate >= sevenDaysAgo
      }

      return !isNaN(pDate.getTime()) && pDate >= sevenDaysAgo
    })

    const pickupRooms = recentReservations.reduce((sum, r: any) => sum + (Number(r.Chambres) || 0), 0)
    const pickupRevenue = recentReservations.reduce((sum, r: any) => sum + (Number(r.total_amount) || 0), 0)

    return {
      occupancyRate,
      adr,
      revpar,
      pickupRooms,
      pickupRevenue,
      totalRooms: totalRoomsCapacity,
      occupiedRooms,
    }
  }, [reservations, apercu])

  const pricingSuggestions: PricingSuggestion[] = useMemo(() => {
    if (!apercu.length) return []

    return apercu.map((day: any) => {
      const currentPrice = day.own_price || 0
      const marketDemand = day.market_demand || 0
      const competitorAvg = day.compset_median || 0

      // Algorithme simple de suggestion
      let suggestedPrice = currentPrice
      let reason = ''

      if (marketDemand > 80 && currentPrice < competitorAvg * 1.1) {
        suggestedPrice = currentPrice * 1.1
        reason = 'Forte demande du marché'
      } else if (marketDemand < 30 && currentPrice > competitorAvg * 0.9) {
        suggestedPrice = currentPrice * 0.95
        reason = 'Faible demande - ajustement compétitif'
      } else if (currentPrice < competitorAvg * 0.85) {
        suggestedPrice = competitorAvg * 0.9
        reason = 'Sous-positionné vs concurrence'
      }

      const change = suggestedPrice - currentPrice
      const changePercent = currentPrice > 0 ? (change / currentPrice) * 100 : 0

      return {
        date: day.date || '',
        currentPrice,
        suggestedPrice: Math.round(suggestedPrice),
        change: Math.round(change),
        changePercent: Math.round(changePercent * 10) / 10,
        reason,
      }
    }).filter(s => s.reason !== '')
  }, [apercu])

  return { kpis, pricingSuggestions }
}
