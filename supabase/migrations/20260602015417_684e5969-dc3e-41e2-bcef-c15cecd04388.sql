
-- Witnesses: people who ministered to souls. Optionally linked to a user once they sign up.
CREATE TABLE public.witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  linked_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX witnesses_name_lower_idx ON public.witnesses (lower(name));
CREATE INDEX witnesses_linked_user_idx ON public.witnesses (linked_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.witnesses TO authenticated;
GRANT ALL ON public.witnesses TO service_role;

ALTER TABLE public.witnesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view witnesses"
  ON public.witnesses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert witnesses"
  ON public.witnesses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update witnesses"
  ON public.witnesses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete witnesses"
  ON public.witnesses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER witnesses_updated_at BEFORE UPDATE ON public.witnesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add witness_id to evangelism_contacts (primary witness for credit)
ALTER TABLE public.evangelism_contacts
  ADD COLUMN witness_id uuid REFERENCES public.witnesses(id) ON DELETE SET NULL;

CREATE INDEX evangelism_contacts_witness_idx ON public.evangelism_contacts (witness_id);

-- Update SELECT policy so members can see contacts they were credited for (via witness link)
DROP POLICY IF EXISTS "Owner, leaders, admins view contacts" ON public.evangelism_contacts;

CREATE POLICY "View own added, credited, leaders, admins"
  ON public.evangelism_contacts FOR SELECT TO authenticated
  USING (
    added_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'leader'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.witnesses w
      WHERE w.id = evangelism_contacts.witness_id
        AND w.linked_user_id = auth.uid()
    )
  );
