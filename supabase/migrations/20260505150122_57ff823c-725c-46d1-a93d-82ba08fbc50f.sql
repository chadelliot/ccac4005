-- Reading programs (Bible study plans) created by admins/leaders.
CREATE TABLE public.reading_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each day in a program. Each passage is a reference like "John 3:1-21" or "Gen 1".
CREATE TABLE public.reading_program_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  title TEXT,
  passages JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {book_abbr, chapter, verse_start?, verse_end?}
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, day_number)
);

-- Per-user per-day completion tracking
CREATE TABLE public.reading_program_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  day_id UUID NOT NULL REFERENCES public.reading_program_days(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_id)
);

ALTER TABLE public.reading_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_program_progress ENABLE ROW LEVEL SECURITY;

-- Programs: anyone signed-in can view published; creators+admins see drafts; only admins/leaders create
CREATE POLICY "View published or own programs" ON public.reading_programs FOR SELECT TO authenticated
  USING (is_published OR created_by = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins and leaders create programs" ON public.reading_programs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'leader')));
CREATE POLICY "Creator or admin update programs" ON public.reading_programs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "Creator or admin delete programs" ON public.reading_programs FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));

-- Days: visible if parent visible; mutated by program creator/admin
CREATE POLICY "View days of visible programs" ON public.reading_program_days FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reading_programs p
    WHERE p.id = program_id AND (p.is_published OR p.created_by = auth.uid() OR has_role(auth.uid(),'admin'))));
CREATE POLICY "Manage own program days" ON public.reading_program_days FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reading_programs p
    WHERE p.id = program_id AND (p.created_by = auth.uid() OR has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reading_programs p
    WHERE p.id = program_id AND (p.created_by = auth.uid() OR has_role(auth.uid(),'admin'))));

-- Progress: each user manages their own
CREATE POLICY "Users view own progress" ON public.reading_program_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users insert own progress" ON public.reading_program_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own progress" ON public.reading_program_progress FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER reading_programs_updated BEFORE UPDATE ON public.reading_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rpd_program ON public.reading_program_days(program_id, day_number);
CREATE INDEX idx_rpp_user ON public.reading_program_progress(user_id, program_id);