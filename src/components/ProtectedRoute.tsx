export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading, role, loadingRole } = useAuth();

  // 🛑 Si ya terminó de cargar y NO hay usuario → ir a login
  if (!loading && !loadingRole && !user) {
    return <Navigate to="/login" replace />;
  }

  // ⏳ Esperar a que auth y role estén listos
  if (loading || loadingRole) {
    return (
      <div className="p-6 text-center text-gray-500">
        Cargando…
      </div>
    );
  }

  // 🔒 Bloqueo por rol
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
