import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Assessments · CIE Exam Portal" }] }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { user, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", user?.id],
    queryFn: async () => {
      const [{ data: assignments }, { data: results }] = await Promise.all([
        supabase.from("assigned_tests").select("exam_id, locked, exams(*)").eq("student_id", user!.id),
        supabase.from("results").select("*").eq("student_id", user!.id),
      ]);
      const resultMap = new Map((results ?? []).map((r) => [r.exam_id, r]));
      return { assignments: assignments ?? [], resultMap };
    },
    enabled: !!user && role !== "admin",
  });

  if (role === "admin") return <Navigate to="/admin" replace />;

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading your tests…</p>;

  const items = data?.assignments ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">My assessments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Take your assigned tests and view results.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No assessments assigned yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Your training department will assign tests here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((a: any) => {
            const exam = a.exams;
            if (!exam) return null;
            const result = data!.resultMap.get(a.exam_id);
            const done = !!result;
            const now = new Date();
            const notStarted = exam.start_at && new Date(exam.start_at) > now;
            const closed = exam.end_at && new Date(exam.end_at) < now;
            const disabled = done || notStarted || closed || a.locked;
            const statusLabel = done
              ? "Submitted"
              : a.locked ? "Locked"
              : notStarted ? "Opens soon"
              : closed ? "Closed" : "Available";
            const statusClass = done
              ? "bg-success/10 text-success"
              : a.locked || closed ? "bg-destructive/10 text-destructive"
              : notStarted ? "bg-muted text-muted-foreground"
              : "bg-accent/10 text-accent";

            return (
              <div key={a.exam_id} className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{exam.category}</span>
                    <h3 className="mt-1 font-semibold">{exam.title}</h3>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>{statusLabel}</span>
                </div>
                {exam.description && <p className="mt-2 text-xs text-muted-foreground">{exam.description}</p>}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.duration_minutes} min</span>
                  <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {exam.total_questions} Qs</span>
                  {done && <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> {result!.score}/{result!.total_marks}</span>}
                </div>
                <div className="mt-5">
                  {done ? (
                    <Link to="/result/$examId" params={{ examId: a.exam_id }} className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary">
                      View result <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <Link
                      to="/exam/$examId" params={{ examId: a.exam_id }}
                      disabled={disabled as any}
                      className={`inline-flex h-9 items-center gap-1 rounded-md px-4 text-xs font-medium ${disabled ? "pointer-events-none bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                    >
                      Start exam <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
