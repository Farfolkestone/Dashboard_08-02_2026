-- ==========================================
-- SCRIPT DE CORRECTION ERREUR 500 & PREFERENCES
-- ==========================================
-- Instructions:
-- 1. Copiez tout ce contenu (Ctrl+A, Ctrl+C)
-- 2. Allez dans Supabase > SQL Editor
-- 3. Collez et cliquez sur 'Run'
-- ==========================================

-- 1. Nettoyage des anciennes fonctions conflictuelles
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_is_admin() CASCADE;

-- 2. Types personnalisés (ignore si existe déjà)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tables (si elles n'existent pas)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    role public.user_role DEFAULT 'user',
    hotel_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.dashboard_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    widgets jsonb NOT NULL DEFAULT '{"revenue": true, "occupancy": true, "pickup": true, "adr": true, "competitors": true, "market": true, "yieldRecommendations": true}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- 4. Fonction de Sécurité (CORRECTIF BOUCLE INFINIE)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $BODY$
BEGIN
  -- Utilise SECURITY DEFINER pour contourner la RLS et éviter la récursion
  RETURN (
    SELECT (role = 'admin')
    FROM public.user_profiles
    WHERE user_id = auth.uid()
  );
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Activation RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

-- 6. Politiques RLS (Réinitialisation complète)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id OR public.check_is_admin());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id OR public.check_is_admin());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles; -- Ancienne politique coupable

DROP POLICY IF EXISTS "Users can view their own config" ON public.dashboard_config;
CREATE POLICY "Users can view their own config" ON public.dashboard_config FOR SELECT
    USING (auth.uid() = user_id OR public.check_is_admin());

DROP POLICY IF EXISTS "Users can update their own config" ON public.dashboard_config;
CREATE POLICY "Users can update their own config" ON public.dashboard_config FOR UPDATE
    USING (auth.uid() = user_id OR public.check_is_admin());

-- 7. Trigger création utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $BODY$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, full_name, role)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New User'), 
        'user'
    );
    INSERT INTO public.dashboard_config (user_id) VALUES (new.id);
    RETURN new;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Mise en place du Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Correction rétroactive des comptes existants
INSERT INTO public.user_profiles (user_id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'User ' || id), 'user'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.dashboard_config (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
