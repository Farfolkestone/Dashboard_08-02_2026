import React, { useMemo } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { useCompetitorRates } from '../../hooks/useCompetitorData'
import { formatCurrency } from '../../utils/formatters'
import { format, parseISO, isWeekend } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'
import {
    Activity,
    Users,
    Hotel
} from 'lucide-react'

const COMPETITOR_COLORS: Record<string, string> = {
    "Folkestone Opéra": "#ef4444", // Red for own hotel
    "Hôtel Madeleine Haussmann": "#3b82f6",
    "Hôtel De l'Arcade": "#10b981",
    "Hôtel Cordelia Opéra-Madeleine": "#f59e0b",
    "Queen Mary Opera": "#8b5cf6",
    "Hôtel du Triangle d'Or": "#ec4899",
    "Best Western Plus Hotel Sydney Opera": "#06b6d4",
    "Hotel Opéra Opal": "#84cc16",
    "Hôtel Royal Opéra": "#6366f1",
    "Hotel George Sand Opéra Paris": "#f43f5e",
    "Hotel Chavanel": "#14b8a6"
}

export const CompetitorAnalysis: React.FC = () => {
    const { profile } = useAuthStore()
    const { startDate, endDate } = useDateRangeStore()
    const hotelId = profile?.hotel_id || 'H2258'

    const { data: rates, isLoading } = useCompetitorRates(hotelId, startDate, endDate)

    const chartData = useMemo(() => {
        if (!rates) return []
        return rates.map(r => ({
            ...r,
            formattedDate: r.Date ? format(parseISO(r.Date), 'dd/MM') : ''
        }))
    }, [rates])

    const competitorNames = useMemo(() => {
        if (!rates || rates.length === 0) return []
        // Extract hotel names from the first row keys, excluding system fields
        const keys = Object.keys(rates[0])
        return keys.filter(k =>
            !['id', 'hotel_id', 'date_mise_a_jour', 'Jour', 'Date', 'Demande du marché'].includes(k)
        )
    }, [rates])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground animate-pulse">Analyse de la concurrence en cours...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex justify-between items-center bg-card/50 p-4 rounded-xl border border-transparent hover:border-border transition-all">
                <div>
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        Analyse Concurrentielle
                    </h2>
                    <p className="text-muted-foreground italic">
                        Positionnement tarifaire par rapport au compset (Folkestone Opéra vs Marché).
                    </p>
                </div>
            </div>

            {/* Price Chart */}
            <div className="bg-card border rounded-2xl shadow-xl p-6 glassmorphism border-white/20">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-lg flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Évolution des Tarifs
                    </h3>
                </div>
                <div className="h-[400px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="formattedDate"
                                stroke="#94a3b8"
                                fontSize={11}
                                fontWeight="bold"
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={11}
                                fontWeight="bold"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${value}€`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    fontWeight: 'bold'
                                }}
                            />
                            <Legend iconType="circle" />
                            {competitorNames.map(name => (
                                <Line
                                    key={name}
                                    type="monotone"
                                    dataKey={name}
                                    name={name}
                                    stroke={COMPETITOR_COLORS[name] || '#94a3b8'}
                                    strokeWidth={name === "Folkestone Opéra" ? 4 : 2}
                                    dot={name === "Folkestone Opéra"}
                                    activeDot={{ r: 8 }}
                                    opacity={name === "Folkestone Opéra" ? 1 : 0.6}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Grid Table */}
            <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden glassmorphism border-white/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border/50">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest sticky left-0 bg-muted/30 z-20 w-32 border-r">Date</th>
                                {competitorNames.map(name => (
                                    <th
                                        key={name}
                                        className={`p-4 text-[10px] font-black uppercase tracking-widest text-center min-w-[120px] ${name === "Folkestone Opéra" ? 'bg-primary/5 text-primary border-x border-primary/10' : ''
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <Hotel className="w-3 h-3 opacity-50" />
                                            {name}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {chartData.map((row: any) => {
                                const dateObj = parseISO(row.Date)
                                const isWeekEnd = isWeekend(dateObj)

                                return (
                                    <tr key={row.Date} className={`group hover:bg-primary/5 transition-all duration-200 ${isWeekEnd ? 'bg-blue-50/20' : ''}`}>
                                        <td className={`p-4 sticky left-0 z-10 transition-colors border-r ${isWeekEnd ? 'bg-blue-50/50' : 'bg-card group-hover:bg-primary/5'
                                            }`}>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm">{format(dateObj, 'eee dd/MM', { locale: fr })}</span>
                                            </div>
                                        </td>
                                        {competitorNames.map(name => {
                                            const price = row[name]
                                            const isSelf = name === "Folkestone Opéra"
                                            const ownPrice = row["Folkestone Opéra"]

                                            // Diff calculation
                                            let diffClass = "text-muted-foreground"
                                            if (!isSelf && price && ownPrice) {
                                                if (ownPrice > price) diffClass = "text-rose-500"
                                                else if (ownPrice < price) diffClass = "text-emerald-500"
                                            }

                                            return (
                                                <td
                                                    key={name}
                                                    className={`p-4 text-center ${isSelf ? 'bg-primary/5 font-black border-x border-primary/10' : ''
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-sm ${isSelf ? 'text-base font-black' : 'font-bold'}`}>
                                                            {price ? formatCurrency(price) : '-'}
                                                        </span>
                                                        {!isSelf && price && ownPrice && (
                                                            <span className={`text-[10px] font-bold ${diffClass}`}>
                                                                {ownPrice - price > 0 ? '+' : ''}{ownPrice - price}€
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
