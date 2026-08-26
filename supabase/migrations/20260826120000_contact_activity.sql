-- ============================================================================
-- A record of who reached out, and when
-- ============================================================================
-- Text, Call and Invite hand the work to the member's own phone, which means
-- the site has no delivery receipt to show for any of it. What it can honestly
-- record is the moment someone pressed the button: who pressed it, on which
-- contact, on what date, and — for an invite — which event they sent.
--
-- That is deliberately weaker than "a text was sent", and the wording in the UI
-- says so. Someone can press Text and then change their mind in Messages. The
-- log is a record of outreach attempted, which is what a follow-up conversation
-- actually needs: "has anyone reached out to this man since Saturday?"
--
-- This is not a follow-up completion. Pressing Text still does not tick a touch
-- off the follow-up schedule — a call that went to voicemail is not a follow-up
-- made, and that judgment stays with the person who made the call.
-- ============================================================================

CREATE TYPE public.contact_activity_kind AS ENUM ('text', 'call', 'invite');

CREATE TABLE public.contact_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.evangelism_contacts(id) ON DELETE CASCADE,

  -- References profiles rather than auth.users so the actor's name can be
  -- embedded in one request. Left nullable and ON DELETE SET NULL: if an
  -- account is ever removed, the outreach still happened and the history
  -- should not vanish with the person who did it.
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  kind public.contact_activity_kind NOT NULL,

  -- Invite only. The title is snapshotted alongside the id because an event
  -- can be renamed or deleted, and "invited to The Gathering" must keep saying
  -- what was actually sent that day.
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT contact_activity_invite_has_event
    CHECK (kind <> 'invite' OR event_title IS NOT NULL)
);

CREATE INDEX contact_activity_contact_idx
  ON public.contact_activity (contact_id, created_at DESC);

ALTER TABLE public.contact_activity ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Visibility follows the contact
-- ----------------------------------------------------------------------------
-- You may read the activity on a contact exactly when you may read the contact
-- itself. The EXISTS below is evaluated as the calling user, so the existing
-- policy on evangelism_contacts — owner, witness, leader, or evangelism
-- manager — decides this too. Restating that four-part rule here would have
-- given us two copies to keep in step, and the copy that drifts is the one
-- that leaks.
CREATE POLICY "Activity visible with its contact" ON public.contact_activity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evangelism_contacts c
      WHERE c.id = contact_activity.contact_id
    )
  );

-- Same rule for writing, plus: you log your own actions and nobody else's.
CREATE POLICY "Log your own outreach" ON public.contact_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.evangelism_contacts c
      WHERE c.id = contact_activity.contact_id
    )
  );

-- No UPDATE or DELETE policy, by omission and on purpose. A log that can be
-- quietly rewritten is not a log. Removing a contact still clears their
-- history through the cascade above, which is the one deletion that should
-- take the activity with it.

GRANT SELECT, INSERT ON public.contact_activity TO authenticated;
