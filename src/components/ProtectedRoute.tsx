import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Role = "admin" | "gerente" | "cajero";

type Props = {
  children: ReactNode;
  allowedRoles?: Role[];
};

export default function ProtectedRoute({
  children,
  allowedRoles,
}: Props) {
  const { user, loading } = useAuth();

  // ⏳ Esperar a que cargue la sesión
  if (loading) {
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

  // 🚫 Rol no permitido
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/pos" replace />;
  }

  // ✅ Acceso permitido
  return <>{children}</>;
}
