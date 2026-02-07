import React from 'react'
import { Bell, Search, Calendar as CalendarIcon } from 'lucide-react'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { useAuthStore } from '../../store/useAuthStore'

interface HeaderProps {
    startDate: Date | null
    endDate: Date | null
    onDateChange: (dates: [Date | null, Date | null]) => void
}

export const Header: React.FC<HeaderProps> = ({ startDate, endDate, onDateChange }) => {
    const { profile } = useAuthStore()

    return (
        <header className="h-16 bg-slate-950 border-b border-white/10 flex items-center justify-between px-8 sticky top-0 z-10 text-white shadow-2xl">
            <div className="flex items-center gap-6 flex-grow max-w-2xl">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une date, une réservation..."
                        className="w-full pl-10 pr-4 py-2 bg-white/10 border-none rounded-lg text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 border border-white/10">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <DatePicker
                        selectsRange={true}
                        startDate={startDate ?? undefined}
                        endDate={endDate ?? undefined}
                        onChange={(update: [Date | null, Date | null]) => onDateChange(update)}
                        className="bg-transparent border-none text-sm w-48 outline-none cursor-pointer text-white"
                        placeholderText="Sélect. période"
                        dateFormat="dd/MM/yyyy"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-white/10 rounded-full relative transition-colors">
                    <Bell className="w-5 h-5 text-slate-300" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-950"></span>
                </button>

                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                    <div className="text-right">
                        <p className="text-sm font-bold text-white leading-tight">{profile?.full_name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black leading-none mt-1">
                            {profile?.role === 'admin' ? 'Strategic Admin' : 'Yield Manager'}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black border-2 border-white/20 shadow-lg cursor-pointer hover:scale-105 transition-all">
                        {profile?.full_name?.charAt(0) || 'U'}
                    </div>
                </div>
            </div>
        </header>
    )
}
