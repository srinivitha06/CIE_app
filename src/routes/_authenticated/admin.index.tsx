import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, FileText, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin · CIE Exam Portal" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [
        { count: examsCount },
        { count: studentsCount },
        { count: resultsCount },
        { data: exams },
      ] = await Promise.all([
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("results").select("id", { count: "exact", head: true }),
        supabase.from("exams").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return { examsCount, studentsCount, resultsCount, exams: exams ?? [] };
    },
    retry: false,
  });

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage assessments, questions, assignments and results.
          </p>
        </div>
        <Link
          to="/admin/exams/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New exam
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={FileText} label="Exams" value={data?.examsCount ?? 0} />
        <Stat icon={Users} label="Students" value={data?.studentsCount ?? 0} />
        <Stat icon={BarChart3} label="Submissions" value={data?.resultsCount ?? 0} />
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold">All exams</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Questions</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(data?.exams ?? []).map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{e.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.category}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.duration_minutes} min</td>
                <td className="px-4 py-3 text-muted-foreground">{e.total_questions}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${e.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {e.is_published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/admin/exams/$examId"
                    params={{ examId: e.id }}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {(data?.exams ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No exams yet. Create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
