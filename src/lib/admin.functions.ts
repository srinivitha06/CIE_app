import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin")) throw new Error("Admin access required.");
}

export const createExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    category: z.enum(["aptitude","softskill"]),
    duration_minutes: z.number().int().min(1).max(600),
    timer_enabled: z.boolean(),
    start_at: z.string().nullable().optional(),
    end_at: z.string().nullable().optional(),
    is_published: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: exam, error } = await supabase.from("exams").insert({
      ...data,
      created_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return { exam };
  });

export const updateExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    category: z.enum(["aptitude","softskill"]),
    duration_minutes: z.number().int().min(1).max(600),
    timer_enabled: z.boolean(),
    start_at: z.string().nullable().optional(),
    end_at: z.string().nullable().optional(),
    is_published: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, ...patch } = data;
    const { error } = await supabase.from("exams").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertQuestionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    questions: z.array(z.object({
      question_text: z.string().min(1).max(2000),
      option_a: z.string().min(1).max(500),
      option_b: z.string().min(1).max(500),
      option_c: z.string().min(1).max(500),
      option_d: z.string().min(1).max(500),
      correct_option: z.enum(["A","B","C","D"]),
      marks: z.number().int().min(1).max(100).default(1),
    })).min(1).max(500),
    replace: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.replace) {
      await supabase.from("questions").delete().eq("exam_id", data.exam_id);
    }
    const rows = data.questions.map((q) => ({ ...q, exam_id: data.exam_id }));
    const { error } = await supabase.from("questions").insert(rows);
    if (error) throw new Error(error.message);
    // update total_questions
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", data.exam_id);
    await supabase.from("exams").update({ total_questions: count ?? rows.length }).eq("id", data.exam_id);
    return { ok: true, inserted: rows.length };
  });

export const deleteQuestionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: q } = await supabase.from("questions").select("exam_id").eq("id", data.id).maybeSingle();
    await supabase.from("questions").delete().eq("id", data.id);
    if (q?.exam_id) {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", q.exam_id);
      await supabase.from("exams").update({ total_questions: count ?? 0 }).eq("id", q.exam_id);
    }
    return { ok: true };
  });

export const listExamQuestionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: questions } = await supabase.from("questions").select("*").eq("exam_id", data.exam_id).order("created_at");
    return { questions: questions ?? [] };
  });

export const listStudentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ search: z.string().max(100).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = supabase.from("profiles").select("id, email, full_name, roll_number, class_name").order("full_name");
    if (data.search) {
      q = q.or(`full_name.ilike.%${data.search}%,email.ilike.%${data.search}%,roll_number.ilike.%${data.search}%`);
    }
    const { data: students } = await q.limit(500);
    return { students: students ?? [] };
  });

export const assignExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    student_ids: z.array(z.string().uuid()).min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const rows = data.student_ids.map((sid) => ({ exam_id: data.exam_id, student_id: sid, assigned_by: userId }));
    const { error } = await supabase.from("assigned_tests").upsert(rows, { onConflict: "exam_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true, assigned: rows.length };
  });

export const unassignExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid(), student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await supabase.from("assigned_tests").delete().eq("exam_id", data.exam_id).eq("student_id", data.student_id);
    return { ok: true };
  });

export const toggleLockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid(), student_id: z.string().uuid(), locked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await supabase.from("assigned_tests").update({ locked: data.locked }).eq("exam_id", data.exam_id).eq("student_id", data.student_id);
    return { ok: true };
  });

export const resetResultFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid(), student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await supabase.from("results").delete().eq("exam_id", data.exam_id).eq("student_id", data.student_id);
    await supabase.from("violations").delete().eq("exam_id", data.exam_id).eq("student_id", data.student_id);
    return { ok: true };
  });

export const examReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: exam } = await supabase.from("exams").select("*").eq("id", data.exam_id).maybeSingle();
    const { data: assignments } = await supabase
      .from("assigned_tests").select("student_id, locked").eq("exam_id", data.exam_id);
    const studentIds = (assignments ?? []).map((a) => a.student_id);
    const { data: profiles } = studentIds.length
      ? await supabase.from("profiles").select("id, full_name, email, roll_number, class_name").in("id", studentIds)
      : { data: [] };
    const { data: results } = await supabase.from("results").select("*").eq("exam_id", data.exam_id);
    const { data: violations } = await supabase.from("violations").select("student_id, violation").eq("exam_id", data.exam_id);
    return { exam, assignments: assignments ?? [], profiles: profiles ?? [], results: results ?? [], violations: violations ?? [] };
  });
