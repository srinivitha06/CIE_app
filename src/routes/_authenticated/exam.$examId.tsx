import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startExamFn, submitExamFn, recordViolationFn, saveProgressFn } from "@/lib/exam.functions";
import { toast } from "sonner";
import { AlertTriangle, Clock, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exam/$examId")({
  head: () => ({ meta: [{ title: "Exam in progress · CIE Exam Portal" }] }),
  component: ExamPage,
});

type Q = {
  id: string;
  question_type: "mcq" | "fill_blank";
  question_text: string;
  options: string[];
  marks: number;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function ExamPage() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const startFn = useServerFn(startExamFn);
  const submitFn = useServerFn(submitExamFn);
  const violationFn = useServerFn(recordViolationFn);
  const saveFn = useServerFn(saveProgressFn);

  const [phase, setPhase] = useState<"intro" | "loading" | "active" | "submitting" | "done">("intro");
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [violations, setViolations] = useState(0);
  const startedAtRef = useRef<string>("");
  const totalSecondsRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const doSubmit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setPhase("submitting");
    try {
      await submitFn({ data: { examId, answers: answersRef.current, autoSubmitted: auto, startedAt: startedAtRef.current } });
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      toast.success(auto ? "Auto-submitted" : "Submitted successfully");
      navigate({ to: "/result/$examId", params: { examId }, replace: true });
    } catch (e: any) {
      toast.error(e.message || "Submit failed");
      submittedRef.current = false;
      setPhase("active");
    }
  }, [examId, navigate, submitFn]);

  const recordV = useCallback((v: string, detail?: string) => {
    setViolations((n) => n + 1);
    violationFn({ data: { examId, violation: v as any, detail } }).catch(() => {});
  }, [examId, violationFn]);

  // Timer
  useEffect(() => {
    if (phase !== "active" || !exam?.timer_enabled) return;
    if (remaining <= 0) { doSubmit(true); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remaining, exam, doSubmit]);

  // Periodic save every 10s
  useEffect(() => {
    if (phase !== "active") return;
    const i = setInterval(() => {
      const elapsed = exam?.timer_enabled ? Math.max(0, totalSecondsRef.current - remaining) : 0;
      saveFn({ data: { examId, answers: answersRef.current, elapsedSeconds: elapsed } }).catch(() => {});
    }, 10000);
    return () => clearInterval(i);
  }, [phase, examId, saveFn, remaining, exam]);

  useEffect(() => {
    if (phase !== "active") return;

    const onVisibility = () => {
      if (document.hidden) {
        recordV("visibility_hidden");
        toast.warning("Tab/app switching detected. This is logged.");
      }
    };
    const onBlur = () => recordV("tab_switch");
    const onFsChange = () => {
      if (!document.fullscreenElement && phase === "active" && !submittedRef.current) {
        recordV("fullscreen_exit");
        toast.error("Fullscreen exited — re-enter or your exam will be auto-submitted.");
        setTimeout(() => {
          if (!document.fullscreenElement && !submittedRef.current) doSubmit(true);
        }, 5000);
      }
    };
    const onContext = (e: MouseEvent) => { e.preventDefault(); recordV("right_click"); };
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); recordV("copy_paste", "copy"); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); recordV("copy_paste", "paste"); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "p", "u", "s"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        recordV("copy_paste", "keyboard");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKey);
    };
  }, [phase, recordV, doSubmit]);

  const beginExam = async () => {
    setPhase("loading");
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Fullscreen is required to start the exam.");
      setPhase("intro");
      return;
    }
    try {
      const res = await startFn({ data: { examId } });
      setExam(res.exam);
      setQuestions(res.questions as Q[]);
      const totalSec = (res.exam.duration_minutes || 0) * 60;
      totalSecondsRef.current = totalSec;
      setRemaining(res.session?.remainingSeconds ?? totalSec);
      setAnswers(res.session?.answers ?? {});
      startedAtRef.current = res.session?.startedAt ?? new Date().toISOString();
      if (res.session?.isResume) toast.info("Resuming your previous session.");
      setPhase("active");
    } catch (e: any) {
      toast.error(e.message || "Could not start exam");
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setPhase("intro");
    }
  };

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold">Exam instructions</h1>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li>• You will enter <strong className="text-foreground">fullscreen mode</strong>. Exiting fullscreen will trigger auto-submit.</li>
            <li>• Tab switching, copy/paste and right-click are <strong className="text-foreground">logged as violations</strong>.</li>
            <li>• A countdown timer will auto-submit your answers when time is up.</li>
            <li>• Progress is auto-saved. If you're allowed to re-enter, you'll resume where you left off.</li>
          </ul>
          <div className="mt-6 flex items-center gap-3">
            <button onClick={beginExam} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Maximize2 className="h-4 w-4" /> Enter fullscreen & start
            </button>
            <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">Cancel</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "loading" || phase === "submitting") {
    return <p className="text-center text-sm text-muted-foreground">{phase === "loading" ? "Preparing exam…" : "Submitting…"}</p>;
  }

  const q = questions[currentIdx];
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const lowTime = remaining < 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="border-b border-border bg-card px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{exam.category} · Question {currentIdx + 1} of {questions.length}</p>
            <h2 className="text-sm font-semibold">{exam.title}</h2>
          </div>
          <div className="flex items-center gap-4">
            {violations > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" /> {violations} violation{violations === 1 ? "" : "s"}
              </span>
            )}
            {exam.timer_enabled && (
              <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-mono font-semibold ${lowTime ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"}`}>
                <Clock className="h-3.5 w-3.5" /> {mm}:{ss}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">{q.question_text}</p>
            {q.question_type === "fill_blank" ? (
              <div className="mt-6">
                <input
                  type="text"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="Type your answer…"
                  className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-2 text-xs text-muted-foreground">Answer is matched case-insensitively.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-2">
                {q.options.map((text, i) => {
                  const opt = LETTERS[i];
                  const sel = answers[q.id] === opt;
                  return (
                    <label key={opt} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${sel ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                      <input type="radio" name={q.id} checked={sel} onChange={() => setAnswers({ ...answers, [q.id]: opt })} className="mt-0.5" />
                      <span><strong className="mr-2">{opt}.</strong>{text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium disabled:opacity-40"
            >Previous</button>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
              {questions.map((qq, i) => (
                <button key={qq.id} onClick={() => setCurrentIdx(i)}
                  className={`h-7 w-7 rounded-md text-[11px] font-medium ${i === currentIdx ? "bg-primary text-primary-foreground" : answers[qq.id] ? "bg-success/15 text-success" : "border border-border bg-background"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            {currentIdx < questions.length - 1 ? (
              <button onClick={() => setCurrentIdx((i) => i + 1)} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Next</button>
            ) : (
              <button onClick={() => doSubmit(false)} className="inline-flex h-10 items-center rounded-md bg-success px-4 text-sm font-medium text-success-foreground hover:opacity-90">Submit</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
