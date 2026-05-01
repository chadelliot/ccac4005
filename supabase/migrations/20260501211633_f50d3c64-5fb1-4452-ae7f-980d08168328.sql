-- Guest RSVP table for non-members
CREATE TABLE public.event_guest_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  response TEXT NOT NULL DEFAULT 'going',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_guest_rsvps_event ON public.event_guest_rsvps(event_id);

ALTER TABLE public.event_guest_rsvps ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can RSVP to an event that is approved + public
CREATE POLICY "Anyone can RSVP to public approved events"
ON public.event_guest_rsvps
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_guest_rsvps.event_id
      AND e.status = 'approved'
      AND e.is_public = true
  )
);

-- Only admins/leaders can view guest RSVPs
CREATE POLICY "Admins and leaders view guest rsvps"
ON public.event_guest_rsvps
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'leader'::app_role));
