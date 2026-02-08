import React, { useEffect, useMemo, useState } from 'react'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { TrendingUp, TrendingDown, Save, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { RMSSettings } from '../../hooks/useDashboardConfig'

interface ScorecardKPIProps {
    title: string
    value: number
    currency?: boolean
    target: number
    committed: number
    forecast: number
    changePercent: number
    isPositive?: boolean
}

export const ScorecardKPI: React.FC<ScorecardKPIProps> = ({
    title,
    value,
    currency,
    target,
    committed,
    forecast,
    changePercent,
    isPositive
}) => {
    const displayValue = currency ? formatCurrency(value) : formatNumber(value)

    // Calculate widths for the bars based on the target (max scale)
    const scale = Math.max(target, forecast, committed) * 1.1
    const committedWidth = (committed / scale) * 100
    const forecastWidth = (forecast / scale) * 100
    const targetPos = (target / scale) * 100

    return (
        <div className="flex-1 min-w-[200px] p-4 group">
            <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
            </div>
            <p className="text-2xl font-black mb-4">{displayValue}</p>

            <div className="relative h-12 w-full bg-muted/20 rounded-sm overflow-visible mb-4">
                {/* Forecast Bar (Light Teal) */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-4 bg-teal-200/50 rounded-sm transition-all duration-1000"
                    style={{ width: `${forecastWidth}%` }}
                />

                {/* Committed Bar (Dark Teal) */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-4 bg-teal-500 rounded-sm transition-all duration-1000 shadow-sm"
                    style={{ width: `${committedWidth}%` }}
                />

                {/* Target Marker (Purple Dotted Line) */}
                <div
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-purple-500 z-10"
                    style={{ left: `${targetPos}%` }}
                >
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-purple-500 rotate-45" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-purple-500 rotate-45" />
                </div>
            </div>

            <div className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{isPositive ? 'Projected above budget' : 'Below budget'}</span>
                <span className="ml-1">{isPositive ? '+' : ''}{changePercent}%</span>
            </div>
        </div>
    )
}

interface FinancialScorecardProps {
    data: Record<'roomNights' | 'adr' | 'revpar' | 'revenue', {
        value: number
        target: number
        committed: number
        forecast: number
        change: number
    }>
    rms: RMSSettings
    onSaveRms: (next: Partial<RMSSettings>) => Promise<void>
    isSaving?: boolean
}

export const FinancialScorecard: React.FC<FinancialScorecardProps> = ({ data, rms, onSaveRms, isSaving = false }) => {
    const [draft, setDraft] = useState<RMSSettings>(rms)

    useEffect(() => {
        setDraft(rms)
    }, [rms])

    const hasChanges = useMemo(() => {
        return JSON.stringify(draft) !== JSON.stringify(rms)
    }, [draft, rms])

    const onNumberChange = (key: keyof RMSSettings, value: string) => {
        const next = Number(value)
        if (!Number.isFinite(next)) return
        setDraft((prev) => ({ ...prev, [key]: next }))
    }

    const apply = async () => {
        await onSaveRms(draft)
    }

    const reset = () => {
        setDraft(rms)
    }

    return (
        <div className="bg-card border rounded-xl shadow-lg overflow-hidden glassmorphism">
            <div className="p-4 border-b flex justify-between items-center bg-muted/10">
                <h3 className="font-black text-sm flex items-center gap-2">
                    Financial Scorecard | <span className="text-primary italic">YieldPro Settings</span>
                </h3>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Updated {new Date().toLocaleDateString('fr-FR')}
                    </span>
                </div>
            </div>

            <div className="p-2 flex flex-wrap divide-x divide-border/50">
                <ScorecardKPI
                    title="Room Nights"
                    value={data.roomNights.value}
                    target={data.roomNights.target}
                    committed={data.roomNights.committed}
                    forecast={data.roomNights.forecast}
                    changePercent={data.roomNights.change}
                    isPositive={data.roomNights.change > 0}
                />
                <ScorecardKPI
                    title="ADR"
                    value={data.adr.value}
                    currency
                    target={data.adr.target}
                    committed={data.adr.committed}
                    forecast={data.adr.forecast}
                    changePercent={data.adr.change}
                    isPositive={data.adr.change > 0}
                />
                <ScorecardKPI
                    title="RevPAR"
                    value={data.revpar.value}
                    currency
                    target={data.revpar.target}
                    committed={data.revpar.committed}
                    forecast={data.revpar.forecast}
                    changePercent={data.revpar.change}
                    isPositive={data.revpar.change > 0}
                />
                <ScorecardKPI
                    title="Room Revenue"
                    value={data.revenue.value}
                    currency
                    target={data.revenue.target}
                    committed={data.revenue.committed}
                    forecast={data.revenue.forecast}
                    changePercent={data.revenue.change}
                    isPositive={data.revenue.change > 0}
                />
            </div>

            {/* Legend */}
            <div className="px-6 py-3 border-t bg-muted/5 flex items-center justify-center gap-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-teal-500 rounded-sm" />
                    <span>Committed</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-teal-200 rounded-sm" />
                    <span>Forecast</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 border-t border-dashed border-purple-500" />
                    <span className="flex items-center gap-1">Budget Target <div className="w-1.5 h-1.5 bg-purple-500 rotate-45" /></span>
                </div>
            </div>

            <div className="border-t bg-muted/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        YieldPro Settings
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={isSaving || !hasChanges}
                            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={apply}
                            disabled={isSaving || !hasChanges}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {isSaving ? 'Saving...' : 'Apply'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-semibold text-muted-foreground">
                        Strategy
                        <select
                            value={draft.strategy}
                            onChange={(e) => setDraft((prev) => ({ ...prev, strategy: e.target.value as RMSSettings['strategy'] }))}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        >
                            <option value="conservative">Conservative</option>
                            <option value="balanced">Balanced</option>
                            <option value="aggressive">Aggressive</option>
                        </select>
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        Target Occupancy (%)
                        <input
                            type="number"
                            min={40}
                            max={100}
                            step={1}
                            value={draft.targetOccupancy}
                            onChange={(e) => onNumberChange('targetOccupancy', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        ADR Min
                        <input
                            type="number"
                            min={30}
                            step={1}
                            value={draft.minAdr}
                            onChange={(e) => onNumberChange('minAdr', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        ADR Max
                        <input
                            type="number"
                            min={30}
                            step={1}
                            value={draft.maxAdr}
                            onChange={(e) => onNumberChange('maxAdr', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        Weekend Premium (%)
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={draft.weekendPremiumPct}
                            onChange={(e) => onNumberChange('weekendPremiumPct', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        Last Minute Discount (%)
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={draft.lastMinuteDiscountPct}
                            onChange={(e) => onNumberChange('lastMinuteDiscountPct', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        Auto-Approve Threshold (%)
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={draft.autoApproveThresholdPct}
                            onChange={(e) => onNumberChange('autoApproveThresholdPct', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>

                    <label className="text-xs font-semibold text-muted-foreground">
                        Hotel Capacity
                        <input
                            type="number"
                            min={1}
                            max={500}
                            step={1}
                            value={draft.hotelCapacity}
                            onChange={(e) => onNumberChange('hotelCapacity', e.target.value)}
                            className="mt-1 block w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground"
                        />
                    </label>
                </div>
            </div>
        </div>
    )
}
