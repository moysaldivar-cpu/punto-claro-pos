import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePosAuth } from "@/contexts/AuthContext";

type PosRole = "admin" | "gerente" | "cajero";

type Props = {
  allowed: PosRole[];
  children: ReactNode;
};

export default function RoleGuard({ allowed, children }: Props) {
  const { user, loading } = usePosAuth();

  const role = ((user as any)?.rol ?? (user as any)?.role ?? null) as
    | PosRole
    | null;

  if (loading) {
    return <div>Cargando permisos...</div>;
  }

  if (!user || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowed.includes(role)) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}