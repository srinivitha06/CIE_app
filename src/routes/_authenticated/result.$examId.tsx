import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ArrowLeft, Download } from "lucide-react";
import { generateStudentResultPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/result/$examId")({
  head: () => ({ meta: [{ title: "Exam result · CIE Exam Portal" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { examId } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["result", examId, user?.id],
    queryFn: async () => {
      const [{ data: result }, { data: exam }, { data: violations }] = await Promise.all([
        supabase.from("results").select("*").eq("exam_id", examId).eq("student_id", user!.id).maybeSingle(),
        supabase.from("exams").select("*").eq("id", examId).maybeSingle(),
        supabase.from("violations").select("violation").eq("exam_id", examId).eq("student_id", user!.id),
      ]);
      return { result, exam, violations: violations ?? [] };
    },
    enabled: !!user,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.result) return <p className="text-sm text-muted-foreground">No result found.</p>;

  const { result, exam, violations } = data;
  const pct = result.total_marks ? Math.round((result.score / result.total_marks) * 100) : 0;
  const passed = pct >= 50;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to dashboard
      </Link>
      <div className="mt-4 rounded-lg border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{exam?.category}</span>
        <h1 className="mt-1 text-2xl font-bold">{exam?.title}</h1>

        <div className="mt-8 flex items-center gap-6">
          <div className={`flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold ${passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {pct}%
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {passed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
              {passed ? "Passed" : "Did not pass"}
            </div>
            <p className="mt-1 text-2xl font-bold">{result.score} <span className="text-base font-normal text-muted-foreground">/ {result.total_marks}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{result.correct_count} of {result.total_questions} correct</p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 text-sm">
          <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd>{new Date(result.submitted_at).toLocaleString()}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Mode</dt><dd>{result.auto_submitted ? "Auto-submitted" : "Manual"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Violations</dt><dd>{violations.length}</dd></div>
        </dl>
      </div>
    </div>
  );
}
