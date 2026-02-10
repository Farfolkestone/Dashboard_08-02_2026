import React from 'react'
import {
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line,
    ComposedChart
} from 'recharts'
import { MoreVertical } from 'lucide-react'

interface YieldChartProps {
    data: Array<{
        date: string
        price: number
        market: number
        demand: number
    }>
    updatedAt?: string | null
    source?: 'booking_apercu' | 'fallback_rms' | 'empty'
}

export const YieldChart: React.FC<YieldChartProps> = ({ data, updatedAt, source = 'empty' }) => {
    // Deterministic recommendation to keep render pure and predictable.
    const chartData = data
        .map((d) => {
            const price = Number.isFinite(d.price) ? d.price : 0
            const market = Number.isFinite(d.market) ? d.market : 0
            const demand = Number.isFinite(d.demand) ? d.demand : 0
            return {
                ...d,
                price,
                market,
                demand,
                recommendation: price * (1 + Math.min(0.15, Math.max(-0.05, demand * 0.002 - 0.02))),
                compHigh: market * 1.25,
                compLow: market * 0.85
            }
        })
        .filter((d) => Number.isFinite(d.price) && Number.isFinite(d.market))

    const safeChartData = chartData.length > 0
        ? chartData
        : [{ date: '-', price: 0, market: 0, demand: 0, recommendation: 0, compHigh: 0, compLow: 0 }]

    const updatedDate = updatedAt ? new Date(updatedAt) : null
    const updatedLabel = updatedDate && !Number.isNaN(updatedDate.getTime())
        ? `Mise a jour ${updatedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}`
        : 'Mise a jour indisponible'
    const sourceLabel =
        source === 'booking_apercu'
            ? 'Source: booking_apercu'
            : source === 'fallback_rms'
                ? 'Source: fallback RMS'
                : 'Source: indisponible'

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
                    BAR vs Concurrence | <span className="text-primary italic">Recommandation YieldPro</span>
                </h3>
                <div className="flex items-center gap-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-600">{updatedLabel}</span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase text-indigo-700">{sourceLabel}</span>
                    <MoreVertical className="w-4 h-4 text-muted-foreground cursor-pointer" />
                </div>
            </div>

            <div className="h-[400px] w-full min-w-0">
                <ResponsiveContainer width="100%" height={360}>
                    <ComposedChart data={safeChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f0f0f0" />

                        {/* Range Area (Compset bounds) */}
                        <Area type="monotone" dataKey="compHigh" baseValue="dataMin" stroke="none" fill="transparent" />
                        <Area
                            type="monotone"
                            dataKey="compLow"
                            stroke="none"
                            fill="#e0f2fe" // Light blue for the range
                            fillOpacity={0.6}
                        />
                        {/* Shaded area between compLow and compHigh */}
                        <Area
                            type="monotone"
                            dataKey="compHigh"
                            stroke="none"
                            fill="#e0f2fe"
                            fillOpacity={0.4}
                        />

                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fontWeight: 'bold' }}
                            tickLine={false}
                            axisLine={false}
                            padding={{ left: 20, right: 20 }}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fontWeight: 'bold' }}
                            tickLine={false}
                            axisLine={false}
                            unit="€"
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => `${val}€`}
                        />

                        <Tooltip
                            formatter={(value: number | string | undefined, name) => {
                                const numeric = typeof value === 'number' ? value : Number(value ?? 0)
                                const label = String(name)
                                return [`${Number.isFinite(numeric) ? numeric.toFixed(0) : String(value ?? 0)} €`, label]
                            }}
                            labelFormatter={(label) => `Date: ${String(label)}`}
                            contentStyle={{
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                boxShadow: '0 12px 24px -8px rgba(15, 23, 42, 0.28)',
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                fontSize: '12px',
                                fontWeight: 700,
                                padding: '10px 12px',
                            }}
                            cursor={{ stroke: '#f43f5e', strokeWidth: 1, strokeDasharray: '5 5' }}
                        />

                        {/* BAR (Current Price) */}
                        <Line
                            type="monotone"
                            dataKey="price"
                            name="BAR"
                            stroke="#6366f1" // Purple/Indigo
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                        />

                        {/* Recommendation */}
                        <Line
                            type="monotone"
                            dataKey="recommendation"
                            name="YieldPro Smart Recommendation"
                            stroke="#10b981" // Green
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
                {chartData.length === 0 && (
                    <p className="mt-2 text-center text-xs font-semibold text-slate-500">
                        Aucune donnée disponible pour afficher la courbe sur la période sélectionnée.
                    </p>
                )}
            </div>

            {/* Chart Legend */}
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-600 md:grid-cols-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-0.5 bg-[#6366f1]" />
                    <span className="flex items-center gap-1">BAR <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" /></span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-10 h-0.5 border-t-2 border-dashed border-[#10b981]" />
                    <span>Recommendation</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[#e0f2fe] opacity-60 rounded-sm" />
                    <span>Competitor High</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[#e0f2fe] opacity-30 rounded-sm" />
                    <span>Competitor Low</span>
                </div>
            </div>
        </div>
    )
}
