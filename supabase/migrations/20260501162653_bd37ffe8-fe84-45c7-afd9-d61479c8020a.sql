
-- EVENTS TABLE
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  flyer_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  rejection_reason TEXT,
  submitted_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Approved + public events viewable by anyone (including anon)
CREATE POLICY "Public can view approved public events"
ON public.events FOR SELECT
TO anon, authenticated
USING (status = 'approved' AND is_public = true);

-- Signed-in users can view all approved events
CREATE POLICY "Members view approved events"
ON public.events FOR SELECT
TO authenticated
USING (status = 'approved');

-- Submitters can view their own events (any status)
CREATE POLICY "Submitter views own events"
ON public.events FOR SELECT
TO authenticated
USING (submitted_by = auth.uid());

-- Admins view all
CREATE POLICY "Admins view all events"
ON public.events FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Members submit events (always as themselves, status pending enforced in app + check)
CREATE POLICY "Members submit events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (submitted_by = auth.uid());

-- Submitter can update only while pending; admin can update any
CREATE POLICY "Submitter updates pending; admin updates any"
ON public.events FOR UPDATE
TO authenticated
USING (
  (submitted_by = auth.uid() AND status = 'pending')
  OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
  (submitted_by = auth.uid() AND status = 'pending')
  OR has_role(auth.uid(), 'admin')
);

-- Submitter or admin can delete
CREATE POLICY "Submitter or admin delete events"
ON public.events FOR DELETE
TO authenticated
USING (submitted_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_events_status_start ON public.events(status, start_at);
CREATE INDEX idx_events_submitted_by ON public.events(submitted_by);

-- RSVPs
CREATE TABLE public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  response TEXT NOT NULL DEFAULT 'going', -- going | maybe | not_going
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rsvps"
ON public.event_rsvps FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'leader'));

CREATE POLICY "Users insert own rsvps"
ON public.event_rsvps FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own rsvps"
ON public.event_rsvps FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own rsvps"
ON public.event_rsvps FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_event_rsvps_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STORAGE BUCKET for flyers (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-flyers', 'event-flyers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Flyers publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-flyers');

CREATE POLICY "Authenticated users upload flyers to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-flyers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own flyers; admin any"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-flyers'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users delete own flyers; admin any"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-flyers'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
);

-- Notification fan-out on approval
CREATE OR REPLACE FUNCTION public.notify_members_on_event_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT
      p.id,
      'New event: ' || NEW.title,
      COALESCE(to_char(NEW.start_at AT TIME ZONE 'UTC', 'Mon DD, YYYY HH24:MI') || ' • ', '') || COALESCE(NEW.location, ''),
      '/dashboard/events/' || NEW.id::text
    FROM public.profiles p;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_members_on_event_approval
AFTER UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_members_on_event_approval();
