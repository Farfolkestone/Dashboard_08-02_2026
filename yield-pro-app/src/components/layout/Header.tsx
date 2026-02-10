import React from 'react'
import { Bell, Search, Calendar as CalendarIcon, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useThemeStore } from '../../store/useThemeStore'

interface HeaderProps {
    startDate: Date | null
    endDate: Date | null
    onStartDateChange: (date: Date) => void
    onEndDateChange: (date: Date) => void
}

const toInputDate = (date: Date | null) => {
    if (!date) return ''
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

const parseInputDate = (value: string) => {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
}

export const Header: React.FC<HeaderProps> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
    const { profile } = useAuthStore()
    const { theme, toggleTheme } = useThemeStore()
    const effectiveStart = startDate || new Date()
    const effectiveEnd = endDate || new Date()

    return (
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/85 px-8 backdrop-blur-xl">
            <div className="flex max-w-5xl flex-1 items-center gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une date, une reservation, un segment..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <CalendarIcon className="h-4 w-4 text-slate-500" />
                    <div className="flex items-center gap-3">
                        <label className="text-[11px] font-bold text-slate-500">
                            Date debut
                            <input
                                type="date"
                                value={toInputDate(effectiveStart)}
                                onChange={(e) => onStartDateChange(parseInputDate(e.target.value))}
                                className="mt-1 block w-[145px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                            />
                        </label>
                        <label className="text-[11px] font-bold text-slate-500">
                            Date fin
                            <input
                                type="date"
                                value={toInputDate(effectiveEnd)}
                                min={toInputDate(effectiveStart)}
                                onChange={(e) => onEndDateChange(parseInputDate(e.target.value))}
                                className="mt-1 block w-[145px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="ml-6 flex items-center gap-4">
                <button
                    onClick={toggleTheme}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50"
                    title={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
                >
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                <button className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50">
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
                </button>

                <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-3 py-2 text-white">
                    <div className="text-right">
                        <p className="text-sm font-bold leading-tight">{profile?.full_name || 'Utilisateur'}</p>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                            {profile?.role === 'admin' ? 'Admin RMS' : 'Yield Manager'}
                        </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-slate-900">
                        {profile?.full_name?.charAt(0) || 'U'}
                    </div>
                </div>
            </div>
        </header>
    )
}
