
-- 1. exam_shares table
CREATE TABLE public.exam_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  copy_exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  shared_with_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_shares TO authenticated;
GRANT ALL ON public.exam_shares TO service_role;
ALTER TABLE public.exam_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Share participants view shares" ON public.exam_shares FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR shared_with_user_id = auth.uid());
CREATE POLICY "Owner records shares" ON public.exam_shares FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- 2. Helper: does this user own this exam?
CREATE OR REPLACE FUNCTION public.owns_exam(_exam_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.exams WHERE id = _exam_id AND created_by = _user_id)
$$;

-- 3. Exams: scope admin access to the owner
DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
CREATE POLICY "Owners manage own exams" ON public.exams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

-- 4. Questions: only the exam owner
DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
DROP POLICY IF EXISTS "Only admins can read questions" ON public.questions;
CREATE POLICY "Owners manage own exam questions" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.owns_exam(exam_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.owns_exam(exam_id, auth.uid()));
-- restrictive: never expose questions to non-admins via Data API
CREATE POLICY "Block non-admin question reads" ON public.questions AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. assigned_tests: only the exam owner (students keep their existing SELECT policy)
DROP POLICY IF EXISTS "Admins manage assignments" ON public.assigned_tests;
CREATE POLICY "Owners manage own exam assignments" ON public.assigned_tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.owns_exam(exam_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.owns_exam(exam_id, auth.uid()));

-- 6. results: students see own, owners see their exams'
DROP POLICY IF EXISTS "Students view own results" ON public.results;
CREATE POLICY "Students and exam owners view results" ON public.results FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.owns_exam(exam_id, auth.uid()));

-- 7. violations: students see own, owners see their exams'
DROP POLICY IF EXISTS "Students view own violations" ON public.violations;
CREATE POLICY "Students and exam owners view violations" ON public.violations FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.owns_exam(exam_id, auth.uid()));

-- 8. exam_sessions: admin read scoped to owner
DROP POLICY IF EXISTS "Admins read all sessions" ON public.exam_sessions;
CREATE POLICY "Owners read own exam sessions" ON public.exam_sessions FOR SELECT TO authenticated
  USING (public.owns_exam(exam_id, auth.uid()));
