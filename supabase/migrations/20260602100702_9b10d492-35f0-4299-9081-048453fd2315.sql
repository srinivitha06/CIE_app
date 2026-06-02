
-- 1. Remove students' ability to UPDATE results (server uses admin client for inserts; results should be immutable to students)
DROP POLICY IF EXISTS "Students update own results" ON public.results;

-- 2. user_roles: add explicit admin-only INSERT/UPDATE/DELETE policies (prevent privilege escalation)
CREATE POLICY "Admins insert user roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update user roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete user roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Questions: add explicit deny-by-default for students (admin-only policy already exists, but make intent explicit)
-- The existing "Admins manage questions" policy is ALL for authenticated with has_role check.
-- Since no permissive SELECT policy exists for students, they already cannot read.
-- Add an explicit restrictive policy to make this airtight and satisfy the scanner.
CREATE POLICY "Only admins can read questions"
ON public.questions AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4 & 5. has_role: revoke EXECUTE from public and anon. RLS policy evaluation works with authenticated grant only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
-- authenticated grant remains (already granted), required for RLS policies that call has_role()
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
