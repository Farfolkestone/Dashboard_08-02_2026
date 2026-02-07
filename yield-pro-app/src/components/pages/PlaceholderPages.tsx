import React from 'react'
import { CompetitorAnalysis } from '../pricing/CompetitorAnalysis'

const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
    <div className="space-y-6">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground">Cette page est en cours de développement.</p>
        </div>
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-muted/30">
                <h3 className="font-bold">Contenu à venir</h3>
            </div>
            <div className="p-6">
                <div className="h-[400px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-muted-foreground italic">L'interface de {title.toLowerCase()} sera disponible prochainement.</p>
                </div>
            </div>
        </div>
    </div>
)

export const GridPage = () => <PlaceholderPage title="Grille Tarifaire" />
export const CompetitorsPage = () => <CompetitorAnalysis />
export const YieldAnalysisPage = () => <PlaceholderPage title="Analyses Yield" />
export const HistoryPage = () => <PlaceholderPage title="Historique" />
export const SettingsPage = () => <PlaceholderPage title="Paramètres" />
