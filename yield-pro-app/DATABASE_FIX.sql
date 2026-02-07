-- ==========================================
-- SCRIPT DE STABILISATION (DATABASE CONFIG + MISSING TABLES)
-- ==========================================

-- 1. Table de configuration du Dashboard
CREATE TABLE IF NOT EXISTS public.dashboard_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    widgets JSONB DEFAULT '{
        "revenue": true,
        "occupancy": true,
        "pickup": true,
        "adr": true,
        "competitors": true,
        "market": true,
        "yieldRecommendations": true
    }'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Active RLS on dashboard_config
ALTER TABLE public.dashboard_config ENABLE ROW LEVEL SECURITY;

-- Allow users to see and update their own config
DROP POLICY IF EXISTS "Users can view their own dashboard config" ON public.dashboard_config;
CREATE POLICY "Users can view their own dashboard config" ON public.dashboard_config
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own dashboard config" ON public.dashboard_config;
CREATE POLICY "Users can update their own dashboard config" ON public.dashboard_config
    FOR ALL USING (auth.uid() = user_id);

-- 2. Ensure hotels table has the default hotel
INSERT INTO public.hotels (hotel_id, name, code)
VALUES ('H2258', 'Hôtel Démo', 'DEMO')
ON CONFLICT (hotel_id) DO NOTHING;

-- 3. Vue simplifiée pour debug si nécessaire
CREATE OR REPLACE VIEW public.booking_stats AS
SELECT 
    hotel_id,
    arrival_date,
    COUNT(*) as total_bookings,
    SUM(total_amount) as total_revenue
FROM public.booking_export
GROUP BY hotel_id, arrival_date;

GRANT SELECT ON public.booking_stats TO authenticated;
GRANT SELECT ON public.booking_stats TO anon;
GRANT SELECT ON public.dashboard_config TO authenticated;
GRANT SELECT ON public.dashboard_config TO anon;
