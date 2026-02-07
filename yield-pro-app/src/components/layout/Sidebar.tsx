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
        <div className={`h-screen flex flex-col bg-card border-r transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
            <div className="p-6 flex items-center justify-between border-b">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-xl tracking-tight">YieldPro</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 hover:bg-muted rounded-md text-muted-foreground ml-auto"
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
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span className="font-medium">{item.label}</span>}
                        </Link>
                    )
                })}

                {isAdmin && (
                    <Link
                        to="/admin"
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mt-8 ${location.pathname === '/admin'
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : 'text-muted-foreground hover:bg-destructive/5 hover:text-destructive'
                            }`}
                    >
                        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && <span className="font-medium">Admin Panel</span>}
                    </Link>
                )}
            </nav>

            <div className="p-4 border-t mt-auto">
                {!collapsed && (
                    <div className="mb-4 px-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Utilisateur</p>
                        <p className="text-sm font-medium truncate">{profile?.full_name || 'Utilisateur'}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                    </div>
                )}
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">Déconnexion</span>}
                </button>
            </div>
        </div>
    )
}
