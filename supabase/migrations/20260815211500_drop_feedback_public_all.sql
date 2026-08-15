-- Guest dish feedback writes go only through Next.js admin (service_role) API.
-- Remove legacy anon/public ALL policies that allowed PostgREST bypass.
DROP POLICY IF EXISTS dish_feedback_public_all ON public.dish_feedback;
DROP POLICY IF EXISTS "dish_feedback_public_all" ON public.dish_feedback;
DROP POLICY IF EXISTS feedback_sessions_public_all ON public.feedback_sessions;
DROP POLICY IF EXISTS "feedback_sessions_public_all" ON public.feedback_sessions;
