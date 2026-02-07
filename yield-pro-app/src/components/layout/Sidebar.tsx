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
    ChevronRight
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
        { icon: TrendingUp, label: 'Analyses Yield', path: '/yield' },
        { icon: History, label: 'Historique', path: '/history' },
        { icon: Settings, label: 'Paramètres', path: '/settings' },
    ]

    const isAdmin = profile?.role === 'admin'

    return (
        <div className={`h-screen flex flex-col bg-slate-900 border-r border-white/10 transition-all duration-300 text-slate-300 shadow-2xl ${collapsed ? 'w-20' : 'w-64'}`}>
            <div className="p-6 flex items-center justify-between border-b border-white/10 bg-slate-950">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary rounded-lg text-primary-foreground shadow-lg shadow-primary/20">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="font-black text-xl tracking-tighter text-white">YieldPro</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 ml-auto transition-colors"
                >
                    {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            <nav className="flex-grow p-4 space-y-2 mt-4">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`} />
                            {!collapsed && <span className="font-bold tracking-tight text-sm">{item.label}</span>}
                        </Link>
                    )
                })}

                {isAdmin && (
                    <Link
                        to="/admin"
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mt-8 group ${location.pathname === '/admin'
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                            : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-500'
                            }`}
                    >
                        <ShieldCheck className="w-5 h-5 flex-shrink-0 group-hover:rotate-12 transition-transform" />
                        {!collapsed && <span className="font-bold tracking-tight text-sm">Strategic Admin</span>}
                    </Link>
                )}
            </nav>

            <div className="p-4 border-t border-white/10 mt-auto bg-slate-950/50">
                {!collapsed && (
                    <div className="mb-4 px-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Authenticated User</p>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white uppercase">
                                {profile?.full_name?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate leading-tight">{profile?.full_name || 'Utilisateur'}</p>
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">{profile?.email}</p>
                            </div>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:bg-white/5 hover:text-rose-400 rounded-lg transition-all group"
                >
                    <LogOut className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                    {!collapsed && <span className="font-bold tracking-tight text-sm">Sign Out</span>}
                </button>
            </div>
        </div>
    )
}
