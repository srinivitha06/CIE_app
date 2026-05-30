import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertQuestionsFn, deleteQuestionFn, listExamQuestionsFn,
  listStudentsFn, assignExamFn, unassignExamFn, toggleLockFn,
  examReportFn, updateExamFn, deleteExamFn, listClassesFn, studentViolationsFn,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Lock, Unlock, Download, FileText, ShieldAlert, X } from "lucide-react";
import { generateExamReportPdf, generateStudentResultPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/admin/exams/$examId")({
  head: () => ({ meta: [{ title: "Manage exam · Admin" }] }),
  component: ManageExam,
});

function ManageExam() {
  const { examId } = Route.useParams();
  const [tab, setTab] = useState<"settings" | "questions" | "assign" | "results">("questions");

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <div className="mt-4 flex gap-1 border-b border-border">
        {(["questions", "assign", "results", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "questions" && <QuestionsTab examId={examId} />}
        {tab === "assign" && <AssignTab examId={examId} />}
        {tab === "results" && <ResultsTab examId={examId} />}
        {tab === "settings" && <SettingsTab examId={examId} />}
      </div>
    </div>
  );
}

function QuestionsTab({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listExamQuestionsFn);
  const upsert = useServerFn(upsertQuestionsFn);
  const del = useServerFn(deleteQuestionFn);

  const { data, isLoading } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => list({ data: { exam_id: examId } }),
  });

  const [q, setQ] = useState({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" as "A"|"B"|"C"|"D", marks: 1 });
  const [csv, setCsv] = useState("");

  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsert({ data: { exam_id: examId, questions: [q] } });
      toast.success("Question added");
      setQ({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", marks: 1 });
      qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
    } catch (e: any) { toast.error(e.message); }
  };

  const importCsv = async () => {
    const lines = csv.trim().split("\n").filter(Boolean);
    const parsed: any[] = [];
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 6) continue;
      const [question_text, option_a, option_b, option_c, option_d, correct_option, marks] = cols;
      parsed.push({ question_text, option_a, option_b, option_c, option_d, correct_option: correct_option.toUpperCase(), marks: parseInt(marks ?? "1") || 1 });
    }
    if (!parsed.length) return toast.error("No valid rows");
    try {
      const res = await upsert({ data: { exam_id: examId, questions: parsed } });
      toast.success(`Imported ${res.inserted} questions`);
      setCsv("");
      qc.invalidateQueries({ queryKey: ["exam-questions", examId] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <div>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-3">
            {(data?.questions ?? []).map((qq: any, i: number) => (
              <div key={qq.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{i+1}. {qq.question_text}</p>
                  <button onClick={async () => { await del({ data: { id: qq.id } }); qc.invalidateQueries({ queryKey: ["exam-questions", examId] }); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                  {(["A","B","C","D"] as const).map((opt) => (
                    <div key={opt} className={opt === qq.correct_option ? "text-success font-medium" : ""}>
                      {opt}. {qq[`option_${opt.toLowerCase()}`]}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(data?.questions ?? []).length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
          </div>
        )}
      </div>
      <div className="space-y-6">
        <form onSubmit={addOne} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add question</h3>
          <textarea required placeholder="Question" rows={2} value={q.question_text} onChange={(e) => setQ({ ...q, question_text: e.target.value })} className="inp" />
          {(["a","b","c","d"] as const).map((k) => (
            <input key={k} required placeholder={`Option ${k.toUpperCase()}`} value={(q as any)[`option_${k}`]} onChange={(e) => setQ({ ...q, [`option_${k}`]: e.target.value } as any)} className="inp" />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <select value={q.correct_option} onChange={(e) => setQ({ ...q, correct_option: e.target.value as any })} className="inp">
              {["A","B","C","D"].map((o) => <option key={o} value={o}>Correct: {o}</option>)}
            </select>
            <input type="number" min={1} value={q.marks} onChange={(e) => setQ({ ...q, marks: parseInt(e.target.value) || 1 })} className="inp" />
          </div>
          <button className="h-9 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1"><Plus className="h-3 w-3"/>Add</button>
        </form>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Bulk CSV import</h3>
          <p className="text-xs text-muted-foreground">Format: question,a,b,c,d,correct,marks</p>
          <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder='"What is 2+2?",2,3,4,5,C,1' className="inp font-mono text-[11px]" />
          <button onClick={importCsv} className="h-9 w-full rounded-md border border-border bg-background text-xs font-medium hover:bg-secondary">Import CSV</button>
        </div>
      </div>
      <style>{`.inp { display:block; width:100%; min-height:2.25rem; border-radius:0.375rem; border:1px solid var(--color-input); background:var(--color-background); padding:0.4rem 0.625rem; font-size:0.8rem; outline:none; } .inp:focus { box-shadow:0 0 0 2px var(--color-ring); }`}</style>
    </div>
  );
}

function AssignTab({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const listSt = useServerFn(listStudentsFn);
  const assign = useServerFn(assignExamFn);
  const unassign = useServerFn(unassignExamFn);
  const lockFn = useServerFn(toggleLockFn);
  const [search, setSearch] = useState("");

  const studentsQ = useQuery({ queryKey: ["students", search], queryFn: () => listSt({ data: { search } }) });
  const assignedQ = useQuery({
    queryKey: ["assigned", examId],
    queryFn: async () => {
      const { data } = await supabase.from("assigned_tests").select("student_id, locked, profiles(full_name, email, roll_number)").eq("exam_id", examId);
      return data ?? [];
    },
  });

  const assignedIds = new Set((assignedQ.data ?? []).map((a: any) => a.student_id));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Available students</h3>
        <input placeholder="Search by name, email, roll…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        <div className="space-y-1 max-h-[500px] overflow-y-auto rounded-lg border border-border bg-card p-2">
          {(studentsQ.data?.students ?? []).filter((s: any) => !assignedIds.has(s.id)).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary">
              <div><p className="font-medium">{s.full_name || s.email}</p><p className="text-xs text-muted-foreground">{s.email}</p></div>
              <button onClick={async () => { await assign({ data: { exam_id: examId, student_ids: [s.id] } }); qc.invalidateQueries({ queryKey: ["assigned", examId] }); toast.success("Assigned"); }} className="text-xs font-medium text-accent hover:underline">Assign</button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Assigned ({(assignedQ.data ?? []).length})</h3>
        <div className="space-y-1 max-h-[540px] overflow-y-auto rounded-lg border border-border bg-card p-2">
          {(assignedQ.data ?? []).map((a: any) => (
            <div key={a.student_id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary">
              <div><p className="font-medium">{a.profiles?.full_name || a.profiles?.email}</p><p className="text-xs text-muted-foreground">{a.profiles?.email}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={async () => { await lockFn({ data: { exam_id: examId, student_id: a.student_id, locked: !a.locked } }); qc.invalidateQueries({ queryKey: ["assigned", examId] }); }} className="text-muted-foreground hover:text-foreground">
                  {a.locked ? <Lock className="h-3.5 w-3.5 text-destructive" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
                <button onClick={async () => { await unassign({ data: { exam_id: examId, student_id: a.student_id } }); qc.invalidateQueries({ queryKey: ["assigned", examId] }); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsTab({ examId }: { examId: string }) {
  const report = useServerFn(examReportFn);
  const { data, isLoading } = useQuery({ queryKey: ["exam-report", examId], queryFn: () => report({ data: { exam_id: examId } }) });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const profileMap = new Map(data.profiles.map((p: any) => [p.id, p]));
  const resultMap = new Map(data.results.map((r: any) => [r.student_id, r]));
  const violCounts: Record<string, number> = {};
  for (const v of data.violations) violCounts[v.student_id] = (violCounts[v.student_id] ?? 0) + 1;

  const exportCsv = () => {
    const rows = [["Name","Email","Roll","Score","Total","Correct","Violations","Auto-submitted","Submitted at"]];
    for (const a of data.assignments) {
      const p = profileMap.get(a.student_id) as any;
      const r = resultMap.get(a.student_id) as any;
      rows.push([
        p?.full_name ?? "", p?.email ?? "", p?.roll_number ?? "",
        r?.score ?? "", r?.total_marks ?? "", r?.correct_count ?? "",
        String(violCounts[a.student_id] ?? 0),
        r?.auto_submitted ? "yes" : "",
        r?.submitted_at ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${data.exam?.title || "results"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{data.assignments.length} assigned · {data.results.length} submitted</p>
        <button onClick={exportCsv} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"><Download className="h-3 w-3" /> Export CSV</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-left font-medium">Student</th>
            <th className="px-3 py-2 text-left font-medium">Score</th>
            <th className="px-3 py-2 text-left font-medium">Correct</th>
            <th className="px-3 py-2 text-left font-medium">Violations</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr></thead>
          <tbody>
            {data.assignments.map((a: any) => {
              const p = profileMap.get(a.student_id) as any;
              const r = resultMap.get(a.student_id) as any;
              return (
                <tr key={a.student_id} className="border-t border-border">
                  <td className="px-3 py-2"><p className="font-medium">{p?.full_name || p?.email}</p><p className="text-xs text-muted-foreground">{p?.email}</p></td>
                  <td className="px-3 py-2">{r ? `${r.score}/${r.total_marks}` : "—"}</td>
                  <td className="px-3 py-2">{r ? `${r.correct_count}/${r.total_questions}` : "—"}</td>
                  <td className="px-3 py-2">{violCounts[a.student_id] ?? 0}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{r ? (r.auto_submitted ? "Auto-submitted" : "Submitted") : "Pending"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({ examId }: { examId: string }) {
  const update = useServerFn(updateExamFn);
  const del = useServerFn(deleteExamFn);
  const { data, isLoading } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => (await supabase.from("exams").select("*").eq("id", examId).maybeSingle()).data,
  });
  const [form, setForm] = useState<any>(null);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (data && !form) setForm({
    ...data,
    start_at: data.start_at ? new Date(data.start_at).toISOString().slice(0,16) : "",
    end_at: data.end_at ? new Date(data.end_at).toISOString().slice(0,16) : "",
  });
  if (!form) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update({ data: {
        id: examId,
        title: form.title, description: form.description, category: form.category,
        duration_minutes: form.duration_minutes, timer_enabled: form.timer_enabled,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        is_published: form.is_published,
      }});
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <form onSubmit={save} className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-6">
      <label className="block"><span className="text-xs text-muted-foreground">Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="inp2" /></label>
      <label className="block"><span className="text-xs text-muted-foreground">Description</span><textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="inp2" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-xs text-muted-foreground">Category</span>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="inp2"><option value="aptitude">Aptitude</option><option value="softskill">Softskill</option></select></label>
        <label className="block"><span className="text-xs text-muted-foreground">Duration (min)</span><input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} className="inp2" /></label>
        <label className="block"><span className="text-xs text-muted-foreground">Start</span><input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="inp2" /></label>
        <label className="block"><span className="text-xs text-muted-foreground">End</span><input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="inp2" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.timer_enabled} onChange={(e) => setForm({ ...form, timer_enabled: e.target.checked })} /> Enable timer</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
      <div className="flex gap-2">
        <button className="h-10 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
        <button type="button" onClick={async () => { if (confirm("Delete exam?")) { await del({ data: { id: examId } }); toast.success("Deleted"); window.location.href = "/admin"; } }} className="h-10 rounded-md border border-destructive bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/20">Delete</button>
      </div>
      <style>{`.inp2 { display:block; width:100%; height:2.5rem; border-radius:0.375rem; border:1px solid var(--color-input); background:var(--color-background); padding:0 0.75rem; font-size:0.875rem; outline:none; margin-top:0.25rem;} textarea.inp2 { height:auto; padding:0.5rem 0.75rem; }`}</style>
    </form>
  );
}
