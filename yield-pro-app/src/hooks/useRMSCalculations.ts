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
  const kpis: KPIData = useMemo(() => {
    if (!reservations.length || !disponibilites.length) {
      return {
        occupancyRate: 0,
        adr: 0,
        revpar: 0,
        pickupRooms: 0,
        pickupRevenue: 0,
        totalRooms: 0,
        occupiedRooms: 0,
      }
    }

    // Calcul des chambres totales
    const totalRooms = disponibilites.reduce((sum, d) => sum + (d.disponibilites || 0), 0)
    
    // Calcul des chambres occupées (réservations confirmées)
    const confirmedReservations = reservations.filter(r => r.Etat === 'Confirmée')
    const occupiedRooms = confirmedReservations.reduce((sum, r) => sum + (r.Chambres || 0), 0)
    
    // Taux d'occupation
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0
    
    // ADR (Average Daily Rate)
    const totalRevenue = confirmedReservations.reduce((sum, r) => sum + (r['Montant total'] || 0), 0)
    const adr = occupiedRooms > 0 ? totalRevenue / occupiedRooms : 0
    
    // RevPAR
    const revpar = totalRooms > 0 ? totalRevenue / totalRooms : 0
    
    // Pickup (réservations des 7 derniers jours)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentReservations = confirmedReservations.filter(r => {
      const purchaseDate = r['Date d\'achat'] ? new Date(r['Date d\'achat']) : null
      return purchaseDate && purchaseDate >= sevenDaysAgo
    })
    const pickupRooms = recentReservations.reduce((sum, r) => sum + (r.Chambres || 0), 0)
    const pickupRevenue = recentReservations.reduce((sum, r) => sum + (r['Montant total'] || 0), 0)

    return {
      occupancyRate,
      adr,
      revpar,
      pickupRooms,
      pickupRevenue,
      totalRooms,
      occupiedRooms,
    }
  }, [reservations, disponibilites])

  const pricingSuggestions: PricingSuggestion[] = useMemo(() => {
    if (!apercu.length) return []

    return apercu.map(day => {
      const currentPrice = day['Votre hôtel le plus bas'] || 0
      const marketDemand = day['Demande du marché'] || 0
      const competitorAvg = day['médiane du compset'] || 0
      
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
        date: day.Date || '',
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
