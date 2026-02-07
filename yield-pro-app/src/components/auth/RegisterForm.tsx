import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { UserPlus, Mail, Lock, User, Loader2 } from 'lucide-react'

export const RegisterForm: React.FC = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                }
            }
        })

        if (error) {
            setError(error.message)
        } else {
            setSuccess(true)
        }
        setLoading(false)
    }

    if (success) {
        return (
            <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-lg border text-center">
                <div className="p-3 bg-accent/10 rounded-full mb-4 inline-block">
                    <Mail className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Vérifiez vos emails</h2>
                <p className="text-muted-foreground mt-2">
                    Un lien de confirmation a été envoyé à <strong>{email}</strong>.
                </p>
                <button
                    onClick={() => window.location.href = '/login'}
                    className="mt-6 text-primary hover:underline font-medium"
                >
                    Retour à la connexion
                </button>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-lg border">
            <div className="flex flex-col items-center mb-8">
                <div className="p-3 bg-primary/10 rounded-full mb-4">
                    <UserPlus className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Inscription</h2>
                <p className="text-muted-foreground text-center mt-2">
                    Créez votre compte YieldManager Pro
                </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Nom complet</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="Jean Dupont"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="votre@email.com"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Mot de passe</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            placeholder="Minimum 6 caractères"
                            min={6}
                            required
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "S'inscrire"}
                </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
                Déjà un compte ?{' '}
                <a href="/login" className="text-primary hover:underline font-medium">
                    Se connecter
                </a>
            </p>
        </div>
    )
}
