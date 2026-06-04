import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fetch exam + randomized questions for student to take (creates/resumes session)
export const startExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { examId: string }) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assignment } = await supabase
      .from("assigned_tests")
      .select("id, locked, re_entry_allowed")
      .eq("exam_id", data.examId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!assignment) throw new Error("You are not assigned to this exam.");
    if (assignment.locked) throw new Error("Your access to this exam is locked. Contact your administrator.");

    const { data: exam, error: examErr } = await supabase
      .from("exams").select("*").eq("id", data.examId).maybeSingle();
    if (examErr || !exam) throw new Error("Exam not found.");
    if (!exam.is_published) throw new Error("Exam is not published.");
    const now = new Date();
    if (exam.start_at && new Date(exam.start_at) > now) throw new Error("Exam has not started yet.");
    if (exam.end_at && new Date(exam.end_at) < now) throw new Error("Exam window has closed.");

    const { data: existing } = await supabase
      .from("results").select("id").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();
    if (existing) throw new Error("You have already submitted this exam.");

    // Load or create session
    const { data: existingSession } = await supabaseAdmin
      .from("exam_sessions").select("*").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();

    let session = existingSession;
    let isResume = !!existingSession;
    if (!session) {
      const { data: newSession, error: sErr } = await supabaseAdmin.from("exam_sessions").insert({
        exam_id: data.examId, student_id: userId, started_at: new Date().toISOString(),
      }).select().single();
      if (sErr) throw new Error(sErr.message);
      session = newSession;
    }

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, question_type, question_text, options, option_a, option_b, option_c, option_d, marks, position")
      .eq("exam_id", data.examId)
      .order("position", { ascending: true });

    if (!questions || questions.length === 0) throw new Error("No questions available for this exam.");

    // Normalize: build a unified options array per question (don't leak correct answer)
    const normalized = questions.map((q: any) => {
      let opts: string[] = Array.isArray(q.options) ? q.options.filter((x: any) => typeof x === "string" && x.length) : [];
      if (q.question_type !== "fill_blank" && opts.length === 0) {
        opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter((x: any) => typeof x === "string" && x.length);
      }
      return {
        id: q.id,
        question_type: q.question_type ?? "mcq",
        question_text: q.question_text,
        options: opts,
        marks: q.marks,
      };
    });

    // Compute remaining time using session.elapsed_seconds (auto-resume)
    const totalSeconds = (exam.duration_minutes || 0) * 60;
    const remainingSeconds = Math.max(0, totalSeconds - (session.elapsed_seconds ?? 0));

    return {
      exam,
      questions: normalized,
      session: {
        startedAt: session.started_at,
        answers: (session.answers ?? {}) as Record<string, string>,
        remainingSeconds,
        isResume,
      },
    };
  });

// Periodic progress save
export const saveProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { examId: string; answers: Record<string, string>; elapsedSeconds: number }) =>
    z.object({
      examId: z.string().uuid(),
      answers: z.record(z.string(), z.string().max(500)),
      elapsedSeconds: z.number().int().min(0).max(36000),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exam_sessions").update({
      answers: data.answers,
      elapsed_seconds: data.elapsedSeconds,
      last_saved_at: new Date().toISOString(),
    }).eq("exam_id", data.examId).eq("student_id", userId);
    return { ok: true };
  });

export const submitExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { examId: string; answers: Record<string, string>; autoSubmitted?: boolean; startedAt: string }) =>
    z.object({
      examId: z.string().uuid(),
      answers: z.record(z.string(), z.string().max(500)),
      autoSubmitted: z.boolean().optional(),
      startedAt: z.string(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assignment } = await supabaseAdmin
      .from("assigned_tests").select("id").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();
    if (!assignment) throw new Error("Not assigned.");

    const { data: existing } = await supabaseAdmin
      .from("results").select("id").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();
    if (existing) throw new Error("Already submitted.");

    const { data: questions } = await supabaseAdmin
      .from("questions").select("id, question_type, correct_option, options, accepted_answers, marks").eq("exam_id", data.examId);
    if (!questions) throw new Error("No questions.");

    let score = 0; let total = 0; let correct = 0;
    for (const q of questions as any[]) {
      total += q.marks;
      const ans = data.answers[q.id];
      if (!ans) continue;
      let isCorrect = false;
      if (q.question_type === "fill_blank") {
        const accepted = Array.isArray(q.accepted_answers) ? q.accepted_answers : [];
        const normalized = ans.trim().toLowerCase();
        isCorrect = accepted.some((a: string) => typeof a === "string" && a.trim().toLowerCase() === normalized);
      } else {
        isCorrect = ans === q.correct_option;
      }
      if (isCorrect) { score += q.marks; correct += 1; }
    }

    const { data: result, error } = await supabaseAdmin
      .from("results").insert({
        exam_id: data.examId,
        student_id: userId,
        score,
        total_marks: total,
        correct_count: correct,
        total_questions: questions.length,
        answers: data.answers,
        started_at: data.startedAt,
        submitted_at: new Date().toISOString(),
        auto_submitted: !!data.autoSubmitted,
      }).select().single();
    if (error) throw new Error(error.message);

    // Cleanup session
    await supabaseAdmin.from("exam_sessions").delete().eq("exam_id", data.examId).eq("student_id", userId);

    return { result };
  });

export const recordViolationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { examId: string; violation: string; detail?: string }) =>
    z.object({
      examId: z.string().uuid(),
      violation: z.enum(["tab_switch","fullscreen_exit","visibility_hidden","copy_paste","right_click"]),
      detail: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("violations").insert({
      exam_id: data.examId,
      student_id: userId,
      violation: data.violation as any,
      detail: data.detail ?? null,
    });
    return { ok: true };
  });
