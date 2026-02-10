import React, { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDisponibilites } from '../../hooks/useHotelData'
import { useBookingExport } from '../../hooks/useBookingData'

type DisponibiliteLike = {
  date: string
  type_de_chambre: string | null
  disponibilites: number | null
  ferme_a_la_vente: string | null
}

type ReservationLike = Record<string, unknown>

type RowResult = {
  date: string
  roomType: string
  available: number
  sold: number
  reason: 'ferme' | 'stock'
}

type InventoryQuery = {
  startKey: string
  endKey: string
  roomType: string
}

type InventoryRow = {
  date: string
  roomType: string
  reason: 'ferme' | 'stock'
  sold: number
}

type SelectedInspection = {
  date: string
  roomType: string
  reason: 'ferme' | 'stock'
}

type ReservationDetail = {
  id: string
  arrivee: string
  depart: string
  reference: string
  etat: string
  origine: string
  typeChambre: string
  chambres: number
  nuitees: number
  guests: string
  montantTotal: number
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd')

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const v = value.trim()
  const parsed = new Date(v)
  if (!Number.isNaN(parsed.getTime())) return parsed
  if (v.includes('/')) {
    const [d, m, y] = v.split('/').map(Number)
    if (d && m && y) {
      const alt = new Date(y, m - 1, d)
      if (!Number.isNaN(alt.getTime())) return alt
    }
  }
  return null
}

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  let raw = value.trim()
  if (!raw) return null

  let negative = false
  if (raw.startsWith('(') && raw.endsWith(')')) {
    negative = true
    raw = raw.slice(1, -1)
  }

  raw = raw.replace(/\s/g, '').replace(/€/g, '')
  raw = raw.replace(/[^\d,.-]/g, '')
  if (!raw) return null

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(',')
    const lastDot = raw.lastIndexOf('.')
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, '').replace(',', '.')
    } else {
      raw = raw.replace(/,/g, '')
    }
  } else if (hasComma) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else {
    const dotCount = (raw.match(/\./g) || []).length
    if (dotCount > 1) {
      const lastDot = raw.lastIndexOf('.')
      raw = `${raw.slice(0, lastDot).replace(/\./g, '')}.${raw.slice(lastDot + 1)}`
    }
  }

  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

const parseNumber = (value: unknown, fallback = 0): number => {
  const n = parseOptionalNumber(value)
  return n ?? fallback
}

const getFieldByTokens = (row: ReservationLike, tokens: string[]): unknown => {
  const entries = Object.entries(row)
  for (const [key, value] of entries) {
    const nk = normalize(key)
    if (tokens.some((token) => nk.includes(token))) return value
  }
  return undefined
}

const toText = (value: unknown, fallback = '-'): string => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

const isClosedForSale = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === 'x'
}

const isStockExhausted = (value: unknown) => {
  const n = parseOptionalNumber(value)
  return n !== null && n === 0
}

const getArrivalDateKey = (row: ReservationLike) => {
  const direct = parseDate(row.arrival_date)
  if (direct) return toDateKey(direct)

  const arrivalCandidates = Object.entries(row).filter(([key, raw]) => {
    if (typeof raw !== 'string' || !raw.trim()) return false
    const n = normalize(key)
    return (n.includes('arriv') || n.includes('checkin') || n.includes('arrival')) && !n.includes('depart')
  })

  for (const [, raw] of arrivalCandidates) {
    const d = parseDate(raw)
    if (d) return toDateKey(d)
  }

  return ''
}

const getRoomType = (row: ReservationLike) => {
  const direct = row['Type de chambre']
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const fallback = Object.entries(row).find(([k, v]) => normalize(k).includes('typedechambre') && typeof v === 'string' && String(v).trim())
  return fallback ? String(fallback[1]).trim() : ''
}

const isCancelled = (row: ReservationLike) => {
  const status = typeof row.Etat === 'string' ? row.Etat : ''
  const n = normalize(status)
  return n.includes('annul') || n.includes('cancel')
}

const getSoldRoomsCount = (row: ReservationLike) => {
  const direct = parseNumber(row.Chambres)
  if (direct > 0) return direct
  const fallback = Object.entries(row).find(([k]) => normalize(k) === 'chambres')
  if (fallback) {
    const parsed = parseNumber(fallback[1])
    if (parsed > 0) return parsed
  }

  const roomType = getRoomType(row)
  if (normalize(roomType).includes('deuxchambresadjacentes')) return 2

  return 1
}

const getDepartureDate = (row: ReservationLike): Date | null => {
  const direct = parseDate(row.departure_date)
  if (direct) return direct

  const candidates = Object.entries(row).filter(([key, raw]) => {
    if (typeof raw !== 'string' || !raw.trim()) return false
    const n = normalize(key)
    return n.includes('depart') || n.includes('checkout') || n.includes('departure')
  })

  for (const [, raw] of candidates) {
    const d = parseDate(raw)
    if (d) return d
  }

  return null
}

const getStayNights = (row: ReservationLike, arrivalDate: Date): number => {
  const directNights = parseNumber(row.Nuitees)
  if (directNights > 0) return Math.floor(directNights)

  const fallbackNights = Object.entries(row).find(([k]) => {
    const n = normalize(k)
    return n.includes('nuitees') || n.includes('nuites') || n.includes('nuit') || n.includes('nights')
  })
  if (fallbackNights) {
    const parsed = parseNumber(fallbackNights[1])
    if (parsed > 0) return Math.floor(parsed)
  }

  const departure = getDepartureDate(row)
  if (departure) {
    const diff = differenceInCalendarDays(departure, arrivalDate)
    if (diff > 0) return diff
  }

  return 1
}

const getStayDateKeys = (row: ReservationLike): string[] => {
  const arrivalDateKey = getArrivalDateKey(row)
  if (!arrivalDateKey) return []
  const arrivalDate = parseDate(arrivalDateKey)
  if (!arrivalDate) return []

  const nights = getStayNights(row, arrivalDate)
  const dateKeys: string[] = []
  for (let i = 0; i < nights; i += 1) {
    dateKeys.push(toDateKey(addDays(arrivalDate, i)))
  }
  return dateKeys
}

const getReservationReference = (row: ReservationLike) => toText(row['Référence'] ?? row.reference, '')
const getReservationStatus = (row: ReservationLike) => toText(row.Etat ?? row.status, '')

const getReservationDedupKey = (row: ReservationLike): string => {
  const arrival = getArrivalDateKey(row)
  const roomType = normalize(getRoomType(row) || '')
  const reference = normalize(getReservationReference(row))
  const status = normalize(getReservationStatus(row))
  const soldRooms = getSoldRoomsCount(row)
  const stayDates = getStayDateKeys(row)
  const nights = stayDates.length

  // Prefer reservation reference when available; fallback to a composite signature.
  if (reference) {
    return `${reference}|${arrival}|${roomType}|${soldRooms}|${nights}|${status}`
  }

  const guest = normalize(
    toText(
      row['E-Mail'] ??
        row.email ??
        row['Nom'] ??
        row.nom ??
        row['Prénom'] ??
        row.prenom,
      '',
    ),
  )

  return `${arrival}|${roomType}|${soldRooms}|${nights}|${status}|${guest}`
}

const inRange = (dateKey: string, startKey: string, endKey: string) => dateKey >= startKey && dateKey <= endKey

export const MyUnavailabilityPage: React.FC = () => {
  const { profile } = useAuthStore()
  const hotelId = profile?.hotel_id || 'H2258'

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [visibleMonth, setVisibleMonth] = useState(new Date())

  const monthStart = startOfMonth(visibleMonth)
  const monthEnd = endOfMonth(visibleMonth)
  const [rangeStart, setRangeStart] = useState(format(monthStart, 'yyyy-MM-dd'))
  const [rangeEnd, setRangeEnd] = useState(format(monthEnd, 'yyyy-MM-dd'))
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [inventoryRoomTypeDraft, setInventoryRoomTypeDraft] = useState<string>('ALL')
  const [inventoryQuery, setInventoryQuery] = useState<InventoryQuery | null>(null)
  const [selectedInspection, setSelectedInspection] = useState<SelectedInspection | null>(null)

  const rangeStartDate = parseDate(rangeStart) || monthStart
  const rangeEndDate = parseDate(rangeEnd) || monthEnd

  const queryStart = new Date(Math.min(monthStart.getTime(), rangeStartDate.getTime()))
  const queryEnd = new Date(Math.max(monthEnd.getTime(), rangeEndDate.getTime()))

  const { data: disponibilites = [], isLoading: loadingDispo } = useDisponibilites(hotelId, queryStart, queryEnd)
  const { data: reservations = [], isLoading: loadingResa } = useBookingExport(hotelId, queryStart, queryEnd)

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const selectedDateKey = toDateKey(selectedDate)
  const rangeStartKey = toDateKey(rangeStartDate)
  const rangeEndKey = toDateKey(rangeEndDate)

  const soldByDateType = useMemo(() => {
    const deduped = new Map<string, ReservationLike>()
    ;(reservations as ReservationLike[]).forEach((row) => {
      const key = getReservationDedupKey(row)
      if (!key) return
      if (!deduped.has(key)) deduped.set(key, row)
    })

    const map = new Map<string, number>()
    Array.from(deduped.values())
      .filter((row) => includeCancelled || !isCancelled(row))
      .forEach((row) => {
        const stayDateKeys = getStayDateKeys(row)
        if (stayDateKeys.length === 0) return
        const roomType = getRoomType(row)
        if (!roomType) return
        const soldRooms = getSoldRoomsCount(row)
        stayDateKeys.forEach((stayDateKey) => {
          const key = `${stayDateKey}::${normalize(roomType)}`
          map.set(key, (map.get(key) || 0) + soldRooms)
        })
      })
    return map
  }, [includeCancelled, reservations])

  const bookingDetailsByDateType = useMemo(() => {
    const deduped = new Map<string, ReservationLike>()
    ;(reservations as ReservationLike[]).forEach((row) => {
      const key = getReservationDedupKey(row)
      if (!key) return
      if (!deduped.has(key)) deduped.set(key, row)
    })

    const map = new Map<string, ReservationDetail[]>()
    Array.from(deduped.values())
      .filter((row) => includeCancelled || !isCancelled(row))
      .forEach((row, idx) => {
      const arrivalDateKey = getArrivalDateKey(row)
      if (!arrivalDateKey) return
      const arrivalDate = parseDate(arrivalDateKey)
      if (!arrivalDate) return
      const roomType = getRoomType(row)
      if (!roomType) return

      const nights = getStayNights(row, arrivalDate)
      const stayDateKeys = getStayDateKeys(row)
      if (stayDateKeys.length === 0) return
      const soldRooms = getSoldRoomsCount(row)
      const departureDate = addDays(arrivalDate, Math.max(nights, 1))
      const reference = toText(row['Référence'] ?? row.reference)
      const etat = toText(row.Etat ?? row.status)
      const origine = toText(
        row.Origine ??
          row.origin ??
          row['Plateforme'] ??
          row.platform ??
          getFieldByTokens(row, ['origine', 'plateforme', 'platform', 'ota']),
      )
      const guestsRaw =
        row.Guests ??
        row.guests ??
        row['Nombre de clients'] ??
        row['Nombre de voyageurs'] ??
        row['Adultes'] ??
        getFieldByTokens(row, ['guests', 'voyageurs', 'clients', 'adultes'])
      const montantRaw =
        row['Montant total'] ??
        row.montant_total ??
        row.Montant ??
        row['Montant payé'] ??
        row['Montant paye'] ??
        row['Total payé'] ??
        row.total ??
        getFieldByTokens(row, ['montant', 'total', 'paye', 'payee', 'paid'])

      const detail: ReservationDetail = {
        id: `${reference}-${arrivalDateKey}-${normalize(roomType)}-${idx}`,
        arrivee: arrivalDateKey,
        depart: toDateKey(departureDate),
        reference,
        etat,
        origine,
        typeChambre: roomType,
        chambres: soldRooms,
        nuitees: nights,
        guests: toText(guestsRaw),
        montantTotal: parseNumber(montantRaw),
      }

      stayDateKeys.forEach((stayDateKey) => {
        const key = `${stayDateKey}::${normalize(roomType)}`
        const list = map.get(key) || []
        list.push(detail)
        map.set(key, list)
      })
    })
    return map
  }, [includeCancelled, reservations])

  const roomTypeOptions = useMemo(() => {
    const set = new Set<string>()
    ;(disponibilites as DisponibiliteLike[]).forEach((row) => {
      if (row.type_de_chambre && row.type_de_chambre.trim()) set.add(row.type_de_chambre.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [disponibilites])

  const selectedDayRows = useMemo<RowResult[]>(() => {
    const rows = (disponibilites as DisponibiliteLike[])
      .filter((row) => {
        if (row.date !== selectedDateKey) return false
        const available = parseOptionalNumber(row.disponibilites)
        const closedByFlag = isClosedForSale(row.ferme_a_la_vente)
        const stockExhausted = available !== null && available === 0
        return closedByFlag || stockExhausted
      })
      .map((row) => {
        const roomType = row.type_de_chambre || 'Type inconnu'
        const available = parseNumber(row.disponibilites)
        const sold = soldByDateType.get(`${selectedDateKey}::${normalize(roomType)}`) || 0
        const reason: RowResult['reason'] = isClosedForSale(row.ferme_a_la_vente) ? 'ferme' : 'stock'
        return {
          date: selectedDateKey,
          roomType,
          available,
          sold,
          reason,
        }
      })

    return rows.sort((a, b) => b.sold - a.sold)
  }, [disponibilites, selectedDateKey, soldByDateType])

  const rangeRows: RowResult[] = (disponibilites as DisponibiliteLike[])
    .filter((row) => {
      if (!inRange(row.date, rangeStartKey, rangeEndKey)) return false
      const available = parseOptionalNumber(row.disponibilites)
      const closedByFlag = isClosedForSale(row.ferme_a_la_vente)
      const stockExhausted = available !== null && available === 0
      return closedByFlag || stockExhausted
    })
    .map((row) => {
      const roomType = row.type_de_chambre || 'Type inconnu'
      const available = parseNumber(row.disponibilites)
      const sold = soldByDateType.get(`${row.date}::${normalize(roomType)}`) || 0
      const reason: RowResult['reason'] = isClosedForSale(row.ferme_a_la_vente) ? 'ferme' : 'stock'
      return {
        date: row.date,
        roomType,
        available,
        sold,
        reason,
      }
    })
    .sort((a, b) => (a.date === b.date ? b.sold - a.sold : a.date.localeCompare(b.date)))

  const dayHasClosed = useMemo(() => {
    const set = new Set<string>()
    ;(disponibilites as DisponibiliteLike[]).forEach((row) => {
      if (isClosedForSale(row.ferme_a_la_vente) || isStockExhausted(row.disponibilites)) set.add(row.date)
    })
    return set
  }, [disponibilites])

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    if (!inventoryQuery || inventoryQuery.roomType === 'ALL') return []

    const selectedTypeNorm = normalize(inventoryQuery.roomType)
    const byDate = new Map<string, { reason: 'ferme' | 'stock' }>()

    ;(disponibilites as DisponibiliteLike[])
      .filter((row) => inRange(row.date, inventoryQuery.startKey, inventoryQuery.endKey))
      .filter((row) => normalize(row.type_de_chambre || '') === selectedTypeNorm)
      .forEach((row) => {
        const closedByFlag = isClosedForSale(row.ferme_a_la_vente)
        const stockExhausted = isStockExhausted(row.disponibilites)
        if (!closedByFlag && !stockExhausted) return
        const current = byDate.get(row.date)
        if (!current || (current.reason !== 'ferme' && closedByFlag)) {
          byDate.set(row.date, { reason: closedByFlag ? 'ferme' : 'stock' })
        }
      })

    return Array.from(byDate.entries())
      .map(([date, value]) => ({
        date,
        roomType: inventoryQuery.roomType,
        reason: value.reason,
        sold: soldByDateType.get(`${date}::${selectedTypeNorm}`) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [disponibilites, inventoryQuery, soldByDateType])

  const selectedBookingDetails = useMemo(() => {
    if (!selectedInspection) return []
    const key = `${selectedInspection.date}::${normalize(selectedInspection.roomType)}`
    return (bookingDetailsByDateType.get(key) || []).sort((a, b) =>
      a.arrivee === b.arrivee ? a.reference.localeCompare(b.reference) : a.arrivee.localeCompare(b.arrivee),
    )
  }, [bookingDetailsByDateType, selectedInspection])

  const isLoading = loadingDispo || loadingResa

  const renderInlineDetails = (colSpan: number) => {
    if (!selectedInspection) return null

    if (isLoading) {
      return (
        <tr className="bg-slate-50">
          <td colSpan={colSpan} className="px-3 py-4 text-sm text-slate-500">
            Chargement des réservations...
          </td>
        </tr>
      )
    }

    if (selectedBookingDetails.length === 0) {
      return (
        <tr className="bg-slate-50">
          <td colSpan={colSpan} className="px-3 py-4 text-sm text-slate-500">
            Aucune réservation trouvée pour cette date et ce type de chambre.
          </td>
        </tr>
      )
    }

    return (
      <tr className="bg-slate-50">
        <td colSpan={colSpan} className="px-3 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3 pl-3">Arrivée</th>
                  <th className="py-2 pr-3">Départ</th>
                  <th className="py-2 pr-3">Référence</th>
                  <th className="py-2 pr-3">État</th>
                  <th className="py-2 pr-3">Origine</th>
                  <th className="py-2 pr-3">Type chambre</th>
                  <th className="py-2 pr-3 text-right">Chambres</th>
                  <th className="py-2 pr-3 text-right">Nuitées</th>
                  <th className="py-2 pr-3 text-right">Guests</th>
                  <th className="py-2 pr-3 text-right">Montant total</th>
                </tr>
              </thead>
              <tbody>
                {selectedBookingDetails.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 pl-3 font-semibold text-slate-900">{row.arrivee}</td>
                    <td className="py-2 pr-3 text-slate-800">{row.depart}</td>
                    <td className="py-2 pr-3 text-slate-800">{row.reference}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.etat}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.origine}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.typeChambre}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{row.chambres}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{row.nuitees}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{row.guests}</td>
                    <td className="py-2 pr-3 text-right font-black text-slate-900">
                      {row.montantTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-2 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Inventaire et Dispos.</h2>
            <p className="text-sm text-slate-500">Types de chambres fermés à la vente et chambres vendues par nuitée de séjour.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600">
            Date de début
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Date de fin
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setRangeStart(format(monthStart, 'yyyy-MM-dd'))
              setRangeEnd(format(monthEnd, 'yyyy-MM-dd'))
            }}
            className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
          >
            Réinitialiser à ce mois
          </button>
          <div className="self-end rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            Lignes fermées sur plage: {rangeRows.length}
          </div>
          <label className="self-end flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(e) => setIncludeCancelled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            Inclure État: Annulé
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-black uppercase tracking-wider text-slate-700">{format(visibleMonth, 'MMMM yyyy', { locale: fr })}</p>
            <button onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-500">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
              <div key={`${d}-${idx}`}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateKey = toDateKey(day)
              const selected = isSameDay(day, selectedDate)
              const inMonth = isSameMonth(day, visibleMonth)
              const hasClosed = dayHasClosed.has(dateKey)

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`relative rounded-md p-2 text-center text-xs font-bold transition ${!inMonth ? 'opacity-30' : ''} ${selected ? 'bg-slate-900 text-white' : hasClosed ? 'bg-rose-100 text-rose-800 hover:bg-rose-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
              Fermées à la vente - {format(selectedDate, 'dd MMM yyyy', { locale: fr })}
            </h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Types fermés: {selectedDayRows.length}
            </span>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">Chargement des indisponibilités...</p>
          ) : selectedDayRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Aucune chambre fermée à la vente sur cette date.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Type de chambre</th>
                    <th className="py-2 pr-3">Motif</th>
                    <th className="py-2 pr-3 text-right">Disponibilités restantes</th>
                    <th className="py-2 pr-0 text-right">Chambres vendues (nuitée)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayRows.map((row) => {
                    const isSelected =
                      selectedInspection?.date === selectedDateKey &&
                      normalize(selectedInspection.roomType) === normalize(row.roomType)
                    return (
                      <React.Fragment key={`${row.roomType}-${selectedDateKey}`}>
                        <tr
                          className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-slate-100' : ''}`}
                          onClick={() =>
                            setSelectedInspection(
                              isSelected ? null : { date: selectedDateKey, roomType: row.roomType, reason: row.reason },
                            )
                          }
                        >
                          <td className="py-2 pr-3 font-semibold text-slate-900">{row.roomType}</td>
                          <td className="py-2 pr-3 text-slate-700">{row.reason === 'ferme' ? 'Fermée à la vente (x)' : 'Stock épuisé (0)'}</td>
                          <td className="py-2 pr-3 text-right text-slate-700">{row.available}</td>
                          <td className="py-2 pr-0 text-right font-black text-rose-700">{row.sold}</td>
                        </tr>
                        {isSelected ? renderInlineDetails(4) : null}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
            Fermetures sur plage - {rangeStartKey} au {rangeEndKey}
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Lignes: {rangeRows.length}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : rangeRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Aucune fermeture trouvée sur la plage sélectionnée.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type de chambre</th>
                  <th className="py-2 pr-3">Motif</th>
                  <th className="py-2 pr-3 text-right">Disponibilités restantes</th>
                  <th className="py-2 pr-0 text-right">Chambres vendues (nuitée)</th>
                </tr>
              </thead>
              <tbody>
                {rangeRows.map((row, idx) => {
                  const isSelected =
                    selectedInspection?.date === row.date && normalize(selectedInspection.roomType) === normalize(row.roomType)
                  return (
                    <React.Fragment key={`${row.date}-${row.roomType}-${idx}`}>
                      <tr
                        className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-slate-100' : ''}`}
                        onClick={() =>
                          setSelectedInspection(isSelected ? null : { date: row.date, roomType: row.roomType, reason: row.reason })
                        }
                      >
                        <td className="py-2 pr-3 font-semibold text-slate-900">{row.date}</td>
                        <td className="py-2 pr-3 text-slate-800">{row.roomType}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.reason === 'ferme' ? 'Fermée à la vente (x)' : 'Stock épuisé (0)'}</td>
                        <td className="py-2 pr-3 text-right text-slate-700">{row.available}</td>
                        <td className="py-2 pr-0 text-right font-black text-rose-700">{row.sold}</td>
                      </tr>
                      {isSelected ? renderInlineDetails(5) : null}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">Option Inventaire</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Plage active: {rangeStartKey} {'->'} {rangeEndKey}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="text-xs font-semibold text-slate-600">
            Type de chambre
            <select
              value={inventoryRoomTypeDraft}
              onChange={(e) => setInventoryRoomTypeDraft(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="ALL">Sélectionner un type</option>
              {roomTypeOptions.map((roomType) => (
                <option key={roomType} value={roomType}>{roomType}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setInventoryQuery({ startKey: rangeStartKey, endKey: rangeEndKey, roomType: inventoryRoomTypeDraft })}
            className="self-end rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={inventoryRoomTypeDraft === 'ALL'}
          >
            Lancer l'inventaire
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
            Inventaire type {inventoryQuery?.roomType && inventoryQuery.roomType !== 'ALL' ? inventoryQuery.roomType : '-'}
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            Dates trouvées: {inventoryRows.length}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : !inventoryQuery || inventoryQuery.roomType === 'ALL' ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Choisissez un type de chambre et lancez l'inventaire.
          </p>
        ) : inventoryRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Aucune fermeture/rupture de stock pour ce type sur la plage sélectionnée.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type de chambre</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-0 text-right">Chambres vendues (nuitée)</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((row, idx) => {
                  const isSelected =
                    selectedInspection?.date === row.date && normalize(selectedInspection.roomType) === normalize(row.roomType)
                  return (
                    <React.Fragment key={`${row.date}-${row.roomType}-${idx}`}>
                      <tr
                        className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-slate-100' : ''}`}
                        onClick={() =>
                          setSelectedInspection(isSelected ? null : { date: row.date, roomType: row.roomType, reason: row.reason })
                        }
                      >
                        <td className="py-2 pr-3 font-semibold text-slate-900">{row.date}</td>
                        <td className="py-2 pr-3 text-slate-800">{row.roomType}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.reason === 'ferme' ? 'Fermée à la vente (x)' : 'Stock épuisé (0)'}</td>
                        <td className="py-2 pr-0 text-right font-black text-rose-700">{row.sold}</td>
                      </tr>
                      {isSelected ? renderInlineDetails(4) : null}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
