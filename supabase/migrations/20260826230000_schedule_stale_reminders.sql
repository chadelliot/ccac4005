-- ============================================================================
-- Run the reminder every morning
-- ============================================================================
-- 13:00 UTC is 9am Eastern through the summer and 8am in winter. Early enough
-- that the reminder is waiting when someone opens the app, late enough that it
-- is not sitting in a notification list overnight.
--
-- Idempotent: unschedule first so re-running this migration, or changing the
-- time later, cannot leave two jobs firing the same function twice a day.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('stale-contact-reminders');
EXCEPTION
  WHEN OTHERS THEN NULL;  -- not scheduled yet, which is the normal first run
END;
$$;

SELECT cron.schedule(
  'stale-contact-reminders',
  '0 13 * * *',
  $job$SELECT public.create_stale_contact_reminders();$job$
);
