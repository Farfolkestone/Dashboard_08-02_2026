import React from 'react'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { TrendingUp, TrendingDown, MoreVertical } from 'lucide-react'

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
    data: {
        roomNights: any
        adr: any
        revpar: any
        revenue: any
    }
}

export const FinancialScorecard: React.FC<FinancialScorecardProps> = ({ data }) => {
    return (
        <div className="bg-card border rounded-xl shadow-lg overflow-hidden glassmorphism">
            <div className="p-4 border-b flex justify-between items-center bg-muted/10">
                <h3 className="font-black text-sm flex items-center gap-2">
                    Financial Scorecard | <span className="text-primary italic">YieldPro Settings</span>
                </h3>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Updated Monday, Oct 03, 2023</span>
                    <MoreVertical className="w-4 h-4 text-muted-foreground cursor-pointer" />
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
        </div>
    )
}
