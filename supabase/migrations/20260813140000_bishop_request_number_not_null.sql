-- request_number is assigned by assign_bishop_request_number(), a BEFORE INSERT
-- trigger, so a row can never legitimately reach the table without one. Leaving
-- the column nullable made the generated types say `string | null`, which then
-- has to be defended against in every screen that quotes a reference number —
-- guarding against a state the trigger already makes impossible.
--
-- BEFORE ROW triggers run ahead of constraint checking, so the trigger still
-- populates the value before NOT NULL is evaluated.

UPDATE public.bishop_booking_requests
SET request_number =
  'BE-' || to_char(created_at AT TIME ZONE 'America/New_York', 'YYYY') || '-' ||
  lpad(nextval('public.bishop_booking_request_seq')::text, 4, '0')
WHERE request_number IS NULL;

ALTER TABLE public.bishop_booking_requests
  ALTER COLUMN request_number SET NOT NULL;
