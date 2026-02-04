import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { getPosUser } from "@/lib/posAuth";

type Role = "admin" | "gerente" | "cajero";

type Props = {
  children: ReactNode;
  allowedRoles?: Role[];
};

export default function ProtectedRoute({ children, allowedRoles }: Props) {

  const user = getPosUser();

  // Si no hay usuario → al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si la ruta pide roles específicos
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}
