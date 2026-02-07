import React, { useState } from 'react'
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    eachDayOfInterval
} from 'date-fns'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export const SidebarCalendar: React.FC = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date()) // System date
    const [selectedDate, setSelectedDate] = useState(new Date())

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate
    })

    return (
        <div className="bg-card border rounded-xl shadow-sm p-4 text-xs">
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 12))} className="p-1 hover:bg-muted rounded"><ChevronsLeft className="w-3 h-3" /></button>
                    <button onClick={prevMonth} className="p-1 hover:bg-muted rounded"><ChevronLeft className="w-3 h-3" /></button>
                </div>
                <span className="font-black uppercase tracking-widest">{format(currentMonth, 'MMM yyyy')}</span>
                <div className="flex gap-1">
                    <button onClick={nextMonth} className="p-1 hover:bg-muted rounded"><ChevronRight className="w-3 h-3" /></button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 12))} className="p-1 hover:bg-muted rounded"><ChevronsRight className="w-3 h-3" /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {days.map(d => (
                    <div key={d} className="text-center font-bold text-muted-foreground opacity-50 py-1">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, monthStart)
                    const isSelected = isSameDay(day, selectedDate)
                    const hasEvent = idx % 5 === 0
                    const hasNote = idx % 7 === 0
                    const hasRestriction = idx % 9 === 0
                    const occupancy = 80 + (idx % 20)

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => setSelectedDate(day)}
                            className={`
                                relative p-2 text-center cursor-pointer rounded-lg transition-all
                                ${!isCurrentMonth ? 'opacity-20' : ''}
                                ${isSelected ? 'bg-primary/10 border border-primary ring-2 ring-primary/20' : 'hover:bg-muted'}
                            `}
                        >
                            <span className={`font-black ${isSelected ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                            <div className="text-[8px] opacity-40 font-bold mt-0.5">{occupancy}%</div>

                            {/* Status Dots */}
                            <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                                {hasEvent && <div className="w-1 h-1 bg-blue-500 rounded-full" />}
                                {hasNote && <div className="w-1 h-1 bg-purple-500 rounded-full" />}
                                {hasRestriction && <div className="w-1 h-1 bg-amber-500 rounded-full" />}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="mt-6 flex flex-wrap gap-4 justify-center border-t pt-4 border-dashed">
                <div className="flex items-center gap-1.5 opacity-60">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Events</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-60">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Notes</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-60">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Restrictions</span>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                <select className="w-full bg-muted/30 border rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-primary/20">
                    <option>Demand Occupancy</option>
                </select>
                <div className="flex gap-2">
                    <button className="flex-1 py-2 text-primary text-[10px] font-black uppercase hover:bg-primary/5 rounded-lg border border-transparent hover:border-primary/20 transition-all">Cancel</button>
                    <button className="flex-1 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase rounded-lg shadow-sm hover:translate-y-[-1px] transition-all">Apply</button>
                </div>
            </div>
        </div>
    )
}

export const DashboardSidebar: React.FC = () => {
    return (
        <div className="w-80 flex flex-col gap-6">
            <div className="flex items-center gap-2 bg-white/50 border rounded-xl p-2 shadow-sm">
                <input
                    type="text"
                    readOnly
                    value={`${format(startOfMonth(new Date()), 'MMM d, yyyy')} - ${format(endOfMonth(new Date()), 'MMM d, yyyy')}`}
                    className="flex-grow bg-transparent border-none text-[10px] font-black px-2 outline-none"
                />
                <ChevronRight className="w-4 h-4 text-muted-foreground mr-2" />
            </div>

            <SidebarCalendar />

            <div className="bg-card border rounded-xl shadow-lg p-4 glassmorphism">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-xs uppercase tracking-widest">Alerts</h4>
                    <MoreVertical className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                    <div className="flex gap-3 items-start border-l-2 border-amber-500 pl-3 py-1">
                        <div className="flex-grow">
                            <p className="text-[10px] font-black text-muted-foreground uppercase opacity-50 mb-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                            <p className="text-[11px] leading-relaxed">
                                <span className="font-bold">Committed group rooms</span> for Folkestone have reached 30% of total capacity.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

import { MoreVertical } from 'lucide-react'
