-- Add geocoding columns
ALTER TABLE public.evangelism_contacts
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_evangelism_contacts_latlng
  ON public.evangelism_contacts (latitude, longitude);

-- Clear geocoding when address/where_met changes so it re-geocodes
CREATE OR REPLACE FUNCTION public.evangelism_contacts_clear_geo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.address IS DISTINCT FROM OLD.address)
       OR (NEW.where_met IS DISTINCT FROM OLD.where_met) THEN
      NEW.latitude := NULL;
      NEW.longitude := NULL;
      NEW.city := NULL;
      NEW.region := NULL;
      NEW.country := NULL;
      NEW.geocoded_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evangelism_contacts_clear_geo_trg ON public.evangelism_contacts;
CREATE TRIGGER evangelism_contacts_clear_geo_trg
BEFORE UPDATE ON public.evangelism_contacts
FOR EACH ROW EXECUTE FUNCTION public.evangelism_contacts_clear_geo();

-- Cascade delete follow-ups when a contact is deleted
-- contact_follow_ups.contact_id has no FK; add one with ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contact_follow_ups_contact_id_fkey'
  ) THEN
    ALTER TABLE public.contact_follow_ups
      ADD CONSTRAINT contact_follow_ups_contact_id_fkey
      FOREIGN KEY (contact_id)
      REFERENCES public.evangelism_contacts(id)
      ON DELETE CASCADE;
  END IF;
END $$;