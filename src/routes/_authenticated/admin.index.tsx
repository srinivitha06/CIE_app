import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { duplicateExamFn, shareExamByEmailFn } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Users, FileText, BarChart3, Copy, Share2, Loader2, X, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin · CIE Exam Portal" }] }),
  component: AdminHome,
});

function AdminHome() {
  const qc = useQueryClient();
  const duplicate = useServerFn(duplicateExamFn);
  const share = useServerFn(shareExamByEmailFn);
  const [shareFor, setShareFor] = useState<{ id: string; title: string } | null>(null);
  const [shareEmail, setShareEmail] = useState("");

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
        supabase.from("exams").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      return { examsCount, studentsCount, resultsCount, exams: exams ?? [] };
    },
    retry: false,
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => duplicate({ data: { exam_id: id } }),
    onSuccess: (r) => { toast.success(`Duplicated as "${r.exam.title}"`); qc.invalidateQueries({ queryKey: ["admin-overview"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const shareMut = useMutation({
    mutationFn: (vars: { exam_id: string; email: string }) => share({ data: vars }),
    onSuccess: (r) => {
      toast.success(`Shared with ${r.recipient}. They now have an independent copy.`);
      setShareFor(null); setShareEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You see only the exams you created. Use share or duplicate to give other staff their own copy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/groups"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-secondary"
          >
            <Users className="h-4 w-4" /> Groups
          </Link>
          <Link
            to="/admin/exams/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New exam
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={FileText} label="My exams" value={data?.examsCount ?? 0} />
        <Stat icon={Users} label="Students" value={data?.studentsCount ?? 0} />
        <Stat icon={BarChart3} label="Submissions" value={data?.resultsCount ?? 0} />
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold">My exams</h2>
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
                  <div className="inline-flex items-center gap-3">
                    <button
                      title="Duplicate exam"
                      disabled={dupMut.isPending && dupMut.variables === e.id}
                      onClick={() => dupMut.mutate(e.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {dupMut.isPending && dupMut.variables === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} Duplicate
                    </button>
                    <button
                      title="Share with another staff member"
                      onClick={() => { setShareFor({ id: e.id, title: e.title }); setShareEmail(""); }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Share2 className="h-3 w-3" /> Share
                    </button>
                    <Link
                      to="/admin/exams/$examId"
                      params={{ examId: e.id }}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Manage →
                    </Link>
                  </div>
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

      {shareFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShareFor(null)}>
          <div onClick={(ev) => ev.stopPropagation()} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Share "{shareFor.title}"</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The recipient gets their own independent copy. Changes on either copy do not sync.
                </p>
              </div>
              <button onClick={() => setShareFor(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-4 block text-xs font-medium">Staff email</label>
            <input
              type="email" autoFocus
              value={shareEmail}
              onChange={(ev) => setShareEmail(ev.target.value)}
              placeholder="colleague@school.edu"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShareFor(null)} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs hover:bg-secondary">Cancel</button>
              <button
                disabled={!shareEmail.trim() || shareMut.isPending}
                onClick={() => shareMut.mutate({ exam_id: shareFor.id, email: shareEmail.trim() })}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {shareMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />} Share copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
