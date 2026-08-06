-- Evangelism: capture who witnessed and when they met, and make follow-up
-- scheduling something people opt into rather than something forced on every
-- contact.

-- ---------------------------------------------------------------------------
-- 1. Attribution + when-it-happened
-- ---------------------------------------------------------------------------

ALTER TABLE public.evangelism_contacts
  -- The date the soul was actually met, which is not the date somebody got
  -- around to typing it in. All time-based reporting should key off this.
  ADD COLUMN IF NOT EXISTS met_on date,
  -- Outreach is often done in pairs. witness_id carries the primary (first
  -- named) witness; this holds whoever was alongside them.
  ADD COLUMN IF NOT EXISTS co_witness text,
  -- 'app' for anything entered in the UI, 'harvest_sheet' for imported rows.
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';

-- Existing rows: the entry date is the best estimate we have.
UPDATE public.evangelism_contacts
  SET met_on = created_at::date
  WHERE met_on IS NULL;

ALTER TABLE public.evangelism_contacts
  ALTER COLUMN met_on SET DEFAULT CURRENT_DATE;

ALTER TABLE public.evangelism_contacts
  ALTER COLUMN met_on SET NOT NULL;

CREATE INDEX IF NOT EXISTS evangelism_contacts_met_on_idx
  ON public.evangelism_contacts (met_on DESC);

-- Reporting groups heavily by these two.
CREATE INDEX IF NOT EXISTS evangelism_contacts_where_met_idx
  ON public.evangelism_contacts (lower(btrim(where_met)));

-- ---------------------------------------------------------------------------
-- 2. Members need to be able to name a witness
-- ---------------------------------------------------------------------------
-- Previously only admins could insert into witnesses, so the member-facing
-- form had no way to attribute a soul to anyone — which is why witness_id was
-- never populated. Any signed-in member may now add a witness name; update and
-- delete stay admin-only. The existing unique index on lower(name) is what
-- stops the "Evg Bri" / "Evg. Bri" sprawl at the database level.

DROP POLICY IF EXISTS "Admins insert witnesses" ON public.witnesses;

CREATE POLICY "Members add witnesses"
  ON public.witnesses FOR INSERT TO authenticated
  WITH CHECK (btrim(name) <> '');

-- ---------------------------------------------------------------------------
-- 3. Follow-ups become opt-in, with a cadence the owner chooses
-- ---------------------------------------------------------------------------
-- Before this, every contact silently got three touches on a fixed Mon/Thu
-- rhythm. Some souls need a call next week; some need one tomorrow; some need
-- none. Opting in is now a deliberate act and the cadence travels with the
-- contact.

ALTER TABLE public.evangelism_contacts
  ADD COLUMN IF NOT EXISTS follow_up_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_interval_days integer NOT NULL DEFAULT 3
    CHECK (follow_up_interval_days BETWEEN 1 AND 90),
  ADD COLUMN IF NOT EXISTS follow_up_touches integer NOT NULL DEFAULT 3
    CHECK (follow_up_touches BETWEEN 1 AND 12);

-- Anything that already has touches scheduled was opted in by the old
-- behaviour; keep those reminders working.
UPDATE public.evangelism_contacts c
  SET follow_up_opt_in = true
  WHERE EXISTS (SELECT 1 FROM public.contact_follow_ups f WHERE f.contact_id = c.id);

-- touch_number was capped at 3 by a CHECK; a chosen cadence can run longer.
ALTER TABLE public.contact_follow_ups
  DROP CONSTRAINT IF EXISTS contact_follow_ups_touch_number_check;

ALTER TABLE public.contact_follow_ups
  ADD CONSTRAINT contact_follow_ups_touch_number_check
  CHECK (touch_number BETWEEN 1 AND 12);

-- Schedule the chosen number of touches at the chosen interval, starting one
-- interval out from when the soul was met.
CREATE OR REPLACE FUNCTION public.schedule_followups_for_contact(_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  i integer;
BEGIN
  SELECT * INTO c FROM public.evangelism_contacts WHERE id = _contact_id;
  IF NOT FOUND OR NOT c.follow_up_opt_in THEN
    RETURN;
  END IF;

  -- Only ever add what's missing, so re-running is harmless.
  FOR i IN 1..c.follow_up_touches LOOP
    INSERT INTO public.contact_follow_ups (contact_id, assigned_to, due_date, touch_number)
    SELECT c.id, c.added_by, c.met_on + (c.follow_up_interval_days * i), i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contact_follow_ups f
      WHERE f.contact_id = c.id AND f.touch_number = i
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.schedule_followups_for_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_followups_for_contact(uuid) TO authenticated;

-- Replace the unconditional insert trigger.
DROP TRIGGER IF EXISTS contacts_schedule_followups ON public.evangelism_contacts;
DROP TRIGGER IF EXISTS evangelism_contacts_schedule_followups ON public.evangelism_contacts;

CREATE OR REPLACE FUNCTION public.evangelism_contacts_followup_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On insert, or when someone flips opt-in on / changes their cadence.
  IF NEW.follow_up_opt_in THEN
    PERFORM public.schedule_followups_for_contact(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER evangelism_contacts_followups
  AFTER INSERT OR UPDATE OF follow_up_opt_in, follow_up_touches, follow_up_interval_days, met_on
  ON public.evangelism_contacts
  FOR EACH ROW EXECUTE FUNCTION public.evangelism_contacts_followup_trigger();

-- Opting back out clears anything still outstanding; completed touches stay as
-- a record of the work that was done.
CREATE OR REPLACE FUNCTION public.evangelism_contacts_followup_optout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.follow_up_opt_in AND NOT NEW.follow_up_opt_in THEN
    DELETE FROM public.contact_follow_ups
      WHERE contact_id = NEW.id AND NOT completed;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER evangelism_contacts_followup_optout
  AFTER UPDATE OF follow_up_opt_in ON public.evangelism_contacts
  FOR EACH ROW EXECUTE FUNCTION public.evangelism_contacts_followup_optout();
