-- Align the invitation form with the paper "Host Ministry Information" sheet it
-- replaces: whatever that sheet asked for is what we must have, and anything we
-- invented on top of it becomes optional.
--
-- Two differences came out of comparing them.

-- 1. The sheet asked for APPROPRIATE APPAREL — vestments, civic attire, shirt
--    and tie, or casual — and the web form never did. It matters: the Bishop
--    asks to be briefed on "proper attire for ministry" in the courtesies, so
--    without it the desk has to chase every host by phone.
DO $$ BEGIN
  CREATE TYPE public.bishop_apparel AS ENUM ('vestments', 'civic', 'shirt_tie', 'casual', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bishop_booking_requests
  ADD COLUMN IF NOT EXISTS apparel       public.bishop_apparel,
  ADD COLUMN IF NOT EXISTS apparel_notes text;

-- 2. The sheet asked only for city, state and ZIP — never the street address.
--    Requiring it added a field without adding information the office needs at
--    request time, so it becomes optional. Existing rows keep their value.
ALTER TABLE public.bishop_booking_requests
  ALTER COLUMN church_address DROP NOT NULL;

COMMENT ON COLUMN public.bishop_booking_requests.apparel IS
  'Expected attire for the engagement, from the host ministry sheet.';
COMMENT ON COLUMN public.bishop_booking_requests.church_address IS
  'Street address. Optional — the host sheet asks only for city, state and ZIP.';
