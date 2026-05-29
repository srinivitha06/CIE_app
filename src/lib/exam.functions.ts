import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fetch exam + randomized questions (without correct answer) for student to take
export const startExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { examId: string }) => z.object({ examId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify assignment
    const { data: assignment } = await supabase
      .from("assigned_tests")
      .select("id, locked")
      .eq("exam_id", data.examId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!assignment) throw new Error("You are not assigned to this exam.");
    if (assignment.locked) throw new Error("Your access to this exam is locked. Contact your administrator.");

    // Verify exam window
    const { data: exam, error: examErr } = await supabase
      .from("exams").select("*").eq("id", data.examId).maybeSingle();
    if (examErr || !exam) throw new Error("Exam not found.");
    if (!exam.is_published) throw new Error("Exam is not published.");
    const now = new Date();
    if (exam.start_at && new Date(exam.start_at) > now) throw new Error("Exam has not started yet.");
    if (exam.end_at && new Date(exam.end_at) < now) throw new Error("Exam window has closed.");

    // Check existing result
    const { data: existing } = await supabase
      .from("results").select("id, submitted_at").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();
    if (existing) throw new Error("You have already submitted this exam.");

    // Need admin client to fetch questions safely (RLS hides them otherwise)
    // Use server-side admin to fetch question bank, strip correct answer
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions } = await supabaseAdmin
      .from("questions").select("id, question_text, option_a, option_b, option_c, option_d, marks").eq("exam_id", data.examId);

    if (!questions || questions.length === 0) throw new Error("No questions available for this exam.");
    // Shuffle
    const shuffled = [...questions].sort(() => Math.random() - 0.5);

    return { exam, questions: shuffled };
  });

export const submitExamFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { examId: string; answers: Record<string, string>; autoSubmitted?: boolean; startedAt: string }) =>
    z.object({
      examId: z.string().uuid(),
      answers: z.record(z.string(), z.string().regex(/^[A-D]$/)),
      autoSubmitted: z.boolean().optional(),
      startedAt: z.string(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify assignment
    const { data: assignment } = await supabaseAdmin
      .from("assigned_tests").select("id").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();
    if (!assignment) throw new Error("Not assigned.");

    const { data: existing } = await supabaseAdmin
      .from("results").select("id").eq("exam_id", data.examId).eq("student_id", userId).maybeSingle();
    if (existing) throw new Error("Already submitted.");

    const { data: questions } = await supabaseAdmin
      .from("questions").select("id, correct_option, marks").eq("exam_id", data.examId);
    if (!questions) throw new Error("No questions.");

    let score = 0; let total = 0; let correct = 0;
    for (const q of questions) {
      total += q.marks;
      if (data.answers[q.id] && data.answers[q.id] === q.correct_option) {
        score += q.marks;
        correct += 1;
      }
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
