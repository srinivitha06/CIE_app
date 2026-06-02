import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertQuestionsFn, deleteQuestionFn, listExamQuestionsFn, updateQuestionFn, reorderQuestionsFn,
  listStudentsFn, assignExamFn, unassignExamFn, toggleLockFn,
  examReportFn, updateExamFn, deleteExamFn, listClassesFn, studentViolationsFn,
  listGroupsFn, assignGroupsToExamFn,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Lock, Unlock, Download, FileText, ShieldAlert, X, Pencil, ChevronUp, ChevronDown, Check, Users, Loader2 } from "lucide-react";
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

// ====================== QUESTIONS TAB ======================

type QForm = {
  question_text: string; option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: "A" | "B" | "C" | "D"; marks: number;
};
const emptyQ: QForm = { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", marks: 1 };

function QuestionsTab({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listExamQuestionsFn);
  const upsert = useServerFn(upsertQuestionsFn);
  const update = useServerFn(updateQuestionFn);
  const reorder = useServerFn(reorderQuestionsFn);
  const del = useServerFn(deleteQuestionFn);

  const { data, isLoading } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: () => list({ data: { exam_id: examId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["exam-questions", examId] });

  const addMut = useMutation({
    mutationFn: (q: QForm) => upsert({ data: { exam_id: examId, questions: [q] } }),
    onSuccess: () => { toast.success("Question added"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (vars: QForm & { id: string }) => update({ data: vars }),
    onSuccess: () => { toast.success("Question updated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { exam_id: examId, ordered_ids: ids } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message),
  });

  const [q, setQ] = useState<QForm>(emptyQ);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QForm>(emptyQ);
  const [csv, setCsv] = useState("");

  const startEdit = (qq: any) => {
    setEditingId(qq.id);
    setEditForm({
      question_text: qq.question_text, option_a: qq.option_a, option_b: qq.option_b,
      option_c: qq.option_c, option_d: qq.option_d, correct_option: qq.correct_option, marks: qq.marks,
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    const arr = [...(data?.questions ?? [])];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    // Optimistic
    qc.setQueryData(["exam-questions", examId], { questions: arr });
    reorderMut.mutate(arr.map((x: any) => x.id));
  };

  const addOne = (e: React.FormEvent) => {
    e.preventDefault();
    addMut.mutate(q, { onSuccess: () => setQ(emptyQ) });
  };

  const importCsv = async () => {
    const lines = csv.trim().split("\n").filter(Boolean);
    const parsed: QForm[] = [];
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 6) continue;
      const [question_text, option_a, option_b, option_c, option_d, correct_option, marks] = cols;
      parsed.push({ question_text, option_a, option_b, option_c, option_d, correct_option: correct_option.toUpperCase() as any, marks: parseInt(marks ?? "1") || 1 });
    }
    if (!parsed.length) return toast.error("No valid rows");
    try {
      const res = await upsert({ data: { exam_id: examId, questions: parsed } });
      toast.success(`Imported ${res.inserted} questions`);
      setCsv("");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const questions = data?.questions ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <div>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-3">
            {questions.map((qq: any, i: number) => (
              <div key={qq.id} className="rounded-lg border border-border bg-card p-4">
                {editingId === qq.id ? (
                  <div className="space-y-2">
                    <textarea rows={2} value={editForm.question_text} onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })} className="inp" />
                    {(["a","b","c","d"] as const).map((k) => (
                      <input key={k} placeholder={`Option ${k.toUpperCase()}`} value={(editForm as any)[`option_${k}`]} onChange={(e) => setEditForm({ ...editForm, [`option_${k}`]: e.target.value } as any)} className="inp" />
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <select value={editForm.correct_option} onChange={(e) => setEditForm({ ...editForm, correct_option: e.target.value as any })} className="inp">
                        {["A","B","C","D"].map((o) => <option key={o} value={o}>Correct: {o}</option>)}
                      </select>
                      <input type="number" min={1} value={editForm.marks} onChange={(e) => setEditForm({ ...editForm, marks: Math.max(1, parseInt(e.target.value) || 1) })} className="inp" />
                    </div>
                    <div className="flex gap-2">
                      <button disabled={updateMut.isPending} onClick={() => updateMut.mutate({ id: qq.id, ...editForm }, { onSuccess: () => setEditingId(null) })} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                        {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{i + 1}. {qq.question_text}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <button title="Move up" disabled={i === 0 || reorderMut.isPending} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                        <button title="Move down" disabled={i === questions.length - 1 || reorderMut.isPending} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                        <button title="Edit" onClick={() => startEdit(qq)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button title="Delete" onClick={() => { if (confirm("Delete this question?")) delMut.mutate(qq.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      {(["A","B","C","D"] as const).map((opt) => (
                        <div key={opt} className={opt === qq.correct_option ? "text-success font-medium" : ""}>
                          {opt}. {qq[`option_${opt.toLowerCase()}`]}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">Marks: {qq.marks}</p>
                  </>
                )}
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
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
            <input type="number" min={1} value={q.marks} onChange={(e) => setQ({ ...q, marks: Math.max(1, parseInt(e.target.value) || 1) })} className="inp" />
          </div>
          <button disabled={addMut.isPending} className="h-9 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1 disabled:opacity-50">
            {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
          </button>
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

// ====================== ASSIGN TAB ======================

function AssignTab({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const listSt = useServerFn(listStudentsFn);
  const listCls = useServerFn(listClassesFn);
  const listGrp = useServerFn(listGroupsFn);
  const assign = useServerFn(assignExamFn);
  const unassign = useServerFn(unassignExamFn);
  const lockFn = useServerFn(toggleLockFn);
  const assignGroups = useServerFn(assignGroupsToExamFn);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => listCls() });
  const groupsQ = useQuery({ queryKey: ["groups"], queryFn: () => listGrp() });
  const studentsQ = useQuery({
    queryKey: ["students", search, classFilter],
    queryFn: () => listSt({ data: { search, class_name: classFilter || undefined } }),
  });
  const assignedQ = useQuery({
    queryKey: ["assigned", examId],
    queryFn: async () => {
      const { data } = await supabase.from("assigned_tests").select("student_id, locked, profiles(full_name, email, roll_number, class_name)").eq("exam_id", examId);
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assigned", examId] });
  const assignedMap = new Map((assignedQ.data ?? []).map((a: any) => [a.student_id, a]));
  const assignedCount = (assignedQ.data ?? []).length;

  const assignMut = useMutation({
    mutationFn: (studentId: string) => assign({ data: { exam_id: examId, student_ids: [studentId] } }),
    onSuccess: () => { toast.success("Assigned"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const unassignMut = useMutation({
    mutationFn: (studentId: string) => unassign({ data: { exam_id: examId, student_id: studentId } }),
    onSuccess: () => { toast.success("Unassigned"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bulkAssign = useMutation({
    mutationFn: (ids: string[]) => assign({ data: { exam_id: examId, student_ids: ids } }),
    onSuccess: (_r, ids) => { toast.success(`Assigned ${ids.length} student(s)`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const groupAssignMut = useMutation({
    mutationFn: (groupIds: string[]) => assignGroups({ data: { exam_id: examId, group_ids: groupIds } }),
    onSuccess: (r) => { toast.success(`Assigned ${r.assigned} student(s) from groups`); setSelectedGroups([]); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAssign = (studentId: string) => {
    if (assignedMap.has(studentId)) {
      if (confirm("Unassign this student from the exam?")) unassignMut.mutate(studentId);
    } else {
      assignMut.mutate(studentId);
    }
  };

  const visible = studentsQ.data?.students ?? [];
  const visibleUnassigned = visible.filter((s: any) => !assignedMap.has(s.id));

  const assignAllVisible = () => {
    if (!visibleUnassigned.length) return;
    bulkAssign.mutate(visibleUnassigned.map((s: any) => s.id));
  };

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Assigned to {assignedCount} student{assignedCount === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* Group assignment */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Assign by group / cohort</h3>
          <Link to="/admin/groups" className="text-xs font-medium text-accent hover:underline">Manage groups →</Link>
        </div>
        {(groupsQ.data?.groups ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No groups yet. Create groups to bulk-assign exams.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(groupsQ.data?.groups ?? []).map((g: any) => {
                const checked = selectedGroups.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => setSelectedGroups((s) => checked ? s.filter((x) => x !== g.id) : [...s, g.id])} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-secondary"}`}>
                    {checked && <Check className="h-3 w-3" />} {g.name} <span className="text-muted-foreground">({g.member_count})</span>
                  </button>
                );
              })}
            </div>
            <button disabled={!selectedGroups.length || groupAssignMut.isPending} onClick={() => groupAssignMut.mutate(selectedGroups)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {groupAssignMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Assign selected groups
            </button>
          </>
        )}
      </div>

      {/* Student list */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Students</h3>
        <div className="mb-3 grid grid-cols-[1fr_140px] gap-2">
          <input placeholder="Search by name, email, roll…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">All classes</option>
            {(classesQ.data?.classes ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {classFilter && visibleUnassigned.length > 0 && (
          <button onClick={assignAllVisible} disabled={bulkAssign.isPending} className="mb-2 inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {bulkAssign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Assign all in "{classFilter}" ({visibleUnassigned.length})
          </button>
        )}
        <div className="space-y-1 max-h-[540px] overflow-y-auto rounded-lg border border-border bg-card p-2">
          {studentsQ.isLoading ? (
            <p className="px-3 py-4 text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">No matching students.</p>
          ) : visible.map((s: any) => {
            const assigned = assignedMap.get(s.id) as any | undefined;
            const isPending = (assignMut.isPending && assignMut.variables === s.id) || (unassignMut.isPending && unassignMut.variables === s.id);
            return (
              <div key={s.id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary">
                <div>
                  <p className="font-medium">{s.full_name || s.email}</p>
                  <p className="text-xs text-muted-foreground">{s.email}{s.class_name ? ` · ${s.class_name}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {assigned && (
                    <button title={assigned.locked ? "Unlock" : "Lock"} onClick={async () => { await lockFn({ data: { exam_id: examId, student_id: s.id, locked: !assigned.locked } }); invalidate(); }} className="text-muted-foreground hover:text-foreground">
                      {assigned.locked ? <Lock className="h-3.5 w-3.5 text-destructive" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    disabled={isPending}
                    onClick={() => toggleAssign(s.id)}
                    className={`inline-flex h-7 min-w-[88px] items-center justify-center gap-1 rounded-md px-3 text-xs font-medium transition disabled:opacity-50 ${assigned ? "bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                  >
                    {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : assigned ? <><Check className="h-3 w-3" /> Assigned</> : "Assign"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ====================== RESULTS TAB (unchanged) ======================

function ResultsTab({ examId }: { examId: string }) {
  const report = useServerFn(examReportFn);
  const { data, isLoading } = useQuery({ queryKey: ["exam-report", examId], queryFn: () => report({ data: { exam_id: examId } }) });
  const [classFilter, setClassFilter] = useState("");
  const [violationFor, setViolationFor] = useState<string | null>(null);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const profileMap = new Map(data.profiles.map((p: any) => [p.id, p]));
  const resultMap = new Map(data.results.map((r: any) => [r.student_id, r]));
  const violCounts: Record<string, number> = {};
  for (const v of data.violations) violCounts[v.student_id] = (violCounts[v.student_id] ?? 0) + 1;

  const classes = Array.from(new Set(data.profiles.map((p: any) => p.class_name).filter(Boolean))).sort() as string[];
  const filteredAssignments = data.assignments.filter((a: any) => {
    if (!classFilter) return true;
    const p = profileMap.get(a.student_id) as any;
    return p?.class_name === classFilter;
  });

  const buildRows = () => filteredAssignments.map((a: any) => {
    const p = profileMap.get(a.student_id) as any;
    const r = resultMap.get(a.student_id) as any;
    return {
      name: p?.full_name ?? "", email: p?.email ?? "", roll: p?.roll_number ?? "", class_name: p?.class_name ?? "",
      score: String(r?.score ?? ""), total: String(r?.total_marks ?? ""), correct: String(r?.correct_count ?? ""),
      violations: violCounts[a.student_id] ?? 0,
      status: r ? (r.auto_submitted ? "Auto-submitted" : "Submitted") : "Pending",
    };
  });

  const exportCsv = () => {
    const rows = [["Name","Email","Roll","Class","Score","Total","Correct","Violations","Status","Submitted at"]];
    for (const a of filteredAssignments) {
      const p = profileMap.get(a.student_id) as any;
      const r = resultMap.get(a.student_id) as any;
      rows.push([
        p?.full_name ?? "", p?.email ?? "", p?.roll_number ?? "", p?.class_name ?? "",
        String(r?.score ?? ""), String(r?.total_marks ?? ""), String(r?.correct_count ?? ""),
        String(violCounts[a.student_id] ?? 0),
        r ? (r.auto_submitted ? "Auto-submitted" : "Submitted") : "Pending",
        r?.submitted_at ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${data.exam?.title || "results"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => generateExamReportPdf({ exam: data.exam ?? {}, rows: buildRows() });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{filteredAssignments.length} of {data.assignments.length} assigned · {data.results.length} submitted</p>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"><Download className="h-3 w-3" /> CSV</button>
          <button onClick={exportPdf} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary"><FileText className="h-3 w-3" /> PDF</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr>
            <th className="px-3 py-2 text-left font-medium">Student</th>
            <th className="px-3 py-2 text-left font-medium">Class</th>
            <th className="px-3 py-2 text-left font-medium">Score</th>
            <th className="px-3 py-2 text-left font-medium">Correct</th>
            <th className="px-3 py-2 text-left font-medium">Violations</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr></thead>
          <tbody>
            {filteredAssignments.map((a: any) => {
              const p = profileMap.get(a.student_id) as any;
              const r = resultMap.get(a.student_id) as any;
              const vCount = violCounts[a.student_id] ?? 0;
              return (
                <tr key={a.student_id} className="border-t border-border">
                  <td className="px-3 py-2"><p className="font-medium">{p?.full_name || p?.email}</p><p className="text-xs text-muted-foreground">{p?.email}</p></td>
                  <td className="px-3 py-2 text-muted-foreground">{p?.class_name || "—"}</td>
                  <td className="px-3 py-2">{r ? `${r.score}/${r.total_marks}` : "—"}</td>
                  <td className="px-3 py-2">{r ? `${r.correct_count}/${r.total_questions}` : "—"}</td>
                  <td className="px-3 py-2">
                    {vCount > 0 ? (
                      <button onClick={() => setViolationFor(a.student_id)} className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/20">
                        <ShieldAlert className="h-3 w-3" /> {vCount} · view
                      </button>
                    ) : <span className="text-xs text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{r ? (r.auto_submitted ? "Auto-submitted" : "Submitted") : "Pending"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r && <button onClick={() => setViolationFor(a.student_id)} className="text-xs font-medium text-accent hover:underline">Details</button>}
                  </td>
                </tr>
              );
            })}
            {filteredAssignments.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-muted-foreground">No students match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {violationFor && (
        <ViolationDialog examId={examId} studentId={violationFor} examMeta={data.exam} onClose={() => setViolationFor(null)} />
      )}
    </div>
  );
}

function ViolationDialog({ examId, studentId, examMeta, onClose }: { examId: string; studentId: string; examMeta: any; onClose: () => void }) {
  const fn = useServerFn(studentViolationsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["student-violations", examId, studentId],
    queryFn: () => fn({ data: { exam_id: examId, student_id: studentId } }),
  });

  const downloadPdf = () => {
    if (!data?.result) return toast.error("Student hasn't submitted yet");
    generateStudentResultPdf({
      exam: { title: examMeta?.title, category: examMeta?.category },
      student: data.profile ?? {},
      result: data.result,
      violations: data.violations,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Student details & violation log</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{examMeta?.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {isLoading || !data ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-md border border-border bg-background p-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Name</dt><dd>{data.profile?.full_name || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate">{data.profile?.email || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Roll</dt><dd>{data.profile?.roll_number || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Class</dt><dd>{data.profile?.class_name || "—"}</dd></div>
              {data.result && (
                <>
                  <div><dt className="text-xs text-muted-foreground">Score</dt><dd>{data.result.score}/{data.result.total_marks}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd>{new Date(data.result.submitted_at).toLocaleString()}</dd></div>
                </>
              )}
            </dl>
            <div className="mt-5 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Violation log ({data.violations.length})</h4>
              <button onClick={downloadPdf} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary">
                <FileText className="h-3 w-3" /> Download PDF
              </button>
            </div>
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              {data.violations.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No violations recorded for this student.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Detail</th><th className="px-3 py-2 text-left">Time</th></tr>
                  </thead>
                  <tbody>
                    {data.violations.map((v: any, i: number) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2"><span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">{v.violation}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{v.detail || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(v.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ====================== SETTINGS TAB ======================

function SettingsTab({ examId }: { examId: string }) {
  const qc = useQueryClient();
  const update = useServerFn(updateExamFn);
  const del = useServerFn(deleteExamFn);
  const { data, isLoading } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => (await supabase.from("exams").select("*").eq("id", examId).maybeSingle()).data,
  });
  const [form, setForm] = useState<any>(null);

  // Initialize form once data loads (no setState during render bug)
  useEffect(() => {
    if (data && !form) {
      setForm({
        ...data,
        duration_minutes: data.duration_minutes ?? 30,
        start_at: data.start_at ? toLocalInput(data.start_at) : "",
        end_at: data.end_at ? toLocalInput(data.end_at) : "",
      });
    }
  }, [data, form]);

  const saveMut = useMutation({
    mutationFn: async (f: any) => update({ data: {
      id: examId,
      title: f.title, description: f.description, category: f.category,
      duration_minutes: f.duration_minutes,
      timer_enabled: f.timer_enabled,
      start_at: f.start_at ? new Date(f.start_at).toISOString() : null,
      end_at: f.end_at ? new Date(f.end_at).toISOString() : null,
      is_published: f.is_published,
    }}),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["exam", examId] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <p className="text-sm text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Loading…</p>;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const dur = parseInt(String(form.duration_minutes));
    if (!Number.isFinite(dur) || dur < 1 || dur > 600) {
      return toast.error("Duration must be between 1 and 600 minutes");
    }
    saveMut.mutate({ ...form, duration_minutes: dur });
  };

  return (
    <form onSubmit={save} className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-6">
      <label className="block"><span className="text-xs text-muted-foreground">Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="inp2" /></label>
      <label className="block"><span className="text-xs text-muted-foreground">Description</span><textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="inp2" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-xs text-muted-foreground">Category</span>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="inp2"><option value="aptitude">Aptitude</option><option value="softskill">Softskill</option></select></label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Duration (min)</span>
          <input
            type="number" min={1} max={600} required
            value={form.duration_minutes ?? ""}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1) })}
            className="inp2"
          />
        </label>
        <label className="block"><span className="text-xs text-muted-foreground">Start</span><input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="inp2" /></label>
        <label className="block"><span className="text-xs text-muted-foreground">End</span><input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="inp2" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.timer_enabled} onChange={(e) => setForm({ ...form, timer_enabled: e.target.checked })} /> Enable timer</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Published</label>
      <div className="flex gap-2">
        <button disabled={saveMut.isPending} className="h-10 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-1">
          {saveMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Save
        </button>
        <button type="button" onClick={async () => { if (confirm("Delete exam?")) { await del({ data: { id: examId } }); toast.success("Deleted"); window.location.href = "/admin"; } }} className="h-10 rounded-md border border-destructive bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/20">Delete</button>
      </div>
      <style>{`.inp2 { display:block; width:100%; height:2.5rem; border-radius:0.375rem; border:1px solid var(--color-input); background:var(--color-background); padding:0 0.75rem; font-size:0.875rem; outline:none; margin-top:0.25rem;} textarea.inp2 { height:auto; padding:0.5rem 0.75rem; }`}</style>
    </form>
  );
}

// Convert ISO to local datetime-local input value (preserves local time)
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
