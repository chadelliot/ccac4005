-- Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER groups_set_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Group members
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);

-- Group messages (simple message board with optional parent for replies)
CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_messages_group ON public.group_messages(group_id, created_at DESC);

-- Add group_id to events
ALTER TABLE public.events ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_leader(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE user_id = _user_id AND group_id = _group_id AND role = 'leader'
  )
$$;

-- RLS: groups
CREATE POLICY "Signed-in users view groups" ON public.groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert groups" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update groups" ON public.groups
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete groups" ON public.groups
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- RLS: group_members
CREATE POLICY "Members and admins view group members" ON public.group_members
  FOR SELECT TO authenticated USING (
    public.is_group_member(auth.uid(), group_id) OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins insert group members" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update group members" ON public.group_members
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete group members" ON public.group_members
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- RLS: group_messages
CREATE POLICY "Group members view messages" ON public.group_messages
  FOR SELECT TO authenticated USING (
    public.is_group_member(auth.uid(), group_id) OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Group members post messages" ON public.group_messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND public.is_group_member(auth.uid(), group_id)
  );
CREATE POLICY "Author or admin delete messages" ON public.group_messages
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR has_role(auth.uid(), 'admin')
  );

-- Update events INSERT policy is fine (submitted_by = auth.uid()). 
-- Add a policy so group leaders can submit events tied to their group (still pending until admin approves).
-- The existing "Members submit events" policy already allows this; the group_id is just metadata.
-- But ensure leaders/admins can view their group's events even before approval:
CREATE POLICY "Group leaders view their group events" ON public.events
  FOR SELECT TO authenticated USING (
    group_id IS NOT NULL AND public.is_group_leader(auth.uid(), group_id)
  );