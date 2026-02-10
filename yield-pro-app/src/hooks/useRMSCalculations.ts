import { useMemo } from 'react'
import type { Database } from '../types/database.types'
import type { RMSSettings } from './useDashboardConfig'

type BookingExport = Database['public']['Tables']['booking_export']['Row']
type Disponibilites = Database['public']['Tables']['disponibilites']['Row']
type BookingApercu = Database['public']['Tables']['booking_apercu']['Row']
type EventsCalendar = Database['public']['Tables']['events_calendar']['Row']

type BookingExportLike = BookingExport & {
  total_amount?: number | null
  purchase_date?: string | null
  arrival_date?: string | null
}

type BookingApercuLike = BookingApercu & {
  date?: string | null
  own_price?: number | null
  compset_median?: number | null
  market_demand?: number | null
  events?: string | null
}

type EventLike = EventsCalendar & Record<string, unknown>

interface KPIData {
  occupancyRate: number
  adr: number
  revpar: number
  pickupRooms: number
  pickupRevenue: number
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  projectedOccupancy: number
}

export interface PricingSuggestion {
  date: string
  currentPrice: number
  suggestedPrice: number
  change: number
  changePercent: number
  reason: string
  formulaText: string
  confidence: number
  shouldAutoApprove: boolean
}

export interface RMSDailyDecision {
  date: string
  occupancyOnBooks: number
  demandIndex: number
  competitorMedian: number
  eventImpact: number
  pickupRooms: number
  currentPrice: number
  recommendedPrice: number
  confidence: number
  reason: string
  formulaText: string
  shouldAutoApprove: boolean
}

const defaultSettings: RMSSettings = {
  hotelCapacity: 45,
  roomTypeCapacities: {},
  strategy: 'balanced',
  targetOccupancy: 82,
  minAdr: 95,
  maxAdr: 290,
  minPrice: 79,
  maxPrice: 340,
  weekendPremiumPct: 12,
  lastMinuteDiscountPct: 8,
  demandWeight: 0.35,
  competitorWeight: 0.3,
  eventWeight: 0.2,
  pickupWeight: 0.15,
  priceStep: 2,
  autoApproveThresholdPct: 4
}

const parseLocalizedNumber = (input: string): number => {
  const raw = input.trim()
  if (!raw) return Number.NaN

  const cleaned = raw
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(/[€$£%]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!cleaned) return Number.NaN

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      const normalized = cleaned.replace(/\./g, '').replace(',', '.')
      return Number(normalized)
    }
    const normalized = cleaned.replace(/,/g, '')
    return Number(normalized)
  }

  if (cleaned.includes(',')) {
    return Number(cleaned.replace(',', '.'))
  }

  return Number(cleaned)
}

const parseNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseLocalizedNumber(value)
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const normalizeDemand = (rawDemand: number): number => {
  if (rawDemand <= 1) return Math.max(0, Math.min(100, rawDemand * 100))
  return Math.max(0, Math.min(100, rawDemand))
}

const roundToStep = (value: number, step: number) => {
  if (step <= 0) return Math.round(value)
  return Math.round(value / step) * step
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const pickString = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[alias]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

const pickNumber = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[alias]
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = parseLocalizedNumber(value)
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

const toDateKey = (input: Date) => {
  const yyyy = input.getFullYear()
  const mm = `${input.getMonth() + 1}`.padStart(2, '0')
  const dd = `${input.getDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const toDate = (input: string): Date | null => {
  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) return parsed
  if (input.includes('/')) {
    const [d, m, y] = input.split('/').map(Number)
    if (d && m && y) {
      const alt = new Date(y, m - 1, d)
      if (!Number.isNaN(alt.getTime())) return alt
    }
  }
  return null
}

export const useRMSCalculations = (
  reservations: BookingExport[],
  disponibilites: Disponibilites[],
  apercu: BookingApercu[],
  settings?: Partial<RMSSettings>,
  events?: EventsCalendar[]
) => {
  const rmsSettings = useMemo(
    () => ({
      ...defaultSettings,
      ...(settings || {})
    }),
    [settings]
  )

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, number>()
    disponibilites.forEach((row) => {
      const value = parseNumber(row.disponibilites, 0)
      map.set(row.date, (map.get(row.date) ?? 0) + value)
    })
    return map
  }, [disponibilites])

  const confirmedReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const status = typeof reservation.Etat === 'string' ? reservation.Etat : ''
      const lower = status.toLowerCase()
      if (!lower) return true
      return !lower.includes('annul') && !lower.includes('cancel')
    })
  }, [reservations])

  const reservationsByArrivalDate = useMemo(() => {
    const map = new Map<string, BookingExportLike[]>()

    confirmedReservations.forEach((reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const arrivalDate = row.arrival_date || pickString(row, ["Date d'arrivée", "Date d'arrivÃ©e"])
      if (!arrivalDate) return
      const list = map.get(arrivalDate) || []
      list.push(row)
      map.set(arrivalDate, list)
    })

    return map
  }, [confirmedReservations])

  const eventImpactByDate = useMemo(() => {
    const map = new Map<string, number>()
    ;(events || []).forEach((eventRow) => {
      const row = eventRow as EventLike
      const startRaw = pickString(row, ['Début', 'DÃ©but', 'start_date'])
      const endRaw = pickString(row, ['Fin', 'end_date'])
      const impact10 = parseNumber(row['Indice impact attendu sur la demande /10'], 0)
      const impactPct = clamp(impact10 * 10, 0, 100)

      const start = toDate(startRaw)
      const end = toDate(endRaw || startRaw)
      if (!start || !end) return

      const cur = new Date(start)
      cur.setHours(0, 0, 0, 0)
      const last = new Date(end)
      last.setHours(0, 0, 0, 0)

      while (cur <= last) {
        const key = toDateKey(cur)
        const currentImpact = map.get(key) || 0
        map.set(key, Math.max(currentImpact, impactPct))
        cur.setDate(cur.getDate() + 1)
      }
    })
    return map
  }, [events])

  const recentReservations = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)

    return confirmedReservations.filter((reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const purchaseDateValue = row.purchase_date || pickString(row, ["Date d'achat"])
      if (!purchaseDateValue) return false

      const purchaseDate = new Date(purchaseDateValue)
      if (isNaN(purchaseDate.getTime()) && purchaseDateValue.includes('/')) {
        const [day, month, year] = purchaseDateValue.split('/')
        const parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
        return parsedDate >= sevenDaysAgo
      }

      return !isNaN(purchaseDate.getTime()) && purchaseDate >= sevenDaysAgo
    })
  }, [confirmedReservations])

  const kpis: KPIData = useMemo(() => {
    const uniqueAvailabilityDates = new Set(disponibilites.map((d) => d.date))
    const dayCount = Math.max(uniqueAvailabilityDates.size, apercu.length, 1)
    const totalRoomsCapacity = rmsSettings.hotelCapacity * dayCount

    const occupiedRooms = confirmedReservations.reduce((sum, reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      return sum + parseNumber(row.Chambres ?? pickNumber(row, ['Chambres', 'Nombre de chambres']), 0)
    }, 0)

    const totalRevenue = confirmedReservations.reduce((sum, reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const revenue = row.total_amount ?? pickNumber(row, ['Montant total'])
      return sum + parseNumber(revenue, 0)
    }, 0)

    const remainingRoomsFromAvailability = Array.from(availabilityByDate.values()).reduce((sum, value) => sum + value, 0)
    const availableRooms = remainingRoomsFromAvailability > 0
      ? remainingRoomsFromAvailability
      : Math.max(0, totalRoomsCapacity - occupiedRooms)

    const occupancyRate = totalRoomsCapacity > 0 ? (occupiedRooms / totalRoomsCapacity) * 100 : 0
    const adr = occupiedRooms > 0 ? totalRevenue / occupiedRooms : 0
    const revpar = totalRoomsCapacity > 0 ? totalRevenue / totalRoomsCapacity : 0

    const pickupRooms = recentReservations.reduce((sum, reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      return sum + parseNumber(row.Chambres ?? pickNumber(row, ['Chambres', 'Nombre de chambres']), 0)
    }, 0)

    const pickupRevenue = recentReservations.reduce((sum, reservation) => {
      const row = reservation as BookingExportLike & Record<string, unknown>
      const revenue = row.total_amount ?? pickNumber(row, ['Montant total'])
      return sum + parseNumber(revenue, 0)
    }, 0)

    const projectedOccupancy = clamp(
      occupancyRate + (pickupRooms / Math.max(1, totalRoomsCapacity)) * 100,
      0,
      100
    )

    return {
      occupancyRate,
      adr,
      revpar,
      pickupRooms,
      pickupRevenue,
      totalRooms: totalRoomsCapacity,
      occupiedRooms,
      availableRooms,
      projectedOccupancy
    }
  }, [apercu.length, availabilityByDate, confirmedReservations, disponibilites, recentReservations, rmsSettings.hotelCapacity])

  const dailyDecisions: RMSDailyDecision[] = useMemo(() => {
    if (!apercu.length) return []

    return apercu.map((day) => {
      const row = day as BookingApercuLike & Record<string, unknown>
      const date = row.date || pickString(row, ['Date'])

      const currentPrice = parseNumber(row.own_price ?? pickNumber(row, ['Votre hôtel le plus bas', 'Votre hÃ´tel le plus bas']), 0)
      const competitorMedian = parseNumber(row.compset_median ?? pickNumber(row, ['médiane du compset', 'mÃ©diane du compset']), currentPrice)
      const demandIndex = normalizeDemand(parseNumber(row.market_demand ?? pickNumber(row, ['Demande du marché', 'Demande du marchÃ©']), 50))
      const hasEventInApercu = Boolean(row.events || pickString(row, ['Événements', 'Ã‰vÃ©nements']))
      const eventImpactFromCalendar = eventImpactByDate.get(date) || 0
      const eventImpact = Math.max(hasEventInApercu ? 100 : 0, eventImpactFromCalendar)

      const arrivalReservations = reservationsByArrivalDate.get(date) || []
      const roomsOnBooks = arrivalReservations.reduce((sum, reservation) => sum + parseNumber(reservation.Chambres, 0), 0)
      const occupancyOnBooks = clamp((roomsOnBooks / Math.max(1, rmsSettings.hotelCapacity)) * 100, 0, 100)

      const pickupRooms = arrivalReservations
        .filter((reservation) => {
          const rowReservation = reservation as BookingExportLike & Record<string, unknown>
          const purchaseDateValue = rowReservation.purchase_date || pickString(rowReservation, ["Date d'achat"])
          if (!purchaseDateValue) return false
          const purchaseDate = new Date(purchaseDateValue)
          const twoDaysAgo = new Date()
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
          return !isNaN(purchaseDate.getTime()) && purchaseDate >= twoDaysAgo
        })
        .reduce((sum, reservation) => sum + parseNumber(reservation.Chambres, 0), 0)

      const pickupPressure = clamp((pickupRooms / Math.max(1, rmsSettings.hotelCapacity)) * 100, 0, 100)
      const competitorGapPct = competitorMedian > 0 ? ((competitorMedian - currentPrice) / competitorMedian) * 100 : 0
      const occupancyPressure = occupancyOnBooks - rmsSettings.targetOccupancy

      const weightedSignal =
        (demandIndex - 50) * rmsSettings.demandWeight +
        competitorGapPct * rmsSettings.competitorWeight +
        ((eventImpact - 50) * rmsSettings.eventWeight) / 2 +
        (pickupPressure - 30) * rmsSettings.pickupWeight +
        occupancyPressure * 0.2

      let recommendedPrice = currentPrice * (1 + weightedSignal / 100)

      const horizonDate = date ? new Date(date) : new Date()
      const daysAhead = Math.ceil((horizonDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24))
      const isWeekend = horizonDate.getDay() === 5 || horizonDate.getDay() === 6

      if (isWeekend && daysAhead >= 2) {
        recommendedPrice *= 1 + rmsSettings.weekendPremiumPct / 100
      }

      if (daysAhead <= 3 && occupancyOnBooks < rmsSettings.targetOccupancy - 10) {
        recommendedPrice *= 1 - rmsSettings.lastMinuteDiscountPct / 100
      }

      if (rmsSettings.strategy === 'conservative') {
        recommendedPrice = (recommendedPrice + currentPrice) / 2
      }

      if (rmsSettings.strategy === 'aggressive') {
        recommendedPrice *= 1.03
      }

      const boundedRecommended = clamp(
        roundToStep(recommendedPrice, rmsSettings.priceStep),
        Math.max(rmsSettings.minAdr, rmsSettings.minPrice),
        Math.min(rmsSettings.maxAdr, rmsSettings.maxPrice)
      )

      const changePct = currentPrice > 0 ? ((boundedRecommended - currentPrice) / currentPrice) * 100 : 0
      const confidence = clamp(45 + Math.abs(weightedSignal) * 1.1 + (eventImpact > 0 ? 8 : 0) + (pickupPressure > 15 ? 5 : 0), 50, 98)

      let reason = 'Maintien conseillé'
      if (changePct >= 6) reason = 'Hausse forte: demande soutenue et potentiel marché'
      else if (changePct >= 2) reason = 'Hausse modérée: positionnement sous marché'
      else if (changePct <= -6) reason = 'Baisse forte: risque de sous-occupation'
      else if (changePct <= -2) reason = 'Baisse tactique: stimulation pickup court terme'

      const formulaText =
        `Tarif suggéré = arrondi(clamp(BAR × (1 + signal/100) × ajustements, ${Math.max(rmsSettings.minAdr, rmsSettings.minPrice)}..${Math.min(rmsSettings.maxAdr, rmsSettings.maxPrice)}), pas ${rmsSettings.priceStep}). ` +
        `Signal = (Demande-50)*${rmsSettings.demandWeight.toFixed(2)} + EcartCompset*${rmsSettings.competitorWeight.toFixed(2)} + ((Evenement-50)/2)*${rmsSettings.eventWeight.toFixed(2)} + (Pickup-30)*${rmsSettings.pickupWeight.toFixed(2)} + PressionOcc*0.20. ` +
        `Valeurs du jour: signal=${weightedSignal.toFixed(2)}, demande=${demandIndex.toFixed(1)}, ecartCompset=${competitorGapPct.toFixed(1)}%, evenement=${eventImpact.toFixed(1)}, pickup=${pickupPressure.toFixed(1)}, occ=${occupancyOnBooks.toFixed(1)}%.`

      return {
        date,
        occupancyOnBooks,
        demandIndex,
        competitorMedian,
        eventImpact,
        pickupRooms,
        currentPrice,
        recommendedPrice: boundedRecommended,
        confidence,
        reason,
        formulaText,
        shouldAutoApprove: Math.abs(changePct) <= rmsSettings.autoApproveThresholdPct
      }
    })
  }, [apercu, eventImpactByDate, reservationsByArrivalDate, rmsSettings])

  const pricingSuggestions: PricingSuggestion[] = useMemo(() => {
    return dailyDecisions
      .map((decision) => {
        const change = decision.recommendedPrice - decision.currentPrice
        const changePercent = decision.currentPrice > 0 ? (change / decision.currentPrice) * 100 : 0

        return {
          date: decision.date,
          currentPrice: Math.round(decision.currentPrice),
          suggestedPrice: Math.round(decision.recommendedPrice),
          change: Math.round(change),
          changePercent: Math.round(changePercent * 10) / 10,
          reason: decision.reason,
          formulaText: decision.formulaText,
          confidence: Math.round(decision.confidence),
          shouldAutoApprove: decision.shouldAutoApprove
        }
      })
      .filter((suggestion) => suggestion.change !== 0)
  }, [dailyDecisions])

  const alerts = useMemo(() => {
    const messages: string[] = []

    if (kpis.occupancyRate < rmsSettings.targetOccupancy - 15) {
      messages.push('Occupation en dessous de la cible: activer une stratégie de stimulation.')
    }
    if (kpis.adr < rmsSettings.minAdr) {
      messages.push('ADR inférieur au plancher stratégique défini.')
    }
    if (kpis.projectedOccupancy > 92) {
      messages.push('Pression d’occupation élevée: opportunité de hausse tarifaire.')
    }

    return messages
    if ((events || []).length > 0) {
      messages.push(`Calendrier événements actif: ${(events || []).length} événement(s) intégré(s) au moteur RMS.`)
    }
  }, [events, kpis, rmsSettings.minAdr, rmsSettings.targetOccupancy])

  return { kpis, pricingSuggestions, dailyDecisions, alerts, rmsSettings }
}
