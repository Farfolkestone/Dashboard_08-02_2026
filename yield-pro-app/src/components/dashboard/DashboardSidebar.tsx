import React, { useEffect, useMemo, useState } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type DashboardSidebarProps = {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  arrivalCountByDate?: Record<string, number>
}

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd')

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ selectedDate, onSelectDate, arrivalCountByDate = {} }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    setCurrentMonth(selectedDate)
  }, [selectedDate])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate])

  return (
    <div className="w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-black uppercase tracking-wider text-slate-700">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-500">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, idx) => (
          <div key={`${d}-${idx}`} className={d === 'S' || d === 'D' ? 'text-blue-600' : ''}>{d}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const inMonth = isSameMonth(day, currentMonth)
          const selected = isSameDay(day, selectedDate)
          const key = toDateKey(day)
          const arrivals = arrivalCountByDate[key] || 0
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`relative rounded-md p-2 text-center text-xs font-bold transition ${!inMonth ? 'opacity-30' : ''} ${selected ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              {format(day, 'd')}
              {arrivals > 0 && (
                <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-black ${selected ? 'bg-cyan-300 text-slate-900' : 'bg-cyan-600 text-white'}`}>
                  {arrivals}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-black text-slate-700">Date active Dashboard</p>
        <p className="mt-1">{format(selectedDate, 'EEE dd MMM yyyy')}</p>
      </div>
    </div>
  )
}
