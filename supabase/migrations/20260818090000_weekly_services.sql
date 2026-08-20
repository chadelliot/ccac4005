-- ============================================================================
-- Weekly services
-- ============================================================================
-- Sunday worship and Tuesday Bible study recur forever. Modelling them as
-- events would mean either one row per week clogging the events list until the
-- end of time, or a recurrence engine — and neither earns its keep for two
-- fixed weekly gatherings.
--
-- Instead a service is one row describing when it meets. The next occurrence is
-- computed at read time, so the invitation is always current and the events
-- page stays a list of actual events.
--
-- The virtual override lives here too. Bible study is occasionally online, and
-- the church wants to say so for one week without editing the standing
-- details. `virtual_until` holds the moment the override lapses, so nobody has
-- to remember to switch it back — it expires on its own after the service.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  -- 0 = Sunday, matching Postgres EXTRACT(DOW) and JavaScript getDay().
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,

  -- Virtual override, self-expiring.
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  virtual_note TEXT,
  virtual_link TEXT,
  virtual_until TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON COLUMN public.weekly_services.virtual_until IS
  'When the virtual override stops applying. Set to just after the affected service so it reverts without anyone remembering to.';

ALTER TABLE public.weekly_services ENABLE ROW LEVEL SECURITY;

-- Public: these are the church's service times, already printed on the
-- homepage footer. Nothing here is private.
CREATE POLICY "Anyone views active weekly services" ON public.weekly_services
  FOR SELECT TO anon, authenticated
  USING (is_active);

-- Managed by the same admins who review events: this is the same kind of
-- decision as approving what the public sees on the events page.
CREATE POLICY "Event reviewers manage weekly services" ON public.weekly_services
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'events_review'))
  WITH CHECK (public.has_capability(auth.uid(), 'events_review'));

GRANT SELECT ON public.weekly_services TO anon, authenticated;
GRANT ALL ON public.weekly_services TO service_role;

-- The church's two standing gatherings.
INSERT INTO public.weekly_services (title, description, day_of_week, start_time, location, sort_order)
VALUES
  ('Sunday Worship',
   'Worship with us every Sunday, followed by discipleship class. Everyone is welcome — come as you are.',
   0, '13:00', '4005 Old York Rd, Baltimore, MD', 1),
  ('Bible Study',
   'Midweek Bible study — a closer look at the Word together. All are welcome.',
   2, '19:00', '4005 Old York Rd, Baltimore, MD', 2)
ON CONFLICT DO NOTHING;
