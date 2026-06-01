import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "student" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

async function loadUserRole(userId: string): Promise<Role> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("Unable to load user role", error);
    return null;
  }

  const roles = (data ?? []).map((r) => r.role as string);
  return roles.includes("admin") ? "admin" : roles.includes("student") ? "student" : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let sequence = 0;

    const applySession = async (s: Session | null) => {
      const requestId = ++sequence;
      if (cancelled) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setRole(null);
      const nextRole = await loadUserRole(s.user.id);
      if (cancelled || requestId !== sequence) return;
      setRole(nextRole);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      void applySession(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      void applySession(s);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ user, session, role, loading, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
