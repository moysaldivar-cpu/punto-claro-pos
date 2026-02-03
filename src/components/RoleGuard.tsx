import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  allowed: ("admin" | "gerente" | "cajero")[];
  children: ReactNode;
};

export default function RoleGuard({ allowed, children }: Props) {
  const { role } = useAuth();

  if (!role) {
    return <div>Cargando permisos...</div>;
  }

  if (!allowed.includes(role as any)) {
    return <Navigate to="/app/pos" replace />;
  }

  return <>{children}</>;
}
