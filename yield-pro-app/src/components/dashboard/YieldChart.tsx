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
    data: any[]
}

export const YieldChart: React.FC<YieldChartProps> = ({ data }) => {
    // Generate some dummy compset data if not present to show the range effect
    const chartData = data.map(d => ({
        ...d,
        recommendation: d.price * (1 + (Math.random() * 0.2 - 0.05)),
        compHigh: d.market * 1.25,
        compLow: d.market * 0.85
    }))

    return (
        <div className="bg-card border rounded-xl shadow-lg p-6 glassmorphism">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-sm flex items-center gap-2">
                    BAR vs Competitors | <span className="text-primary italic">YieldPro Smart Recommendation</span>
                </h3>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Updated Monday, Oct 03, 2023</span>
                    <MoreVertical className="w-4 h-4 text-muted-foreground cursor-pointer" />
                </div>
            </div>

            <div className="h-[400px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f0f0f0" />

                        {/* Range Area (Compset bounds) */}
                        <Area
                            type="monotone"
                            dataKey="compHigh"
                            baseValue="dataMin"
                            stroke="none"
                            fill="transparent"
                        />
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
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                fontSize: '11px',
                                fontWeight: 'bold'
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
            </div>

            {/* Chart Legend */}
            <div className="grid grid-cols-4 gap-4 mt-8 px-4 py-3 border-t bg-muted/5 rounded-lg text-[9px] font-black uppercase tracking-tighter text-muted-foreground">
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
