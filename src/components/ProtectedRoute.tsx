import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Role = "admin" | "gerente" | "cajero";

type Props = {
  children: ReactNode;
  allowedRoles?: Role[];
};

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading, role, loadingRole } = useAuth();

  // ⏳ Esperar a que auth y role estén listos
  if (loading || loadingRole) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando…
      </div>
    );
  }

  // 🚫 No autenticado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🔒 Bloqueo por rol
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
