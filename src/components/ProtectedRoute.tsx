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

  // 🚨 CAMBIO CLAVE:
  // Si estamos en /login NO bloquear nunca
  const isLoginRoute = window.location.pathname === "/login";

  if (loading || loadingRole) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando…
      </div>
    );
  }

  // 👇 ESTE ES EL CAMBIO REAL
  if (!user && !isLoginRoute) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
