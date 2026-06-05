DROP POLICY IF EXISTS "Students insert own results" ON public.results;

CREATE POLICY "Students view own group memberships" ON public.group_members
FOR SELECT TO authenticated
USING (student_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));