import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
    Users,
    Shield,
    Settings,
    Activity,
    UserCheck,
    UserX,
    Hotel
} from 'lucide-react'
import type { Database } from '../../types/database.types'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type HotelRow = Database['public']['Tables']['hotels']['Row']

export const AdminPanel: React.FC = () => {
    const { data: users, isLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async (): Promise<UserProfile[]> => {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            return (data ?? []) as UserProfile[]
        }
    })

    const { data: hotels } = useQuery({
        queryKey: ['admin-hotels'],
        queryFn: async (): Promise<HotelRow[]> => {
            const { data, error } = await supabase
                .from('hotels')
                .select('*')
            if (error) throw error
            return (data ?? []) as HotelRow[]
        }
    })

    if (isLoading) return <div className="animate-pulse">Chargement des données admin...</div>

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Panel Administrateur</h2>
                <p className="text-muted-foreground">Gestion globale des utilisateurs et des accès hôtels.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground uppercase font-semibold">Utilisateurs</p>
                            <p className="text-2xl font-bold">{users?.length || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-secondary/10 rounded-lg text-secondary-foreground">
                            <Hotel className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground uppercase font-semibold">Hôtels</p>
                            <p className="text-2xl font-bold">{hotels?.length || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-accent/10 rounded-lg text-accent">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground uppercase font-semibold">Statut Système</p>
                            <p className="text-2xl font-bold">Opérationnel</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-bold">Gestion des Utilisateurs</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-card bg-opacity-50">
                        <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground font-bold">
                            <tr>
                                <th className="px-6 py-4">Utilisateur</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Rôle</th>
                                <th className="px-6 py-4">Hôtel ID</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users?.map((user) => (
                                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                                                {user.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <span className="font-medium">{user.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-rose-500/10 text-rose-600' : 'bg-blue-500/10 text-blue-600'
                                            }`}>
                                            {user.role === 'admin' ? <Shield className="w-3 h-3" /> : null}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{user.hotel_id || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 hover:bg-muted rounded text-muted-foreground" title="Désactiver">
                                                <UserX className="w-4 h-4" />
                                            </button>
                                            <button className="p-1.5 hover:bg-muted rounded text-primary" title="Promouvoir">
                                                <UserCheck className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
