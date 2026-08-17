-- ============================================================================
-- Granular Admin Capabilities
-- ============================================================================
-- Today `admin` is all-or-nothing: any admin can approve events, manage
-- groups, manage the evangelism pipeline, manage reading programs, and
-- (once deployed) run the Bishop's Desk. This migration introduces a
-- capability layer so specific, NAMED admins can be scoped to only the
-- areas they actually own.
--
-- Members are unaffected — they keep one uniform permission set (no
-- capability grants apply to the `member` tier at all). `leader` is also
-- left alone; it's a separate, narrower tier from before this migration.
--
-- Design: `admin` role remains the prerequisite for holding any capability
-- (you must already be an admin to be grantable), but no longer implies
-- every capability on its own. To avoid locking anyone out on deploy, every
-- EXISTING admin is seeded with every capability below — from that point on,
-- the Admin Settings screen is how you dial individual admins back.
-- ============================================================================

CREATE TYPE public.admin_capability AS ENUM (
  'events_review',        -- approve/reject/edit submitted events
  'groups_management',    -- create/edit/delete groups, manage group membership
  'evangelism_management',-- oversee evangelism contacts & follow-ups beyond one's own
  'programs_management',  -- create/edit reading programs, lessons, quizzes
  'bishop_desk',           -- access /dashboard/engagements
  'admin_management'      -- manage roles + who holds which capability (this screen itself)
);

CREATE TABLE public.admin_capability_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability public.admin_capability NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, capability)
);

CREATE OR REPLACE FUNCTION public.has_capability(_user_id UUID, _capability public.admin_capability)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_capability_grants
    WHERE user_id = _user_id AND capability = _capability
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_capability(UUID, public.admin_capability) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_capability(UUID, public.admin_capability) TO authenticated;

-- Only role='admin' accounts may hold a capability grant — capabilities scope
-- an admin's access, they don't promote a member into one.
CREATE OR REPLACE FUNCTION public.enforce_capability_grantee_is_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(NEW.user_id, 'admin') THEN
    RAISE EXCEPTION 'Capabilities can only be granted to accounts with the admin role.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_capability_grantee_is_admin
  BEFORE INSERT OR UPDATE ON public.admin_capability_grants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_capability_grantee_is_admin();

-- Guard against self-lockout: you can't remove your own admin_management
-- grant. (You can still remove your own other capabilities.)
CREATE OR REPLACE FUNCTION public.prevent_self_revoke_admin_management()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.capability = 'admin_management' AND OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own Admin Settings access. Have another admin_management holder do this.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_self_revoke_admin_management
  BEFORE DELETE ON public.admin_capability_grants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_revoke_admin_management();

-- Backward-compatible seed: every current admin keeps full access on deploy day.
INSERT INTO public.admin_capability_grants (user_id, capability)
SELECT ur.user_id, cap
FROM public.user_roles ur
CROSS JOIN unnest(enum_range(NULL::public.admin_capability)) AS cap
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;

ALTER TABLE public.admin_capability_grants ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_capability_grants TO authenticated;
GRANT ALL ON public.admin_capability_grants TO service_role;

CREATE POLICY "Admins view all grants; users view own" ON public.admin_capability_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_management holders manage grants" ON public.admin_capability_grants
  FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(auth.uid(), 'admin_management'));

CREATE POLICY "admin_management holders update grants" ON public.admin_capability_grants
  FOR UPDATE TO authenticated
  USING (public.has_capability(auth.uid(), 'admin_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'admin_management'));

CREATE POLICY "admin_management holders delete grants" ON public.admin_capability_grants
  FOR DELETE TO authenticated
  USING (public.has_capability(auth.uid(), 'admin_management'));

-- ----------------------------------------------------------------------------
-- Bishop's Desk: recognize the general 'bishop_desk' capability as an
-- alternate path in, alongside the existing bishop_booking_authorized_users
-- table (which still exists for the bishop/secretary sub-role distinction
-- used by the simplified Bishop approval screen).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_bishop_desk_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bishop_booking_authorized_users WHERE user_id = _user_id
  ) OR public.has_capability(_user_id, 'bishop_desk')
$$;

-- ----------------------------------------------------------------------------
-- Rewire existing admin-gated policies from blanket has_role('admin') to the
-- specific capability that now governs each area. Member-facing policies
-- (submit your own event, join a group, add your own contact, etc.) are
-- untouched — only the admin/management side of each table changes.
-- ----------------------------------------------------------------------------

-- EVENTS
DROP POLICY IF EXISTS "Admins view all events" ON public.events;
CREATE POLICY "Event reviewers view all events" ON public.events
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'events_review'));

DROP POLICY IF EXISTS "Submitter updates pending; admin updates any" ON public.events;
CREATE POLICY "Submitter updates pending; reviewer updates any" ON public.events
  FOR UPDATE TO authenticated
  USING ((submitted_by = auth.uid() AND status = 'pending') OR public.has_capability(auth.uid(), 'events_review'))
  WITH CHECK ((submitted_by = auth.uid() AND status = 'pending') OR public.has_capability(auth.uid(), 'events_review'));

DROP POLICY IF EXISTS "Submitter or admin delete events" ON public.events;
CREATE POLICY "Submitter or reviewer delete events" ON public.events
  FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() OR public.has_capability(auth.uid(), 'events_review'));

-- GROUPS
DROP POLICY IF EXISTS "Admins insert groups" ON public.groups;
CREATE POLICY "Group managers insert groups" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Admins update groups" ON public.groups;
CREATE POLICY "Group managers update groups" ON public.groups
  FOR UPDATE TO authenticated USING (public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Admins delete groups" ON public.groups;
CREATE POLICY "Group managers delete groups" ON public.groups
  FOR DELETE TO authenticated USING (public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Members and admins view group members" ON public.group_members;
CREATE POLICY "Members and group managers view group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id) OR public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Admins insert group members" ON public.group_members;
CREATE POLICY "Group managers insert group members" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Admins update group members" ON public.group_members;
CREATE POLICY "Group managers update group members" ON public.group_members
  FOR UPDATE TO authenticated USING (public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Admins delete group members" ON public.group_members;
CREATE POLICY "Group managers delete group members" ON public.group_members
  FOR DELETE TO authenticated USING (public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Group members view messages" ON public.group_messages;
CREATE POLICY "Group members and managers view messages" ON public.group_messages
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id) OR public.has_capability(auth.uid(), 'groups_management'));

DROP POLICY IF EXISTS "Author or admin delete messages" ON public.group_messages;
CREATE POLICY "Author or group manager delete messages" ON public.group_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_capability(auth.uid(), 'groups_management'));

-- EVANGELISM
-- Two policy names, because this table's SELECT rule was renamed by migration
-- 20260602: "Owner, leaders, admins view contacts" was dropped there and
-- replaced with "View own added, credited, leaders, admins". Dropping only the
-- original name is a silent no-op that leaves the live has_role('admin') policy
-- in place — and since policies for the same command are OR'd, that would let
-- any admin keep reading every contact regardless of capability. The checkbox
-- in Admin Settings would appear to work and do nothing, on the one table
-- holding the personal details of people who never signed up for this site.
DROP POLICY IF EXISTS "Owner, leaders, admins view contacts" ON public.evangelism_contacts;
DROP POLICY IF EXISTS "View own added, credited, leaders, admins" ON public.evangelism_contacts;
CREATE POLICY "Owner, witness, leaders, evangelism managers view contacts" ON public.evangelism_contacts
  FOR SELECT TO authenticated USING (
    added_by = auth.uid()
    OR public.has_capability(auth.uid(), 'evangelism_management')
    OR public.has_role(auth.uid(), 'leader')
    -- Carried over from the policy being replaced: a witness still sees the
    -- contacts credited to them. Dropping this clause would quietly revoke
    -- access they have today.
    OR EXISTS (
      SELECT 1 FROM public.witnesses w
      WHERE w.id = evangelism_contacts.witness_id
        AND w.linked_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner or admin update contacts" ON public.evangelism_contacts;
CREATE POLICY "Owner or evangelism manager update contacts" ON public.evangelism_contacts
  FOR UPDATE TO authenticated USING (
    added_by = auth.uid() OR public.has_capability(auth.uid(), 'evangelism_management')
  );

DROP POLICY IF EXISTS "Owner or admin delete contacts" ON public.evangelism_contacts;
CREATE POLICY "Owner or evangelism manager delete contacts" ON public.evangelism_contacts
  FOR DELETE TO authenticated USING (
    added_by = auth.uid() OR public.has_capability(auth.uid(), 'evangelism_management')
  );

DROP POLICY IF EXISTS "Assignee or admin view follow-ups" ON public.contact_follow_ups;
CREATE POLICY "Assignee or evangelism manager view follow-ups" ON public.contact_follow_ups
  FOR SELECT TO authenticated USING (
    assigned_to = auth.uid() OR public.has_capability(auth.uid(), 'evangelism_management')
  );

-- These two were not in the original rewrite and would have survived with
-- blanket has_role('admin'), leaving admins able to create and delete
-- follow-ups for contacts they cannot otherwise manage.
DROP POLICY IF EXISTS "Owner inserts follow-ups" ON public.contact_follow_ups;
CREATE POLICY "Assignee or evangelism manager insert follow-ups" ON public.contact_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (assigned_to = auth.uid() OR public.has_capability(auth.uid(), 'evangelism_management'));

DROP POLICY IF EXISTS "Assignee or admin delete follow-ups" ON public.contact_follow_ups;
CREATE POLICY "Assignee or evangelism manager delete follow-ups" ON public.contact_follow_ups
  FOR DELETE TO authenticated
  USING (assigned_to = auth.uid() OR public.has_capability(auth.uid(), 'evangelism_management'));

DROP POLICY IF EXISTS "Assignee or admin update follow-ups" ON public.contact_follow_ups;
CREATE POLICY "Assignee or evangelism manager update follow-ups" ON public.contact_follow_ups
  FOR UPDATE TO authenticated USING (
    assigned_to = auth.uid() OR public.has_capability(auth.uid(), 'evangelism_management')
  );

-- READING PROGRAMS
DROP POLICY IF EXISTS "View published or own programs" ON public.reading_programs;
CREATE POLICY "View published, own, or managed programs" ON public.reading_programs FOR SELECT TO authenticated
  USING (is_published OR created_by = auth.uid() OR public.has_capability(auth.uid(), 'programs_management'));

DROP POLICY IF EXISTS "Admins and leaders create programs" ON public.reading_programs;
CREATE POLICY "Program managers and leaders create programs" ON public.reading_programs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_capability(auth.uid(), 'programs_management') OR public.has_role(auth.uid(), 'leader')));

DROP POLICY IF EXISTS "Creator or admin update programs" ON public.reading_programs;
CREATE POLICY "Creator or program manager update programs" ON public.reading_programs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_capability(auth.uid(), 'programs_management'));

DROP POLICY IF EXISTS "Creator or admin delete programs" ON public.reading_programs;
CREATE POLICY "Creator or program manager delete programs" ON public.reading_programs FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_capability(auth.uid(), 'programs_management'));

-- ROLE ASSIGNMENT (naming who is an admin at all — governed by admin_management)
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "admin_management holders manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'admin_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'admin_management'));
