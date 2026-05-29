import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Shield, Clock, BarChart3, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CIE Exam Portal — Secure Online Assessments" },
      { name: "description", content: "Conduct Aptitude and Softskill CIE tests with full-screen security, anti-cheat, and instant analytics." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">CIE Exam Portal</span>
          </div>
          <Link to="/login" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3" /> Secure proctoring · Fullscreen enforcement
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Secure online CIE examination<br /> management for training departments.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Run Aptitude and Softskill assessments with fullscreen enforcement, tab-switch detection,
            randomized questions, and instant analytics — built for colleges and placement portals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get started
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Shield, title: "Anti-cheat proctoring", desc: "Fullscreen lock, tab-switch detection, copy/paste & right-click blocking." },
            { icon: Clock, title: "Timed assessments", desc: "Randomized MCQs with auto-submit. Per-exam duration and schedule windows." },
            { icon: BarChart3, title: "Analytics & reports", desc: "Score breakdowns, violations, and exportable reports for every cohort." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} CIE Exam Portal · Training Department
        </div>
      </footer>
    </div>
  );
}
