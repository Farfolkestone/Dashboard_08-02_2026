-- ==========================================
-- SCRIPT FINAL DE SYNCHRONISATION (SCHEMA + DONNÉES)
-- ==========================================
-- Instructions: 
-- 1. Exécutez ce script dans le SQL Editor de Supabase.
-- 2. Il va s'assurer que TOUTES les colonnes nécessaires existent
--    et portent le nom attendu par l'application.
-- ==========================================

DO $BODY$ 
BEGIN
    -- 1. Table booking_export
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_export' AND column_name='Date d''arrivée') THEN
        ALTER TABLE public.booking_export RENAME COLUMN "Date d'arrivée" TO arrival_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_export' AND column_name='Date d''achat') THEN
        ALTER TABLE public.booking_export RENAME COLUMN "Date d'achat" TO purchase_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_export' AND column_name='Montant total') THEN
        ALTER TABLE public.booking_export RENAME COLUMN "Montant total" TO total_amount;
    END IF;

    -- 2. Table booking_apercu
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_apercu' AND column_name='Date') THEN
        ALTER TABLE public.booking_apercu RENAME COLUMN "Date" TO date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_apercu' AND column_name='Votre hôtel le plus bas') THEN
        ALTER TABLE public.booking_apercu RENAME COLUMN "Votre hôtel le plus bas" TO own_price;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_apercu' AND column_name='médiane du compset') THEN
        ALTER TABLE public.booking_apercu RENAME COLUMN "médiane du compset" TO compset_median;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='booking_apercu' AND column_name='Demande du marché') THEN
        ALTER TABLE public.booking_apercu RENAME COLUMN "Demande du marché" TO market_demand;
    END IF;

    -- 3. Table events_calendar
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events_calendar' AND column_name='Début') THEN
        ALTER TABLE public.events_calendar RENAME COLUMN "Début" TO start_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events_calendar' AND column_name='Fin') THEN
        ALTER TABLE public.events_calendar RENAME COLUMN "Fin" TO end_date;
    END IF;

END $BODY$;

-- 4. Nettoyage et Indexation finale
CREATE INDEX IF NOT EXISTS idx_booking_export_final ON public.booking_export (hotel_id, arrival_date);
CREATE INDEX IF NOT EXISTS idx_booking_apercu_final ON public.booking_apercu (hotel_id, date);
CREATE INDEX IF NOT EXISTS idx_disponibilites_final ON public.disponibilites (hotel_id, date);

-- 5. S'assurer que les profils sont à jour
INSERT INTO public.user_profiles (user_id, email, full_name, role, hotel_id)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Utilisateur'), 'user', 'H2258'
FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET hotel_id = EXCLUDED.hotel_id WHERE user_profiles.hotel_id IS NULL;

ANALYZE public.booking_export;
ANALYZE public.booking_apercu;
ANALYZE public.disponibilites;
