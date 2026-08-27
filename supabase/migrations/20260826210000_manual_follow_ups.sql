-- ============================================================================
-- Follow-ups become a decision, not a schedule
-- ============================================================================
-- Every contact was given three touches automatically, on a fixed interval,
-- whether or not anyone intended to make them. A queue that fills itself is a
-- queue people stop reading: by the time it holds two hundred rows nobody
-- generated on purpose, the one that mattered is indistinguishable from the
-- rest.
--
-- From here a follow-up is created deliberately — usually from a note, so it
-- arrives with the reason attached. Fewer rows, each one meaning somebody
-- actually committed to something.
--
-- Nothing is deleted. The table currently holds zero rows, so there is no
-- existing commitment to lose, and the columns that drove the schedule stay on
-- the contact rather than being dropped — they are history of how a record was
-- created, and removing them buys nothing.
-- ============================================================================

DROP TRIGGER IF EXISTS evangelism_contacts_followups ON public.evangelism_contacts;
DROP TRIGGER IF EXISTS evangelism_contacts_followup_optout ON public.evangelism_contacts;

DROP FUNCTION IF EXISTS public.evangelism_contacts_followup_trigger();
DROP FUNCTION IF EXISTS public.evangelism_contacts_followup_optout();

COMMENT ON COLUMN public.evangelism_contacts.follow_up_opt_in IS
  'Historic. Follow-ups are created by hand now; nothing reads this to schedule anything.';

-- touch_number stays NOT NULL because the column is, but it no longer counts
-- toward a mandate of three. A manual follow-up simply continues the numbering
-- for that soul, so the ordering of successive commitments is still readable.
COMMENT ON COLUMN public.contact_follow_ups.touch_number IS
  'Sequence of follow-ups for this contact. No longer capped at three.';
