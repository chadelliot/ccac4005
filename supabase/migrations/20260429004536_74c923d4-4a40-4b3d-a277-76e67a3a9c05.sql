
-- ROLES ENUM + TABLE
CREATE TYPE public.app_role AS ENUM ('admin', 'leader', 'member');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- SECURITY DEFINER role checker (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- EVANGELISM CONTACTS
CREATE TABLE public.evangelism_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  where_met TEXT,
  notes TEXT,
  visited BOOLEAN NOT NULL DEFAULT false,
  baptized BOOLEAN NOT NULL DEFAULT false,
  holy_ghost BOOLEAN NOT NULL DEFAULT false,
  gospel_shared BOOLEAN NOT NULL DEFAULT false,
  prayer_request TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FOLLOW-UPS
CREATE TABLE public.contact_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.evangelism_contacts(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  touch_number INT NOT NULL CHECK (touch_number BETWEEN 1 AND 3),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followups_assigned ON public.contact_follow_ups(assigned_to, due_date) WHERE completed = false;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evangelism_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Profiles viewable by signed-in users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER_ROLES policies
CREATE POLICY "Roles readable by signed-in users" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- EVANGELISM_CONTACTS policies
CREATE POLICY "Owner, leaders, admins view contacts" ON public.evangelism_contacts
  FOR SELECT TO authenticated USING (
    added_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'leader')
  );
CREATE POLICY "Members add contacts" ON public.evangelism_contacts
  FOR INSERT TO authenticated WITH CHECK (added_by = auth.uid());
CREATE POLICY "Owner or admin update contacts" ON public.evangelism_contacts
  FOR UPDATE TO authenticated USING (
    added_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Owner or admin delete contacts" ON public.evangelism_contacts
  FOR DELETE TO authenticated USING (
    added_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- FOLLOW_UPS policies
CREATE POLICY "Assignee or admin view follow-ups" ON public.contact_follow_ups
  FOR SELECT TO authenticated USING (
    assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Assignee or admin update follow-ups" ON public.contact_follow_ups
  FOR UPDATE TO authenticated USING (
    assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
-- inserts handled by trigger (security definer); allow any authenticated insert just in case
CREATE POLICY "System inserts follow-ups" ON public.contact_follow_ups
  FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS policies
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON public.evangelism_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUTO-CREATE profile + member role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- AUTO-SCHEDULE 3 follow-ups (next Mondays/Thursdays from today) when a contact is added
CREATE OR REPLACE FUNCTION public.schedule_initial_followups()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d DATE := CURRENT_DATE;
  count_added INT := 0;
  touch INT := 1;
BEGIN
  WHILE count_added < 3 LOOP
    d := d + 1;
    -- 1 = Monday, 4 = Thursday (ISO dow)
    IF EXTRACT(ISODOW FROM d) IN (1, 4) THEN
      INSERT INTO public.contact_follow_ups (contact_id, assigned_to, due_date, touch_number)
      VALUES (NEW.id, NEW.added_by, d, touch);
      count_added := count_added + 1;
      touch := touch + 1;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_schedule_followups
  AFTER INSERT ON public.evangelism_contacts
  FOR EACH ROW EXECUTE FUNCTION public.schedule_initial_followups();
