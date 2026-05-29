import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createExamFn } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/exams/new")({
  head: () => ({ meta: [{ title: "New exam · Admin" }] }),
  component: NewExam,
});

function NewExam() {
  const navigate = useNavigate();
  const create = useServerFn(createExamFn);
  const [form, setForm] = useState({
    title: "", description: "", category: "aptitude" as "aptitude" | "softskill",
    duration_minutes: 30, timer_enabled: true, start_at: "", end_at: "", is_published: false,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { exam } = await create({
        data: {
          ...form,
          start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
          end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        },
      });
      toast.success("Exam created");
      navigate({ to: "/admin/exams/$examId", params: { examId: exam.id } });
    } catch (e: any) {
      toast.error(e.message || "Failed to create");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Create exam</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6">
        <Field label="Title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" /></Field>
        <Field label="Description"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="input">
              <option value="aptitude">Aptitude</option>
              <option value="softskill">Softskill</option>
            </select>
          </Field>
          <Field label="Duration (minutes)">
            <input type="number" min={1} required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} className="input" />
          </Field>
          <Field label="Start at"><input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="input" /></Field>
          <Field label="End at"><input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="input" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.timer_enabled} onChange={(e) => setForm({ ...form, timer_enabled: e.target.checked })} /> Enable timer
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> Publish immediately
        </label>
        <button disabled={busy} className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Creating…" : "Create exam"}
        </button>
      </form>
      <style>{`.input { display:block; width:100%; height:2.5rem; border-radius:0.375rem; border:1px solid var(--color-input); background:var(--color-background); padding:0 0.75rem; font-size:0.875rem; outline:none; } textarea.input { height:auto; padding:0.5rem 0.75rem; } .input:focus { box-shadow:0 0 0 2px var(--color-ring); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
