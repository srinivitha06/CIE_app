import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
