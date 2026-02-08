import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Table,
    BarChart3,
    History,
    Settings,
    LogOut,
    TrendingUp,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Workflow,
    CalendarDays,
    Calculator,
    BookOpen,
    Lock
} from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'

export const Sidebar: React.FC = () => {
    const location = useLocation()
    const { profile, signOut } = useAuthStore()
    const [collapsed, setCollapsed] = React.useState(false)

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Table, label: 'Grille Tarifaire', path: '/grid' },
        { icon: BarChart3, label: 'Concurrence', path: '/competitors' },
        { icon: Workflow, label: 'Analyses Yield', path: '/yield' },
        { icon: CalendarDays, label: 'Calendrier Arrivées', path: '/calendar-arrivals' },
        { icon: Lock, label: 'Mes indisponibilités', path: '/mes-indisponibilites' },
        { icon: Calculator, label: 'Simulateur', path: '/reservation-simulator' },
        { icon: BookOpen, label: 'Aide Générale', path: '/help-general', highlight: true },
        { icon: BookOpen, label: 'Aide Calibrage', path: '/help-calibrage', highlight: true },
        { icon: History, label: 'Historique', path: '/history' },
        { icon: Settings, label: 'Studio RMS', path: '/settings' },
    ]

    const isAdmin = profile?.role === 'admin'

    return (
        <aside className={`h-screen flex flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}>
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
                {!collapsed && (
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-900 p-2 text-white">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-lg font-black tracking-tight text-slate-900">YieldPro</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Revenue OS</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </div>

            <nav className="flex-1 space-y-2 p-4">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${isActive
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                : item.highlight
                                    ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span className="text-sm font-bold tracking-tight">{item.label}</span>}
                        </Link>
                    )
                })}

                {isAdmin && (
                    <Link
                        to="/admin"
                        className={`mt-6 flex items-center gap-3 rounded-xl px-3 py-3 transition ${location.pathname === '/admin'
                            ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/25'
                            : 'text-rose-600 hover:bg-rose-50'
                            }`}
                    >
                        <ShieldCheck className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="text-sm font-bold tracking-tight">Admin</span>}
                    </Link>
                )}
            </nav>

            <div className="border-t border-slate-200 p-4">
                {!collapsed && (
                    <div className="mb-4 rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-black text-slate-900">{profile?.full_name || 'Utilisateur'}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{profile?.email}</p>
                    </div>
                )}
                <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-rose-600"
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="text-sm font-bold">Déconnexion</span>}
                </button>
            </div>
        </aside>
    )
}
