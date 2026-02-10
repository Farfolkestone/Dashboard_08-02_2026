import React, { useEffect, useMemo, useState } from 'react'
import { Save, SlidersHorizontal, RefreshCcw, Sparkles } from 'lucide-react'
import {
    useDashboardConfig,
    type DashboardConfigPayload,
    type DashboardWidgets,
    type RMSSettings,
} from '../../hooks/useDashboardConfig'
import { useDisponibilites } from '../../hooks/useHotelData'
import { useCompetitorsSettings, useHotelByHotelId, useHotels, useUpdateCurrentUserHotel } from '../../hooks/useHotels'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import type { Database } from '../../types/database.types'

type CompetitorRow = Database['public']['Tables']['hotels_concurrents']['Row']
type DisponibilitesRow = Database['public']['Tables']['disponibilites']['Row']

const SectionTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div>
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
)

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <button type="button" onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    </label>
)

const RangeField: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }> = ({
    label,
    value,
    min,
    max,
    step = 1,
    suffix = '',
    onChange,
}) => (
    <label className="block rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            <span className="text-sm font-black text-slate-900">{value}{suffix}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200"
        />
    </label>
)

const presetMap: Record<RMSSettings['strategy'], Partial<RMSSettings>> = {
    conservative: {
        strategy: 'conservative',
        targetOccupancy: 78,
        demandWeight: 0.28,
        competitorWeight: 0.37,
        eventWeight: 0.2,
        pickupWeight: 0.15,
        weekendPremiumPct: 8,
        lastMinuteDiscountPct: 5,
    },
    balanced: {
        strategy: 'balanced',
        targetOccupancy: 82,
        demandWeight: 0.35,
        competitorWeight: 0.3,
        eventWeight: 0.2,
        pickupWeight: 0.15,
        weekendPremiumPct: 12,
        lastMinuteDiscountPct: 8,
    },
    aggressive: {
        strategy: 'aggressive',
        targetOccupancy: 88,
        demandWeight: 0.43,
        competitorWeight: 0.25,
        eventWeight: 0.2,
        pickupWeight: 0.12,
        weekendPremiumPct: 17,
        lastMinuteDiscountPct: 10,
    },
}

export const RMSSettingsPage: React.FC = () => {
    const { user, profile, setProfile } = useAuthStore()
    const { startDate, endDate } = useDateRangeStore()
    const hotelId = profile?.hotel_id || 'H2258'
    const { data: hotel } = useHotelByHotelId(hotelId)
    const { data: hotels = [] } = useHotels()
    const { config, defaultConfig, isLoading, updateConfig } = useDashboardConfig()
    const { data: disponibilites = [] } = useDisponibilites(hotelId, startDate, endDate)
    const { data: competitorsSettings = [], saveMutation } = useCompetitorsSettings(hotelId)
    const updateHotelMutation = useUpdateCurrentUserHotel()
    const [localConfig, setLocalConfig] = useState<DashboardConfigPayload>(config)
    const [localCompetitors, setLocalCompetitors] = useState<CompetitorRow[]>([])
    const [selectedHotelId, setSelectedHotelId] = useState(hotelId)
    const [saved, setSaved] = useState(false)
    const [newRoomTypeName, setNewRoomTypeName] = useState('')
    const [newRoomTypeCount, setNewRoomTypeCount] = useState(1)
    const [editingRoomType, setEditingRoomType] = useState<string | null>(null)

    useEffect(() => {
        setLocalConfig(config)
    }, [config])

    useEffect(() => {
        setSelectedHotelId(hotelId)
    }, [hotelId])

    useEffect(() => {
        const hotelName = (hotel?.name || '').toLowerCase().trim()
        const filtered = competitorsSettings.filter((competitor) => {
            const competitorName = (competitor.competitor_name || '').toLowerCase().trim()
            if (!competitorName) return true
            if (!hotelName) return true
            return competitorName !== hotelName
        })
        setLocalCompetitors(filtered)
    }, [competitorsSettings, hotel?.name])

    const weightSum = useMemo(() => {
        return localConfig.rms.demandWeight + localConfig.rms.competitorWeight + localConfig.rms.eventWeight + localConfig.rms.pickupWeight
    }, [localConfig.rms])

    const updateRms = (patch: Partial<RMSSettings>) => {
        setSaved(false)
        setLocalConfig((prev) => ({ ...prev, rms: { ...prev.rms, ...patch } }))
    }

    const upsertRoomTypeCapacity = (roomType: string, count: number) => {
        const key = roomType.trim()
        if (!key) return
        updateRms({
            roomTypeCapacities: {
                ...(localConfig.rms.roomTypeCapacities || {}),
                [key]: Math.max(0, Math.floor(count)),
            },
        })
    }

    const removeRoomTypeCapacity = (roomType: string) => {
        const next = { ...(localConfig.rms.roomTypeCapacities || {}) }
        delete next[roomType]
        updateRms({ roomTypeCapacities: next })
        if (editingRoomType === roomType) {
            setEditingRoomType(null)
            setNewRoomTypeName('')
            setNewRoomTypeCount(1)
        }
    }

    const roomTypeOptions = useMemo(() => {
        const set = new Set<string>()
        ;(disponibilites as DisponibilitesRow[]).forEach((row) => {
            if (row.type_de_chambre && row.type_de_chambre.trim()) {
                set.add(row.type_de_chambre.trim())
            }
        })
        Object.keys(localConfig.rms.roomTypeCapacities || {}).forEach((roomType) => {
            if (roomType.trim()) set.add(roomType.trim())
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [disponibilites, localConfig.rms.roomTypeCapacities])

    const saveRoomTypeCapacity = () => {
        const key = newRoomTypeName.trim()
        if (!key) return
        upsertRoomTypeCapacity(key, newRoomTypeCount)
        setEditingRoomType(null)
        setNewRoomTypeName('')
        setNewRoomTypeCount(1)
    }

    const startEditRoomType = (roomType: string, count: number) => {
        setEditingRoomType(roomType)
        setNewRoomTypeName(roomType)
        setNewRoomTypeCount(count)
    }

    const updateWidgets = (patch: Partial<DashboardWidgets>) => {
        setSaved(false)
        setLocalConfig((prev) => ({ ...prev, widgets: { ...prev.widgets, ...patch } }))
    }

    const applyPreset = (strategy: RMSSettings['strategy']) => updateRms(presetMap[strategy])

    const normalizeWeights = () => {
        const sum = weightSum
        if (sum <= 0) return
        updateRms({
            demandWeight: Number((localConfig.rms.demandWeight / sum).toFixed(2)),
            competitorWeight: Number((localConfig.rms.competitorWeight / sum).toFixed(2)),
            eventWeight: Number((localConfig.rms.eventWeight / sum).toFixed(2)),
            pickupWeight: Number((localConfig.rms.pickupWeight / sum).toFixed(2)),
        })
    }

    const saveSettings = async () => {
        if (user && selectedHotelId && selectedHotelId !== hotelId) {
            await updateHotelMutation.mutateAsync({
                user_id: user.id,
                hotel_id: selectedHotelId
            })
            if (profile) {
                setProfile({
                    ...profile,
                    hotel_id: selectedHotelId
                })
            }
        }

        await updateConfig.mutateAsync(localConfig)
        await saveMutation.mutateAsync(
            localCompetitors.map((competitor) => ({
                id: competitor.id,
                is_active: competitor.is_active,
                display_order: competitor.display_order,
            }))
        )
        setSaved(true)
    }

    const resetToDefaults = () => {
        setLocalConfig(defaultConfig)
        setSaved(false)
    }

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <p className="text-sm font-semibold text-slate-500">Chargement des parametres RMS...</p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-[1400px] space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-2xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]">
                            <Sparkles className="h-3 w-3" />
                            RMS Control Studio
                        </p>
                        <h2 className="text-3xl font-black tracking-tight">Personnalisation avancee du Yield Management</h2>
                        <p className="mt-2 text-sm text-slate-200">Calibrage des regles de pricing, ponderations RMS, widgets dashboard et modes d'affichage.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={resetToDefaults} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
                            <RefreshCcw className="h-4 w-4" /> Reinitialiser
                        </button>
                        <button onClick={saveSettings} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-900">
                            <Save className="h-4 w-4" /> Enregistrer
                        </button>
                    </div>
                </div>
            </section>

            {saved && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Parametres enregistres dans Supabase.</div>}

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <SectionTitle title="Mon hotel" subtitle="Selectionnez l'hotel principal utilise pour le dashboard et le moteur RMS." />
                    <label className="block rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
                        Hotel actif
                        <select
                            value={selectedHotelId}
                            onChange={(event) => {
                                setSelectedHotelId(event.target.value)
                                setSaved(false)
                            }}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                            {hotels.map((row) => {
                                const optionValue = row.hotel_id || row.code || row.id
                                const optionLabel = row.name || row.hotel_id || row.code || row.id
                                return (
                                    <option key={row.id} value={optionValue}>
                                        {optionLabel}
                                    </option>
                                )
                            })}
                        </select>
                    </label>
                    <p className="text-xs text-slate-500">
                        Hotel actuellement charge: <span className="font-bold text-slate-700">{hotel?.name || hotelId}</span>
                    </p>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <SectionTitle title="Profil RMS" subtitle="Choisissez une strategie de base puis ajustez les curseurs finement." />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(['conservative', 'balanced', 'aggressive'] as const).map((strategy) => (
                            <button
                                key={strategy}
                                onClick={() => applyPreset(strategy)}
                                className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-wide ${localConfig.rms.strategy === strategy ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                            >
                                {strategy}
                            </button>
                        ))}
                    </div>

                    <RangeField label="Capacite hotel" value={localConfig.rms.hotelCapacity} min={20} max={120} suffix=" ch" onChange={(value) => updateRms({ hotelCapacity: value })} />
                    <RangeField label="Objectif occupation" value={localConfig.rms.targetOccupancy} min={55} max={98} suffix="%" onChange={(value) => updateRms({ targetOccupancy: value })} />
                    <RangeField label="Premium weekend" value={localConfig.rms.weekendPremiumPct} min={0} max={40} suffix="%" onChange={(value) => updateRms({ weekendPremiumPct: value })} />
                    <RangeField label="Discount last minute" value={localConfig.rms.lastMinuteDiscountPct} min={0} max={30} suffix="%" onChange={(value) => updateRms({ lastMinuteDiscountPct: value })} />
                    <RangeField label="Auto-approve max variation" value={localConfig.rms.autoApproveThresholdPct} min={1} max={15} suffix="%" onChange={(value) => updateRms({ autoApproveThresholdPct: value })} />
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <SectionTitle title="Ponderations du moteur" subtitle="Le total doit tendre vers 1.00 pour garder un modele stable." />

                    <RangeField label="Poids demande" value={Number(localConfig.rms.demandWeight.toFixed(2))} min={0} max={1} step={0.01} onChange={(value) => updateRms({ demandWeight: value })} />
                    <RangeField label="Poids concurrence" value={Number(localConfig.rms.competitorWeight.toFixed(2))} min={0} max={1} step={0.01} onChange={(value) => updateRms({ competitorWeight: value })} />
                    <RangeField label="Poids evenements" value={Number(localConfig.rms.eventWeight.toFixed(2))} min={0} max={1} step={0.01} onChange={(value) => updateRms({ eventWeight: value })} />
                    <RangeField label="Poids pickup" value={Number(localConfig.rms.pickupWeight.toFixed(2))} min={0} max={1} step={0.01} onChange={(value) => updateRms({ pickupWeight: value })} />

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-700">Somme des poids</p>
                        <p className={`text-2xl font-black ${Math.abs(weightSum - 1) <= 0.05 ? 'text-emerald-600' : 'text-amber-600'}`}>{weightSum.toFixed(2)}</p>
                        <button onClick={normalizeWeights} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                            <SlidersHorizontal className="h-4 w-4" /> Normaliser
                        </button>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <SectionTitle
                    title="Capacites par type de chambre"
                    subtitle="Selectionnez une categorie, saisissez la quantite, puis sauvegardez."
                />
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
                        Type de chambre
                        <select
                            value={newRoomTypeName}
                            onChange={(event) => setNewRoomTypeName(event.target.value)}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
                        >
                            <option value="">Selectionner un type</option>
                            {roomTypeOptions.map((roomType) => (
                                <option key={roomType} value={roomType}>{roomType}</option>
                            ))}
                        </select>
                    </label>
                    <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
                        Nb chambres
                        <input
                            type="number"
                            min={0}
                            value={newRoomTypeCount}
                            onChange={(event) => setNewRoomTypeCount(Number(event.target.value))}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={saveRoomTypeCapacity}
                        disabled={!newRoomTypeName.trim()}
                        className="self-end rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
                    >
                        {editingRoomType ? 'Sauvegarder' : 'Ajouter'}
                    </button>
                </div>

                <div className="mt-4 space-y-2">
                    {Object.entries(localConfig.rms.roomTypeCapacities || {}).map(([roomType, count]) => (
                        <div key={roomType} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_140px_auto] md:items-center">
                            <p className="text-sm font-semibold text-slate-800">{roomType}</p>
                            <p className="text-sm font-black text-slate-700">{count}</p>
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => startEditRoomType(roomType, Number(count))}
                                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                                >
                                    Editer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeRoomTypeCapacity(roomType)}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-rose-700"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    ))}

                    {Object.keys(localConfig.rms.roomTypeCapacities || {}).length === 0 && (
                        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                            Aucun type de chambre configure.
                        </p>
                    )}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <SectionTitle title="Garde-fous tarifaires" subtitle="Definissez les bornes ADR/Price et le pas de recommandation." />
                    <div className="grid grid-cols-2 gap-3">
                        <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">ADR min<input type="number" value={localConfig.rms.minAdr} onChange={(event) => updateRms({ minAdr: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                        <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">ADR max<input type="number" value={localConfig.rms.maxAdr} onChange={(event) => updateRms({ maxAdr: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                        <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">Prix min<input type="number" value={localConfig.rms.minPrice} onChange={(event) => updateRms({ minPrice: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                        <label className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">Prix max<input type="number" value={localConfig.rms.maxPrice} onChange={(event) => updateRms({ maxPrice: Number(event.target.value) })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                    </div>
                    <RangeField label="Pas de recommandation" value={localConfig.rms.priceStep} min={1} max={10} onChange={(value) => updateRms({ priceStep: value })} />
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <SectionTitle title="Widgets & interface" subtitle="Activez les modules visibles sur le dashboard principal." />
                    <div className="grid grid-cols-1 gap-2">
                        <Toggle label="Revenue" checked={localConfig.widgets.revenue} onChange={(checked) => updateWidgets({ revenue: checked })} />
                        <Toggle label="Occupancy" checked={localConfig.widgets.occupancy} onChange={(checked) => updateWidgets({ occupancy: checked })} />
                        <Toggle label="Pickup" checked={localConfig.widgets.pickup} onChange={(checked) => updateWidgets({ pickup: checked })} />
                        <Toggle label="ADR" checked={localConfig.widgets.adr} onChange={(checked) => updateWidgets({ adr: checked })} />
                        <Toggle label="Competitors" checked={localConfig.widgets.competitors} onChange={(checked) => updateWidgets({ competitors: checked })} />
                        <Toggle label="Market" checked={localConfig.widgets.market} onChange={(checked) => updateWidgets({ market: checked })} />
                        <Toggle label="Yield Recommendations" checked={localConfig.widgets.yieldRecommendations} onChange={(checked) => updateWidgets({ yieldRecommendations: checked })} />
                        <Toggle label="Alerts" checked={localConfig.widgets.alerts} onChange={(checked) => updateWidgets({ alerts: checked })} />
                        <Toggle label="Events" checked={localConfig.widgets.events} onChange={(checked) => updateWidgets({ events: checked })} />
                        <Toggle label="Booking Pace" checked={localConfig.widgets.bookingPace} onChange={(checked) => updateWidgets({ bookingPace: checked })} />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <Toggle label="Mode compact" checked={localConfig.ui.compactMode} onChange={(checked) => setLocalConfig((prev) => ({ ...prev, ui: { ...prev.ui, compactMode: checked } }))} />
                        <Toggle label="Cartes avancees" checked={localConfig.ui.showAdvancedCards} onChange={(checked) => setLocalConfig((prev) => ({ ...prev, ui: { ...prev.ui, showAdvancedCards: checked } }))} />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <SectionTitle
                    title="Mes concurrents"
                    subtitle="Selection depuis la table hotels_concurrents, avec activation et ordre personnalises."
                />
                <div className="mt-4 space-y-2">
                    {localCompetitors.map((competitor, index) => (
                        <div key={competitor.id} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_110px_120px] md:items-center">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{competitor.competitor_name || 'Concurrent sans nom'}</p>
                                <p className="text-xs text-slate-500">{competitor.source || 'Source non definie'}</p>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                Ordre
                                <input
                                    type="number"
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5"
                                    value={competitor.display_order ?? index + 1}
                                    onChange={(event) => {
                                        const value = Number(event.target.value)
                                        setLocalCompetitors((prev) => prev.map((row) => row.id === competitor.id ? { ...row, display_order: value } : row))
                                        setSaved(false)
                                    }}
                                />
                            </label>
                            <Toggle
                                label="Actif"
                                checked={Boolean(competitor.is_active)}
                                onChange={(checked) => {
                                    setLocalCompetitors((prev) => prev.map((row) => row.id === competitor.id ? { ...row, is_active: checked } : row))
                                    setSaved(false)
                                }}
                            />
                        </div>
                    ))}
                    {localCompetitors.length === 0 && (
                        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                            Aucun concurrent configurable trouve pour cet hotel.
                        </p>
                    )}
                </div>
            </section>
        </div>
    )
}

