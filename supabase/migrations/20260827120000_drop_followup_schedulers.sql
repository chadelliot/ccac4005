-- ============================================================================
-- Remove what is left of the three-touch scheduler
-- ============================================================================
-- Dropping the triggers stopped the schedule from firing, but the functions
-- behind them survived: schedule_initial_followups and
-- schedule_followups_for_contact.
--
-- Dormant is not the same as gone. The second one is in the generated client
-- types, which means PostgREST exposes it as an RPC — any signed-in browser
-- could call it and conjure three touches per contact back into a queue we
-- deliberately emptied. Nothing in the app or in any other function calls
-- either one, so they go.
-- ============================================================================

DROP FUNCTION IF EXISTS public.schedule_initial_followups() CASCADE;
DROP FUNCTION IF EXISTS public.schedule_followups_for_contact(UUID) CASCADE;
