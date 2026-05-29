import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · CIE Exam Portal" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (user) {
      navigate({ to: role === "admin" ? "/admin" : "/dashboard", replace: true });
    }
  }, [user, role, navigate]);

  if (loading) return null;
  if (user) return <Navigate to={role === "admin" ? "/admin" : "/dashboard"} replace />;

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox to verify your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">CIE Exam Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to access your assessments</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full name</label>
                <input
                  required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button disabled={busy} className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in you agree to abide by exam integrity rules.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.85z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.85C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
