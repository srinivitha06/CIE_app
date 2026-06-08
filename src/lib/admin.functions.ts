import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin")) throw new Error("Admin access required.");
}

async function assertOwnsExam(supabase: any, examId: string, userId: string) {
  const { data: exam } = await supabase.from("exams").select("id, created_by").eq("id", examId).maybeSingle();
  if (!exam) throw new Error("Exam not found.");
  if (exam.created_by !== userId) throw new Error("You do not own this exam.");
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

const questionShape = z.object({
  question_type: z.enum(["mcq", "fill_blank"]).default("mcq"),
  question_text: z.string().min(1).max(2000),
  options: z.array(z.string().max(500)).max(6).default([])
    .transform((arr) => arr.map((s) => (s ?? "").trim()).filter((s) => s.length > 0)),
  correct_option: z.string().max(2).optional().nullable(),
  accepted_answers: z.array(z.string().max(500)).max(20).default([])
    .transform((arr) => arr.map((s) => (s ?? "").trim()).filter((s) => s.length > 0)),
  marks: z.number().int().min(1).max(100).default(1),
}).superRefine((q, ctx) => {
  if (q.question_type === "mcq") {
    if (q.options.length < 2) ctx.addIssue({ code: "custom", message: "MCQ needs at least 2 options" });
    const valid = ["A","B","C","D","E","F"].slice(0, q.options.length);
    if (!q.correct_option || !valid.includes(q.correct_option)) ctx.addIssue({ code: "custom", message: "Invalid correct_option" });
  } else if (q.accepted_answers.length < 1) {
    ctx.addIssue({ code: "custom", message: "Fill-blank needs at least 1 accepted answer" });
  }
});

function questionRow(q: z.infer<typeof questionShape>) {
  if (q.question_type === "mcq") {
    return {
      question_type: "mcq",
      question_text: q.question_text,
      options: q.options,
      accepted_answers: [],
      correct_option: q.correct_option,
      marks: q.marks,
      option_a: q.options[0] ?? null,
      option_b: q.options[1] ?? null,
      option_c: q.options[2] ?? null,
      option_d: q.options[3] ?? null,
    };
  }
  return {
    question_type: "fill_blank",
    question_text: q.question_text,
    options: [],
    accepted_answers: q.accepted_answers,
    correct_option: null,
    marks: q.marks,
    option_a: null, option_b: null, option_c: null, option_d: null,
  };
}

export const upsertQuestionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    questions: z.array(questionShape).min(1).max(500),
    replace: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.replace) {
      await supabase.from("questions").delete().eq("exam_id", data.exam_id);
    }
    const { data: maxRow } = await supabase
      .from("questions").select("position").eq("exam_id", data.exam_id)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    let pos = (maxRow?.position ?? 0);
    const rows = data.questions.map((q) => ({ ...questionRow(q), exam_id: data.exam_id, position: ++pos }));
    const { error } = await supabase.from("questions").insert(rows);
    if (error) throw new Error(error.message);
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", data.exam_id);
    await supabase.from("exams").update({ total_questions: count ?? rows.length }).eq("id", data.exam_id);
    return { ok: true, inserted: rows.length };
  });

export const updateQuestionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).passthrough().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, ...rest } = data as any;
    const parsed = questionShape.parse(rest);
    const { error } = await supabase.from("questions").update(questionRow(parsed)).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderQuestionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    ordered_ids: z.array(z.string().uuid()).min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    for (let i = 0; i < data.ordered_ids.length; i++) {
      const { error } = await supabase.from("questions")
        .update({ position: i + 1 })
        .eq("id", data.ordered_ids[i]).eq("exam_id", data.exam_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
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
    const { data: questions } = await supabase.from("questions").select("*")
      .eq("exam_id", data.exam_id).order("position", { ascending: true }).order("created_at");
    return { questions: questions ?? [] };
  });

export const listStudentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    search: z.string().max(100).optional(),
    class_name: z.string().max(100).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = supabase.from("profiles").select("id, email, full_name, roll_number, class_name").order("full_name");
    if (data.search) {
      q = q.or(`full_name.ilike.%${data.search}%,email.ilike.%${data.search}%,roll_number.ilike.%${data.search}%`);
    }
    if (data.class_name) q = q.eq("class_name", data.class_name);
    const { data: students } = await q.limit(500);
    return { students: students ?? [] };
  });

export const listClassesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase.from("profiles").select("class_name").not("class_name", "is", null).limit(2000);
    const set = new Set<string>();
    (data ?? []).forEach((r: any) => r.class_name && set.add(r.class_name));
    return { classes: Array.from(set).sort() };
  });

export const studentViolationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid(), student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: violations } = await supabase
      .from("violations")
      .select("violation, detail, created_at")
      .eq("exam_id", data.exam_id)
      .eq("student_id", data.student_id)
      .order("created_at");
    const { data: profile } = await supabase
      .from("profiles").select("full_name, email, roll_number, class_name").eq("id", data.student_id).maybeSingle();
    const { data: result } = await supabase
      .from("results").select("*").eq("exam_id", data.exam_id).eq("student_id", data.student_id).maybeSingle();
    return { violations: violations ?? [], profile, result };
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

// ===== Groups (cohorts) =====

export const listGroupsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: groups } = await supabase.from("groups").select("*").order("name");
    const { data: members } = await supabase.from("group_members").select("group_id");
    const counts: Record<string, number> = {};
    (members ?? []).forEach((m: any) => { counts[m.group_id] = (counts[m.group_id] ?? 0) + 1; });
    return { groups: (groups ?? []).map((g: any) => ({ ...g, member_count: counts[g.id] ?? 0 })) };
  });

export const createGroupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: group, error } = await supabase.from("groups")
      .insert({ name: data.name, description: data.description ?? null, created_by: userId })
      .select().single();
    if (error) throw new Error(error.message);
    return { group };
  });

export const renameGroupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("groups")
      .update({ name: data.name, description: data.description ?? null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGroupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: group } = await supabase.from("groups").select("*").eq("id", data.id).maybeSingle();
    const { data: members } = await supabase.from("group_members").select("student_id").eq("group_id", data.id);
    const ids = (members ?? []).map((m: any) => m.student_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name, email, roll_number, class_name").in("id", ids)
      : { data: [] };
    return { group, students: profiles ?? [] };
  });

export const addGroupMembersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    group_id: z.string().uuid(),
    student_ids: z.array(z.string().uuid()).min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const rows = data.student_ids.map((sid) => ({ group_id: data.group_id, student_id: sid }));
    const { error } = await supabase.from("group_members").upsert(rows, { onConflict: "group_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true, added: rows.length };
  });

export const removeGroupMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ group_id: z.string().uuid(), student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await supabase.from("group_members").delete()
      .eq("group_id", data.group_id).eq("student_id", data.student_id);
    return { ok: true };
  });

export const assignGroupsToExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    group_ids: z.array(z.string().uuid()).min(1).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: members } = await supabase.from("group_members")
      .select("student_id").in("group_id", data.group_ids);
    const studentIds = Array.from(new Set((members ?? []).map((m: any) => m.student_id)));
    if (!studentIds.length) return { ok: true, assigned: 0 };
    const rows = studentIds.map((sid) => ({ exam_id: data.exam_id, student_id: sid, assigned_by: userId }));
    const { error } = await supabase.from("assigned_tests").upsert(rows, { onConflict: "exam_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true, assigned: rows.length };
  });

// ===== Admin re-entry override =====

export const grantReEntryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    student_id: z.string().uuid(),
    reason: z.string().min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove the previously auto-submitted result so the student can resume.
    await supabaseAdmin.from("results").delete()
      .eq("exam_id", data.exam_id).eq("student_id", data.student_id);

    // Unlock and stamp re-entry metadata
    const { error: uErr } = await supabaseAdmin.from("assigned_tests").update({
      locked: false,
      re_entry_allowed: true,
      re_entry_reason: data.reason,
      re_entered_at: new Date().toISOString(),
      re_entered_by: userId,
    }).eq("exam_id", data.exam_id).eq("student_id", data.student_id);
    if (uErr) throw new Error(uErr.message);

    // Audit log
    await supabaseAdmin.from("violations").insert({
      exam_id: data.exam_id,
      student_id: data.student_id,
      violation: "admin_re_entry" as any,
      detail: `Re-entry granted by admin ${userId}. Reason: ${data.reason}`,
    });

    return { ok: true };
  });

export const listExamSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid(), student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: session } = await supabase.from("exam_sessions")
      .select("*").eq("exam_id", data.exam_id).eq("student_id", data.student_id).maybeSingle();
    return { session };
  });

// ===== Duplicate & Share =====

async function deepCopyExam(opts: {
  sourceExamId: string;
  newOwnerId: string;
  titleSuffix?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: src, error: srcErr } = await supabaseAdmin
    .from("exams").select("*").eq("id", opts.sourceExamId).maybeSingle();
  if (srcErr || !src) throw new Error("Source exam not found.");

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = src as any;
  const copyTitle = opts.titleSuffix ? `${src.title}${opts.titleSuffix}` : src.title;

  const { data: copy, error: insErr } = await supabaseAdmin.from("exams").insert({
    ...rest,
    title: copyTitle,
    created_by: opts.newOwnerId,
    is_published: false, // new copy starts as draft
  }).select().single();
  if (insErr) throw new Error(insErr.message);

  const { data: questions } = await supabaseAdmin
    .from("questions").select("*").eq("exam_id", opts.sourceExamId).order("position");
  if (questions && questions.length) {
    const rows = questions.map((q: any) => {
      const { id, created_at, exam_id, ...qrest } = q;
      return { ...qrest, exam_id: copy.id };
    });
    const { error: qErr } = await supabaseAdmin.from("questions").insert(rows);
    if (qErr) throw new Error(qErr.message);
  }

  await supabaseAdmin.from("exams")
    .update({ total_questions: questions?.length ?? 0 }).eq("id", copy.id);

  return copy;
}

export const duplicateExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ exam_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await assertOwnsExam(supabase, data.exam_id, userId);
    const copy = await deepCopyExam({
      sourceExamId: data.exam_id,
      newOwnerId: userId,
      titleSuffix: " (Copy)",
    });
    return { exam: copy };
  });

export const shareExamByEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({
    exam_id: z.string().uuid(),
    email: z.string().trim().email().max(255),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    await assertOwnsExam(supabase, data.exam_id, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find recipient profile by email
    const normalized = data.email.toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id, email, full_name").ilike("email", normalized).maybeSingle();
    if (!profile) throw new Error("No staff account found for that email.");
    if (profile.id === userId) throw new Error("You already own this exam.");

    // Recipient must be staff (admin role)
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", profile.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Recipient is not a staff member.");

    const copy = await deepCopyExam({
      sourceExamId: data.exam_id,
      newOwnerId: profile.id,
      titleSuffix: " (Shared)",
    });

    await supabaseAdmin.from("exam_shares").insert({
      source_exam_id: data.exam_id,
      copy_exam_id: copy.id,
      owner_user_id: userId,
      shared_with_user_id: profile.id,
    });

    return { ok: true, recipient: profile.full_name || profile.email };
  });
