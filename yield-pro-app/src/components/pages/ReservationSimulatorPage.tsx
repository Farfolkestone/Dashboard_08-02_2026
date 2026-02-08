import React, { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, eachDayOfInterval, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calculator, RotateCcw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import otaConfig from '../../../config_ota_folkestone.json'
import { usePlanningTarifs } from '../../hooks/usePlanningTarifs'
import { useAuthStore } from '../../store/useAuthStore'
import type { Database } from '../../types/database.types'
import { formatCurrency } from '../../utils/formatters'
import { getMetrics } from '../../utils/metricsLogger'

type PlanningTarifRow = Database['public']['Tables']['planning_tarifs']['Row']

type OtaConfig = {
  partners: Record<string, { commission: number; codes: string[] }>
  displayOrder: { rooms: string[]; plans: string[] }
}
type DiscountMode = 'night' | 'total'
type DiscountPreset = {
  id: string
  name: string
  percent: number
  mode: DiscountMode
}

const typedOtaConfig = otaConfig as OtaConfig
const DEFAULT_PLAN = 'OTA-RO-FLEX'
const DEFAULT_ROOM = 'Double Classique'
const DISCOUNT_STORAGE_KEY = 'yield_discount_presets_v1'

const toISO = (date: Date) => format(date, 'yyyy-MM-dd')

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

const normalizeText = (value: string | null | undefined): string => (value || '').trim().toUpperCase()

const extractPlanCode = (value: string): string => {
  const match = value.match(/\(([^)]+)\)/)
  return normalizeText((match?.[1] || value).split(' - ')[0])
}

const matchesPlan = (candidate: string | null | undefined, targetCode: string): boolean => {
  const left = normalizeText(candidate)
  const right = normalizeText(targetCode)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const loadDiscountPresets = (): DiscountPreset[] => {
  try {
    const raw = localStorage.getItem(DISCOUNT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DiscountPreset[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveDiscountPresets = (presets: DiscountPreset[]) => {
  localStorage.setItem(DISCOUNT_STORAGE_KEY, JSON.stringify(presets))
}

export const ReservationSimulatorPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { profile } = useAuthStore()
  const hotelId = profile?.hotel_id || 'H2258'

  const today = new Date()
  const [arrivalInput, setArrivalInput] = useState<string>(toISO(today))
  const [departureInput, setDepartureInput] = useState<string>(toISO(addDays(today, 30)))

  const partnerNames = useMemo(() => Object.keys(typedOtaConfig.partners || {}), [])
  const defaultOta = useMemo(() => {
    const booking = partnerNames.find((name) => name.toLowerCase().includes('booking.com'))
    return booking || partnerNames[0] || 'Booking.com'
  }, [partnerNames])

  const [ota, setOta] = useState<string>(defaultOta)
  const [planTarifaire, setPlanTarifaire] = useState<string>(DEFAULT_PLAN)
  const [roomType, setRoomType] = useState<string>(DEFAULT_ROOM)
  const [applyCommission, setApplyCommission] = useState(true)
  const [discountMode, setDiscountMode] = useState<DiscountMode>('night')
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [discountName, setDiscountName] = useState<string>('')
  const [discountPresets, setDiscountPresets] = useState<DiscountPreset[]>(() => loadDiscountPresets())
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [showMetrics, setShowMetrics] = useState(false)

  const arrivalDate = useMemo(() => parseLocalDate(arrivalInput), [arrivalInput])
  const departureDate = useMemo(() => parseLocalDate(departureInput), [departureInput])

  const { data: planningTarifs = [], isLoading } = usePlanningTarifs(hotelId, arrivalDate, departureDate)

  const otaPlans = useMemo(() => {
    const codes = typedOtaConfig.partners?.[ota]?.codes || []
    return Array.from(new Set(codes.map((code) => normalizeText(code)).filter(Boolean)))
  }, [ota])

  const displayOrderPlans = useMemo(() => {
    const raw = typedOtaConfig.displayOrder?.plans || []
    return Array.from(new Set(raw.map((entry) => extractPlanCode(entry)).filter(Boolean)))
  }, [])

  const planningPlanCodes = useMemo(() => {
    return Array.from(new Set(planningTarifs.map((row) => normalizeText(row.plan_tarifaire)).filter(Boolean)))
  }, [planningTarifs])

  const availablePlans = useMemo(() => {
    const pool = otaPlans.length > 0 ? otaPlans : displayOrderPlans
    if (pool.length === 0) return planningPlanCodes

    const matched = pool.filter((plan) => planningPlanCodes.length === 0 || planningPlanCodes.some((candidate) => matchesPlan(candidate, plan)))
    return matched.length > 0 ? matched : pool
  }, [displayOrderPlans, otaPlans, planningPlanCodes])

  const availableRoomTypes = useMemo(() => {
    const fromPlanning = Array.from(new Set(planningTarifs.map((row) => row.type_de_chambre).filter((v): v is string => Boolean(v))))
    const configured = typedOtaConfig.displayOrder?.rooms || []
    const orderedConfigured = configured.filter((room) => fromPlanning.length === 0 || fromPlanning.includes(room))
    const remaining = fromPlanning.filter((room) => !orderedConfigured.includes(room))
    return [...orderedConfigured, ...remaining]
  }, [planningTarifs])

  const effectivePlanTarifaire = useMemo(() => {
    const normalizedCurrent = normalizeText(planTarifaire)
    if (availablePlans.length === 0) return normalizedCurrent
    if (availablePlans.some((plan) => matchesPlan(plan, normalizedCurrent))) return normalizedCurrent
    return availablePlans.includes(DEFAULT_PLAN) ? DEFAULT_PLAN : availablePlans[0]
  }, [availablePlans, planTarifaire])

  const effectiveRoomType = useMemo(() => {
    if (availableRoomTypes.length === 0) return roomType
    if (availableRoomTypes.includes(roomType)) return roomType
    return availableRoomTypes.includes(DEFAULT_ROOM) ? DEFAULT_ROOM : availableRoomTypes[0]
  }, [availableRoomTypes, roomType])

  const commissionRate = useMemo(() => typedOtaConfig.partners?.[ota]?.commission || 0, [ota])

  const simulation = useMemo(() => {
    const safeDeparture = departureDate > arrivalDate ? departureDate : addDays(arrivalDate, 1)
    const nights = Math.max(1, differenceInCalendarDays(safeDeparture, arrivalDate))
    const stayDays = eachDayOfInterval({ start: arrivalDate, end: addDays(safeDeparture, -1) })

    const ratesByDate = new Map<string, PlanningTarifRow[]>()
    planningTarifs.forEach((row) => {
      const key = row.date
      const list = ratesByDate.get(key) || []
      list.push(row)
      ratesByDate.set(key, list)
    })

    const nightlyBreakdown = stayDays.map((day) => {
      const key = toISO(day)
      const candidates = ratesByDate.get(key) || []

      const filtered = candidates.filter((row) => {
        const planOk = !effectivePlanTarifaire || matchesPlan(row.plan_tarifaire, effectivePlanTarifaire)
        const roomOk = !effectiveRoomType || row.type_de_chambre === effectiveRoomType
        return planOk && roomOk
      })

      const pool = filtered.length > 0 ? filtered : candidates
      const avgRate = pool.length > 0
        ? pool.reduce((sum, row) => sum + Number(row.tarif || 0), 0) / pool.length
        : 0

      return {
        date: key,
        count: pool.length,
        filteredCount: filtered.length,
        rate: avgRate,
      }
    })

    const total = nightlyBreakdown.reduce((sum, row) => sum + row.rate, 0)
    const discountFactor = Math.max(0, 1 - discountPercent / 100)
    const discountedNightlyBreakdown = nightlyBreakdown.map((row) => ({
      ...row,
      discountedRate: discountMode === 'night' ? row.rate * discountFactor : row.rate,
    }))
    const totalAfterNightDiscount = discountedNightlyBreakdown.reduce((sum, row) => sum + row.discountedRate, 0)
    const totalAfterDiscount = discountMode === 'total' ? total * discountFactor : totalAfterNightDiscount
    const commissionAmount = applyCommission ? (totalAfterDiscount * commissionRate) / 100 : 0
    const netTotal = totalAfterDiscount - commissionAmount
    const daysWithoutRate = nightlyBreakdown.filter((row) => row.count === 0).length

    return {
      nights,
      nightlyBreakdown: discountedNightlyBreakdown,
      averageRate: nights > 0 ? netTotal / nights : 0,
      grossTotal: total,
      totalAfterDiscount,
      commissionAmount,
      netTotal,
      daysWithoutRate,
    }
  }, [applyCommission, arrivalDate, commissionRate, departureDate, discountMode, discountPercent, effectivePlanTarifaire, effectiveRoomType, planningTarifs])

  const handleSaveDiscount = () => {
    const percent = Math.max(0, Math.min(100, discountPercent))
    const name = discountName.trim() || `${percent}% ${discountMode === 'night' ? 'par nuit' : 'sur total'}`
    const next: DiscountPreset = {
      id: selectedPresetId || `${Date.now()}`,
      name,
      percent,
      mode: discountMode,
    }
    const existingIdx = discountPresets.findIndex((p) => p.id === next.id)
    const updated = existingIdx >= 0
      ? discountPresets.map((p, idx) => (idx === existingIdx ? next : p))
      : [next, ...discountPresets]
    setDiscountPresets(updated)
    saveDiscountPresets(updated)
    setSelectedPresetId(next.id)
    setDiscountName(name)
  }

  const handleDeleteDiscount = () => {
    if (!selectedPresetId) return
    const updated = discountPresets.filter((p) => p.id !== selectedPresetId)
    setDiscountPresets(updated)
    saveDiscountPresets(updated)
    setSelectedPresetId('')
    setDiscountName('')
  }

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = discountPresets.find((p) => p.id === presetId)
    if (!preset) return
    setDiscountName(preset.name)
    setDiscountPercent(preset.percent)
    setDiscountMode(preset.mode)
  }

  const metricRows = getMetrics('planning_tarifs_fetch', 8)

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <Calculator className="h-5 w-5" />
            <h2 className="text-3xl font-black tracking-tight">Simulation de reservation</h2>
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['planning-tarifs', hotelId] })
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700"
          >
            <RotateCcw className="mr-1 inline h-3 w-3" /> Rafraichir
          </button>
        </div>
        <p className="text-sm text-slate-500">Basee sur la table planning_tarifs et ton mapping OTA/plans tarifaires.</p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            Date d'arrivee
            <input
              type="date"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              value={arrivalInput}
              onChange={(e) => {
                const next = e.target.value
                setArrivalInput(next)
                if (departureInput <= next) {
                  setDepartureInput(toISO(addDays(parseLocalDate(next), 1)))
                }
              }}
            />
          </label>

          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            Date de depart
            <input
              type="date"
              min={toISO(addDays(arrivalDate, 1))}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              value={departureInput}
              onChange={(e) => setDepartureInput(e.target.value)}
            />
          </label>

          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            OTA
            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={ota} onChange={(e) => setOta(e.target.value)}>
              {partnerNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            Plan tarifaire
            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={effectivePlanTarifaire} onChange={(e) => setPlanTarifaire(e.target.value)}>
              {availablePlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
            </select>
          </label>

          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
            Type de chambre
            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={effectiveRoomType} onChange={(e) => setRoomType(e.target.value)}>
              {availableRoomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Appliquer commission OTA
            <input type="checkbox" checked={applyCommission} onChange={(e) => setApplyCommission(e.target.checked)} />
          </label>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Commission OTA: <span className="font-black">{commissionRate}%</span>
          </div>
          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Remise %
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
            />
          </label>
          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Type remise
            <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value as DiscountMode)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1">
              <option value="night">Par nuit</option>
              <option value="total">Sur total</option>
            </select>
          </label>
          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Nom remise
            <input value={discountName} onChange={(e) => setDiscountName(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1" placeholder="Ex: Promo Salon" />
          </label>
          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Remise sauvegardee
            <select value={selectedPresetId} onChange={(e) => handleApplyPreset(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1">
              <option value="">Selectionner...</option>
              {discountPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.name} ({preset.percent}% - {preset.mode === 'night' ? 'nuit' : 'total'})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={handleSaveDiscount} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Sauvegarder / Modifier remise</button>
          <button onClick={handleDeleteDiscount} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Supprimer remise</button>
          <button onClick={() => setShowMetrics((v) => !v)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            {showMetrics ? 'Cacher metriques live' : 'Afficher metriques live'}
          </button>
        </div>

        {showMetrics && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-bold text-slate-700">Metriques live</p>
            <p>Periode: {arrivalInput} {'->'} {departureInput} | Nuits calculees: {simulation.nights} | Jours sans tarif: {simulation.daysWithoutRate}</p>
            <p>OTA plans: {otaPlans.length} | Plans disponibles: {availablePlans.length} | Lignes planning: {planningTarifs.length}</p>
            <div className="mt-2 max-h-24 overflow-auto font-mono text-[11px]">
              {metricRows.length === 0 ? (
                <p>Aucun log planning_tarifs_fetch pour l'instant.</p>
              ) : (
                metricRows.map((m, idx) => <div key={`${m.ts}-${idx}`}>{m.ts} | {JSON.stringify(m.payload)}</div>)
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Nuitees simulees</p><p className="text-2xl font-black">{simulation.nights}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">ADR simule net</p><p className="text-2xl font-black">{formatCurrency(simulation.averageRate)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total brut</p><p className="text-2xl font-black">{formatCurrency(simulation.grossTotal)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total apres remise</p><p className="text-2xl font-black">{formatCurrency(simulation.totalAfterDiscount)}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Commission OTA</p><p className="text-2xl font-black">{formatCurrency(simulation.commissionAmount)}</p></div>
        <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Total net estime</p><p className="text-2xl font-black text-emerald-800">{formatCurrency(simulation.netTotal)}</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-700">Detail journalier des tarifs</h3>

        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement du planning tarifaire...</p>
        ) : simulation.nightlyBreakdown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucun tarif disponible sur cette periode.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3 text-left">Date</th>
                  <th className="py-2 pr-3 text-right">Tarifs trouves</th>
                  <th className="py-2 pr-3 text-right">Tarifs match OTA/Plan</th>
                  <th className="py-2 pr-0 text-right">Prix simule net</th>
                </tr>
              </thead>
              <tbody>
                {simulation.nightlyBreakdown.map((row) => (
                  <tr key={row.date} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold">{format(parseLocalDate(row.date), 'EEE dd MMM yyyy', { locale: fr })}</td>
                    <td className="py-2 pr-3 text-right">{row.count}</td>
                    <td className="py-2 pr-3 text-right">{row.filteredCount}</td>
                    <td className="py-2 pr-0 text-right font-semibold">{formatCurrency(row.discountedRate)}</td>
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

