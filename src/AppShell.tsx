import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AppShell() {
  const { user, signOut, role, loadingRole } = useAuth();

  if (!user || loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <span className="text-gray-500">Cargando sesión…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">
            Punto Claro POS
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {user.email}
          </p>
          <p className="text-xs text-gray-400 capitalize">
            Rol: {role}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1 text-sm">
          {/* ADMIN */}
          {role === "admin" && (
            <>
              <NavLink
                to="/app/admin"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded ${
                    isActive
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`
                }
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/app/inventory"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded ${
                    isActive
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`
                }
              >
                Inventario
              </NavLink>

              <NavLink
                to="/app/sales"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded ${
                    isActive
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`
                }
              >
                Ventas
              </NavLink>

              {/* 🆕 Reportes (solo Admin) */}
              <NavLink
                to="/app/reports"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded ${
                    isActive
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`
                }
              >
                Reportes
              </NavLink>
            </>
          )}

          {/* GERENTE */}
          {role === "gerente" && (
            <>
              <NavLink
                to="/app/gerente"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded ${
                    isActive
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`
                }
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/app/inventory"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded ${
                    isActive
                      ? "bg-gray-200 font-medium"
                      : "hover:bg-gray-100"
                  }`
                }
              >
                Inventario
              </NavLink>
            </>
          )}

          {/* CAJERO */}
          {role === "cajero" && (
            <NavLink
              to="/app/pos"
              className={({ isActive }) =>
                `block px-3 py-2 rounded ${
                  isActive
                    ? "bg-gray-200 font-medium"
                    : "hover:bg-gray-100"
                }`
              }
            >
              Punto de Venta
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={signOut}
            className="w-full text-sm text-red-600 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center px-6">
          <h2 className="text-sm font-medium text-gray-700 capitalize">
            {role}
          </h2>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
