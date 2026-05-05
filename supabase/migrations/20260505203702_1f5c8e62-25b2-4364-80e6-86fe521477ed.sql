
-- Extend reading_programs into a fuller "discipleship programs" model
ALTER TABLE public.reading_programs
  ADD COLUMN IF NOT EXISTS program_type TEXT NOT NULL DEFAULT 'reading_plan',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS cover_image TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS estimated_duration TEXT,
  ADD COLUMN IF NOT EXISTS self_paced BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enrollment_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS includes_quiz BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS includes_certificate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_config JSONB DEFAULT '{}'::jsonb;

-- Backfill status from is_published
UPDATE public.reading_programs SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END
  WHERE status = 'draft';

-- Lessons
CREATE TABLE IF NOT EXISTS public.program_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  lesson_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  focus_scriptures JSONB NOT NULL DEFAULT '[]'::jsonb,
  scripture_text TEXT,
  teaching_notes TEXT,
  reflection_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  call_to_action TEXT,
  completion_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.program_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lessons of visible programs" ON public.program_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.is_published OR p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Manage own program lessons" ON public.program_lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- Extend reading_program_days with richer fields (already exists)
ALTER TABLE public.reading_program_days
  ADD COLUMN IF NOT EXISTS assigned_date DATE,
  ADD COLUMN IF NOT EXISTS scripture_reference TEXT,
  ADD COLUMN IF NOT EXISTS book_name TEXT,
  ADD COLUMN IF NOT EXISTS chapter_start INT,
  ADD COLUMN IF NOT EXISTS chapter_end INT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS reflection_question TEXT;

-- Quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.program_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INT NOT NULL DEFAULT 70,
  allow_retakes BOOLEAN NOT NULL DEFAULT true,
  show_correct_answers BOOLEAN NOT NULL DEFAULT true,
  randomize_questions BOOLEAN NOT NULL DEFAULT false,
  required_for_completion BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View quizzes of visible programs" ON public.quizzes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.is_published OR p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Manage own program quizzes" ON public.quizzes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- Quiz questions
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  question_type TEXT NOT NULL, -- 'multiple_choice'|'fill_blank'|'true_false'|'short_answer'
  question_text TEXT NOT NULL,
  answer_options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  acceptable_answers JSONB DEFAULT '[]'::jsonb,
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  explanation TEXT,
  points INT NOT NULL DEFAULT 1,
  auto_grading_enabled BOOLEAN NOT NULL DEFAULT true,
  requires_admin_review BOOLEAN NOT NULL DEFAULT false,
  grading_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View questions of visible quizzes" ON public.quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.reading_programs p ON p.id=q.program_id WHERE q.id=quiz_id AND (p.is_published OR p.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Manage own quiz questions" ON public.quiz_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.reading_programs p ON p.id=q.program_id WHERE q.id=quiz_id AND (p.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.reading_programs p ON p.id=q.program_id WHERE q.id=quiz_id AND (p.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- Quiz attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  percent NUMERIC NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_grading_feedback JSONB,
  admin_override_score NUMERIC,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.quizzes q JOIN public.reading_programs p ON p.id=q.program_id WHERE q.id=quiz_id AND (p.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Users insert own attempts" ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins/creators update attempts" ON public.quiz_attempts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.reading_programs p ON p.id=q.program_id WHERE q.id=quiz_id AND (p.created_by=auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- Enrollments
CREATE TABLE IF NOT EXISTS public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  percent_complete NUMERIC NOT NULL DEFAULT 0,
  current_lesson INT,
  current_day INT,
  completion_date TIMESTAMPTZ,
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(program_id, user_id)
);
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own enrollments" ON public.program_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Users enroll themselves" ON public.program_enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own enrollment" ON public.program_enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Users unenroll" ON public.program_enrollments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Lesson progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.program_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own lesson progress" ON public.lesson_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Users insert own lesson progress" ON public.lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own lesson progress" ON public.lesson_progress FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.reading_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  certificate_title TEXT NOT NULL,
  certificate_subtitle TEXT,
  church_name TEXT,
  member_name TEXT NOT NULL,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  signature_name TEXT,
  signature_title TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, user_id)
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own certificates" ON public.certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.reading_programs p WHERE p.id = program_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Users insert own certificate" ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER trg_program_lessons_updated BEFORE UPDATE ON public.program_lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_quizzes_updated BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
