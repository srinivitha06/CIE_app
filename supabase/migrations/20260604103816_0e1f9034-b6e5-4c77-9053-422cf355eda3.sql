
-- Question types and flexible options
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.questions
  ALTER COLUMN option_a DROP NOT NULL,
  ALTER COLUMN option_b DROP NOT NULL,
  ALTER COLUMN option_c DROP NOT NULL,
  ALTER COLUMN option_d DROP NOT NULL,
  ALTER COLUMN correct_option DROP NOT NULL;

-- Backfill options array from option_a..d for existing rows
UPDATE public.questions
SET options = to_jsonb(ARRAY[
  COALESCE(option_a, ''),
  COALESCE(option_b, ''),
  COALESCE(option_c, ''),
  COALESCE(option_d, '')
])
WHERE jsonb_array_length(options) = 0 AND question_type = 'mcq';

ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check CHECK (question_type IN ('mcq','fill_blank'));

-- Assigned tests: re-entry fields
ALTER TABLE public.assigned_tests
  ADD COLUMN IF NOT EXISTS re_entry_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS re_entry_reason text,
  ADD COLUMN IF NOT EXISTS re_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS re_entered_by uuid;

-- Add violation type for admin re-entry audit
ALTER TYPE public.violation_type ADD VALUE IF NOT EXISTS 'admin_re_entry';

-- Exam sessions: in-progress answer persistence
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sessions TO authenticated;
GRANT ALL ON public.exam_sessions TO service_role;

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own sessions" ON public.exam_sessions
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins read all sessions" ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER exam_sessions_set_updated_at
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
