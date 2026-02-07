export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            hotels: {
                Row: {
                    id: string
                    hotel_id: string
                    code: string
                    name: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    hotel_id: string
                    code: string
                    name?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string
                    code?: string
                    name?: string | null
                    created_at?: string | null
                }
            }
            booking_apercu: {
                Row: {
                    id: string
                    hotel_id: string | null
                    date_mise_a_jour: string | null
                    Jour: string | null
                    Date: string | null
                    "Votre hôtel le plus bas": number | null
                    "Tarif le plus bas": number | null
                    "médiane du compset": number | null
                    "Classement des tarifs du compset": string | null
                    "Demande du marché": number | null
                    "Booking.com Classement": string | null
                    "Jours fériés": string | null
                    "Événements": string | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    date_mise_a_jour?: string | null
                    Jour?: string | null
                    Date?: string | null
                    "Votre hôtel le plus bas"?: number | null
                    "Tarif le plus bas"?: number | null
                    "médiane du compset"?: number | null
                    "Classement des tarifs du compset"?: string | null
                    "Demande du marché"?: number | null
                    "Booking.com Classement"?: string | null
                    "Jours fériés"?: string | null
                    "Événements"?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    date_mise_a_jour?: string | null
                    Jour?: string | null
                    Date?: string | null
                    "Votre hôtel le plus bas"?: number | null
                    "Tarif le plus bas"?: number | null
                    "médiane du compset"?: number | null
                    "Classement des tarifs du compset"?: string | null
                    "Demande du marché"?: number | null
                    "Booking.com Classement"?: string | null
                    "Jours fériés"?: string | null
                    "Événements"?: string | null
                }
            }
            booking_export: {
                Row: {
                    id: string
                    hotel_id: string | null
                    Etat: string | null
                    Référence: string | null
                    "Date d'arrivée": string | null
                    "Date de départ": string | null
                    "Date d'achat": string | null
                    "Type de chambre": string | null
                    "Montant total": number | null
                    Nuits: number | null
                    Chambres: number | null
                    Adultes: number | null
                    Enfants: number | null
                    Pays: string | null
                    Origine: string | null
                    "Type d'origine": string | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    Etat?: string | null
                    Référence?: string | null
                    "Date d'arrivée"?: string | null
                    "Date de départ"?: string | null
                    "Date d'achat"?: string | null
                    "Type de chambre"?: string | null
                    "Montant total"?: number | null
                    Nuits?: number | null
                    Chambres?: number | null
                    Adultes?: number | null
                    Enfants?: number | null
                    Pays?: string | null
                    Origine?: string | null
                    "Type d'origine"?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    Etat?: string | null
                    Référence?: string | null
                    "Date d'arrivée"?: string | null
                    "Date de départ"?: string | null
                    "Date d'achat"?: string | null
                    "Type de chambre"?: string | null
                    "Montant total"?: number | null
                    Nuits?: number | null
                    Chambres?: number | null
                    Adultes?: number | null
                    Enfants?: number | null
                    Pays?: string | null
                    Origine?: string | null
                    "Type d'origine"?: string | null
                }
            }
            booking_tarifs: {
                Row: {
                    id: string
                    hotel_id: string | null
                    date_mise_a_jour: string | null
                    Jour: string | null
                    Date: string | null
                    "Demande du marché": number | null
                    "Folkestone Opéra": number | null
                    "Hôtel Madeleine Haussmann": number | null
                    "Hôtel De l'Arcade": number | null
                    "Hôtel Cordelia Opéra-Madeleine": number | null
                    "Queen Mary Opera": number | null
                    "Hôtel du Triangle d'Or": number | null
                    "Best Western Plus Hotel Sydney Opera": number | null
                    "Hotel Opéra Opal": number | null
                    "Hôtel Royal Opéra": number | null
                    "Hotel George Sand Opéra Paris": number | null
                    "Hotel Chavanel": number | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    date_mise_a_jour?: string | null
                    Jour?: string | null
                    Date?: string | null
                    "Demande du marché"?: number | null
                    "Folkestone Opéra"?: number | null
                    "Hôtel Madeleine Haussmann"?: number | null
                    "Hôtel De l'Arcade"?: number | null
                    "Hôtel Cordelia Opéra-Madeleine"?: number | null
                    "Queen Mary Opera"?: number | null
                    "Hôtel du Triangle d'Or"?: number | null
                    "Best Western Plus Hotel Sydney Opera"?: number | null
                    "Hotel Opéra Opal"?: number | null
                    "Hôtel Royal Opéra"?: number | null
                    "Hotel George Sand Opéra Paris"?: number | null
                    "Hotel Chavanel"?: number | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    date_mise_a_jour?: string | null
                    Jour?: string | null
                    Date?: string | null
                    "Demande du marché"?: number | null
                    "Folkestone Opéra"?: number | null
                    "Hôtel Madeleine Haussmann"?: number | null
                    "Hôtel De l'Arcade"?: number | null
                    "Hôtel Cordelia Opéra-Madeleine"?: number | null
                    "Queen Mary Opera"?: number | null
                    "Hôtel du Triangle d'Or"?: number | null
                    "Best Western Plus Hotel Sydney Opera"?: number | null
                    "Hotel Opéra Opal"?: number | null
                    "Hôtel Royal Opéra"?: number | null
                    "Hotel George Sand Opéra Paris"?: number | null
                    "Hotel Chavanel"?: number | null
                }
            }
            disponibilites: {
                Row: {
                    id: string
                    hotel_id: string | null
                    date: string
                    type_de_chambre: string | null
                    disponibilites: number | null
                    ferme_a_la_vente: string | null
                    date_mise_a_jour: string | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    date: string
                    type_de_chambre?: string | null
                    disponibilites?: number | null
                    ferme_a_la_vente?: string | null
                    date_mise_a_jour?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    date?: string
                    type_de_chambre?: string | null
                    disponibilites?: number | null
                    ferme_a_la_vente?: string | null
                    date_mise_a_jour?: string | null
                }
            }
            events_calendar: {
                Row: {
                    id: string
                    hotel_id: string | null
                    "Événement": string | null
                    "Début": string | null
                    "Fin": string | null
                    "Indice impact attendu sur la demande /10": number | null
                    "Multiplicateur": number | null
                    "Pourquoi cet indice": string | null
                    "Conseils yield": string | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    "Événement"?: string | null
                    "Début"?: string | null
                    "Fin"?: string | null
                    "Indice impact attendu sur la demande /10"?: number | null
                    "Multiplicateur"?: number | null
                    "Pourquoi cet indice"?: string | null
                    "Conseils yield"?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    "Événement"?: string | null
                    "Début"?: string | null
                    "Fin"?: string | null
                    "Indice impact attendu sur la demande /10"?: number | null
                    "Multiplicateur"?: number | null
                    "Pourquoi cet indice"?: string | null
                    "Conseils yield"?: string | null
                }
            }
            planning_tarifs: {
                Row: {
                    id: string
                    hotel_id: string | null
                    date: string
                    type_de_chambre: string | null
                    plan_tarifaire: string | null
                    tarif: number | null
                    date_mise_a_jour: string | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    date: string
                    type_de_chambre?: string | null
                    plan_tarifaire?: string | null
                    tarif?: number | null
                    date_mise_a_jour?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    date?: string
                    type_de_chambre?: string | null
                    plan_tarifaire?: string | null
                    tarif?: number | null
                    date_mise_a_jour?: string | null
                }
            }
            hotels_concurrents: {
                Row: {
                    id: string
                    hotel_id: string | null
                    competitor_name: string | null
                    source: string | null
                    display_order: number | null
                    is_active: boolean | null
                    last_seen_at: string | null
                }
                Insert: {
                    id?: string
                    hotel_id?: string | null
                    competitor_name?: string | null
                    source?: string | null
                    display_order?: number | null
                    is_active?: boolean | null
                    last_seen_at?: string | null
                }
                Update: {
                    id?: string
                    hotel_id?: string | null
                    competitor_name?: string | null
                    source?: string | null
                    display_order?: number | null
                    is_active?: boolean | null
                    last_seen_at?: string | null
                }
            }
            user_profiles: {
                Row: {
                    id: string
                    user_id: string
                    email: string | null
                    full_name: string | null
                    role: 'user' | 'admin'
                    hotel_id: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    email?: string | null
                    full_name?: string | null
                    role?: 'user' | 'admin'
                    hotel_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    email?: string | null
                    full_name?: string | null
                    role?: 'user' | 'admin'
                    hotel_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            dashboard_config: {
                Row: {
                    id: string
                    user_id: string
                    widgets: Json
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    widgets?: Json
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    widgets?: Json
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            user_role: 'user' | 'admin'
        }
    }
}
