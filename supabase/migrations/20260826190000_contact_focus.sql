-- ============================================================================
-- Focus: the handful of souls to concentrate on
-- ============================================================================
-- Eighty-four contacts is more than anyone works at once, and a list where
-- everything is equally important is a list nobody starts. Focus marks the few
-- someone is actively pursuing toward conversion, so the assigned person has a
-- short list to open rather than a long one to triage.
--
-- A plain boolean on the contact rather than a per-viewer flag: focus is a
-- decision about the soul, not a private bookmark. When leadership marks
-- someone as focus, the person following them up should see the same thing.
--
-- NOT NULL DEFAULT false so every existing row starts off-focus and nothing has
-- to be backfilled — an empty focus list is the correct starting state, since
-- it is a claim somebody has to make.
-- ============================================================================

ALTER TABLE public.evangelism_contacts
  ADD COLUMN is_focus BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.evangelism_contacts.is_focus IS
  'Primary contacts to concentrate follow-up on. Toggled from the contact list and profile.';

-- Partial: the whole point is that few rows are true, and the queries that use
-- this only ever ask for those.
CREATE INDEX evangelism_contacts_focus_idx
  ON public.evangelism_contacts (is_focus)
  WHERE is_focus;

-- No new policy. Toggling focus is an update to the contact, and the existing
-- "Owner or evangelism manager update contacts" rule is the right answer to who
-- may make that call: the person who met them, or someone who oversees
-- evangelism. The interface hides the control for anyone else so the button is
-- never offered where the database would refuse it.
