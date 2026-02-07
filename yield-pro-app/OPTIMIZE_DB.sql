-- ==========================================
-- SCRIPT D'OPTIMISATION DES PERFORMANCES (INDEXATION)
-- ==========================================
-- Ce script ajoute des index sur les colonnes fréquemment filtrées
-- pour accélérer le chargement du Dashboard (RevPAR, Occupancy, etc.)
-- ==========================================

-- 1. Index pour booking_export (Le plus lourd)
CREATE INDEX IF NOT EXISTS idx_booking_export_hotel_date 
ON public.booking_export (hotel_id, "Date d'arrivée");

CREATE INDEX IF NOT EXISTS idx_booking_export_achat 
ON public.booking_export ("Date d'achat");

-- 2. Index pour booking_apercu (Graphiques et Medianes)
CREATE INDEX IF NOT EXISTS idx_booking_apercu_hotel_date 
ON public.booking_apercu (hotel_id, "Date");

-- 3. Index pour disponibilites (Calcul Occupancy)
CREATE INDEX IF NOT EXISTS idx_disponibilites_hotel_date 
ON public.disponibilites (hotel_id, "date");

-- 4. Index pour events_calendar
CREATE INDEX IF NOT EXISTS idx_events_hotel_dates 
ON public.events_calendar (hotel_id, "Début", "Fin");

-- 5. Index pour planning_tarifs
CREATE INDEX IF NOT EXISTS idx_planning_hotel_date 
ON public.planning_tarifs (hotel_id, "date");

-- 6. Index pour dashboard_config & user_profiles (Auth)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_config_user_id ON public.dashboard_config (user_id);

-- Analyse des tables pour mettre à jour les statistiques de l'optimiseur
ANALYZE public.booking_export;
ANALYZE public.booking_apercu;
ANALYZE public.disponibilites;
ANALYZE public.user_profiles;
ANALYZE public.dashboard_config;
